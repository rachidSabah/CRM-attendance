import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordAttendance,
  mergeAttendanceRecords,
  calculateAttendanceStats,
  type AttendanceRecordLike,
  type StudentLike,
} from './attendanceLogic';

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
