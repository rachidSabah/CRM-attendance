import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee } from './types';

// ---------------------------------------------------------------------------
// i18n helper: pick the right string for a given language
// ---------------------------------------------------------------------------
function h(en: string, fr: string, lang: string): string {
  if (lang === 'fr') return fr;
  return en; // 'en' and 'ar' both use English headers
}

/** Shared fallback translations keyed by language */
function unknownFallback(lang: string): string {
  return h('Unknown', 'Inconnu', lang);
}
function naFallback(lang: string): string {
  return h('N/A', 'N/A', lang);
}

// ---------------------------------------------------------------------------
// CSV utilities (unchanged)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Export functions — all have `language: string = 'en'` as the LAST param
// ---------------------------------------------------------------------------

export function exportStudentsCSV(students: Student[], classes: Class[], language: string = 'en') {
  const rows = [[
    h('Full Name', 'Nom Complet', language),
    h('Student ID', 'ID Étudiant', language),
    h('Class', 'Classe', language),
    h('Guardian', 'Tuteur', language),
    h('Phone', 'Téléphone', language),
    h('Email', 'Email', language),
    h('Address', 'Adresse', language),
    h('Status', 'Statut', language),
    h('Created', 'Créé', language),
  ]];
  students.forEach(s => {
    const cls = classes.find(c => c.id === s.classId);
    rows.push([s.fullName, s.studentId, cls?.name || '', s.guardianName || '', s.guardianPhone || '', s.email || '', s.address || '', s.status, new Date(s.createdAt).toLocaleDateString()]);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'students_export.csv');
}

export function exportAttendanceCSV(records: AttendanceRecord[], students: Student[], classes: Class[], language: string = 'en') {
  const rows = [[
    h('Date', 'Date', language),
    h('Student Name', 'Nom Étudiant', language),
    h('Student ID', 'ID Étudiant', language),
    h('Class', 'Classe', language),
    h('Status', 'Statut', language),
    h('Notes', 'Notes', language),
  ]];
  records.forEach(r => {
    const s = students.find(st => st.id === r.studentId);
    const cls = classes.find(c => c.id === s?.classId);
    rows.push([r.date, s?.fullName || unknownFallback(language), s?.studentId || '', cls?.name || '', r.status, r.notes || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'attendance_export.csv');
}

export function exportClassesCSV(classes: Class[], students: Student[], language: string = 'en') {
  const rows = [[
    h('Class Name', 'Nom de Classe', language),
    h('Description', 'Description', language),
    h('Teacher', 'Enseignant', language),
    h('Room', 'Salle', language),
    h('Capacity', 'Capacité', language),
    h('Students', 'Étudiants', language),
    h('Created', 'Créé', language),
  ]];
  classes.forEach(c => {
    const count = students.filter(s => s.classId === c.id).length;
    rows.push([c.name, c.description || '', c.teacher || '', c.room || '', String(c.capacity || 0), String(count), new Date(c.createdAt).toLocaleDateString()]);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'classes_export.csv');
}

export function exportModulesCSV(modules: Module[], language: string = 'en') {
  const rows = [[
    h('Module Name', 'Nom du Module', language),
    h('Code', 'Code', language),
    h('Year', 'Année', language),
    h('Semester', 'Semestre', language),
    h('Hours', 'Heures', language),
    h('Description', 'Description', language),
  ]];
  modules.forEach(m => {
    rows.push([m.name, m.code || '', m.year || '', m.semester || '', String(m.hours || ''), m.description || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'modules_export.csv');
}

export function exportGradesCSV(grades: Grade[], students: Student[], modules: Module[], language: string = 'en') {
  const rows = [[
    h('Student', 'Étudiant', language),
    h('Student ID', 'ID Étudiant', language),
    h('Module', 'Module', language),
    h('Grade', 'Note', language),
    h('Percentage', 'Pourcentage', language),
    h('Date', 'Date', language),
  ]];
  grades.forEach(g => {
    const s = students.find(st => st.id === g.studentId);
    const m = modules.find(mod => mod.id === g.moduleId);
    rows.push([s?.fullName || unknownFallback(language), s?.studentId || '', m?.name || '', g.grade || '', g.percentage != null ? g.percentage + '%' : naFallback(language), g.date ? new Date(g.date).toLocaleDateString() : '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'grades_export.csv');
}

export function exportBehaviorCSV(records: BehaviorRecord[], students: Student[], language: string = 'en') {
  const rows = [[
    h('Student', 'Étudiant', language),
    h('Student ID', 'ID Étudiant', language),
    h('Type', 'Type', language),
    h('Description', 'Description', language),
    h('Points', 'Points', language),
    h('Date', 'Date', language),
    h('Teacher', 'Enseignant', language),
  ]];
  records.forEach(r => {
    const s = students.find(st => st.id === r.studentId);
    rows.push([s?.fullName || unknownFallback(language), s?.studentId || '', r.type, r.description, String(r.points || 0), new Date(r.date).toLocaleDateString(), r.teacher || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'behavior_export.csv');
}

export function exportTasksCSV(tasks: Task[], language: string = 'en') {
  const rows = [[
    h('Ticket', 'Ticket', language),
    h('Title', 'Titre', language),
    h('Priority', 'Priorité', language),
    h('Status', 'Statut', language),
    h('Assigned To', 'Assigné À', language),
    h('Due Date', 'Date Limite', language),
    h('Progress', 'Progression', language),
    h('Created', 'Créé', language),
  ]];
  tasks.forEach(t => {
    rows.push([t.ticketNumber || '', t.title, t.priority, t.status, t.assignedTo || '', t.dueDate || '', String(t.progress || 0) + '%', new Date(t.createdAt).toLocaleDateString()]);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'tasks_export.csv');
}

export function exportIncidentsCSV(incidents: Incident[], students: Student[], language: string = 'en') {
  const rows = [[
    h('Student', 'Étudiant', language),
    h('Type', 'Type', language),
    h('Severity', 'Sévérité', language),
    h('Status', 'Statut', language),
    h('Description', 'Description', language),
    h('Action Taken', 'Action Prise', language),
    h('Date', 'Date', language),
    h('Reported By', 'Signalé Par', language),
  ]];
  incidents.forEach(i => {
    const s = students.find(st => st.id === i.studentId);
    rows.push([s?.fullName || unknownFallback(language), i.incidentType || '', i.severity, i.status, i.description || '', i.actionTaken || '', i.date || '', i.reportedBy || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'incidents_export.csv');
}

export function exportTeachersCSV(teachers: Teacher[], language: string = 'en') {
  const rows = [[
    h('Name', 'Nom', language),
    h('Subject', 'Matière', language),
    h('Email', 'Email', language),
    h('Phone', 'Téléphone', language),
    h('Experience', 'Expérience', language),
    h('Qualification', 'Qualification', language),
  ]];
  teachers.forEach(t => {
    rows.push([t.name, t.subject || '', t.email || '', t.phone || '', String(t.experience || 0), t.qualification || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'teachers_export.csv');
}

export function exportEmployeesCSV(employees: Employee[], language: string = 'en') {
  const rows = [[
    h('Name', 'Nom', language),
    h('Department', 'Département', language),
    h('Position', 'Poste', language),
    h('Email', 'Email', language),
    h('Phone', 'Téléphone', language),
  ]];
  employees.forEach(e => {
    rows.push([e.fullName, e.department || '', e.position || '', e.email || '', e.phone || '']);
  });
  downloadFile(rows.map(csvRow).join('\n'), 'employees_export.csv');
}

// ---------------------------------------------------------------------------
// exportAllCSV — combined export with section headers
// ---------------------------------------------------------------------------
export function exportAllCSV(
  data: {
    students: Student[];
    classes: Class[];
    modules: Module[];
    attendance: AttendanceRecord[];
    grades: Grade[];
    behavior: BehaviorRecord[];
    tasks: Task[];
    incidents: Incident[];
    teachers: Teacher[];
    employees: Employee[];
  },
  language: string = 'en',
) {
  let content = '';

  // Students
  content += `=== ${h('STUDENTS', 'ÉTUDIANTS', language)} ===\n`;
  content += csvRow([
    h('Full Name', 'Nom Complet', language),
    h('Student ID', 'ID Étudiant', language),
    h('Class', 'Classe', language),
    h('Guardian', 'Tuteur', language),
    h('Phone', 'Téléphone', language),
    h('Email', 'Email', language),
    h('Status', 'Statut', language),
  ]) + '\n';
  data.students.forEach(s => {
    const cls = data.classes.find(c => c.id === s.classId);
    content += csvRow([s.fullName, s.studentId, cls?.name || '', s.guardianName || '', s.guardianPhone || '', s.email || '', s.status]) + '\n';
  });

  // Classes
  content += `\n=== ${h('CLASSES', 'CLASSES', language)} ===\n`;
  content += csvRow([
    h('Name', 'Nom', language),
    h('Description', 'Description', language),
    h('Teacher', 'Enseignant', language),
    h('Room', 'Salle', language),
    h('Capacity', 'Capacité', language),
  ]) + '\n';
  data.classes.forEach(c => {
    content += csvRow([c.name, c.description || '', c.teacher || '', c.room || '', String(c.capacity || 0)]) + '\n';
  });

  // Attendance
  content += `\n=== ${h('ATTENDANCE', 'PRÉSENCE', language)} ===\n`;
  content += csvRow([
    h('Date', 'Date', language),
    h('Student', 'Étudiant', language),
    h('Status', 'Statut', language),
    h('Notes', 'Notes', language),
  ]) + '\n';
  data.attendance.forEach(a => {
    const s = data.students.find(st => st.id === a.studentId);
    content += csvRow([a.date, s?.fullName || '', a.status, a.notes || '']) + '\n';
  });

  // Modules
  content += `\n=== ${h('MODULES', 'MODULES', language)} ===\n`;
  content += csvRow([
    h('Name', 'Nom', language),
    h('Code', 'Code', language),
    h('Year', 'Année', language),
    h('Semester', 'Semestre', language),
    h('Hours', 'Heures', language),
  ]) + '\n';
  data.modules.forEach(m => {
    content += csvRow([m.name, m.code || '', m.year || '', m.semester || '', String(m.hours || 0)]) + '\n';
  });

  // Grades
  content += `\n=== ${h('GRADES', 'NOTES', language)} ===\n`;
  content += csvRow([
    h('Student', 'Étudiant', language),
    h('Module', 'Module', language),
    h('Grade', 'Note', language),
    h('Percentage', 'Pourcentage', language),
  ]) + '\n';
  data.grades.forEach(g => {
    const s = data.students.find(st => st.id === g.studentId);
    const m = data.modules.find(mod => mod.id === g.moduleId);
    content += csvRow([s?.fullName || '', m?.name || '', g.grade || '', String(g.percentage || 0)]) + '\n';
  });

  // Behavior
  content += `\n=== ${h('BEHAVIOR', 'COMPORTEMENT', language)} ===\n`;
  content += csvRow([
    h('Student', 'Étudiant', language),
    h('Type', 'Type', language),
    h('Description', 'Description', language),
    h('Points', 'Points', language),
    h('Date', 'Date', language),
  ]) + '\n';
  data.behavior.forEach(b => {
    const s = data.students.find(st => st.id === b.studentId);
    content += csvRow([s?.fullName || '', b.type, b.description, String(b.points || 0), b.date]) + '\n';
  });

  // Tasks
  content += `\n=== ${h('TASKS', 'TÂCHES', language)} ===\n`;
  content += csvRow([
    h('Ticket', 'Ticket', language),
    h('Title', 'Titre', language),
    h('Priority', 'Priorité', language),
    h('Status', 'Statut', language),
    h('Due Date', 'Date Limite', language),
    h('Progress', 'Progression', language),
  ]) + '\n';
  data.tasks.forEach(t => {
    content += csvRow([t.ticketNumber || '', t.title, t.priority, t.status, t.dueDate || '', String(t.progress || 0) + '%']) + '\n';
  });

  // Incidents
  content += `\n=== ${h('INCIDENTS', 'INCIDENTS', language)} ===\n`;
  content += csvRow([
    h('Student', 'Étudiant', language),
    h('Type', 'Type', language),
    h('Severity', 'Sévérité', language),
    h('Status', 'Statut', language),
    h('Description', 'Description', language),
    h('Date', 'Date', language),
  ]) + '\n';
  data.incidents.forEach(i => {
    const s = data.students.find(st => st.id === i.studentId);
    content += csvRow([s?.fullName || '', i.incidentType || '', i.severity, i.status, i.description || '', i.date || '']) + '\n';
  });

  // Teachers
  content += `\n=== ${h('TEACHERS', 'ENSEIGNANTS', language)} ===\n`;
  content += csvRow([
    h('Name', 'Nom', language),
    h('Subject', 'Matière', language),
    h('Email', 'Email', language),
    h('Phone', 'Téléphone', language),
  ]) + '\n';
  data.teachers.forEach(t => {
    content += csvRow([t.name, t.subject || '', t.email || '', t.phone || '']) + '\n';
  });

  // Employees
  content += `\n=== ${h('EMPLOYEES', 'EMPLOYÉS', language)} ===\n`;
  content += csvRow([
    h('Name', 'Nom', language),
    h('Department', 'Département', language),
    h('Position', 'Poste', language),
    h('Email', 'Email', language),
  ]) + '\n';
  data.employees.forEach(e => {
    content += csvRow([e.fullName, e.department || '', e.position || '', e.email || '']) + '\n';
  });

  downloadFile(content, `complete_export_${new Date().toISOString().slice(0, 10)}.csv`);
}
