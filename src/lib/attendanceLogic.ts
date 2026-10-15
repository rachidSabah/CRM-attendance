export interface AttendanceRecordLike {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  createdAt?: string;
  notes?: string;
}

export interface StudentLike {
  id: string;
  status?: string;
  classId?: string;
}

/**
 * Pure function to record/update attendance for a given date and student-status map.
 * Preserves other-day records and non-filtered students.
 */
export function recordAttendance(
  existingAttendance: AttendanceRecordLike[],
  selectedDate: string,
  targetStudents: StudentLike[],
  statusMap: Record<string, 'present' | 'absent' | 'late' | 'excused'>,
  idGenerator: () => string
): {
  updatedAttendance: AttendanceRecordLike[];
  newAbsences: Array<{ studentId: string; status: 'absent' | 'late' }>;
} {
  const targetStudentIds = new Set(targetStudents.map(s => s.id));
  const otherDayRecords = existingAttendance.filter(
    r => r.date === selectedDate && !targetStudentIds.has(r.studentId)
  );
  const otherDateRecords = existingAttendance.filter(r => r.date !== selectedDate);

  const updatedTargetRecords: AttendanceRecordLike[] = [];
  const newAbsences: Array<{ studentId: string; status: 'absent' | 'late' }> = [];

  for (const s of targetStudents) {
    const desiredStatus = statusMap[s.id] || 'present';
    const existing = existingAttendance.find(
      r => r.date === selectedDate && r.studentId === s.id
    );

    if (existing) {
      updatedTargetRecords.push({
        ...existing,
        status: desiredStatus,
      });
    } else {
      updatedTargetRecords.push({
        id: idGenerator(),
        studentId: s.id,
        date: selectedDate,
        status: desiredStatus,
        createdAt: new Date().toISOString(),
      });
    }

    if (
      (desiredStatus === 'absent' || desiredStatus === 'late') &&
      (!existing || existing.status !== desiredStatus)
    ) {
      newAbsences.push({ studentId: s.id, status: desiredStatus });
    }
  }

  return {
    updatedAttendance: [...otherDateRecords, ...otherDayRecords, ...updatedTargetRecords],
    newAbsences,
  };
}

/**
 * Merges cloud attendance with local cached attendance.
 * Preserves all authoritative cloud records, but injects any local records that haven't reached cloud yet.
 */
export function mergeAttendanceRecords(
  cloudRecords: AttendanceRecordLike[],
  localCachedRecords: AttendanceRecordLike[]
): {
  merged: AttendanceRecordLike[];
  hasLocalUnsynced: boolean;
} {
  const cloudMap = new Map<string, AttendanceRecordLike>();
  for (const r of cloudRecords) {
    cloudMap.set(`${r.studentId}_${r.date}`, r);
  }

  const merged = [...cloudRecords];
  let hasLocalUnsynced = false;

  for (const local of localCachedRecords) {
    const key = `${local.studentId}_${local.date}`;
    if (!cloudMap.has(key)) {
      merged.push(local);
      hasLocalUnsynced = true;
    }
  }

  return { merged, hasLocalUnsynced };
}

/**
 * Calculates attendance counts for a given list of students and date
 */
export function calculateAttendanceStats(
  students: StudentLike[],
  attendance: AttendanceRecordLike[],
  date: string,
  classId?: string
) {
  const filtered = students.filter(
    s => s.status !== 'inactive' && (!classId || classId === 'all' || s.classId === classId)
  );
  const dateMap: Record<string, string> = {};
  for (const r of attendance) {
    if (r.date === date) {
      dateMap[r.studentId] = r.status;
    }
  }

  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;
  let unmarked = 0;

  for (const s of filtered) {
    const st = dateMap[s.id];
    if (st === 'present') present++;
    else if (st === 'absent') absent++;
    else if (st === 'late') late++;
    else if (st === 'excused') excused++;
    else unmarked++;
  }

  return { present, absent, late, excused, unmarked, total: filtered.length };
}
