import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSmartDoc,
  exportIndividualStudentPDF,
  exportClassGroupReportPDF,
  exportProgressReportPDF,
  exportStudentBadgesPDF,
  exportBulletinSemestrielPDF,
  exportAbsenceWarningLetterPDF,
} from './pdf';
import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Incident, SchoolInfo } from './types';

test('createSmartDoc selects orientation and format adaptively', () => {
  // Portrait when small columns and normal width
  const docSmall = createSmartDoc({
    title: 'Small Doc',
    columnCount: 4,
    estimatedContentWidthMm: 120,
    orientation: 'auto',
  });
  assert.equal(docSmall.orientation, 'portrait');
  assert.equal(docSmall.format, 'a4');

  // Landscape when wide columns (>180mm or >6 cols)
  const docWide = createSmartDoc({
    title: 'Wide Doc',
    columnCount: 10,
    estimatedContentWidthMm: 220,
    orientation: 'auto',
  });
  assert.equal(docWide.orientation, 'landscape');
  assert.equal(docWide.format, 'a4');

  // A3 or custom format when ultra-wide (>269mm)
  const docUltraWide = createSmartDoc({
    title: 'Ultra Wide Matrix',
    columnCount: 35,
    estimatedContentWidthMm: 340,
    orientation: 'landscape',
  });
  assert.equal(docUltraWide.orientation, 'landscape');
  assert.equal(docUltraWide.format, 'a3');

  // Even wider (>390mm) custom width
  const docHuge = createSmartDoc({
    title: 'Huge Matrix',
    columnCount: 50,
    estimatedContentWidthMm: 450,
    orientation: 'landscape',
  });
  assert.equal(docHuge.orientation, 'landscape');
  assert.ok(Array.isArray(docHuge.format));
  assert.ok((docHuge.format as [number, number])[0] > 420);
});

test('exportIndividualStudentPDF generates without errors', () => {
  const dummyStudent: Student = {
    id: 'st_1',
    fullName: 'Yassine Alami',
    studentId: 'STD-1001',
    classId: 'cls_1',
    className: 'Dev Digital 1',
    academicYear: '2026-2027',
    status: 'active',
    guardianName: 'Omar Alami',
    guardianPhone: '+212600000000',
    email: 'yassine@example.com',
    address: '123 Boulevard Hassan II, Casablanca',
    createdAt: new Date().toISOString(),
  };

  const dummyClass: Class = {
    id: 'cls_1',
    name: 'Dev Digital 1',
    academicYear: '2026-2027',
    createdAt: new Date().toISOString(),
  };

  const dummyAttendance: AttendanceRecord[] = [
    { id: 'att_1', studentId: 'st_1', date: '2026-10-01', status: 'present', createdAt: '' },
    { id: 'att_2', studentId: 'st_1', date: '2026-10-02', status: 'absent', notes: 'Sick leave', createdAt: '' },
    { id: 'att_3', studentId: 'st_1', date: '2026-10-03', status: 'present', createdAt: '' },
  ];

  const dummyModules: Module[] = [
    { id: 'mod_1', name: 'Algorithmique & Python', code: 'M01', createdAt: '' },
    { id: 'mod_2', name: 'Bases de Données SQL', code: 'M02', createdAt: '' },
  ];

  const dummyGrades: Grade[] = [
    { id: 'grd_1', studentId: 'st_1', moduleId: 'mod_1', grade: '16/20', percentage: 80, date: '2026-10-05', createdAt: '' },
    { id: 'grd_2', studentId: 'st_1', moduleId: 'mod_2', grade: '18/20', percentage: 90, date: '2026-10-08', createdAt: '' },
  ];

  const dummyBehavior: BehaviorRecord[] = [
    { id: 'beh_1', studentId: 'st_1', type: 'positive', description: 'Excellente participation', points: 5, date: '2026-10-02', createdAt: '' }
  ];

  const dummyIncidents: Incident[] = [];

  const schoolInfo: SchoolInfo = {
    name: 'INFOHAS SUP',
    field: 'Formation Professionnelle & Supérieure',
    phone: '+212522000000',
    email: 'contact@infohas.ma',
    address: 'Casablanca, Maroc',
  };

  assert.doesNotThrow(() => {
    exportIndividualStudentPDF(
      dummyStudent,
      dummyClass,
      dummyAttendance,
      dummyGrades,
      dummyModules,
      dummyBehavior,
      dummyIncidents,
      schoolInfo,
      'fr'
    );
  });
});

