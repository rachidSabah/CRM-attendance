import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, SchoolInfo, ClassScheduleEntry } from './types';

type Orientation = 'portrait' | 'landscape';

interface PdfOptions {
  orientation: Orientation;
  title: string;
  schoolInfo: SchoolInfo;
}

function createDoc(opts: PdfOptions) {
  const doc = new jsPDF({ orientation: opts.orientation, unit: 'mm', format: 'a4' });
  return { doc, pageWidth: doc.internal.pageSize.getWidth() };
}

function addHeader(doc: jsPDF, opts: PdfOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
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
          imgFormat = fmt === 'JPG' ? 'JPEG' : (fmt === 'PNG' ? 'PNG' : 'JPEG');
        }
      } else {
        imgData = logoStr;
      }

      doc.addImage(imgData, imgFormat, 14, yPos, 15, 15);
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
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, yPos + 12, { align: 'right' });

  // Line separator
  yPos = 28;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, yPos, pageWidth - 14, yPos);

  return yPos + 4;
}

function addFooter(doc: jsPDF, schoolInfo: SchoolInfo) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);

    const footerParts = [
      schoolInfo.address || '',
      schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '',
      schoolInfo.email ? `Email: ${schoolInfo.email}` : ''
    ].filter(Boolean);

    const footerText = footerParts.join('  |  ');
    doc.text(footerText, 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
  }
}

function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

// ==================== EXPORT FUNCTIONS ====================

