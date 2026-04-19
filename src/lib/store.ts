import { create } from 'zustand';
import type { User, Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, SchoolInfo, PageName, Notification, ClassScheduleEntry, Exam, ExamGrade, CurriculumItem, AuditLogEntry, SavedSchedule } from './types';
import { api, setApiToken, getApiToken } from './api';

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;

  // Navigation
  currentPage: PageName;

  // Data
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
  templates: Template[];
  academicYears: AcademicYear[];
  schoolInfo: SchoolInfo;
  notifications: Notification[];
  admins: Record<string, unknown>[];
  schedules: ClassScheduleEntry[];
  exams: Exam[];
  examGrades: ExamGrade[];
  curriculum: CurriculumItem[];
  auditLog: AuditLogEntry[];
  savedSchedules: SavedSchedule[];

  // Settings
  language: 'en' | 'fr';
  primaryColor: string;
  setPrimaryColor: (color: string) => void;

  // Actions
  setCurrentPage: (page: PageName) => void;
  login: (username: string, password: string, slug?: string) => Promise<boolean>;
  logout: () => void;
  setStudents: (students: Student[]) => void;
  setClasses: (classes: Class[]) => void;
  setModules: (modules: Module[]) => void;
  setAttendance: (attendance: AttendanceRecord[]) => void;
  setGrades: (grades: Grade[]) => void;
  setBehavior: (behavior: BehaviorRecord[]) => void;
  setTasks: (tasks: Task[]) => void;
  setIncidents: (incidents: Incident[]) => void;
  setTeachers: (teachers: Teacher[]) => void;
  setEmployees: (employees: Employee[]) => void;
  setTemplates: (templates: Template[]) => void;
  setAcademicYears: (years: AcademicYear[]) => void;
  setSchoolInfo: (info: SchoolInfo) => void;
  setNotifications: (notifications: Notification[]) => void;
  setSchedules: (schedules: ClassScheduleEntry[]) => void;
  setExams: (exams: Exam[]) => void;
  setExamGrades: (examGrades: ExamGrade[]) => void;
  setCurriculum: (curriculum: CurriculumItem[]) => void;
  addAuditLog: (action: string, entityType: string, entityId?: string, entityName?: string, details?: string) => void;
  setAuditLog: (logs: AuditLogEntry[]) => void;
  setSavedSchedules: (schedules: SavedSchedule[]) => void;
  setAdmins: (admins: Record<string, unknown>[]) => void;
  purgeCache: () => void;
  loadAllData: () => Promise<void>;
}

function loadLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch { return []; }
}

function loadLocalObj<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  } catch { return fallback; }
}

// ========== API Sync System ==========
let _loadingFromApi = false;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _d1PushTimer: ReturnType<typeof setTimeout> | null = null;

// D1 Cloud Sync status
export type D1SyncStatus = 'idle' | 'syncing' | 'error' | 'success';
export interface D1SyncState {
  status: D1SyncStatus;
  lastCloudSync: string | null;
  lastCloudPull: string | null;
  cloudCounts: Record<string, number>;
  cloudConnected: boolean;
}

let _d1SyncState: D1SyncState = {
  status: 'idle',
  lastCloudSync: null,
  lastCloudPull: null,
  cloudCounts: {},
  cloudConnected: false,
};

export function getD1SyncState(): D1SyncState {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('attendance_d1_sync_state');
      if (saved) _d1SyncState = { ..._d1SyncState, ...JSON.parse(saved) };
    } catch {}
  }
  return _d1SyncState;
}

function updateD1SyncState(partial: Partial<D1SyncState>) {
  _d1SyncState = { ..._d1SyncState, ...partial };
  if (typeof window !== 'undefined') {
    localStorage.setItem('attendance_d1_sync_state', JSON.stringify(_d1SyncState));
  }
}

function getTenantId(): string {
  if (typeof window !== 'undefined') {
    try {
      const auth = JSON.parse(localStorage.getItem('attendance_auth') || '{}');
      return auth.tenantId || 'default';
    } catch {}
  }
  return 'default';
}

