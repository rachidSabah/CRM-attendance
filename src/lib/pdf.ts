import jsPDFRaw, { jsPDF as jsPDFNamed } from 'jspdf';
import autoTableRaw, { autoTable as autoTableNamed } from 'jspdf-autotable';
import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, SchoolInfo, ClassScheduleEntry } from './types';

// Universally resolve jsPDF and autoTable for both Next.js bundling and Node ESM
// @ts-expect-error fallback constructor resolution
const jsPDF: typeof jsPDFNamed = jsPDFNamed || (jsPDFRaw as unknown as { jsPDF: typeof jsPDFNamed })?.jsPDF || jsPDFRaw;
// @ts-expect-error fallback autoTable resolution
const autoTable: typeof autoTableNamed = autoTableNamed || autoTableRaw;

export type Orientation = 'portrait' | 'landscape';

export interface PdfOptions {
  orientation: Orientation | 'auto';
  title: string;
  schoolInfo?: SchoolInfo;
  language?: string;
  columnCount?: number;
  estimatedContentWidthMm?: number;
  format?: 'a4' | 'a3' | 'auto' | [number, number];
}

// ---- Translation helper ----
function t(en: string, fr: string, lang: string): string {
  return lang === 'fr' ? fr : en;
}

export function createSmartDoc(opts: PdfOptions) {
  const cols = opts.columnCount || 6;
  const estWidth = opts.estimatedContentWidthMm || (cols * 22);

  // 1. Determine orientation
  // A4 portrait printable width: ~182mm (210 - 28)
  // A4 landscape printable width: ~269mm (297 - 28)
  let orientation: Orientation = 'portrait';
  if (opts.orientation === 'landscape') {
    orientation = 'landscape';
  } else if (opts.orientation === 'portrait') {
    orientation = 'portrait';
  } else {
    // 'auto': default to landscape if width > 180mm or more than 6 columns
    if (estWidth > 180 || cols > 6) {
      orientation = 'landscape';
    } else {
      orientation = 'portrait';
    }
  }

  // 2. Determine format / page dimension:
  // If landscape content cannot fit on standard A4 (269mm printable width),
  // automatically adapt to A3 (420mm) or custom width so content is never cut off!
  let format: string | [number, number] = 'a4';

  if (opts.format && opts.format !== 'auto') {
    format = opts.format;
  } else {
    const printableNeeded = Math.max(estWidth, cols * 9);
    if (orientation === 'landscape') {
      if (printableNeeded > 269) {
        if (printableNeeded <= 390) {
          format = 'a3';
        } else {
          format = [Math.ceil(printableNeeded + 35), 210];
        }
      }
    } else {
      if (printableNeeded > 182) {
        orientation = 'landscape';
        if (printableNeeded > 269) {
          format = printableNeeded <= 390 ? 'a3' : [Math.ceil(printableNeeded + 35), 210];
        }
      }
    }
  }

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format,
  });

  return {
    doc,
    orientation,
    format,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
  };
}

function createDoc(opts: PdfOptions) {
  return createSmartDoc(opts);
}

function addHeader(doc: jsPDF, opts: PdfOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const lang = opts.language || 'en';
  let yPos = 10;

  // Logo on left
  if (opts.schoolInfo?.logo) {
    try {
      const logoStr = opts.schoolInfo.logo;
      let imgData: string;
      let imgFormat: string = 'JPEG';

      if (logoStr.includes('base64,')) {
        const parts = logoStr.split('base64,');
        imgData = parts[1];
        const mimeMatch = parts[0].match(/data:image\/(png|jpeg|jpg|gif|webp)/i);
        if (mimeMatch) {
          const fmt = mimeMatch[1].toUpperCase();
          imgFormat = fmt === 'JPG' ? 'JPEG' : (fmt === 'PNG' ? 'PNG' : '');
        }
      } else {
        imgData = logoStr;
      }

      if (imgData && imgFormat) doc.addImage(imgData, imgFormat, 14, yPos, 15, 15);
    } catch (e) {
      // Logo failed, skip
    }
  }

  // School name + field on left
  const textX = opts.schoolInfo?.logo ? 32 : 14;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.schoolInfo?.name || 'INFOHAS', textX, yPos + 6);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (opts.schoolInfo?.field) {
    doc.text(opts.schoolInfo.field, textX, yPos + 12, { maxWidth: Math.max(80, pageWidth - textX - 80) });
  }

  // Title and date on right
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.title, pageWidth - 14, yPos + 6, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${t('Generated:', 'Généré le :', lang)} ${new Date().toLocaleString()}`, pageWidth - 14, yPos + 12, { align: 'right' });

  // Line separator
  yPos = 28;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, yPos, pageWidth - 14, yPos);

  return yPos + 4;
}

function addFooter(doc: jsPDF, schoolInfo?: SchoolInfo, language: string = 'en') {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);

    const telLabel = t('Tel:', 'Tél.:', language);
    const emailLabel = t('Email:', 'Email :', language);

    const footerParts = [
      schoolInfo?.address || '',
      schoolInfo?.phone ? `${telLabel} ${schoolInfo.phone}` : '',
      schoolInfo?.email ? `${emailLabel} ${schoolInfo.email}` : ''
    ].filter(Boolean);

    const footerText = footerParts.join('  |  ');
    doc.text(footerText, 14, pageHeight - 8);
    doc.text(`${t('Page', 'Page', language)} ${i} ${t('of', 'sur', language)} ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
  }
}

export function downloadPdf(doc: jsPDF, filename: string) {
  if (typeof window !== 'undefined' && doc?.save) {
    try {
      doc.save(filename);
    } catch (e) {
      console.warn('PDF download error:', e);
    }
  }
}

// ==================== EXPORT FUNCTIONS ====================