export function exportStudentsPDF(students: Student[], classes: Class[], schoolInfo: SchoolInfo) {
  const { doc } = createDoc({ orientation: 'landscape', title: 'Students List', schoolInfo });
  let startY = addHeader(doc, { orientation: 'landscape', title: 'Students List', schoolInfo });

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
    head: [['Name', 'Student ID', 'Class', 'Status', 'Guardian', 'Phone', 'Email', 'Created']],
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

  addFooter(doc, schoolInfo);
  downloadPdf(doc, `students_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportAttendancePDF(records: AttendanceRecord[], students: Student[], classes: Class[], schoolInfo: SchoolInfo, dateFrom?: string, dateTo?: string) {
  const { doc } = createDoc({ orientation: 'landscape', title: 'Attendance Report', schoolInfo });
  let startY = addHeader(doc, { orientation: 'landscape', title: 'Attendance Report', schoolInfo });

  let filtered = [...records];
  if (dateFrom) filtered = filtered.filter(r => r.date >= dateFrom);
  if (dateTo) filtered = filtered.filter(r => r.date <= dateTo);

  // Summary section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, startY);
  startY += 2;

  const present = filtered.filter(r => r.status === 'present').length;
  const absent = filtered.filter(r => r.status === 'absent').length;
  const late = filtered.filter(r => r.status === 'late').length;
  const excused = filtered.filter(r => r.status === 'excused').length;
  const total = filtered.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Records: ${total}  |  Present: ${present}  |  Absent: ${absent}  |  Late: ${late}  |  Excused: ${excused}  |  Rate: ${rate}%`, 14, startY + 5);
  startY += 12;

  if (dateFrom || dateTo) {
    doc.setFontSize(8);
    doc.text(`Date Range: ${dateFrom || 'All'} → ${dateTo || 'All'}`, 14, startY);
    startY += 6;
  }

  const tableData = filtered.map(r => {
    const s = students.find(st => st.id === r.studentId);
    const cls = classes.find(c => c.id === s?.classId);
    return [
      r.date,
      s?.fullName || 'Unknown',
      s?.studentId || '-',
      cls?.name || '-',
      r.status,
      r.notes || ''
    ];
  });

  autoTable(doc, {
    startY,
    head: [['Date', 'Student Name', 'Student ID', 'Class', 'Status', 'Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, schoolInfo);
  downloadPdf(doc, `attendance_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportGradesPDF(grades: Grade[], students: Student[], modules: Module[], schoolInfo: SchoolInfo) {
  const { doc } = createDoc({ orientation: 'landscape', title: 'Grades Report', schoolInfo });
  let startY = addHeader(doc, { orientation: 'landscape', title: 'Grades Report', schoolInfo });

  const tableData = grades.map(g => {
    const s = students.find(st => st.id === g.studentId);
    const m = modules.find(mod => mod.id === g.moduleId);
    return [
      s?.fullName || 'Unknown',
      s?.studentId || '-',
      m?.name || '-',
      g.grade || '-',
      g.percentage != null ? `${g.percentage}%` : 'N/A',
      g.date ? new Date(g.date).toLocaleDateString() : '-'
    ];
  });

  autoTable(doc, {
    startY,
    head: [['Student', 'Student ID', 'Module', 'Grade', 'Percentage', 'Date']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, schoolInfo);
  downloadPdf(doc, `grades_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportBehaviorPDF(records: BehaviorRecord[], students: Student[], schoolInfo: SchoolInfo) {
  const { doc } = createDoc({ orientation: 'landscape', title: 'Behavior Report', schoolInfo });
  let startY = addHeader(doc, { orientation: 'landscape', title: 'Behavior Report', schoolInfo });

  const tableData = records.map(r => {
    const s = students.find(st => st.id === r.studentId);
    return [
      r.date,
      s?.fullName || 'Unknown',
      s?.studentId || '-',
      r.type,
      r.description,
      r.points != null ? String(r.points) : '0',
      r.teacher || '-'
    ];
  });

  autoTable(doc, {
    startY,
    head: [['Date', 'Student', 'Student ID', 'Type', 'Description', 'Points', 'Teacher']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, schoolInfo);
  downloadPdf(doc, `behavior_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportIncidentsPDF(incidents: Incident[], students: Student[], schoolInfo: SchoolInfo) {
  const { doc } = createDoc({ orientation: 'landscape', title: 'Incidents Report', schoolInfo });
  let startY = addHeader(doc, { orientation: 'landscape', title: 'Incidents Report', schoolInfo });

  const tableData = incidents.map(i => {
    const s = students.find(st => st.id === i.studentId);
    return [
      i.date || '-',
      s?.fullName || 'Unknown',
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
    head: [['Date', 'Student', 'Type', 'Severity', 'Status', 'Description', 'Action Taken', 'Reported By']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, schoolInfo);
  downloadPdf(doc, `incidents_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportTasksPDF(tasks: Task[], schoolInfo: SchoolInfo) {
  const { doc } = createDoc({ orientation: 'landscape', title: 'Tasks Report', schoolInfo });
  let startY = addHeader(doc, { orientation: 'landscape', title: 'Tasks Report', schoolInfo });

  const tableData = tasks.map(t => [
    t.ticketNumber || '-',
    t.title,
    t.priority,
    t.status,
    t.assignedTo || '-',
    t.dueDate || '-',
    t.progress != null ? `${t.progress}%` : '0%',
    new Date(t.createdAt).toLocaleDateString()
  ]);

  autoTable(doc, {
    startY,
    head: [['Ticket', 'Title', 'Priority', 'Status', 'Assigned To', 'Due Date', 'Progress', 'Created']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, schoolInfo);
  downloadPdf(doc, `tasks_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportClassPerformancePDF(
  students: Student[],
  classes: Class[],
  grades: Grade[],
  attendance: AttendanceRecord[],
  schoolInfo: SchoolInfo
) {
  const { doc } = createDoc({ orientation: 'landscape', title: 'Class Performance Comparison', schoolInfo });
  let startY = addHeader(doc, { orientation: 'landscape', title: 'Class Performance Comparison', schoolInfo });

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
    head: [['Class', 'Students', 'Total Grades', 'Avg Grade', 'Att. Records', 'Att. Rate', 'Pass Rate', 'Teacher']],
    body: classData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, schoolInfo);
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
  schoolInfo: SchoolInfo
) {
  const { doc } = createDoc({ orientation: 'landscape', title: 'Comprehensive School Report', schoolInfo });
  let yPos = addHeader(doc, { orientation: 'landscape', title: 'Comprehensive School Report', schoolInfo });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- OVERVIEW STATS ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('1. Overview', 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const statsText = [
    `Total Students: ${allData.students.length}`,
    `Active Students: ${allData.students.filter(s => s.status === 'active').length}`,
    `Total Classes: ${allData.classes.length}`,
    `Total Modules: ${allData.modules.length}`,
    `Attendance Records: ${allData.attendance.length}`,
    `Grade Records: ${allData.grades.length}`,
    `Behavior Records: ${allData.behavior.length}`,
    `Open Tasks: ${allData.tasks.filter(t => t.status !== 'completed').length}`,
    `Open Incidents: ${allData.incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length}`,
  ];

  statsText.forEach((text, i) => {
    doc.text(text, 14, yPos + i * 5);
  });
  yPos += statsText.length * 5 + 10;

  // ---- STUDENTS TABLE ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('2. Students', 14, yPos);
  yPos += 4;

  const studentsData = allData.students.map(s => {
    const cls = allData.classes.find(c => c.id === s.classId);
    return [s.fullName, s.studentId, cls?.name || '-', s.status];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Name', 'Student ID', 'Class', 'Status']],
    body: studentsData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ---- ATTENDANCE SUMMARY ----
  const present = allData.attendance.filter(r => r.status === 'present').length;
  const absent = allData.attendance.filter(r => r.status === 'absent').length;
  const rate = allData.attendance.length > 0 ? Math.round((present / allData.attendance.length) * 100) : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('3. Attendance Summary', 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Records: ${allData.attendance.length}  |  Present: ${present}  |  Absent: ${absent}  |  Rate: ${rate}%`, 14, yPos);
  yPos += 10;

  // ---- GRADES SUMMARY ----
  const avgGrade = allData.grades.length > 0
    ? Math.round(allData.grades.reduce((s, g) => s + (g.percentage || 0), 0) / allData.grades.length)
    : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('4. Grades Summary', 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Grades: ${allData.grades.length}  |  Average: ${avgGrade}%  |  Above 70%: ${allData.grades.filter(g => (g.percentage || 0) >= 70).length}  |  Below 50%: ${allData.grades.filter(g => (g.percentage || 0) < 50).length}`, 14, yPos);
  yPos += 10;

  // ---- BEHAVIOR SUMMARY ----
  const posBehavior = allData.behavior.filter(b => b.type === 'positive').length;
  const negBehavior = allData.behavior.filter(b => b.type === 'negative').length;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('5. Behavior Summary', 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Records: ${allData.behavior.length}  |  Positive: ${posBehavior}  |  Negative: ${negBehavior}`, 14, yPos);
  yPos += 10;

  // ---- TASKS SUMMARY ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('6. Tasks Summary', 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const pendingTasks = allData.tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = allData.tasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = allData.tasks.filter(t => t.status === 'completed').length;
  const overdueTasks = allData.tasks.filter(t => t.status === 'overdue').length;
  doc.text(`Total: ${allData.tasks.length}  |  Pending: ${pendingTasks}  |  In Progress: ${inProgressTasks}  |  Completed: ${completedTasks}  |  Overdue: ${overdueTasks}`, 14, yPos);
  yPos += 10;

  // ---- INCIDENTS SUMMARY ----
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('7. Incidents Summary', 14, yPos);
  yPos += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const openIncidents = allData.incidents.filter(i => i.status === 'open').length;
  const resolvedIncidents = allData.incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length;
  doc.text(`Total: ${allData.incidents.length}  |  Open: ${openIncidents}  |  Resolved: ${resolvedIncidents}`, 14, yPos);

  addFooter(doc, schoolInfo);
  downloadPdf(doc, `full_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportSchedulePDF(
  scheduleEntries: ClassScheduleEntry[],
  targetClass: Class,
  teachers: { id: string; name: string }[],
  modules: { id: string; name: string }[],
  monthLabel: string,
  schoolInfo: SchoolInfo
) {
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
          imgFormat = fmt === 'JPG' ? 'JPEG' : (fmt === 'PNG' ? 'PNG' : 'JPEG');
        }
      } else {
        imgData = logoStr;
      }
      doc.addImage(imgData, imgFormat, 14, yPos, 12, 12);
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
  doc.text(`Schedule - ${targetClass.name}`, pageWidth - 14, yPos + 5, { align: 'right' });
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

  const tableHead = [['Date', 'Time', 'Teacher', 'Room', 'Module']];
  const tableBody = sorted.map(entry => {
    const teacher = teachers.find(tc => tc.id === entry.teacherId);
    const module = modules.find(m => m.id === entry.moduleId);
    const dateObj = new Date(entry.date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = `${dayName} ${entry.date}`;
    return [
      dateStr,
      entry.timeSlot || '-',
      teacher?.name || entry.teacherId || '-',
      entry.roomId || '-',
      module?.name || entry.moduleId || '-',
    ];
  });

  if (tableBody.length === 0) {
    doc.setFontSize(10);
    doc.text('No schedule entries for this period.', 14, yPos + 10);
  } else {
    // Calculate optimal font size to fit all rows on one page in portrait
    // A4 portrait: usable width ~182mm, usable height from yPos(27) to footer(282) = ~255mm
    const availableHeight = pageHeight - yPos - 20;
    const estimatedRowHeight = 5.5;
    const maxRowsPerPage = Math.floor(availableHeight / estimatedRowHeight);
    const fontSize = tableBody.length > maxRowsPerPage * 2 ? 5 : tableBody.length > maxRowsPerPage ? 5.5 : 6;

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
          schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '',
          schoolInfo.email ? `Email: ${schoolInfo.email}` : ''
        ].filter(Boolean);
        doc.text(footerParts.join('  |  '), 14, ph - 8);
        doc.text(`Page ${pg}`, pw - 14, ph - 8, { align: 'right' });
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
  schoolInfo: SchoolInfo
) {
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
      doc.addImage(imgData, imgFormat, 14, yPos, 15, 15);
    } catch {}
  }
  const textX = schoolInfo.logo ? 32 : 14;
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(schoolInfo.name || 'INFOHAS', textX, yPos + 6);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  if (schoolInfo.field) doc.text(schoolInfo.field, textX, yPos + 12);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('All Classes Schedule', pageWidth - 14, yPos + 6, { align: 'right' });
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
    doc.text(`Class: ${cls.name}`, 14, yPos);
    yPos += 2;
    doc.setTextColor(0, 0, 0);
    yPos += 4;

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const tableBody = sorted.map(entry => {
      const teacher = teachers.find(tc => tc.id === entry.teacherId);
      const module = modules.find(m => m.id === entry.moduleId);
      return [
        entry.date,
        entry.timeSlot || '-',
        teacher?.name || '-',
        entry.roomId || '-',
        module?.name || '-',
      ];
    });

    const fontSize = tableBody.length > 20 ? 5.5 : tableBody.length > 12 ? 6 : 6.5;

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Time', 'Teacher', 'Room', 'Module']],
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

    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
    const fp = [schoolInfo.address || '', schoolInfo.phone ? `Tel: ${schoolInfo.phone}` : '', schoolInfo.email ? `Email: ${schoolInfo.email}` : ''].filter(Boolean);
    doc.text(fp.join('  |  '), 14, ph - 8);
    doc.text(`Page ${i} of ${pageCount}`, pw - 14, ph - 8, { align: 'right' });
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
  const si = schoolInfo as SchoolInfo;
  const { doc } = createDoc({ orientation: 'landscape', title: language === 'fr' ? 'Bulletin de Progres' : 'Progress Report', schoolInfo: si });
  let startY = addHeader(doc, { orientation: 'landscape', title: language === 'fr' ? 'Bulletin de Progres' : 'Progress Report', schoolInfo: si });

  if (reports.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(language === 'fr' ? 'Aucune donnee de progression disponible' : 'No progress data available', 14, startY + 20);
    addFooter(doc, si);
    downloadPdf(doc, `progress_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  // Table header
  const head = [[
    language === 'fr' ? 'Étudiant' : 'Student',
    language === 'fr' ? 'Matière' : 'Module',
    language === 'fr' ? 'Note' : 'Grade',
    language === 'fr' ? '%' : '%',
    language === 'fr' ? 'Statut' : 'Status',
  ]];

  const body = reports.map(r => [
    String(r.studentName || r.fullName || '-'),
    String(r.moduleName || r.module || '-'),
    String(r.grade || r.score || '-'),
    String(r.percentage || r.pct || '0'),
    String(r.status || (Number(r.percentage || r.pct || 0) >= 50 ? (language === 'fr' ? 'Reussi' : 'Pass') : (language === 'fr' ? 'Echoue' : 'Fail'))),
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
      doc.text(language === 'fr' ? 'Commentaire du professeur' : 'Teacher Comment', 14, finalY + 12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(teacherComment, 180);
      doc.text(lines, 14, finalY + 18);
    }
  }

  addFooter(doc, si);
  downloadPdf(doc, `progress_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
