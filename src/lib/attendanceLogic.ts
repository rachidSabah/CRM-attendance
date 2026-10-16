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

export interface ClassLike {
  id: string;
  name: string;
}

export interface WeeklyLowAttendanceStats {
  percentage: number;
  lowRateClassCount: number;
  totalEvaluatedClasses: number;
  weekRangeLabel: string;
  mondayStr: string;
  sundayStr: string;
  lowClasses: Array<{
    id: string;
    name: string;
    rate: number;
    total: number;
    present: number;
  }>;
}

export type DateRangePreset = 'today' | 'this_week' | 'last_7_days' | 'this_month' | 'last_30_days' | 'custom';

export interface DateRangeBounds {
  startDate: string;
  endDate: string;
  label: string;
}

/**
 * Computes start and end date strings (YYYY-MM-DD) for dashboard date presets
 */
export function getDateRangeBounds(
  preset: DateRangePreset,
  referenceDate: Date = new Date(),
  customStart?: string,
  customEnd?: string
): DateRangeBounds {
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const ref = new Date(referenceDate);
  const todayStr = formatYMD(ref);

  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr, label: todayStr };
  }

  if (preset === 'this_week') {
    const day = ref.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const s = formatYMD(monday);
    const e = formatYMD(sunday);
    return { startDate: s, endDate: e, label: `${s} ~ ${e}` };
  }

  if (preset === 'last_7_days') {
    const start = new Date(ref);
    start.setDate(ref.getDate() - 6);
    const s = formatYMD(start);
    return { startDate: s, endDate: todayStr, label: `${s} ~ ${todayStr}` };
  }

  if (preset === 'this_month') {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const s = formatYMD(start);
    const e = formatYMD(end);
    return { startDate: s, endDate: e, label: `${s} ~ ${e}` };
  }

  if (preset === 'last_30_days') {
    const start = new Date(ref);
    start.setDate(ref.getDate() - 29);
    const s = formatYMD(start);
    return { startDate: s, endDate: todayStr, label: `${s} ~ ${todayStr}` };
  }

  if (preset === 'custom' && customStart && customEnd) {
    const s = customStart <= customEnd ? customStart : customEnd;
    const e = customStart <= customEnd ? customEnd : customStart;
    return { startDate: s, endDate: e, label: `${s} ~ ${e}` };
  }

  const start = new Date(ref);
  start.setDate(ref.getDate() - 29);
  const s = formatYMD(start);
  return { startDate: s, endDate: todayStr, label: `${s} ~ ${todayStr}` };
}

/**
 * Calculates the percentage of classes with low attendance rates (<75%) for the current week.
 */
export function calculateWeeklyLowAttendanceClasses(
  classes: ClassLike[],
  students: StudentLike[],
  attendance: AttendanceRecordLike[],
  referenceDate: Date = new Date(),
  threshold: number = 75
): WeeklyLowAttendanceStats {
  const d = new Date(referenceDate);
  const day = d.getDay();
  // Monday as start of week: in JS 0 is Sunday, 1 is Monday... 6 is Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const formatYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  const mondayStr = formatYMD(monday);
  const sundayStr = formatYMD(sunday);

  const lowClasses: Array<{
    id: string;
    name: string;
    rate: number;
    total: number;
    present: number;
  }> = [];

  const classStudentMap = new Map<string, string[]>();
  for (const s of students) {
    if (s.status === 'inactive' || !s.classId) continue;
    const list = classStudentMap.get(s.classId) || [];
    list.push(s.id);
    classStudentMap.set(s.classId, list);
  }

  const weekAttendance = attendance.filter(
    r => r.date >= mondayStr && r.date <= sundayStr
  );

  let evaluatedClassCount = 0;

  for (const cls of classes) {
    const studentIds = classStudentMap.get(cls.id);
    if (!studentIds || studentIds.length === 0) continue;

    const studentIdSet = new Set(studentIds);
    const classRecords = weekAttendance.filter(r => studentIdSet.has(r.studentId));

    if (classRecords.length === 0) continue;

    evaluatedClassCount++;
    const presentCount = classRecords.filter(r => r.status === 'present').length;
    const rate = Math.round((presentCount / classRecords.length) * 100);

    if (rate < threshold) {
      lowClasses.push({
        id: cls.id,
        name: cls.name,
        rate,
        total: classRecords.length,
        present: presentCount,
      });
    }
  }

  const percentage = evaluatedClassCount > 0
    ? Math.round((lowClasses.length / evaluatedClassCount) * 100)
    : 0;

  return {
    percentage,
    lowRateClassCount: lowClasses.length,
    totalEvaluatedClasses: evaluatedClassCount,
    weekRangeLabel: `${mondayStr} ~ ${sundayStr}`,
    mondayStr,
    sundayStr,
    lowClasses,
  };
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