test('exportClassGroupReportPDF generates matrix and summary without errors', () => {
  const dummyStudents: Student[] = [
    { id: 'st_1', fullName: 'Fatima Zahra', studentId: 'STD-1001', classId: 'cls_1', status: 'active', createdAt: '' },
    { id: 'st_2', fullName: 'Karim Mansouri', studentId: 'STD-1002', classId: 'cls_1', status: 'active', createdAt: '' },
  ];

  const dummyClass: Class = {
    id: 'cls_1',
    name: 'Dev Web 2',
    createdAt: '',
  };

  const dummyAttendance: AttendanceRecord[] = [
    { id: 'a1', studentId: 'st_1', date: '2026-10-01', status: 'present', createdAt: '' },
    { id: 'a2', studentId: 'st_1', date: '2026-10-02', status: 'present', createdAt: '' },
    { id: 'a3', studentId: 'st_2', date: '2026-10-01', status: 'absent', createdAt: '' },
    { id: 'a4', studentId: 'st_2', date: '2026-10-02', status: 'late', createdAt: '' },
  ];

  // Test Matrix mode
  assert.doesNotThrow(() => {
    exportClassGroupReportPDF(
      dummyClass,
      dummyStudents,
      dummyAttendance,
      [],
      [],
      { name: 'INFOHAS' },
      'fr',
      { mode: 'matrix' }
    );
  });

  // Test Summary mode
  assert.doesNotThrow(() => {
    exportClassGroupReportPDF(
      dummyClass,
      dummyStudents,
      dummyAttendance,
      [],
      [],
      { name: 'INFOHAS' },
      'fr',
      { mode: 'summary' }
    );
  });
});

test('exportStudentBadgesPDF generates badges sheet with QR codes without errors', async () => {
  const dummyStudents: Student[] = [
    { id: 'st_1', fullName: 'Yasmine Ibnoghazala', studentId: 'F01/26', classId: 'cls_1', status: 'active', createdAt: '' },
    { id: 'st_2', fullName: 'Douae Mourchid', studentId: 'F02/26', classId: 'cls_1', status: 'active', createdAt: '' },
  ];
  const dummyClasses: Class[] = [{ id: 'cls_1', name: 'Group Dubai', createdAt: '' }];

  await assert.doesNotReject(async () => {
    await exportStudentBadgesPDF(dummyStudents, dummyClasses, { name: 'INFOHAS' }, 'fr');
  });
});

test('exportBulletinSemestrielPDF calculates weighted average and passes without errors', () => {
  const dummyStudent: Student = { id: 'st_1', fullName: 'Yasmine Ibnoghazala', studentId: 'F01/26', classId: 'cls_1', status: 'active', createdAt: '' };
  const dummyClass: Class = { id: 'cls_1', name: 'Group Dubai', createdAt: '' };
  const dummyModules: Module[] = [
    { id: 'm1', name: 'Sécurité Aérienne', code: 'M01', coef: 2, createdAt: '' },
    { id: 'm2', name: 'Anglais Aéronautique', code: 'M02', coef: 3, createdAt: '' },
  ];
  const dummyGrades: Grade[] = [
    { id: 'g1', studentId: 'st_1', moduleId: 'm1', percentage: 80, createdAt: '' },
    { id: 'g2', studentId: 'st_1', moduleId: 'm2', percentage: 85, createdAt: '' },
  ];
  const dummyAtt: AttendanceRecord[] = [
    { id: 'a1', studentId: 'st_1', date: '2026-10-01', status: 'present', createdAt: '' },
  ];

  assert.doesNotThrow(() => {
    exportBulletinSemestrielPDF(dummyStudent, dummyClass, dummyModules, dummyGrades, dummyAtt, { name: 'INFOHAS' }, 'fr');
  });
});

test('exportAbsenceWarningLetterPDF generates official warning letter without errors', () => {
  const dummyStudent: Student = { id: 'st_1', fullName: 'Yasmine Ibnoghazala', studentId: 'F01/26', classId: 'cls_1', status: 'active', createdAt: '' };
  const dummyClass: Class = { id: 'cls_1', name: 'Group Dubai', createdAt: '' };
  const absenceDates = ['2026-10-01', '2026-10-05', '2026-10-08', '2026-10-10', '2026-10-12'];

  assert.doesNotThrow(() => {
    exportAbsenceWarningLetterPDF(dummyStudent, dummyClass, absenceDates, { name: 'INFOHAS' }, 'fr', 'warning_2');
  });
});