function scheduleApiSync() {
  if (_loadingFromApi) return;
  const token = getApiToken();
  if (!token) return;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncAllToApi, 3000); // 3 second debounce
  scheduleD1Push();
}

// ========== D1 Cloud Sync System ==========
function scheduleD1Push() {
  if (_d1PushTimer) clearTimeout(_d1PushTimer);
  _d1PushTimer = setTimeout(pushToD1, 5000); // 5 second debounce
}

async function pushToD1() {
  try {
    updateD1SyncState({ status: 'syncing' });
    const state = useAppStore.getState();
    const payload = {
      tenant_id: getTenantId(),
      students: state.students,
      classes: state.classes,
      modules: state.modules,
      attendance: state.attendance,
      grades: state.grades,
      behavior: state.behavior,
      tasks: state.tasks,
      incidents: state.incidents,
      teachers: state.teachers,
      employees: state.employees,
      templates: state.templates,
      academicYears: state.academicYears,
      schedules: state.schedules,
      exams: state.exams,
      examGrades: state.examGrades,
      curriculum: state.curriculum,
      schoolInfo: state.schoolInfo,
    };
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      updateD1SyncState({ status: 'success', lastCloudSync: new Date().toISOString(), cloudConnected: true });
      console.log('[D1] Cloud push successful:', data.upserted, 'records');
    } else {
      updateD1SyncState({ status: 'error' });
      console.warn('[D1] Cloud push failed:', data.error);
    }
  } catch (err) {
    updateD1SyncState({ status: 'error', cloudConnected: false });
    console.warn('[D1] Cloud push error:', err);
  }
}

// Manual sync to cloud (called from Settings UI)
export async function syncToCloud(): Promise<{ success: boolean; upserted?: number; error?: string }> {
  try {
    updateD1SyncState({ status: 'syncing' });
    const state = useAppStore.getState();
    const payload = {
      tenant_id: getTenantId(),
      mode: 'push',
      students: state.students,
      classes: state.classes,
      modules: state.modules,
      attendance: state.attendance,
      grades: state.grades,
      behavior: state.behavior,
      tasks: state.tasks,
      incidents: state.incidents,
      teachers: state.teachers,
      employees: state.employees,
      templates: state.templates,
      academicYears: state.academicYears,
      schedules: state.schedules,
      exams: state.exams,
      examGrades: state.examGrades,
      curriculum: state.curriculum,
      schoolInfo: state.schoolInfo,
    };
    const res = await fetch('/api/sync/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      const pushOp = data.operations?.find((o: { operation: string }) => o.operation === 'push');
      updateD1SyncState({ status: 'success', lastCloudSync: new Date().toISOString(), cloudConnected: true });
      return { success: true, upserted: pushOp?.count };
    }
    updateD1SyncState({ status: 'error' });
    return { success: false, error: data.error };
  } catch (err) {
    updateD1SyncState({ status: 'error' });
    return { success: false, error: String(err) };
  }
}

// Pull data from cloud (called from Settings UI)
export async function loadFromCloud(): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    updateD1SyncState({ status: 'syncing' });
    const tenantId = getTenantId();
    const res = await fetch(`/api/sync/pull?tenant_id=${encodeURIComponent(tenantId)}`);
    const data = await res.json();
    if (data.success && data.data) {
      updateD1SyncState({ status: 'success', lastCloudPull: new Date().toISOString(), cloudConnected: true, cloudCounts: data.counts || {} });
      return { success: true, data: data.data };
    }
    updateD1SyncState({ status: 'error' });
    return { success: false, error: data.error };
  } catch (err) {
    updateD1SyncState({ status: 'error' });
    return { success: false, error: String(err) };
  }
}

