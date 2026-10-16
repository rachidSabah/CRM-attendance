import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordAttendance,
  mergeAttendanceRecords,
  calculateAttendanceStats,
  calculateWeeklyLowAttendanceClasses,
  getDateRangeBounds,
  type AttendanceRecordLike,
  type StudentLike,
  type ClassLike,
} from './attendanceLogic.ts';

test('recordAttendance adds new records and preserves other dates', () => {
  const existing: AttendanceRecordLike[] = [
    { id: '1', studentId: 's1', date: '2026-10-14', status: 'present' },
  ];
  const students: StudentLike[] = [
    { id: 's1' },
    { id: 's2' },
  ];

  let counter = 10;
  const idGen = () => `id_${counter++}`;

  const result = recordAttendance(
    existing,
    '2026-10-15',
    students,
    { s1: 'present', s2: 'absent' },
    idGen
  );

  assert.equal(result.updatedAttendance.length, 3);
  assert.equal(result.newAbsences.length, 1);
  assert.equal(result.newAbsences[0].studentId, 's2');
  assert.equal(result.newAbsences[0].status, 'absent');

  // Verify other date record is preserved intact
  const pastRec = result.updatedAttendance.find(r => r.date === '2026-10-14');
  assert.ok(pastRec);
  assert.equal(pastRec.status, 'present');
});

test('recordAttendance updates existing status without duplicate entries', () => {
  const existing: AttendanceRecordLike[] = [
    { id: '1', studentId: 's1', date: '2026-10-15', status: 'present' },
  ];
  const students: StudentLike[] = [{ id: 's1' }];

  const result = recordAttendance(
    existing,
    '2026-10-15',
    students,
    { s1: 'late' },
    () => 'id_99'
  );

  assert.equal(result.updatedAttendance.length, 1);
  assert.equal(result.updatedAttendance[0].status, 'late');
  assert.equal(result.updatedAttendance[0].id, '1');
  assert.equal(result.newAbsences.length, 1);
});

test('mergeAttendanceRecords preserves cloud and adds unsynced local records', () => {
  const cloud: AttendanceRecordLike[] = [
    { id: 'c1', studentId: 's1', date: '2026-10-14', status: 'present' },
  ];
  const local: AttendanceRecordLike[] = [
    { id: 'c1', studentId: 's1', date: '2026-10-14', status: 'present' },
    { id: 'l2', studentId: 's2', date: '2026-10-15', status: 'absent' },
  ];

  const { merged, hasLocalUnsynced } = mergeAttendanceRecords(cloud, local);

  assert.equal(hasLocalUnsynced, true);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(r => r.studentId === 's2')?.status, 'absent');
});

test('calculateAttendanceStats accurately totals statuses', () => {
  const students: StudentLike[] = [
    { id: 's1', classId: 'c1', status: 'active' },
    { id: 's2', classId: 'c1', status: 'active' },
    { id: 's3', classId: 'c2', status: 'active' },
  ];
  const records: AttendanceRecordLike[] = [
    { id: '1', studentId: 's1', date: '2026-10-15', status: 'present' },
    { id: '2', studentId: 's2', date: '2026-10-15', status: 'absent' },
  ];

  const stats = calculateAttendanceStats(students, records, '2026-10-15', 'c1');
  assert.equal(stats.present, 1);
  assert.equal(stats.absent, 1);
  assert.equal(stats.unmarked, 0);
  assert.equal(stats.total, 2);

  const allStats = calculateAttendanceStats(students, records, '2026-10-15', 'all');
  assert.equal(allStats.unmarked, 1);
  assert.equal(allStats.total, 3);
});

test('calculateWeeklyLowAttendanceClasses computes percentage correctly for current week', () => {
  const refDate = new Date('2026-10-15T10:00:00Z');

  const classes: ClassLike[] = [
    { id: 'cls_a', name: 'Class Alpha' },
    { id: 'cls_b', name: 'Class Beta' },
  ];

  const students: StudentLike[] = [
    { id: 'st_1', classId: 'cls_a', status: 'active' },
    { id: 'st_2', classId: 'cls_a', status: 'active' },
    { id: 'st_3', classId: 'cls_b', status: 'active' },
    { id: 'st_4', classId: 'cls_b', status: 'active' },
  ];

  const attendance: AttendanceRecordLike[] = [
    { id: '1', studentId: 'st_1', date: '2026-10-13', status: 'present' },
    { id: '2', studentId: 'st_2', date: '2026-10-13', status: 'absent' },
    { id: '3', studentId: 'st_3', date: '2026-10-14', status: 'present' },
    { id: '4', studentId: 'st_4', date: '2026-10-14', status: 'present' },
    { id: '5', studentId: 'st_1', date: '2026-10-05', status: 'present' },
  ];

  const res = calculateWeeklyLowAttendanceClasses(classes, students, attendance, refDate, 75);

  assert.equal(res.totalEvaluatedClasses, 2);
  assert.equal(res.lowRateClassCount, 1);
  assert.equal(res.percentage, 50);
  assert.equal(res.lowClasses.length, 1);
  assert.equal(res.lowClasses[0].name, 'Class Alpha');
  assert.equal(res.lowClasses[0].rate, 50);
});

test('getDateRangeBounds calculates ranges accurately', () => {
  const ref = new Date('2026-10-15T12:00:00Z'); // Thursday

  const todayBounds = getDateRangeBounds('today', ref);
  assert.equal(todayBounds.startDate, '2026-10-15');
  assert.equal(todayBounds.endDate, '2026-10-15');

  const weekBounds = getDateRangeBounds('this_week', ref);
  assert.equal(weekBounds.startDate, '2026-10-12'); // Monday
  assert.equal(weekBounds.endDate, '2026-10-18'); // Sunday

  const sevenDayBounds = getDateRangeBounds('last_7_days', ref);
  assert.equal(sevenDayBounds.startDate, '2026-10-09');
  assert.equal(sevenDayBounds.endDate, '2026-10-15');

  const monthBounds = getDateRangeBounds('this_month', ref);
  assert.equal(monthBounds.startDate, '2026-10-01');
  assert.equal(monthBounds.endDate, '2026-10-31');

  const customBounds = getDateRangeBounds('custom', ref, '2026-10-05', '2026-10-10');
  assert.equal(customBounds.startDate, '2026-10-05');
  assert.equal(customBounds.endDate, '2026-10-10');
});
