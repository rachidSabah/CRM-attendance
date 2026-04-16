import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee } from './types';

function csvEscape(val: unknown): string {
  const s = String(val == null ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(row: unknown[]): string {
  return row.map(csvEscape).join(',');
}

function downloadFile(content: string, filename: string, type: string = 'text/csv;charset=utf-8;') {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function exportStudentsCSV(students: Student[], classes: Class[]) {
  const rows = [['Full Name', 'Student ID', 'Class', 'Guardian', 'Phone', 'Email', 'Address', 'Status', 'Created']];
  students.forEach(s => {
    const cls = classes.find(c => c.id === s.classId);
    rows.push([s.fullName, s.studentId, cls?.name || '', s.guardianName || '', s.guardianPhone || '', s.email || '', s.address || '', s.status, new Date(s.createdAt).toLocaleDateString()]);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'students_export.csv');
}

export function exportAttendanceCSV(records: AttendanceRecord[], students: Student[], classes: Class[]) {
  const rows = [['Date', 'Student Name', 'Student ID', 'Class', 'Status', 'Notes']];
  records.forEach(r => {
    const s = students.find(st => st.id === r.studentId);
    const cls = classes.find(c => c.id === s?.classId);
    rows.push([r.date, s?.fullName || 'Unknown', s?.studentId || '', cls?.name || '', r.status, r.notes || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'attendance_export.csv');
}

export function exportClassesCSV(classes: Class[], students: Student[]) {
  const rows = [['Class Name', 'Description', 'Teacher', 'Room', 'Capacity', 'Students', 'Created']];
  classes.forEach(c => {
    const count = students.filter(s => s.classId === c.id).length;
    rows.push([c.name, c.description || '', c.teacher || '', c.room || '', String(c.capacity || 0), String(count), new Date(c.createdAt).toLocaleDateString()]);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'classes_export.csv');
}

export function exportModulesCSV(modules: Module[]) {
  const rows = [['Module Name', 'Code', 'Year', 'Semester', 'Credits', 'Description']];
  modules.forEach(m => {
    rows.push([m.name, m.code || '', m.year || '', m.semester || '', String(m.credits || ''), m.description || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'modules_export.csv');
}

export function exportGradesCSV(grades: Grade[], students: Student[], modules: Module[]) {
  const rows = [['Student', 'Student ID', 'Module', 'Grade', 'Percentage', 'Date']];
  grades.forEach(g => {
    const s = students.find(st => st.id === g.studentId);
    const m = modules.find(mod => mod.id === g.moduleId);
    rows.push([s?.fullName || 'Unknown', s?.studentId || '', m?.name || '', g.grade || '', g.percentage != null ? g.percentage + '%' : 'N/A', g.date ? new Date(g.date).toLocaleDateString() : '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'grades_export.csv');
}

export function exportBehaviorCSV(records: BehaviorRecord[], students: Student[]) {
  const rows = [['Student', 'Student ID', 'Type', 'Description', 'Points', 'Date', 'Teacher']];
  records.forEach(r => {
    const s = students.find(st => st.id === r.studentId);
    rows.push([s?.fullName || 'Unknown', s?.studentId || '', r.type, r.description, String(r.points || 0), new Date(r.date).toLocaleDateString(), r.teacher || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'behavior_export.csv');
}

export function exportTasksCSV(tasks: Task[]) {
  const rows = [['Ticket', 'Title', 'Priority', 'Status', 'Assigned To', 'Due Date', 'Progress', 'Created']];
  tasks.forEach(t => {
    rows.push([t.ticketNumber || '', t.title, t.priority, t.status, t.assignedTo || '', t.dueDate || '', String(t.progress || 0) + '%', new Date(t.createdAt).toLocaleDateString()]);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'tasks_export.csv');
}

export function exportIncidentsCSV(incidents: Incident[], students: Student[]) {
  const rows = [['Student', 'Type', 'Severity', 'Status', 'Description', 'Action Taken', 'Date', 'Reported By']];
  incidents.forEach(i => {
    const s = students.find(st => st.id === i.studentId);
    rows.push([s?.fullName || 'Unknown', i.incidentType || '', i.severity, i.status, i.description || '', i.actionTaken || '', i.date || '', i.reportedBy || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'incidents_export.csv');
}

export function exportTeachersCSV(teachers: Teacher[]) {
  const rows = [['Name', 'Subject', 'Email', 'Phone', 'Experience', 'Qualification']];
  teachers.forEach(t => {
    rows.push([t.name, t.subject || '', t.email || '', t.phone || '', String(t.experience || 0), t.qualification || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'teachers_export.csv');
}

export function exportEmployeesCSV(employees: Employee[]) {
  const rows = [['Name', 'Department', 'Position', 'Email', 'Phone']];
  employees.forEach(e => {
    rows.push([e.fullName, e.department || '', e.position || '', e.email || '', e.phone || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'employees_export.csv');
}

export function exportAllCSV(data: { students: Student[]; classes: Class[]; modules: Module[]; attendance: AttendanceRecord[]; grades: Grade[]; behavior: BehaviorRecord[]; tasks: Task[]; incidents: Incident[]; teachers: Teacher[]; employees: Employee[] }) {
  let content = '=== STUDENTS ===\n';
  content += csvRow(['Full Name', 'Student ID', 'Class', 'Guardian', 'Phone', 'Email', 'Status']) + '\n';
  data.students.forEach(s => {
    const cls = data.classes.find(c => c.id === s.classId);
    content += csvRow([s.fullName, s.studentId, cls?.name || '', s.guardianName || '', s.guardianPhone || '', s.email || '', s.status]) + '\n';
  });

  content += '\n=== CLASSES ===\n';
  content += csvRow(['Name', 'Description', 'Teacher', 'Room', 'Capacity']) + '\n';
  data.classes.forEach(c => { content += csvRow([c.name, c.description || '', c.teacher || '', c.room || '', String(c.capacity || 0)]) + '\n'; });

  content += '\n=== ATTENDANCE ===\n';
  content += csvRow(['Date', 'Student', 'Status', 'Notes']) + '\n';
  data.attendance.forEach(a => {
    const s = data.students.find(st => st.id === a.studentId);
    content += csvRow([a.date, s?.fullName || '', a.status, a.notes || '']) + '\n';
  });

  content += '\n=== MODULES ===\n';
  content += csvRow(['Name', 'Code', 'Year', 'Semester', 'Credits']) + '\n';
  data.modules.forEach(m => { content += csvRow([m.name, m.code || '', m.year || '', m.semester || '', String(m.credits || 0)]) + '\n'; });

  content += '\n=== GRADES ===\n';
  content += csvRow(['Student', 'Module', 'Grade', 'Percentage']) + '\n';
  data.grades.forEach(g => {
    const s = data.students.find(st => st.id === g.studentId);
    const m = data.modules.find(mod => mod.id === g.moduleId);
    content += csvRow([s?.fullName || '', m?.name || '', g.grade || '', String(g.percentage || 0)]) + '\n';
  });

  content += '\n=== BEHAVIOR ===\n';
  content += csvRow(['Student', 'Type', 'Description', 'Points', 'Date']) + '\n';
  data.behavior.forEach(b => {
    const s = data.students.find(st => st.id === b.studentId);
    content += csvRow([s?.fullName || '', b.type, b.description, String(b.points || 0), b.date]) + '\n';
  });

  content += '\n=== TASKS ===\n';
  content += csvRow(['Ticket', 'Title', 'Priority', 'Status', 'Due Date', 'Progress']) + '\n';
  data.tasks.forEach(t => { content += csvRow([t.ticketNumber || '', t.title, t.priority, t.status, t.dueDate || '', String(t.progress || 0) + '%']) + '\n'; });

  content += '\n=== INCIDENTS ===\n';
  content += csvRow(['Student', 'Type', 'Severity', 'Status', 'Description', 'Date']) + '\n';
  data.incidents.forEach(i => {
    const s = data.students.find(st => st.id === i.studentId);
    content += csvRow([s?.fullName || '', i.incidentType || '', i.severity, i.status, i.description || '', i.date || '']) + '\n';
  });

  content += '\n=== TEACHERS ===\n';
  content += csvRow(['Name', 'Subject', 'Email', 'Phone']) + '\n';
  data.teachers.forEach(t => { content += csvRow([t.name, t.subject || '', t.email || '', t.phone || '']) + '\n'; });

  content += '\n=== EMPLOYEES ===\n';
  content += csvRow(['Name', 'Department', 'Position', 'Email']) + '\n';
  data.employees.forEach(e => { content += csvRow([e.fullName, e.department || '', e.position || '', e.email || '']) + '\n'; });

  downloadFile(content, `complete_export_${new Date().toISOString().slice(0, 10)}.csv`);
}
