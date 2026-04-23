import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, SchoolInfo, ClassScheduleEntry } from './types';

type Orientation = 'portrait' | 'landscape';

interface PdfOptions {
  orientation: Orientation;
  title: string;
  schoolInfo: SchoolInfo;
  language?: string;
}

// ---- Translation helper ----
function t(en: string, fr: string, lang: string): string {
  return lang === 'fr' ? fr : en;
}

function createDoc(opts: PdfOptions) {
  const doc = new jsPDF({ orientation: opts.orientation, unit: 'mm', format: 'a4' });
  return { doc, pageWidth: doc.internal.pageSize.getWidth() };
}

function addHeader(doc: jsPDF, opts: PdfOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const lang = opts.language || 'en';
  let yPos = 10;

  // Logo on left
  if (opts.schoolInfo.logo) {
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
  const textX = opts.schoolInfo.logo ? 32 : 14;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.schoolInfo.name || 'INFOHAS', textX, yPos + 6);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (opts.schoolInfo.field) {
    doc.text(opts.schoolInfo.field, textX, yPos + 12);
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

function addFooter(doc: jsPDF, schoolInfo: SchoolInfo, language: string = 'en') {
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
      schoolInfo.address || '',
      schoolInfo.phone ? `${telLabel} ${schoolInfo.phone}` : '',
      schoolInfo.email ? `${emailLabel} ${schoolInfo.email}` : ''
    ].filter(Boolean);

    const footerText = footerParts.join('  |  ');
    doc.text(footerText, 14, pageHeight - 8);
    doc.text(`${t('Page', 'Page', language)} ${i} ${t('of', 'sur', language)} ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
  }
}

function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
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
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 22 },
      2: { cellWidth: 25 },
      3: { cellWidth: 18 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
      6: { cellWidth: 30 },
      7: { cellWidth: 20 },
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

// ==================== PROGRESS REPORT PDF ====================
export function exportProgressReportPDF(
  reports: Array<Record<string, unknown>>,
  _classSummary: Record<string, number>,
  schoolInfo: Record<string, string | undefined>,
  _dateRange: Record<string, string>,
  teacherComment: string,
  language: string = 'en'
) {
  const lang = language;
  const si = schoolInfo as SchoolInfo;
  const title = lang === 'fr' ? 'Bulletin de Progres' : 'Progress Report';
  const { doc } = createDoc({ orientation: 'landscape', title, schoolInfo: si, language: lang });
  let startY = addHeader(doc, { orientation: 'landscape', title, schoolInfo: si, language: lang });

  if (reports.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(lang === 'fr' ? 'Aucune donnee de progression disponible' : 'No progress data available', 14, startY + 20);
    addFooter(doc, si, lang);
    downloadPdf(doc, `progress_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  // Table header
  const head = [[
    t('Student', 'Étudiant', lang),
    t('Module', 'Module', lang),
    t('Grade', 'Note', lang),
    '%',
    t('Status', 'Statut', lang),
  ]];

  const body = reports.map(r => [
    String(r.studentName || r.fullName || '-'),
    String(r.moduleName || r.module || '-'),
    String(r.grade || r.score || '-'),
    String(r.percentage || r.pct || '0'),
    String(r.status || (Number(r.percentage || r.pct || 0) >= 50 ? (lang === 'fr' ? 'Reussi' : 'Pass') : (lang === 'fr' ? 'Echoue' : 'Fail'))),
  ]);

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  // Teacher comment section
  if (teacherComment) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY;
    if (finalY) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(lang === 'fr' ? 'Commentaire du professeur' : 'Teacher Comment', 14, finalY + 12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(teacherComment, 180);
      doc.text(lines, 14, finalY + 18);
    }
  }

  addFooter(doc, si, lang);
  downloadPdf(doc, `progress_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
