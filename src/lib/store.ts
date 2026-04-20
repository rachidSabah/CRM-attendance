import { create } from 'zustand';
import type { User, Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, SchoolInfo, PageName, Notification, ClassScheduleEntry, Exam, ExamGrade, CurriculumItem, AuditLogEntry, SavedSchedule } from './types';
import { api, setApiToken } from './api';

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
  language: 'en' | 'fr' | 'ar';
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
  // Only trigger D1 cloud sync — external API does not support entity sync
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
    } else {
      updateD1SyncState({ status: 'error' });
    }
  } catch (err) {
    updateD1SyncState({ status: 'error', cloudConnected: false });
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
      // Use local /api/auth/login which tries external API first, then D1 fallback
      // This ensures password changes (saved to D1) are properly recognized on next login
      const loginData: Record<string, string> = { username, password };
      if (slug) loginData.slug = slug;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });
      if (!res.ok) return false;
      const result = await res.json();
      if (result && result.success) {
        const token = result.token as string;
        const user = result.user as Record<string, unknown>;
        if (token) setApiToken(token);
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
    // Audit logs stored locally only (external API does not have audit-log endpoint)
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

    // Mark as loading from API to prevent sync-back
    _loadingFromApi = true;

    try {
      // NOTE: Entity data is loaded from localStorage (above) and D1 cloud sync (below).
      // The external API (infohas-attendance-api) only supports auth/login.
      // All entity GET endpoints return 404 there, so we skip them to avoid console noise.

      // Also try loading from D1 cloud database
      try {
        const tenantId = getTenantId();
        const cloudRes = await fetch(`/api/sync/pull?tenant_id=${encodeURIComponent(tenantId)}`);
        if (!cloudRes.ok) {
          // Endpoint not available or error — skip silently
        } else {
          const cloudData = await cloudRes.json();
          if (cloudData?.success && cloudData.data) {
            const cd = cloudData.data;
            const currentState = useAppStore.getState();
            const mergeArray = (local: unknown[], cloudKey: string) => {
              const cloud = cd[cloudKey];
              if (Array.isArray(cloud) && cloud.length > local.length) return cloud;
              return local;
            };
            // Merge ALL entity types from cloud — cloud wins if larger
            set({
              students: mergeArray(currentState.students, 'students') as Student[],
              classes: mergeArray(currentState.classes, 'classes') as Class[],
              modules: mergeArray(currentState.modules, 'modules') as Module[],
              attendance: mergeArray(currentState.attendance, 'attendance') as AttendanceRecord[],
              grades: mergeArray(currentState.grades, 'grades') as Grade[],
              behavior: mergeArray(currentState.behavior, 'behavior') as BehaviorRecord[],
              tasks: mergeArray(currentState.tasks, 'tasks') as Task[],
              incidents: mergeArray(currentState.incidents, 'incidents') as Incident[],
              teachers: mergeArray(currentState.teachers, 'teachers') as Teacher[],
              employees: mergeArray(currentState.employees, 'employees') as Employee[],
              templates: mergeArray(currentState.templates, 'templates') as Template[],
              academicYears: mergeArray(currentState.academicYears, 'academicYears') as AcademicYear[],
              schedules: mergeArray(currentState.schedules, 'schedules') as ClassScheduleEntry[],
              exams: mergeArray(currentState.exams, 'exams') as Exam[],
              examGrades: mergeArray(currentState.examGrades, 'examGrades') as ExamGrade[],
              curriculum: mergeArray(currentState.curriculum, 'curriculum') as CurriculumItem[],
            });
            // Merge school info from cloud
            if (cd.schoolInfo && typeof cd.schoolInfo === 'object' && Object.keys(cd.schoolInfo).length > Object.keys(currentState.schoolInfo).length) {
              set({ schoolInfo: cd.schoolInfo as SchoolInfo });
            }
            updateD1SyncState({ cloudConnected: true, cloudCounts: cloudData.counts || {} });
          }
        }
      } catch {}

    } catch (e) {
      // Silently handle errors during data load
    } finally {
      // Re-enable API sync after loading is complete
      _loadingFromApi = false;
    }
  },
}));