// Get cloud sync status
export async function getCloudSyncStatus(): Promise<D1SyncState & { success: boolean }> {
  try {
    const tenantId = getTenantId();
    const res = await fetch(`/api/sync/status?tenant_id=${encodeURIComponent(tenantId)}`);
    const data = await res.json();
    if (data.success) {
      const updated: D1SyncState = {
        status: 'idle',
        lastCloudSync: data.last_push || _d1SyncState.lastCloudSync,
        lastCloudPull: data.last_pull || _d1SyncState.lastCloudPull,
        cloudCounts: data.entity_counts || {},
        cloudConnected: data.connected,
      };
      updateD1SyncState(updated);
      return { ...updated, success: true };
    }
    return { ..._d1SyncState, success: false };
  } catch {
    return { ..._d1SyncState, success: false };
  }
}

// Send attendance reminders via Brevo
export async function sendAttendanceReminders(params: {
  date?: string;
  attendance?: unknown[];
  students?: unknown[];
  classes?: unknown[];
  brevoApiKey: string;
  senderEmail: string;
  language: string;
  schoolInfo: Record<string, string>;
}): Promise<{ success: boolean; sent?: number; skipped?: number; errors?: unknown[]; error?: string }> {
  try {
    const tenantId = getTenantId();
    const payload = {
      tenant_id: tenantId,
      date: params.date || new Date().toISOString().split('T')[0],
      attendance: params.attendance || [],
      students: params.students || [],
      classes: params.classes || [],
      brevo_api_key: params.brevoApiKey,
      sender_email: params.senderEmail,
      language: params.language,
      school_info: params.schoolInfo,
    };
    const res = await fetch('/api/reminders/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function syncAllToApi() {
  const state = useAppStore.getState();
  const token = getApiToken();
  if (!token || _loadingFromApi) return;

  try {
    // Try bulk sync endpoint first (most efficient)
    await api.post('/sync', {
      schoolInfo: state.schoolInfo,
      primaryColor: state.primaryColor,
      language: state.language,
      data: {
        students: state.students,
        classes: state.classes,
        modules: state.modules,
        attendance: state.attendance,
        grades: state.grades,
        behavior: state.behavior,
        tasks: state.tasks,
        incidents: state.incidents,
        teachers: state.teachers,
        employees: state.employees,
        schedules: state.schedules,
        academicYears: state.academicYears,
        exams: state.exams,
        examGrades: state.examGrades,
        curriculum: state.curriculum,
      }
    });
    console.log('[API] Data synced to cloud successfully');
  } catch (bulkErr) {
    // Fallback: try individual entity endpoints
    console.warn('[API] Bulk sync failed, trying individual endpoints:', bulkErr);
    const entities: Array<{ endpoint: string; data: unknown[] }> = [
      { endpoint: 'students', data: state.students },
      { endpoint: 'classes', data: state.classes },
      { endpoint: 'modules', data: state.modules },
      { endpoint: 'attendance', data: state.attendance },
      { endpoint: 'grades', data: state.grades },
      { endpoint: 'behavior', data: state.behavior },
      { endpoint: 'tasks', data: state.tasks },
      { endpoint: 'incidents', data: state.incidents },
      { endpoint: 'teachers', data: state.teachers },
      { endpoint: 'employees', data: state.employees },
      { endpoint: 'schedules', data: state.schedules },
      { endpoint: 'academic-years', data: state.academicYears },
      { endpoint: 'exams', data: state.exams },
      { endpoint: 'exam-grades', data: state.examGrades },
      { endpoint: 'curriculum', data: state.curriculum },
    ];

    // Sync school settings separately
    if (state.schoolInfo && Object.keys(state.schoolInfo).length > 0) {
      api.put('/settings/school', state.schoolInfo).catch(() => {});
    }

    // Try individual entity sync
    for (const entity of entities) {
      if (entity.data.length === 0) continue;
      try {
        await api.post(`/${entity.endpoint}`, entity.data);
      } catch {
        // Try upsert-style endpoint
        try {
          await api.put(`/${entity.endpoint}`, entity.data);
        } catch {
          // Last resort: sync individual items
          for (const item of entity.data.slice(0, 5)) { // Limit to 5 to avoid flooding
            const record = item as Record<string, unknown>;
            if (record.id) {
              api.put(`/${entity.endpoint}/${record.id}`, record).catch(() => {});
            }
          }
        }
      }
    }
    console.log('[API] Individual entity sync attempted');
  }
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  isAuthenticated: false,
  currentPage: 'dashboard',
  students: [],
  classes: [],
  modules: [],
  attendance: [],
  grades: [],
  behavior: [],
  tasks: [],
  incidents: [],
  teachers: [],
  employees: [],
  templates: [],
  academicYears: [],
  schoolInfo: {},
  notifications: [],
  admins: [],
  schedules: [],
  exams: [],
  examGrades: [],
  curriculum: [],
  auditLog: [],
  savedSchedules: [],
  language: 'en',
  primaryColor: '#10b981',

  setCurrentPage: (page) => set({ currentPage: page }),

  login: async (username, password, slug) => {
    try {
      const loginData: Record<string, string> = { username, password };
      if (slug) loginData.slug = slug;
      const result = await api.post('/auth/login', loginData);
      if (result && result.success) {
        const token = result.token as string;
        const user = result.user as Record<string, unknown>;
        setApiToken(token);
        const currentUser: User = {
          id: String(user.id || ''),
          username: String(user.username || ''),
          fullName: String(user.fullName || user.username || ''),
          email: String(user.email || ''),
          role: (String(user.role || 'user') as User['role']),
          tenantId: String(user.tenant_id || ''),
          is_super_admin: Boolean(user.is_super_admin),
        };
        if (user.is_super_admin) currentUser.role = 'super_admin';
        set({ currentUser, isAuthenticated: true });
        localStorage.setItem('attendance_auth', JSON.stringify({
          userId: currentUser.id,
          userRole: currentUser.role,
          token,
          tenantId: currentUser.tenantId,
          isSuperAdmin: currentUser.is_super_admin || false,
        }));
        return true;
      }
      return false;
    } catch { return false; }
  },

  logout: () => {
    setApiToken(null);
    set({ currentUser: null, isAuthenticated: false, currentPage: 'dashboard' });
    localStorage.removeItem('attendance_auth');
  },

  setStudents: (s) => { set({ students: s }); localStorage.setItem('attendance_students', JSON.stringify(s)); scheduleApiSync(); scheduleD1Push(); },
  setClasses: (c) => { set({ classes: c }); localStorage.setItem('attendance_classes', JSON.stringify(c)); scheduleApiSync(); scheduleD1Push(); },
  setModules: (m) => { set({ modules: m }); localStorage.setItem('attendance_modules', JSON.stringify(m)); scheduleApiSync(); scheduleD1Push(); },
  setAttendance: (a) => { set({ attendance: a }); localStorage.setItem('attendance_records', JSON.stringify(a)); scheduleApiSync(); scheduleD1Push(); },
  setGrades: (g) => { set({ grades: g }); localStorage.setItem('attendance_grades', JSON.stringify(g)); scheduleApiSync(); scheduleD1Push(); },
  setBehavior: (b) => { set({ behavior: b }); localStorage.setItem('attendance_behavior', JSON.stringify(b)); scheduleApiSync(); scheduleD1Push(); },
  setTasks: (t) => { set({ tasks: t }); localStorage.setItem('attendance_tasks', JSON.stringify(t)); scheduleApiSync(); scheduleD1Push(); },
  setIncidents: (i) => { set({ incidents: i }); localStorage.setItem('attendance_incidents', JSON.stringify(i)); scheduleApiSync(); scheduleD1Push(); },
  setTeachers: (t) => { set({ teachers: t }); localStorage.setItem('attendance_teachers', JSON.stringify(t)); scheduleApiSync(); scheduleD1Push(); },
  setEmployees: (e) => { set({ employees: e }); localStorage.setItem('attendance_employees', JSON.stringify(e)); scheduleApiSync(); scheduleD1Push(); },
  setTemplates: (t) => { set({ templates: t }); localStorage.setItem('attendance_templates', JSON.stringify(t)); scheduleApiSync(); scheduleD1Push(); },
  setAcademicYears: (y) => { set({ academicYears: y }); localStorage.setItem('attendance_academic_years', JSON.stringify(y)); scheduleApiSync(); scheduleD1Push(); },
  setSchoolInfo: (i) => { set({ schoolInfo: i }); localStorage.setItem('attendance_school_info', JSON.stringify(i)); scheduleApiSync(); scheduleD1Push(); },
  setNotifications: (n) => { set({ notifications: n }); },
  setSchedules: (s) => { set({ schedules: s }); localStorage.setItem('attendance_schedules', JSON.stringify(s)); scheduleApiSync(); scheduleD1Push(); },
  setExams: (e) => { set({ exams: e }); localStorage.setItem('attendance_exams', JSON.stringify(e)); scheduleApiSync(); scheduleD1Push(); },
  setExamGrades: (eg) => { set({ examGrades: eg }); localStorage.setItem('attendance_exam_grades', JSON.stringify(eg)); scheduleApiSync(); scheduleD1Push(); },
  setCurriculum: (c) => { set({ curriculum: c }); localStorage.setItem('attendance_curriculum', JSON.stringify(c)); scheduleApiSync(); scheduleD1Push(); },
  addAuditLog: (action, entityType, entityId, entityName, details) => {
    const state = useAppStore.getState();
    const user = state.currentUser;
    const entry: AuditLogEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      action,
      entityType,
      entityId,
      entityName,
      userId: user?.id || 'unknown',
      userName: user?.username || user?.fullName || 'unknown',
      details: details || `${action} on ${entityType}${entityName ? ': ' + entityName : ''}`,
      timestamp: new Date().toISOString(),
    };
    const newLog = [entry, ...state.auditLog].slice(0, 2000); // Keep last 2000 entries
    set({ auditLog: newLog });
    localStorage.setItem('attendance_audit_log', JSON.stringify(newLog));
    // Sync audit log periodically
    try { api.post('/audit-log', entry).catch(() => {}); } catch {}
  },
  setAuditLog: (logs) => { set({ auditLog: logs }); localStorage.setItem('attendance_audit_log', JSON.stringify(logs)); },
  setSavedSchedules: (s) => { set({ savedSchedules: s }); localStorage.setItem('attendance_saved_schedules', JSON.stringify(s)); scheduleApiSync(); },
  setAdmins: (a) => { set({ admins: a }); localStorage.setItem('attendance_admins', JSON.stringify(a)); },
  purgeCache: () => {
    const keep = ['attendance_auth', 'attendance_primary_color'];
    const keys = Object.keys(localStorage);
    keys.forEach(k => { if (!keep.includes(k)) localStorage.removeItem(k); });
    set({
      students: [], classes: [], modules: [], attendance: [], grades: [],
      behavior: [], tasks: [], incidents: [], teachers: [], employees: [],
      templates: [], academicYears: [], schoolInfo: {}, notifications: [],
      admins: [], schedules: [], exams: [], examGrades: [], curriculum: [],
      auditLog: [], savedSchedules: [],
    });
  },
  setPrimaryColor: (color) => { set({ primaryColor: color }); localStorage.setItem('attendance_primary_color', color); document.documentElement.style.setProperty('--app-primary-color', color); scheduleApiSync(); },

  loadAllData: async () => {
    // Load local cache first for instant UI
    const savedLang = (typeof window !== 'undefined' ? localStorage.getItem('attendance_language') : null) as 'en' | 'fr' | null;
    set({
      students: loadLocal('attendance_students'),
      classes: loadLocal('attendance_classes'),
      modules: loadLocal('attendance_modules'),
      attendance: loadLocal('attendance_records'),
      grades: loadLocal('attendance_grades'),
      behavior: loadLocal('attendance_behavior'),
      tasks: loadLocal('attendance_tasks'),
      incidents: loadLocal('attendance_incidents'),
      teachers: loadLocal('attendance_teachers'),
      employees: loadLocal('attendance_employees'),
      templates: loadLocal('attendance_templates'),
      academicYears: loadLocal('attendance_academic_years'),
      schoolInfo: loadLocalObj('attendance_school_info', {}),
      primaryColor: typeof window !== 'undefined' ? localStorage.getItem('attendance_primary_color') || '#10b981' : '#10b981',
      admins: loadLocal('attendance_admins'),
      schedules: loadLocal('attendance_schedules'),
      exams: loadLocal('attendance_exams'),
      examGrades: loadLocal('attendance_exam_grades'),
      curriculum: loadLocal('attendance_curriculum'),
      auditLog: loadLocal('attendance_audit_log'),
      savedSchedules: loadLocal('attendance_saved_schedules'),
      language: savedLang || 'en',
    });

    // Apply primary color from cache
    const cachedColor = localStorage.getItem('attendance_primary_color') || '#10b981';
    document.documentElement.style.setProperty('--app-primary-color', cachedColor);

    // Apply saved language
    if (savedLang) {
      document.documentElement.lang = savedLang;
    }

    const token = getApiToken();
    if (!token) return;

    // Mark as loading from API to prevent sync-back
    _loadingFromApi = true;

    try {
      // Load school settings
      try {
        const settingsRes = await api.get('/settings/school');
        if (settingsRes && !settingsRes.error) {
          const si = settingsRes.data || settingsRes;
          if (si && Object.keys(si).length > 0) {
            set({ schoolInfo: si });
            localStorage.setItem('attendance_school_info', JSON.stringify(si));
          }
        }
      } catch {}

      // Load theme settings
      try {
        const themeRes = await api.get('/settings/theme');
        if (themeRes && themeRes.primaryColor) {
          const color = String(themeRes.primaryColor);
          set({ primaryColor: color });
          localStorage.setItem('attendance_primary_color', color);
          document.documentElement.style.setProperty('--app-primary-color', color);
        }
      } catch {}

      // Load students
      try {
        const studentsRes = await api.get('/students');
        if (studentsRes?.success && Array.isArray(studentsRes.data)) {
          const normalized = studentsRes.data.map((s: Record<string, unknown>) => ({
            id: String(s.id || ''),
            fullName: String(s.fullName || s.first_name || s.email || 'Unknown'),
            studentId: String(s.studentId || s.student_id || ''),
            classId: String(s.classId || s.class || ''),
            className: String(s.className || s.class || ''),
            academicYear: String(s.academicYear || s.academic_year || ''),
            status: (s.status as Student['status']) || 'active',
            guardianName: String(s.guardianName || s.guardian_name || ''),
            guardianPhone: String(s.guardianPhone || s.guardian_phone || s.phone || ''),
            phone: String(s.phone || ''),
            email: String(s.email || ''),
            address: String(s.address || ''),
            notes: String(s.notes || ''),
            photo: (s.photo as string) || null,
            group: String(s.group || s.group_name || ''),
            createdAt: String(s.createdAt || s.created_at || s.enrollment_date || new Date().toISOString()),
          }));
          set({ students: normalized });
          localStorage.setItem('attendance_students', JSON.stringify(normalized));
        }
      } catch {}

      // Load classes
      try {
        const classesRes = await api.get('/classes');
        if (classesRes?.success && Array.isArray(classesRes.data)) {
          const normalized = classesRes.data.map((c: Record<string, unknown>) => ({
            id: String(c.id),
            name: String(c.name || c.className || ''),
            description: String(c.description || c.department || ''),
            teacher: String(c.teacher || c.teacher_id || ''),
            room: String(c.room || c.schedule || ''),
            capacity: Number(c.capacity) || 30,
            academicYear: String(c.academicYear || c.academic_year || ''),
            createdAt: String(c.createdAt || c.created_at || new Date().toISOString()),
          }));
          set({ classes: normalized });
          localStorage.setItem('attendance_classes', JSON.stringify(normalized));
        }
      } catch {}

      // Load attendance
      try {
        const attendanceRes = await api.get('/attendance');
        if (attendanceRes?.success && Array.isArray(attendanceRes.data)) {
          const normalized = attendanceRes.data.map((a: Record<string, unknown>) => ({
            id: String(a.id),
            studentId: String(a.studentId || a.student_id || ''),
            date: String(a.date || ''),
            status: (a.status as AttendanceRecord['status']) || 'present',
            notes: String(a.notes || ''),
            createdAt: String(a.createdAt || a.created_at || new Date().toISOString()),
          }));
          set({ attendance: normalized });
          localStorage.setItem('attendance_records', JSON.stringify(normalized));
        }
      } catch {}

      // Load modules
      try {
        const modulesRes = await api.get('/modules');
        if (modulesRes?.success && Array.isArray(modulesRes.data)) {
          set({ modules: modulesRes.data });
          localStorage.setItem('attendance_modules', JSON.stringify(modulesRes.data));
        }
      } catch {}

      // Load grades
      try {
        const gradesRes = await api.get('/grades');
        if (gradesRes?.success && Array.isArray(gradesRes.data)) {
          set({ grades: gradesRes.data });
          localStorage.setItem('attendance_grades', JSON.stringify(gradesRes.data));
        }
      } catch {}

      // Load behavior
      try {
        const behaviorRes = await api.get('/behavior');
        if (behaviorRes?.success && Array.isArray(behaviorRes.data)) {
          set({ behavior: behaviorRes.data });
          localStorage.setItem('attendance_behavior', JSON.stringify(behaviorRes.data));
        }
      } catch {}

      // Load tasks
      try {
        const tasksRes = await api.get('/tasks');
        if (tasksRes?.success && Array.isArray(tasksRes.data)) {
          const normalized = tasksRes.data.map((t: Record<string, unknown>) => ({
            id: String(t.id),
            title: String(t.title || ''),
            description: String(t.description || ''),
            assignedTo: String(t.assignedTo || t.assigned_to || ''),
            assignedBy: String(t.assignedBy || t.assigned_by || ''),
            priority: (t.priority as Task['priority']) || 'medium',
            status: (t.status as Task['status']) || 'pending',
            category: String(t.category || ''),
            dueDate: String(t.dueDate || t.due_date || ''),
            progress: Number(t.progress) || 0,
            ticketNumber: String(t.ticketNumber || 'TK-' + String(t.id || '').substring(0, 6).toUpperCase()),
            completionReport: String(t.completionReport || ''),
            attachments: (t.attachments as string[]) || [],
            comments: (t.comments as Task['comments']) || [],
            createdAt: String(t.createdAt || t.created_at || new Date().toISOString()),
            completedAt: (t.completedAt as string) || null,
          }));
          set({ tasks: normalized });
          localStorage.setItem('attendance_tasks', JSON.stringify(normalized));
        }
      } catch {}

      // Load incidents
      try {
        const incidentsRes = await api.get('/incidents');
        if (incidentsRes?.success && Array.isArray(incidentsRes.data)) {
          const normalized = incidentsRes.data.map((i: Record<string, unknown>) => ({
            id: String(i.id),
            studentId: String(i.studentId || i.student_id || ''),
            incidentType: String(i.incidentType || i.type || ''),
            description: String(i.description || ''),
            actionTaken: String(i.actionTaken || i.action_taken || ''),
            reportedBy: String(i.reportedBy || i.reported_by || ''),
            date: String(i.date || i.incident_date || ''),
            severity: (i.severity as Incident['severity']) || 'medium',
            status: (i.status as Incident['status']) || 'open',
            followUpNotes: String(i.followUpNotes || ''),
            attachments: (i.attachments as string[]) || [],
            createdAt: String(i.createdAt || i.created_at || new Date().toISOString()),
          }));
          set({ incidents: normalized });
          localStorage.setItem('attendance_incidents', JSON.stringify(normalized));
        }
      } catch {}

      // Load teachers
      try {
        const teachersRes = await api.get('/teachers');
        if (teachersRes?.success && Array.isArray(teachersRes.data)) {
          set({ teachers: teachersRes.data });
          localStorage.setItem('attendance_teachers', JSON.stringify(teachersRes.data));
        }
      } catch {}

      // Load employees
      try {
        const employeesRes = await api.get('/employees');
        if (employeesRes?.success && Array.isArray(employeesRes.data)) {
          set({ employees: employeesRes.data });
          localStorage.setItem('attendance_employees', JSON.stringify(employeesRes.data));
        }
      } catch {}

      // Load schedules
      try {
        const schedulesRes = await api.get('/schedules');
        if (schedulesRes?.success && Array.isArray(schedulesRes.data)) {
          set({ schedules: schedulesRes.data });
          localStorage.setItem('attendance_schedules', JSON.stringify(schedulesRes.data));
        }
      } catch {}

      // Load academic years
      try {
        const ayRes = await api.get('/academic-years');
        if (ayRes?.success && Array.isArray(ayRes.data)) {
          set({ academicYears: ayRes.data });
          localStorage.setItem('attendance_academic_years', JSON.stringify(ayRes.data));
        }
      } catch {}

      // Load exams
      try {
        const examsRes = await api.get('/exams');
        if (examsRes?.success && Array.isArray(examsRes.data)) {
          set({ exams: examsRes.data });
          localStorage.setItem('attendance_exams', JSON.stringify(examsRes.data));
        }
      } catch {}

      // Load exam grades
      try {
        const egRes = await api.get('/exam-grades');
        if (egRes?.success && Array.isArray(egRes.data)) {
          set({ examGrades: egRes.data });
          localStorage.setItem('attendance_exam_grades', JSON.stringify(egRes.data));
        }
      } catch {}

      // Load curriculum
      try {
        const currRes = await api.get('/curriculum');
        if (currRes?.success && Array.isArray(currRes.data)) {
          set({ curriculum: currRes.data });
          localStorage.setItem('attendance_curriculum', JSON.stringify(currRes.data));
        }
      } catch {}

      // Load users
      try {
        const usersRes = await api.get('/users');
        if (usersRes?.success && Array.isArray(usersRes.data)) {
          localStorage.setItem('attendance_users', JSON.stringify(usersRes.data));
        }
      } catch {}

      // Also try loading from D1 cloud database
      try {
        const tenantId = getTenantId();
        const cloudRes = await fetch(`/api/sync/pull?tenant_id=${encodeURIComponent(tenantId)}`);
        const cloudData = await cloudRes.json();
        if (cloudData?.success && cloudData.data) {
          // D1 data is used to supplement, not replace (merge if D1 has more recent data)
          const cd = cloudData.data;
          const mergeArray = (local: unknown[], cloud: unknown[], key: string) => {
            if (Array.isArray(cd[key]) && cd[key].length > local.length) return cd[key];
            return local;
          };
          set({
            students: mergeArray(state.students, cd.students, 'students') as Student[],
            classes: mergeArray(state.classes, cd.classes, 'classes') as Class[],
            attendance: mergeArray(state.attendance, cd.attendance, 'attendance') as AttendanceRecord[],
          });
          updateD1SyncState({ cloudConnected: true, cloudCounts: cloudData.counts || {} });
          console.log('[D1] Cloud data loaded, counts:', cloudData.counts);
        }
      } catch {}

      console.log('[API] Data loading complete');
    } catch (e) {
      // Only log unexpected errors, not 404-related issues
      console.warn('[API] Unexpected error during data load:', e);
    } finally {
      // Re-enable API sync after loading is complete
      _loadingFromApi = false;
    }
  },
}));
