const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, 'imported_students.sql'), 'utf8');
const lines = content.split('\n').filter(Boolean);
const students = [];
const classes = [];

for (const l of lines) {
  const start = l.indexOf("'{");
  const end = l.indexOf("}', datetime");
  if (start !== -1 && end !== -1) {
    const jsonStr = l.slice(start + 1, end + 1);
    const obj = JSON.parse(jsonStr);
    if (l.includes("'students'")) students.push(obj);
    else if (l.includes("'classes'")) classes.push(obj);
  }
}

const modules = [
  { id: 'mod_01', code: 'M01', name: 'Métier et formation', year: '1', semester: 'S1', hours: 30, coef: 2, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_02', code: 'M02', name: 'Comportements et attitudes professionnels', year: '1', semester: 'S1', hours: 45, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_03', code: 'M03', name: 'Interaction en situations professionnelles', year: '1', semester: 'S1', hours: 60, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_04', code: 'M04', name: 'Communication en français', year: '1', semester: 'S1', hours: 75, coef: 4, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_05', code: 'M05', name: 'Approche client', year: '1', semester: 'S1', hours: 45, coef: 2, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_06', code: 'M06', name: 'Environnement professionnel', year: '1', semester: 'S1', hours: 45, coef: 2, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_07', code: 'M07', name: 'Mesures de sûreté', year: '1', semester: 'S2', hours: 60, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_08', code: 'M08', name: 'Marchandises dangereuses', year: '1', semester: 'S2', hours: 45, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_09', code: 'M09', name: 'Procédures de pré-départ', year: '1', semester: 'S2', hours: 45, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_10', code: 'M10', name: 'Embarquement et départ', year: '1', semester: 'S2', hours: 45, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_11', code: 'M11', name: 'Outils informatiques', year: '1', semester: 'S1', hours: 60, coef: 2, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_12', code: 'M12', name: 'Communication en anglais', year: '1', semester: 'S2', hours: 90, coef: 4, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_13', code: 'M13', name: 'Activités d’accueil en milieu de travail (Stage 1)', year: '1', semester: 'S2', hours: 120, coef: 4, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_14', code: 'M14', name: 'Service à bord', year: '2', semester: 'S3', hours: 60, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_15', code: 'M15', name: 'Gestion des passagers indisciplinés', year: '2', semester: 'S3', hours: 40, coef: 2, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_16', code: 'M16', name: 'Premiers secours et urgences médicales', year: '2', semester: 'S3', hours: 60, coef: 4, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_17', code: 'M17', name: 'Survie en mer et en milieu hostile', year: '2', semester: 'S3', hours: 45, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_18', code: 'M18', name: 'Lutte contre les incendies et fumées', year: '2', semester: 'S3', hours: 45, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_19', code: 'M19', name: 'Procédures d’évacuation et d’urgence', year: '2', semester: 'S4', hours: 60, coef: 4, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_20', code: 'M20', name: 'Gestion des ressources de l’équipage (CRM)', year: '2', semester: 'S4', hours: 45, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_21', code: 'M21', name: 'Réglementation aéronautique et sûreté de l aviation', year: '2', semester: 'S4', hours: 60, coef: 3, createdAt: '2026-10-15T00:00:00.000Z' },
  { id: 'mod_22', code: 'M22', name: 'Stage pratique en entreprise (Stage 2)', year: '2', semester: 'S4', hours: 160, coef: 5, createdAt: '2026-10-15T00:00:00.000Z' },
];

const schoolInfo = {
  name: 'INFOHAS SUP',
  field: 'Institut de Formation Hôtelière et Aviation Spécialisée',
  phone: '05 37 76 20 25',
  email: 'contact@infohas.ma',
  address: '15 Rue Demnate Hassan, Rabat',
  academicYear: '2026-2028',
};

const academicYears = [
  { id: 'ay_2026_2028', name: '2026-2028', isCurrent: true, startDate: '2026-09-01', endDate: '2028-06-30' },
];

const admins = [
  {
    id: 'admin',
    username: 'admin',
    fullName: 'Administrateur INFOHAS',
    name: 'Administrateur INFOHAS',
    email: 'direction@infohas.ma',
    role: 'super_admin',
    department: 'Direction',
    tenantId: 'default',
    is_super_admin: true,
  },
];

const fileContent = `/**
 * Authoritative Seed Data for INFOHAS Attendance Application
 * Embedded fallback store to guarantee instant data recovery and resilience
 * against D1 rate-limiting, network failures, or initial cold-start deployments.
 */

export const SEED_CLASSES = ${JSON.stringify(classes, null, 2)};

export const SEED_STUDENTS = ${JSON.stringify(students, null, 2)};

export const SEED_MODULES = ${JSON.stringify(modules, null, 2)};

export const SEED_SCHOOL_INFO = ${JSON.stringify(schoolInfo, null, 2)};

export const SEED_ACADEMIC_YEARS = ${JSON.stringify(academicYears, null, 2)};

export const SEED_ADMINS = ${JSON.stringify(admins, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'functions', '_lib', 'seedData.js'), fileContent, 'utf8');
console.log(`Successfully generated functions/_lib/seedData.js with ${classes.length} classes, ${students.length} students, ${modules.length} modules.`);