export function exportStudentsPDF(students: Student[], classes: Class[], schoolInfo: SchoolInfo, language: string = 'en') {
  const title = t('Students List', 'Liste des Étudiants', language);
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo, language });
  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language });

  const tableData = students.map(s => {
    const cls = classes.find(c => c.id === s.classId);
    return [
      s.fullName,
      s.studentId,
      cls?.name || s.className || '-',
      s.status,
      s.guardianName || '-',
      s.guardianPhone || '-',
      s.email || '-',
      new Date(s.createdAt).toLocaleDateString()
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      t('Name', 'Nom', language),
      t('Student ID', 'ID Étudiant', language),
      t('Class', 'Classe', language),
      t('Status', 'Statut', language),
      t('Guardian', 'Tuteur', language),
      t('Phone', 'Téléphone', language),
      t('Email', 'Email', language),
      t('Created', 'Créé', language),
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    rowPageBreak: 'avoid',
    columnStyles: {
      0: { cellWidth: 44 }, // Nom
      1: { cellWidth: 22, halign: 'center' }, // ID Étudiant
      2: { cellWidth: 30 }, // Classe
      3: { cellWidth: 20, halign: 'center' }, // Statut
      4: { cellWidth: 50 }, // Tuteur
      5: { cellWidth: 42 }, // Téléphone
      6: { cellWidth: 'auto' }, // Email fills remaining page width to right margin
      7: { cellWidth: 24, halign: 'center' }, // Créé
    },
  });

  addFooter(doc, schoolInfo, language);
  downloadPdf(doc, `students_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportAttendancePDF(records: AttendanceRecord[], students: Student[], classes: Class[], schoolInfo: SchoolInfo, dateFrom?: string, dateTo?: string, language: string = 'en') {
  const title = t('Attendance Report', 'Rapport de Présence', language);
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo, language });
  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language });

  let filtered = [...records];
  if (dateFrom) filtered = filtered.filter(r => r.date >= dateFrom);
  if (dateTo) filtered = filtered.filter(r => r.date <= dateTo);

  // Summary section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(t('Summary', 'Résumé', language), 14, startY);
  startY += 2;

  const present = filtered.filter(r => r.status === 'present').length;
  const absent = filtered.filter(r => r.status === 'absent').length;
  const late = filtered.filter(r => r.status === 'late').length;
  const excused = filtered.filter(r => r.status === 'excused').length;
  const total = filtered.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${t('Total Records', 'Total Enregistrements', language)}: ${total}  |  ${t('Present', 'Présent', language)}: ${present}  |  ${t('Absent', 'Absent', language)}: ${absent}  |  ${t('Late', 'En Retard', language)}: ${late}  |  ${t('Excused', 'Excusé', language)}: ${excused}  |  ${t('Rate', 'Taux', language)}: ${rate}%`,
    14,
    startY + 5
  );
  startY += 12;

  if (dateFrom || dateTo) {
    doc.setFontSize(8);
    doc.text(`${t('Date Range', 'Plage de Dates', language)}: ${dateFrom || t('All', 'Tout', language)} → ${dateTo || t('All', 'Tout', language)}`, 14, startY);
    startY += 6;
  }

  const tableData = filtered.map(r => {
    const s = students.find(st => st.id === r.studentId);
    const cls = classes.find(c => c.id === s?.classId);
    return [
      r.date,
      s?.fullName || t('Unknown', 'Inconnu', language),
      s?.studentId || '-',
      cls?.name || '-',
      r.status,
      r.notes || ''
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      t('Date', 'Date', language),
      t('Student Name', 'Nom Étudiant', language),
      t('Student ID', 'ID Étudiant', language),
      t('Class', 'Classe', language),
      t('Status', 'Statut', language),
      t('Notes', 'Notes', language),
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    rowPageBreak: 'avoid',
  });

  addFooter(doc, schoolInfo, language);
  downloadPdf(doc, `attendance_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportGradesPDF(grades: Grade[], students: Student[], modules: Module[], schoolInfo: SchoolInfo, language: string = 'en') {
  const title = t('Grades Report', 'Rapport des Notes', language);
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo, language });
  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language });

  const tableData = grades.map(g => {
    const s = students.find(st => st.id === g.studentId);
    const m = modules.find(mod => mod.id === g.moduleId);
    return [
      s?.fullName || t('Unknown', 'Inconnu', language),
      s?.studentId || '-',
      m?.name || '-',
      g.grade || '-',
      g.percentage != null ? `${g.percentage}%` : 'N/A',
      g.date ? new Date(g.date).toLocaleDateString() : '-'
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      t('Student', 'Étudiant', language),
      t('Student ID', 'ID Étudiant', language),
      t('Module', 'Module', language),
      t('Grade', 'Note', language),
      t('Percentage', 'Pourcentage', language),
      t('Date', 'Date', language),
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    rowPageBreak: 'avoid',
  });

  addFooter(doc, schoolInfo, language);
  downloadPdf(doc, `grades_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportBehaviorPDF(records: BehaviorRecord[], students: Student[], schoolInfo: SchoolInfo, language: string = 'en') {
  const title = t('Behavior Report', 'Rapport de Comportement', language);
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo, language });
  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language });

  const tableData = records.map(r => {
    const s = students.find(st => st.id === r.studentId);
    return [
      r.date,
      s?.fullName || t('Unknown', 'Inconnu', language),
      s?.studentId || '-',
      r.type,
      r.description,
      r.points != null ? String(r.points) : '0',
      r.teacher || '-'
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      t('Date', 'Date', language),
      t('Student', 'Étudiant', language),
      t('Student ID', 'ID Étudiant', language),
      t('Type', 'Type', language),
      t('Description', 'Description', language),
      t('Points', 'Points', language),
      t('Teacher', 'Enseignant', language),
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    rowPageBreak: 'avoid',
  });

  addFooter(doc, schoolInfo, language);
  downloadPdf(doc, `behavior_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportIncidentsPDF(incidents: Incident[], students: Student[], schoolInfo: SchoolInfo, language: string = 'en') {
  const title = t('Incidents Report', 'Rapport des Incidents', language);
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo, language });
  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language });

  const tableData = incidents.map(i => {
    const s = students.find(st => st.id === i.studentId);
    return [
      i.date || '-',
      s?.fullName || t('Unknown', 'Inconnu', language),
      i.incidentType || '-',
      i.severity,
      i.status,
      i.description || '-',
      i.actionTaken || '-',
      i.reportedBy || '-'
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      t('Date', 'Date', language),
      t('Student', 'Étudiant', language),
      t('Type', 'Type', language),
      t('Severity', 'Sévérité', language),
      t('Status', 'Statut', language),
      t('Description', 'Description', language),
      t('Action Taken', 'Action Prise', language),
      t('Reported By', 'Signalé Par', language),
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    rowPageBreak: 'avoid',
  });

  addFooter(doc, schoolInfo, language);
  downloadPdf(doc, `incidents_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportTasksPDF(tasks: Task[], schoolInfo: SchoolInfo, language: string = 'en') {
  const title = t('Tasks Report', 'Rapport des Tâches', language);
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo, language });
  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language });

  const tableData = tasks.map(task => [
    task.ticketNumber || '-',
    task.title,
    task.priority,
    task.status,
    task.assignedTo || '-',
    task.dueDate || '-',
    task.progress != null ? `${task.progress}%` : '0%',
    new Date(task.createdAt).toLocaleDateString()
  ]);

  autoTable(doc, {
    startY,
    head: [[
      t('Ticket', 'Ticket', language),
      t('Title', 'Titre', language),
      t('Priority', 'Priorité', language),
      t('Status', 'Statut', language),
      t('Assigned To', 'Assigné À', language),
      t('Due Date', 'Date Limite', language),
      t('Progress', 'Progression', language),
      t('Created', 'Créé', language),
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    rowPageBreak: 'avoid',
  });

  addFooter(doc, schoolInfo, language);
  downloadPdf(doc, `tasks_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportClassPerformancePDF(
  students: Student[],
  classes: Class[],
  grades: Grade[],
  attendance: AttendanceRecord[],
  schoolInfo: SchoolInfo,
  language: string = 'en'
) {
  const title = t('Class Performance Comparison', 'Comparaison des Performances par Classe', language);
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo, language });
  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language });

  const classData = classes.map(c => {
    const classStudentIds = new Set(students.filter(s => s.classId === c.id).map(s => s.id));
    const classGrades = grades.filter(g => classStudentIds.has(g.studentId));
    const classAtt = attendance.filter(a => classStudentIds.has(a.studentId));

    const avgGrade = classGrades.length > 0
      ? Math.round(classGrades.reduce((s, g) => s + (g.percentage || 0), 0) / classGrades.length)
      : 0;

    const presentCount = classAtt.filter(a => a.status === 'present').length;
    const attRate = classAtt.length > 0 ? Math.round((presentCount / classAtt.length) * 100) : 0;

    const passRate = classGrades.length > 0
      ? Math.round((classGrades.filter(g => (g.percentage || 0) >= 50).length / classGrades.length) * 100)
      : 0;

    return [
      c.name,
      String(classStudentIds.size),
      String(classGrades.length),
      `${avgGrade}%`,
      String(classAtt.length),
      `${attRate}%`,
      `${passRate}%`,
      c.teacher || '-'
    ];
  });

  autoTable(doc, {
    startY,
    head: [[
      t('Class', 'Classe', language),
      t('Students', 'Étudiants', language),
      t('Total Grades', 'Total des Notes', language),
      t('Avg Grade', 'Moyenne', language),
      t('Att. Records', 'Enr. Présence', language),
      t('Att. Rate', 'Taux Présence', language),
      t('Pass Rate', 'Taux Réussite', language),
      t('Teacher', 'Enseignant', language),
    ]],
    body: classData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, schoolInfo, language);
  downloadPdf(doc, `class_performance_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportFullReportPDF(
  allData: {
    students: Student[];
    classes: Class[];
    modules: Module[];
    attendance: AttendanceRecord[];
    grades: Grade[];
    behavior: BehaviorRecord[];
    tasks: Task[];
    incidents: Incident[];
  },
  schoolInfo: SchoolInfo,
  language: string = 'en'
) {
  const title = t('Comprehensive School Report', "Rapport Global de l'École", language);
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo, language });
  let yPos = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- OVERVIEW STATS ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`1. ${t('Overview', 'Aperçu', language)}`, 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const statsText = [
    `${t('Total Students', 'Total Étudiants', language)}: ${allData.students.length}`,
    `${t('Active Students', 'Étudiants Actifs', language)}: ${allData.students.filter(s => s.status === 'active').length}`,
    `${t('Total Classes', 'Total Classes', language)}: ${allData.classes.length}`,
    `${t('Total Modules', 'Total Modules', language)}: ${allData.modules.length}`,
    `${t('Attendance Records', 'Enregistrements de Présence', language)}: ${allData.attendance.length}`,
    `${t('Grade Records', 'Enregistrements de Notes', language)}: ${allData.grades.length}`,
    `${t('Behavior Records', 'Enregistrements de Comportement', language)}: ${allData.behavior.length}`,
    `${t('Open Tasks', 'Tâches Ouvertes', language)}: ${allData.tasks.filter(task => task.status !== 'completed').length}`,
    `${t('Open Incidents', 'Incidents Ouverts', language)}: ${allData.incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length}`,
  ];

  statsText.forEach((text, i) => {
    doc.text(text, 14, yPos + i * 5);
  });
  yPos += statsText.length * 5 + 10;

  // ---- STUDENTS TABLE ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`2. ${t('Students', 'Étudiants', language)}`, 14, yPos);
  yPos += 4;

  const studentsData = allData.students.map(s => {
    const cls = allData.classes.find(c => c.id === s.classId);
    return [s.fullName, s.studentId, cls?.name || '-', s.status];
  });

  autoTable(doc, {
    startY: yPos,
    head: [[
      t('Name', 'Nom', language),
      t('Student ID', 'ID Étudiant', language),
      t('Class', 'Classe', language),
      t('Status', 'Statut', language),
    ]],
    body: studentsData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  yPos = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 32) + 12;

  // ---- ATTENDANCE SUMMARY ----
  const present = allData.attendance.filter(r => r.status === 'present').length;
  const absent = allData.attendance.filter(r => r.status === 'absent').length;
  const rate = allData.attendance.length > 0 ? Math.round((present / allData.attendance.length) * 100) : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`3. ${t('Attendance Summary', 'Résumé de Présence', language)}`, 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${t('Total Records', 'Total Enregistrements', language)}: ${allData.attendance.length}  |  ${t('Present', 'Présent', language)}: ${present}  |  ${t('Absent', 'Absent', language)}: ${absent}  |  ${t('Rate', 'Taux', language)}: ${rate}%`,
    14,
    yPos
  );
  yPos += 10;

  // ---- GRADES SUMMARY ----
  const avgGrade = allData.grades.length > 0
    ? Math.round(allData.grades.reduce((s, g) => s + (g.percentage || 0), 0) / allData.grades.length)
    : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`4. ${t('Grades Summary', 'Résumé des Notes', language)}`, 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${t('Total Grades', 'Total des Notes', language)}: ${allData.grades.length}  |  ${t('Average', 'Moyenne', language)}: ${avgGrade}%  |  ${t('Above', 'Au-dessus', language)} 70%: ${allData.grades.filter(g => (g.percentage || 0) >= 70).length}  |  ${t('Below', 'En dessous', language)} 50%: ${allData.grades.filter(g => (g.percentage || 0) < 50).length}`,
    14,
    yPos
  );
  yPos += 10;

  // ---- BEHAVIOR SUMMARY ----
  const posBehavior = allData.behavior.filter(b => b.type === 'positive').length;
  const negBehavior = allData.behavior.filter(b => b.type === 'negative').length;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`5. ${t('Behavior Summary', 'Résumé de Comportement', language)}`, 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${t('Total Records', 'Total Enregistrements', language)}: ${allData.behavior.length}  |  Positive: ${posBehavior}  |  Negative: ${negBehavior}`,
    14,
    yPos
  );
  yPos += 10;

  // ---- TASKS SUMMARY ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`6. ${t('Tasks Summary', 'Résumé des Tâches', language)}`, 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const pendingTasks = allData.tasks.filter(task => task.status === 'pending').length;
  const inProgressTasks = allData.tasks.filter(task => task.status === 'in_progress').length;
  const completedTasks = allData.tasks.filter(task => task.status === 'completed').length;
  const overdueTasks = allData.tasks.filter(task => task.status === 'overdue').length;
  doc.text(
    `${t('Total', 'Total', language)}: ${allData.tasks.length}  |  ${t('Pending', 'En Attente', language)}: ${pendingTasks}  |  ${t('In Progress', 'En Cours', language)}: ${inProgressTasks}  |  ${t('Completed', 'Terminé', language)}: ${completedTasks}  |  ${t('Overdue', 'En Retard', language)}: ${overdueTasks}`,
    14,
    yPos
  );
  yPos += 10;

  // ---- INCIDENTS SUMMARY ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`7. ${t('Incidents Summary', 'Résumé des Incidents', language)}`, 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const openIncidents = allData.incidents.filter(i => i.status === 'open').length;
  const resolvedIncidents = allData.incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length;
  doc.text(
    `${t('Total', 'Total', language)}: ${allData.incidents.length}  |  ${t('Open', 'Ouvert', language)}: ${openIncidents}  |  ${t('Resolved', 'Résolu', language)}: ${resolvedIncidents}`,
    14,
    yPos
  );

  addFooter(doc, schoolInfo, language);
  downloadPdf(doc, `full_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportSchedulePDF(
  scheduleEntries: ClassScheduleEntry[],
  targetClass: Class,
  teachers: { id: string; name: string }[],
  modules: { id: string; name: string }[],
  monthLabel: string,
  schoolInfo: SchoolInfo,
  language: string = 'en'
) {
  const lang = language;
  // A4 Portrait
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ---- HEADER (same as addHeader) ----
  let yPos = 10;
  if (schoolInfo.logo) {
    try {
      const logoStr = schoolInfo.logo;
      let imgData: string;
      let imgFormat: string = 'JPEG';
      if (logoStr.includes('base64,')) {
        const parts = logoStr.split('base64,');
        imgData = parts[1];
        const mimeMatch = parts[0].match(/data:image\/(png|jpeg|jpg|gif|webp)/i);
        if (mimeMatch) {
          const fmt = mimeMatch[1].toUpperCase();
          imgFormat = fmt === 'JPG' ? 'JPEG' : (fmt === 'PNG' ? 'PNG' : '');
        }
      } else {
        imgData = logoStr;
      }
      if (imgData && imgFormat) doc.addImage(imgData, imgFormat, 14, yPos, 12, 12);
    } catch {}
  }
  const textX = schoolInfo.logo ? 28 : 14;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolInfo.name || 'INFOHAS', textX, yPos + 5);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (schoolInfo.field) {
    doc.text(schoolInfo.field, textX, yPos + 10);
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${t('Schedule', 'Emploi du Temps', lang)} - ${targetClass.name}`, pageWidth - 14, yPos + 5, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(monthLabel, pageWidth - 14, yPos + 10, { align: 'right' });
  yPos = 24;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 3;

  // ---- GROUP SCHEDULE DATA BY DATE ----
  const sorted = [...scheduleEntries].sort((a, b) => a.date.localeCompare(b.date));

  const tableHead = [[
    t('Date', 'Date', lang),
    t('Time', 'Heure', lang),
    t('Teacher', 'Enseignant', lang),
    t('Room', 'Salle', lang),
    t('Module', 'Module', lang),
  ]];
  const tableBody = sorted.map(entry => {
    const teacher = teachers.find(tc => tc.id === entry.teacherId);
    const mod = modules.find(m => m.id === entry.moduleId);
    const dateObj = new Date(entry.date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = `${dayName} ${entry.date}`;
    return [
      dateStr,
      entry.timeSlot || '-',
      teacher?.name || entry.teacherId || '-',
      entry.roomId || '-',
      mod?.name || entry.moduleId || '-',
    ];
  });

  if (tableBody.length === 0) {
    doc.setFontSize(10);
    doc.text(t("No schedule entries for this period.", "Aucune entrée d'emploi du temps pour cette période.", lang), 14, yPos + 10);
  } else {
    // Calculate optimal font size to fit all rows on one page in portrait
    // A4 portrait: usable width ~182mm, usable height from yPos(27) to footer(282) = ~255mm
    const availableHeight = pageHeight - yPos - 20;
    const estimatedRowHeight = 5.5;
    const maxRowsPerPage = Math.floor(availableHeight / estimatedRowHeight);
    const fontSize = tableBody.length > maxRowsPerPage * 2 ? 5 : tableBody.length > maxRowsPerPage ? 5.5 : 6;

    const telLabel = t('Tel:', 'Tél.:', lang);
    const emailLabel = t('Email:', 'Email :', lang);

    autoTable(doc, {
      startY: yPos,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 6.5, fontStyle: 'bold', halign: 'center', cellPadding: 1.5 },
      bodyStyles: { fontSize: fontSize, valign: 'middle', cellPadding: 1.2 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 12, right: 12 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 35 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 'auto' },
      },
      didDrawPage: (data) => {
        // Footer on each page
        const pg = doc.getNumberOfPages();
        const ph = doc.internal.pageSize.getHeight();
        const pw = doc.internal.pageSize.getWidth();
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        const footerParts = [
          schoolInfo.address || '',
          schoolInfo.phone ? `${telLabel} ${schoolInfo.phone}` : '',
          schoolInfo.email ? `${emailLabel} ${schoolInfo.email}` : ''
        ].filter(Boolean);
        doc.text(footerParts.join('  |  '), 14, ph - 8);
        doc.text(`${t('Page', 'Page', lang)} ${pg}`, pw - 14, ph - 8, { align: 'right' });
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(14, ph - 10, pw - 14, ph - 10);
        doc.setTextColor(0, 0, 0);
      },
    });
  }

  doc.save(`schedule_${targetClass.name}_${monthLabel.replace(/\s+/g, '_')}.pdf`);
}

export function exportAllSchedulesPDF(
  allScheduleEntries: ClassScheduleEntry[],
  classes: Class[],
  teachers: { id: string; name: string }[],
  modules: { id: string; name: string }[],
  schoolInfo: SchoolInfo,
  language: string = 'en'
) {
  const lang = language;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  let yPos = 10;
  if (schoolInfo.logo) {
    try {
      const logoStr = schoolInfo.logo;
      let imgData: string; let imgFormat = 'JPEG';
      if (logoStr.includes('base64,')) {
        const parts = logoStr.split('base64,'); imgData = parts[1];
        const m = parts[0].match(/data:image\/(png|jpeg|jpg|gif|webp)/i);
        if (m) { const f = m[1].toUpperCase(); imgFormat = f === 'JPG' ? 'JPEG' : (f === 'PNG' ? 'PNG' : 'JPEG'); }
      } else { imgData = logoStr; }
      if (imgData && imgFormat) doc.addImage(imgData, imgFormat, 14, yPos, 15, 15);
    } catch {}
  }
  const textX = schoolInfo.logo ? 32 : 14;
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(schoolInfo.name || 'INFOHAS', textX, yPos + 6);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  if (schoolInfo.field) doc.text(schoolInfo.field, textX, yPos + 12);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(t('All Classes Schedule', "Emploi du Temps de Toutes les Classes", lang), pageWidth - 14, yPos + 6, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString(), pageWidth - 14, yPos + 12, { align: 'right' });
  yPos = 28;
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
  doc.line(14, yPos, pageWidth - 14, yPos); yPos += 4;

  // Group schedule by class
  const entriesByClass = new Map<string, ClassScheduleEntry[]>();
  allScheduleEntries.forEach(e => {
    if (!entriesByClass.has(e.classId)) entriesByClass.set(e.classId, []);
    entriesByClass.get(e.classId)!.push(e);
  });

  let isFirstPage = true;
  entriesByClass.forEach((entries, classId) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    if (!isFirstPage) {
      doc.addPage();
      yPos = 20;
    }
    isFirstPage = false;

    // Class title
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`${t('Class', 'Classe', lang)}: ${cls.name}`, 14, yPos);
    yPos += 2;
    doc.setTextColor(0, 0, 0);
    yPos += 4;

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const tableBody = sorted.map(entry => {
      const teacher = teachers.find(tc => tc.id === entry.teacherId);
      const mod = modules.find(m => m.id === entry.moduleId);
      return [
        entry.date,
        entry.timeSlot || '-',
        teacher?.name || '-',
        entry.roomId || '-',
        mod?.name || '-',
      ];
    });

    const fontSize = tableBody.length > 20 ? 5.5 : tableBody.length > 12 ? 6 : 6.5;

    autoTable(doc, {
      startY: yPos,
      head: [[
        t('Date', 'Date', lang),
        t('Time', 'Heure', lang),
        t('Teacher', 'Enseignant', lang),
        t('Room', 'Salle', lang),
        t('Module', 'Module', lang),
      ]],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 7, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: fontSize, valign: 'middle' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 32 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 'auto' },
      },
    });

    yPos = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 20) + 10;
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  const telLabel = t('Tel:', 'Tél.:', lang);
  const emailLabel = t('Email:', 'Email :', lang);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
    const fp = [schoolInfo.address || '', schoolInfo.phone ? `${telLabel} ${schoolInfo.phone}` : '', schoolInfo.email ? `${emailLabel} ${schoolInfo.email}` : ''].filter(Boolean);
    doc.text(fp.join('  |  '), 14, ph - 8);
    doc.text(`${t('Page', 'Page', lang)} ${i} ${t('of', 'sur', lang)} ${pageCount}`, pw - 14, ph - 8, { align: 'right' });
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2);
    doc.line(14, ph - 10, pw - 14, ph - 10);
  }

  doc.save(`all_schedules_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ==================== INDIVIDUAL STUDENT REPORT PDF ====================
export interface ExportIndividualOptions {
  orientation?: 'portrait' | 'landscape' | 'auto';
  includeHistory?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export function exportIndividualStudentPDF(
  student: Student,
  studentClass: Class | undefined,
  attendance: AttendanceRecord[],
  grades: Grade[],
  modules: Module[],
  behavior: BehaviorRecord[],
  incidents: Incident[],
  schoolInfo?: SchoolInfo,
  language: string = 'en',
  options: ExportIndividualOptions = {}
) {
  const lang = language;
  const isFr = lang === 'fr';

  // Filter attendance records for this student
  let studentAtt = attendance.filter(a => a.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (options.dateFrom) studentAtt = studentAtt.filter(a => a.date >= options.dateFrom!);
  if (options.dateTo) studentAtt = studentAtt.filter(a => a.date <= options.dateTo!);

  // Filter grades, behavior, incidents
  const studentGrades = grades.filter(g => g.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const studentBehavior = behavior.filter(b => b.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const studentIncidents = incidents.filter(i => i.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // KPI Calculations
  const totalAtt = studentAtt.length;
  const present = studentAtt.filter(a => a.status === 'present').length;
  const absent = studentAtt.filter(a => a.status === 'absent').length;
  const late = studentAtt.filter(a => a.status === 'late').length;
  const excused = studentAtt.filter(a => a.status === 'excused').length;
  const attRate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 0;

  // Streaks
  let curStreak = 0;
  for (const r of studentAtt) { if (r.status === 'present') curStreak++; else break; }
  let bestStreak = 0, tmp = 0;
  for (const r of [...studentAtt].sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
    if (r.status === 'present') { tmp++; bestStreak = Math.max(bestStreak, tmp); } else tmp = 0;
  }

  // Academic average
  const validGrades = studentGrades.filter(g => g.percentage != null);
  const avgGrade = validGrades.length > 0
    ? Math.round(validGrades.reduce((sum, g) => sum + (g.percentage as number), 0) / validGrades.length)
    : 0;

  // Behavior points
  const totalBehaviorPoints = studentBehavior.reduce((sum, b) => sum + (b.points || 0), 0);
  const posCount = studentBehavior.filter(b => b.type === 'positive').length;
  const negCount = studentBehavior.filter(b => b.type === 'negative').length;

  const title = isFr ? "FICHE DE SUIVI INDIVIDUELLE" : "INDIVIDUAL STUDENT REPORT";
  const preferredOrientation = options.orientation || 'auto';

  // Smart document creation with auto orientation
  const { doc, pageWidth, pageHeight } = createSmartDoc({
    title,
    schoolInfo,
    language: lang,
    columnCount: preferredOrientation === 'landscape' ? 8 : 4,
    estimatedContentWidthMm: preferredOrientation === 'landscape' ? 220 : 170,
    orientation: preferredOrientation === 'auto' ? 'portrait' : preferredOrientation,
  });

  let yPos = addHeader(doc, { orientation: preferredOrientation === 'landscape' ? 'landscape' : 'portrait', title, schoolInfo, language: lang });

  // 1. Student Identity Header Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  const boxHeight = 32;
  doc.roundedRect(14, yPos, pageWidth - 28, boxHeight, 3, 3, 'FD');

  let textLeft = 20;
  if (student.photo) {
    try {
      let photoData = student.photo;
      let format = 'JPEG';
      if (photoData.includes('base64,')) {
        const parts = photoData.split('base64,');
        photoData = parts[1];
        const m = parts[0].match(/data:image\/(png|jpeg|jpg|gif|webp)/i);
        if (m) format = m[1].toUpperCase() === 'PNG' ? 'PNG' : 'JPEG';
      }
      doc.addImage(photoData, format, 18, yPos + 4, 24, 24);
      textLeft = 46;
    } catch {
      doc.setFillColor(209, 250, 229);
      doc.circle(28, yPos + 16, 10, 'F');
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(student.fullName.charAt(0).toUpperCase(), 28, yPos + 19.5, { align: 'center' });
      textLeft = 44;
    }
  } else {
    doc.setFillColor(209, 250, 229);
    doc.circle(28, yPos + 16, 10, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(student.fullName.charAt(0).toUpperCase(), 28, yPos + 19.5, { align: 'center' });
    textLeft = 44;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(student.fullName, textLeft, yPos + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${isFr ? 'ID Étudiant' : 'Student ID'}: ${student.studentId || '-'}  |  ${isFr ? 'Classe' : 'Class'}: ${studentClass?.name || student.className || '-'}  |  ${isFr ? 'Année' : 'Year'}: ${student.academicYear || '-'}`, textLeft, yPos + 14);

  const statusLabel = student.status?.toUpperCase() || 'ACTIVE';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  if (student.status === 'active') doc.setTextColor(16, 185, 129);
  else if (student.status === 'abandoned') doc.setTextColor(245, 158, 11);
  else if (student.status === 'terminated') doc.setTextColor(239, 68, 68);
  else doc.setTextColor(59, 130, 246);
  doc.text(`[${statusLabel}]`, textLeft, yPos + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const colRightX = Math.max(textLeft + 80, pageWidth - 90);
  doc.text(`${isFr ? 'Tuteur' : 'Guardian'}: ${student.guardianName || '-'}`, colRightX, yPos + 8);
  doc.text(`${isFr ? 'Tél' : 'Phone'}: ${student.guardianPhone || student.phone || '-'}`, colRightX, yPos + 14);
  doc.text(`Email: ${student.email || student.guardianEmail || '-'}`, colRightX, yPos + 20);
  if (student.address) {
    doc.text(`${isFr ? 'Adresse' : 'Address'}: ${student.address.slice(0, 35)}`, colRightX, yPos + 26);
  }

  yPos += boxHeight + 6;

  // 2. Executive KPI Summary Cards
  const kpiCount = 4;
  const kpiGap = 4;
  const kpiWidth = (pageWidth - 28 - (kpiGap * (kpiCount - 1))) / kpiCount;
  const kpiHeight = 16;

  const kpis = [
    {
      title: isFr ? 'Taux de Présence' : 'Attendance Rate',
      val: `${attRate}%`,
      sub: `${present}P • ${absent}A • ${late}L • ${excused}E`,
      color: attRate >= 90 ? [16, 185, 129] : (attRate >= 75 ? [245, 158, 11] : [239, 68, 68]),
    },
    {
      title: isFr ? 'Série Présence' : 'Attendance Streak',
      val: curStreak > 0 ? `${curStreak} ${isFr ? 'jrs' : 'days'}` : '0',
      sub: `${isFr ? 'Record' : 'Best'}: ${bestStreak} ${isFr ? 'jrs' : 'days'}`,
      color: [14, 165, 233],
    },
    {
      title: isFr ? 'Moyenne Générale' : 'Academic Average',
      val: validGrades.length > 0 ? `${avgGrade}%` : 'N/A',
      sub: `${validGrades.length} ${isFr ? 'notes saisies' : 'grades recorded'}`,
      color: avgGrade >= 70 ? [16, 185, 129] : (avgGrade >= 50 ? [245, 158, 11] : [239, 68, 68]),
    },
    {
      title: isFr ? 'Points Comportement' : 'Behavior Score',
      val: `${totalBehaviorPoints >= 0 ? '+' : ''}${totalBehaviorPoints} pts`,
      sub: `${posCount} + / ${negCount} - / ${studentIncidents.length} ${isFr ? 'inc.' : 'inc.'}`,
      color: totalBehaviorPoints >= 0 ? [16, 185, 129] : [239, 68, 68],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kX = 14 + idx * (kpiWidth + kpiGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(kX, yPos, kpiWidth, kpiHeight, 2, 2, 'FD');

    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(kX, yPos, 2, kpiHeight, 'F');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, kX + 5, yPos + 4.5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, kX + 5, yPos + 10);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, kX + 5, yPos + 14);
  });

  yPos += kpiHeight + 6;

  // 3. Section: Academic Grades / Evaluations
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(isFr ? "1. ÉVALUATIONS ACADÉMIQUES & NOTES" : "1. ACADEMIC EVALUATIONS & GRADES", 14, yPos);
  yPos += 3;

  const gradesTableData = studentGrades.map(g => {
    const mod = modules.find(m => m.id === g.moduleId);
    const pct = g.percentage != null ? `${g.percentage}%` : '-';
    const status = g.percentage != null
      ? (g.percentage >= 50 ? (isFr ? 'Validé' : 'Passed') : (isFr ? 'Non validé' : 'Failed'))
      : '-';
    return [
      mod?.name || (isFr ? 'Module' : 'Module'),
      mod?.code || '-',
      g.grade || '-',
      pct,
      g.date || '-',
      status,
    ];
  });

  if (gradesTableData.length === 0) {
    gradesTableData.push([
      isFr ? 'Aucune note enregistrée' : 'No grades recorded',
      '-', '-', '-', '-', '-'
    ]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [[
      isFr ? 'Module / Matière' : 'Module / Course',
      isFr ? 'Code' : 'Code',
      isFr ? 'Note' : 'Grade',
      isFr ? 'Pourcentage' : 'Percentage',
      isFr ? 'Date' : 'Date',
      isFr ? 'Résultat' : 'Status',
    ]],
    body: gradesTableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 7, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 6.5, cellPadding: 1.2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 24, halign: 'center' },
    },
  });

  yPos = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos) + 6;

  if (yPos > pageHeight - 65) {
    doc.addPage();
    yPos = 20;
  }

  // 4. Section: Attendance History
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(isFr ? "2. HISTORIQUE DE PRÉSENCE DÉTAILLÉ" : "2. DETAILED ATTENDANCE HISTORY", 14, yPos);
  yPos += 3;

  const attTableData = studentAtt.slice(0, 35).map(a => {
    let dayName = '-';
    try {
      const d = new Date(a.date + 'T00:00:00');
      dayName = d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'short' });
    } catch {}

    const statusMap = {
      present: isFr ? 'Présent' : 'Present',
      absent: isFr ? 'Absent' : 'Absent',
      late: isFr ? 'En Retard' : 'Late',
      excused: isFr ? 'Excusé' : 'Excused',
    };

    return [
      a.date,
      dayName,
      statusMap[a.status] || a.status,
      a.notes || '-',
    ];
  });

  if (attTableData.length === 0) {
    attTableData.push([
      isFr ? 'Aucun enregistrement' : 'No records',
      '-', '-', '-'
    ]);
  }

  autoTable(doc, {
    startY: yPos,
    head: [[
      isFr ? 'Date' : 'Date',
      isFr ? 'Jour' : 'Day',
      isFr ? 'Statut' : 'Status',
      isFr ? 'Remarques / Observations' : 'Notes / Remarks',
    ]],
    body: attTableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 7, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 6.5, cellPadding: 1.2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 'auto' },
    },
  });

  yPos = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos) + 6;

  // 5. Behavior & Incidents (if any)
  if (studentBehavior.length > 0 || studentIncidents.length > 0) {
    if (yPos > pageHeight - 55) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(isFr ? "3. COMPORTEMENT & INCIDENTS" : "3. BEHAVIOR & INCIDENTS", 14, yPos);
    yPos += 3;

    const behTableData = [
      ...studentBehavior.map(b => [
        b.date,
        b.type === 'positive' ? (isFr ? 'Positif (+)' : 'Positive (+)') : (isFr ? 'Négatif (-)' : 'Negative (-)'),
        b.description,
        `${b.points != null && b.points > 0 ? '+' : ''}${b.points || 0} pts`,
        b.teacher || '-',
      ]),
      ...studentIncidents.map(i => [
        i.date || '-',
        isFr ? `Incident: ${i.severity}` : `Incident: ${i.severity}`,
        `${i.incidentType || ''}: ${i.description || ''}`,
        i.actionTaken || (isFr ? 'En cours' : 'Pending'),
        i.reportedBy || '-',
      ]),
    ];

    autoTable(doc, {
      startY: yPos,
      head: [[
        isFr ? 'Date' : 'Date',
        isFr ? 'Type' : 'Type',
        isFr ? 'Description' : 'Description',
        isFr ? 'Points / Action' : 'Points / Action',
        isFr ? 'Enseignant / Signalé' : 'Teacher / Reported',
      ]],
      body: behTableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 6.5, cellPadding: 1.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 32 },
      },
    });

    yPos = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos) + 8;
  }

  // 6. Signature Block
  if (yPos > pageHeight - 35) {
    doc.addPage();
    yPos = 20;
  }

  const sigBoxWidth = (pageWidth - 36) / 2;
  const sigBoxHeight = 22;

  doc.setFillColor(252, 252, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, yPos, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(isFr ? "Signature du Tuteur / Parent" : "Parent / Guardian Signature", 18, yPos + 5);

  doc.roundedRect(14 + sigBoxWidth + 8, yPos, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
  doc.text(isFr ? "Cachet et Signature de la Direction" : "School Stamp & Director Signature", 14 + sigBoxWidth + 12, yPos + 5);

  addFooter(doc, schoolInfo, lang);

  const cleanName = (student.studentId || student.fullName).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `student_report_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  downloadPdf(doc, filename);
}

// ==================== GROUP / CLASS REPORT PDF ====================
export interface GroupReportOptions {
  dateFrom?: string;
  dateTo?: string;
  mode?: 'matrix' | 'summary' | 'auto';
  orientation?: 'portrait' | 'landscape' | 'auto';
}

export function exportClassGroupReportPDF(
  targetClass: Class | undefined,
  students: Student[],
  attendance: AttendanceRecord[],
  grades: Grade[],
  modules: Module[],
  schoolInfo?: SchoolInfo,
  language: string = 'en',
  options: GroupReportOptions = {}
) {
  const lang = language;
  const isFr = lang === 'fr';

  const classStudents = targetClass
    ? students.filter(s => s.classId === targetClass.id && s.status === 'active')
    : students.filter(s => s.status === 'active');

  const classStudentIds = new Set(classStudents.map(s => s.id));

  let classAtt = attendance.filter(a => classStudentIds.has(a.studentId));
  if (options.dateFrom) classAtt = classAtt.filter(a => a.date >= options.dateFrom!);
  if (options.dateTo) classAtt = classAtt.filter(a => a.date <= options.dateTo!);

  const distinctDates = Array.from(new Set(classAtt.map(a => a.date))).sort();
  const isMatrix = options.mode === 'matrix' || (options.mode !== 'summary' && distinctDates.length > 0 && distinctDates.length <= 31);

  if (isMatrix && distinctDates.length > 0) {
    // ---- MATRIX MODE (DATES AS COLUMNS) ----
    const dateColsCount = distinctDates.length;
    // Estimated width: # (7mm) + Name (32mm) + ID (16mm) + Stats (P, A, L, Rate) (30mm) + Dates (6.5mm each)
    const estimatedWidth = 85 + (dateColsCount * 6.5);

    const title = targetClass
      ? `${isFr ? 'GRILLE DE PRÉSENCE' : 'ATTENDANCE MATRIX'} - ${targetClass.name.toUpperCase()}`
      : (isFr ? 'GRILLE DE PRÉSENCE GLOBALE' : 'GLOBAL ATTENDANCE MATRIX');

    // Automatically determine orientation and format (A4 Landscape, A3, or custom width if > 269mm)
    const { doc, pageWidth } = createSmartDoc({
      title,
      schoolInfo,
      language: lang,
      columnCount: dateColsCount + 6,
      estimatedContentWidthMm: estimatedWidth,
      orientation: 'landscape',
    });

    let yPos = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language: lang });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const rangeText = `${isFr ? 'Période' : 'Period'}: ${options.dateFrom || distinctDates[0]} → ${options.dateTo || distinctDates[distinctDates.length - 1]}  |  ${isFr ? 'Total Étudiants' : 'Total Students'}: ${classStudents.length}  |  ${isFr ? 'Séances' : 'Dates'}: ${dateColsCount}`;
    doc.text(rangeText, 14, yPos);
    yPos += 5;

    const dateHeaders = distinctDates.map(d => {
      const parts = d.split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
    });

    const headRow = [
      '#',
      isFr ? 'Étudiant' : 'Student',
      'ID',
      ...dateHeaders,
      'P',
      'A',
      'L',
      isFr ? 'Taux' : 'Rate',
    ];

    const attMap = new Map<string, string>();
    classAtt.forEach(a => {
      attMap.set(`${a.studentId}_${a.date}`, a.status);
    });

    const bodyRows = classStudents.map((st, idx) => {
      let pCount = 0;
      let aCount = 0;
      let lCount = 0;
      let totalMarked = 0;

      const dateStatuses = distinctDates.map(d => {
        const status = attMap.get(`${st.id}_${d}`);
        if (status === 'present') { pCount++; totalMarked++; return 'P'; }
        if (status === 'absent') { aCount++; totalMarked++; return 'A'; }
        if (status === 'late') { lCount++; totalMarked++; return 'L'; }
        if (status === 'excused') { totalMarked++; return 'E'; }
        return '-';
      });

      const rate = totalMarked > 0 ? `${Math.round((pCount / totalMarked) * 100)}%` : '-';

      return [
        String(idx + 1),
        st.fullName,
        st.studentId || '-',
        ...dateStatuses,
        String(pCount),
        String(aCount),
        String(lCount),
        rate,
      ];
    });

    const colStyles: Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> = {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 32, halign: 'left' },
      2: { cellWidth: 16, halign: 'center' },
    };

    for (let i = 0; i < dateColsCount; i++) {
      colStyles[3 + i] = { cellWidth: dateColsCount > 20 ? 5.5 : 7, halign: 'center' };
    }

    const sumIdx = 3 + dateColsCount;
    colStyles[sumIdx] = { cellWidth: 7, halign: 'center' };
    colStyles[sumIdx + 1] = { cellWidth: 7, halign: 'center' };
    colStyles[sumIdx + 2] = { cellWidth: 7, halign: 'center' };
    colStyles[sumIdx + 3] = { cellWidth: 11, halign: 'center' };

    const fontSize = dateColsCount > 25 ? 5 : (dateColsCount > 15 ? 5.5 : 6.5);

    autoTable(doc, {
      startY: yPos,
      head: [headRow],
      body: bodyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129],
        fontSize: fontSize,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 1,
      },
      bodyStyles: {
        fontSize: fontSize,
        cellPadding: 1,
        valign: 'middle',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      tableWidth: 'wrap',
      columnStyles: colStyles,
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index >= 3 && data.column.index < 3 + dateColsCount) {
          const val = String(data.cell.raw);
          if (val === 'P') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'A') {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'L') {
            data.cell.styles.textColor = [245, 158, 11];
          } else if (val === 'E') {
            data.cell.styles.textColor = [59, 130, 246];
          }
        }
      },
    });

    addFooter(doc, schoolInfo, lang);
    const cleanClassName = (targetClass?.name || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `attendance_matrix_${cleanClassName}_${new Date().toISOString().slice(0, 10)}.pdf`;
    downloadPdf(doc, filename);

  } else {
    // ---- SUMMARY ROSTER MODE ----
    const title = targetClass
      ? `${isFr ? 'RAPPORT DE CLASSE' : 'CLASS REPORT'} - ${targetClass.name.toUpperCase()}`
      : (isFr ? 'RAPPORT DE GROUPE' : 'GROUP REPORT');

    const { doc, pageWidth } = createSmartDoc({
      title,
      schoolInfo,
      language: lang,
      columnCount: 11,
      estimatedContentWidthMm: 240,
      orientation: 'landscape',
    });

    let yPos = addHeader(doc, { orientation: 'landscape', title, schoolInfo, language: lang });

    const classGrades = grades.filter(g => classStudentIds.has(g.studentId));
    const totalPresent = classAtt.filter(a => a.status === 'present').length;
    const totalAbsent = classAtt.filter(a => a.status === 'absent').length;
    const totalLate = classAtt.filter(a => a.status === 'late').length;
    const totalRecords = classAtt.length;
    const classAttRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    const validGrades = classGrades.filter(g => g.percentage != null);
    const classAvgGrade = validGrades.length > 0
      ? Math.round(validGrades.reduce((sum, g) => sum + (g.percentage as number), 0) / validGrades.length)
      : 0;

    const kpiCount = 4;
    const kpiGap = 4;
    const kpiWidth = (pageWidth - 28 - (kpiGap * (kpiCount - 1))) / kpiCount;
    const kpiHeight = 14;

    const summaryKpis = [
      { label: isFr ? 'Étudiants Inscrits' : 'Enrolled Students', val: String(classStudents.length), color: [16, 185, 129] },
      { label: isFr ? 'Taux Présence Global' : 'Overall Attendance', val: `${classAttRate}%`, color: classAttRate >= 80 ? [16, 185, 129] : [245, 158, 11] },
      { label: isFr ? 'Moyenne Académique' : 'Academic Average', val: `${classAvgGrade}%`, color: [14, 165, 233] },
      { label: isFr ? 'Total Absences' : 'Total Absences', val: `${totalAbsent} (${totalLate} ${isFr ? 'retards' : 'late'})`, color: [239, 68, 68] },
    ];

    summaryKpis.forEach((kpi, idx) => {
      const kX = 14 + idx * (kpiWidth + kpiGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(kX, yPos, kpiWidth, kpiHeight, 2, 2, 'FD');

      doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.rect(kX, yPos, 2, kpiHeight, 'F');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, kX + 5, yPos + 4.5);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.text(kpi.val, kX + 5, yPos + 10.5);
    });

    yPos += kpiHeight + 6;

    const tableData = classStudents.map((st, idx) => {
      const stAtt = classAtt.filter(a => a.studentId === st.id);
      const stPresent = stAtt.filter(a => a.status === 'present').length;
      const stAbsent = stAtt.filter(a => a.status === 'absent').length;
      const stLate = stAtt.filter(a => a.status === 'late').length;
      const stRate = stAtt.length > 0 ? `${Math.round((stPresent / stAtt.length) * 100)}%` : '-';

      const stGrades = classGrades.filter(g => g.studentId === st.id && g.percentage != null);
      const stAvg = stGrades.length > 0
        ? `${Math.round(stGrades.reduce((sum, g) => sum + (g.percentage as number), 0) / stGrades.length)}%`
        : '-';

      return [
        String(idx + 1),
        st.fullName,
        st.studentId || '-',
        targetClass?.name || st.className || '-',
        String(stAtt.length),
        String(stPresent),
        String(stAbsent),
        String(stLate),
        stRate,
        stAvg,
        st.status?.toUpperCase() || 'ACTIVE',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [[
        '#',
        isFr ? 'Nom & Prénom' : 'Full Name',
        'ID',
        isFr ? 'Classe' : 'Class',
        isFr ? 'Total' : 'Total',
        isFr ? 'Présent' : 'Present',
        isFr ? 'Absent' : 'Absent',
        isFr ? 'Retard' : 'Late',
        isFr ? 'Taux Présence' : 'Att. Rate',
        isFr ? 'Moyenne' : 'Avg Grade',
        isFr ? 'Statut' : 'Status',
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7, cellPadding: 1.5, valign: 'middle' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 24 },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 16, halign: 'center' },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 22, halign: 'center' },
        9: { cellWidth: 20, halign: 'center' },
        10: { cellWidth: 20, halign: 'center' },
      },
    });

    addFooter(doc, schoolInfo, lang);
    const cleanClassName = (targetClass?.name || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `class_report_${cleanClassName}_${new Date().toISOString().slice(0, 10)}.pdf`;
    downloadPdf(doc, filename);
  }
}

// ==================== PROGRESS REPORT PDF ====================
export function exportProgressReportPDF(
  reports: Array<Record<string, unknown>>,
  classSummary: Record<string, number> = {},
  schoolInfo?: SchoolInfo | Record<string, string | undefined>,
  dateRange: Record<string, string> = {},
  teacherComment: string = '',
  language: string = 'en'
) {
  const lang = language;
  const isFr = lang === 'fr';
  const si = schoolInfo as SchoolInfo;
  const title = isFr ? 'BULLETIN DE PROGRÈS' : 'PROGRESS REPORT';

  const hasNestedStudent = reports.length > 0 && typeof reports[0]?.student === 'object';
  const cols = hasNestedStudent ? 8 : 5;

  const { doc, pageWidth } = createSmartDoc({
    title,
    schoolInfo: si,
    language: lang,
    columnCount: cols,
    estimatedContentWidthMm: cols * 25,
    orientation: 'landscape',
  });

  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo: si, language: lang });

  if (reports.length === 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(isFr ? 'Aucune donnée de progression disponible' : 'No progress data available', 14, startY + 15);
    addFooter(doc, si, lang);
    downloadPdf(doc, `progress_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  // Summary KPI Cards if classSummary provided
  if (classSummary && (classSummary.totalStudents || classSummary.avgAtt || classSummary.avgGrade)) {
    const kpiCount = 3;
    const kpiGap = 6;
    const kpiWidth = (pageWidth - 28 - (kpiGap * (kpiCount - 1))) / kpiCount;
    const kpiHeight = 14;

    const kpis = [
      { label: isFr ? 'Total Étudiants' : 'Total Students', val: String(classSummary.totalStudents || reports.length), color: [16, 185, 129] },
      { label: isFr ? 'Taux Présence Moyen' : 'Avg Attendance', val: `${classSummary.avgAtt || 0}%`, color: [14, 165, 233] },
      { label: isFr ? 'Moyenne des Notes' : 'Avg Academic Grade', val: `${classSummary.avgGrade || 0}%`, color: [168, 85, 247] },
    ];

    kpis.forEach((kpi, idx) => {
      const kX = 14 + idx * (kpiWidth + kpiGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(kX, startY, kpiWidth, kpiHeight, 2, 2, 'FD');

      doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.rect(kX, startY, 2, kpiHeight, 'F');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, kX + 5, startY + 4.5);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.text(kpi.val, kX + 5, startY + 10.5);
    });

    startY += kpiHeight + 6;
  }

  // Date range subtitle
  if (dateRange?.from || dateRange?.to) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${isFr ? 'Période analysée' : 'Analyzed Period'}: ${dateRange.from || '-'} → ${dateRange.to || '-'}`, 14, startY);
    startY += 4;
  }

  let head: string[][];
  let body: (string | number)[][];

  if (hasNestedStudent) {
    // Nested structure from ProgressReportsSection
    head = [[
      '#',
      isFr ? 'Nom & Prénom' : 'Full Name',
      'ID',
      isFr ? 'Taux Présence' : 'Att. Rate',
      isFr ? 'Moyenne' : 'Avg Grade',
      isFr ? 'Moy. Pondérée' : 'Weighted Avg',
      isFr ? 'Comportement' : 'Conduct',
      isFr ? 'Résultat' : 'Result',
    ]];

    body = reports.map((r, idx) => {
      const st = r.student as Student;
      const att = Number(r.attRate || 0);
      const avg = Number(r.avgGrade || 0);
      const weighted = Number(r.finalWeighted || avg);
      const pos = Number(r.posBehavior || 0);
      const neg = Number(r.negBehavior || 0);
      const netConduct = pos - neg;

      const isPass = weighted >= 50;

      return [
        String(idx + 1),
        st?.fullName || String(r.studentName || '-'),
        st?.studentId || '-',
        `${att}%`,
        `${avg}%`,
        `${weighted}%`,
        `${netConduct >= 0 ? '+' : ''}${netConduct}`,
        isPass ? (isFr ? 'Admis' : 'Pass') : (isFr ? 'Ajourné' : 'Fail'),
      ];
    });
  } else {
    // Flat reports
    head = [[
      isFr ? 'Étudiant' : 'Student',
      isFr ? 'Module' : 'Module',
      isFr ? 'Note' : 'Grade',
      '%',
      isFr ? 'Statut' : 'Status',
    ]];

    body = reports.map(r => [
      String(r.studentName || r.fullName || '-'),
      String(r.moduleName || r.module || '-'),
      String(r.grade || r.score || '-'),
      String(r.percentage || r.pct || '0'),
      String(r.status || (Number(r.percentage || r.pct || 0) >= 50 ? (isFr ? 'Réussi' : 'Pass') : (isFr ? 'Échoué' : 'Fail'))),
    ]);
  }

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7, cellPadding: 1.5, valign: 'middle' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  // Teacher comment section
  if (teacherComment) {
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    if (finalY) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(isFr ? 'Commentaire / Observations pédagogiques :' : 'Teacher / Pedagogical Observations:', 14, finalY + 8);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(teacherComment, pageWidth - 28);
      doc.text(lines, 14, finalY + 13);
    }
  }

  addFooter(doc, si, lang);
  downloadPdf(doc, `progress_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

