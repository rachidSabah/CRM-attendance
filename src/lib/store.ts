import { create } from 'zustand';
import type { User, Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, SchoolInfo, PageName, Notification, ClassScheduleEntry, Exam, ExamGrade, CurriculumItem, AuditLogEntry, SavedSchedule, CalendarEvent } from './types';
import { api, setApiToken, localApi } from './api';

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
  calendarEvents: CalendarEvent[];
  profileViewStudent: Student | null;

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
  setCalendarEvents: (events: CalendarEvent[]) => void;
  setAdmins: (admins: Record<string, unknown>[]) => void;
  purgeCache: () => void;
  loadAllData: () => Promise<void>;
}

// ========== D1-Only Architecture ==========
// No localStorage for business data. All data lives in D1.
// Only auth tokens, language, primary color, and UI preferences stay in localStorage.

// ========== D1 Cloud Sync System ==========
let _loadingFromApi = false;
let _lastPull401Time = 0; // Cooldown after sync/pull 401 to prevent console spam
const PULL_401_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Push retry queue
let _pushQueue: Array<() => Promise<void>> = [];
let _isPushing = false;
let _consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;
let _pushFailureWarned = false;

// Push batching
let _pushBatchTimer: ReturnType<typeof setTimeout> | null = null;
const PUSH_BATCH_DELAY = 500; // ms — coalesce rapid setter calls

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

// ========== Immediate D1 Push ==========
// Renamed to pushToD1Now — the actual push implementation.
// Setters call pushToD1Async() which debounces and queues.

async function pushToD1Now(): Promise<boolean> {
  if (_isPushing) return false;
  _isPushing = true;
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
      savedSchedules: state.savedSchedules,
      calendarEvents: state.calendarEvents,
      schoolInfo: state.schoolInfo,
      admins: state.admins,
    };
    const res = await localApi('POST', '/api/sync/push', payload);
    if (!res.ok) {
      if (res.status === 401) _lastPull401Time = 0;
      updateD1SyncState({ status: 'error' });
      _consecutiveFailures++;
      if (_consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !_pushFailureWarned) {
        _pushFailureWarned = true;
        try {
          const { toast: showToast } = await import('sonner');
          showToast.warning('Sync paused — check your connection');
        } catch {
          console.warn('[store] Push failures exceeded threshold, sync paused');
        }
      }
      return false;
    }
    const data = await res.json();
    if (data.success) {
      updateD1SyncState({ status: 'success', lastCloudSync: new Date().toISOString(), cloudConnected: true });
      _consecutiveFailures = 0;
      _pushFailureWarned = false;
      return true;
    }
    updateD1SyncState({ status: 'error' });
    _consecutiveFailures++;
    return false;
  } catch (err) {
    updateD1SyncState({ status: 'error', cloudConnected: false });
    _consecutiveFailures++;
    if (_consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !_pushFailureWarned) {
      _pushFailureWarned = true;
      try {
        const { toast: showToast } = await import('sonner');
        showToast.warning('Sync paused — check your connection');
      } catch {
        console.warn('[store] Push failures exceeded threshold, sync paused');
      }
    }
    return false;
  } finally {
    _isPushing = false;
  }
}

// Drain queued pushes sequentially
async function drainPushQueue() {
  if (_pushQueue.length === 0) return;
  while (_pushQueue.length > 0) {
    const fn = _pushQueue.shift();
    if (fn) await fn().catch(() => {});
  }
}

// Debounced, queue-aware push to D1
function pushToD1Async() {
  // Don't push while loading from D1 — prevents overwriting cloud data with stale data
  if (_loadingFromApi) return;
  // If failures have exceeded threshold, queue for later retry
  if (_consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    if (_pushQueue.length < 50) _pushQueue.push(() => pushToD1Now().then(() => drainPushQueue()));
    return;
  }
  // Debounce: coalesce rapid setter calls into one push
  if (_pushBatchTimer) clearTimeout(_pushBatchTimer);
  _pushBatchTimer = setTimeout(() => {
    _pushBatchTimer = null;
    pushToD1Now().then(() => drainPushQueue()).catch(() => {});
  }, PUSH_BATCH_DELAY);
}

// Manual retry — resets failure count and drains the queue
export function retrySync() {
  _consecutiveFailures = 0;
  _pushFailureWarned = false;
  if (_pushBatchTimer) { clearTimeout(_pushBatchTimer); _pushBatchTimer = null; }
  pushToD1Now().then(() => drainPushQueue()).catch(() => {});
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
      admins: state.admins,
      calendarEvents: state.calendarEvents,
      exams: state.exams,
      examGrades: state.examGrades,
      curriculum: state.curriculum,
      savedSchedules: state.savedSchedules,
      schoolInfo: state.schoolInfo,
    };
    const res = await localApi('POST', '/api/sync/trigger', payload);
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
    const res = await localApi('GET', `/api/sync/pull?tenant_id=${encodeURIComponent(tenantId)}`);
    if (!res.ok) {
      if (res.status === 401) _lastPull401Time = Date.now();
      updateD1SyncState({ status: 'error' });
      return { success: false, error: `HTTP ${res.status}` };
    }
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
    const res = await localApi('GET', `/api/sync/status?tenant_id=${encodeURIComponent(tenantId)}`);
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
    const res = await localApi('POST', '/api/reminders/check', payload);
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
  savedSchedules: [], calendarEvents: [], profileViewStudent: null,
  language: 'en',
  primaryColor: '#10b981',

  setCurrentPage: (page) => set({ currentPage: page }),

  login: async (username, password, slug) => {
    try {
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
        _lastPull401Time = 0;
        _loadingFromApi = false;
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
        // Load all data from D1 after login
        setTimeout(() => { useAppStore.getState().loadAllData(); }, 300);
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

  // ===== D1-Only Setters =====
  // Each setter updates Zustand state in memory and immediately pushes to D1.
  // No localStorage writes for business data — D1 is the single source of truth.
  setStudents: (s) => { set({ students: s }); pushToD1Async(); },
  setClasses: (c) => { set({ classes: c }); pushToD1Async(); },
  setModules: (m) => { set({ modules: m }); pushToD1Async(); },
  setAttendance: (a) => { set({ attendance: a }); pushToD1Async(); },
  setGrades: (g) => { set({ grades: g }); pushToD1Async(); },
  setBehavior: (b) => { set({ behavior: b }); pushToD1Async(); },
  setTasks: (t) => { set({ tasks: t }); pushToD1Async(); },
  setIncidents: (i) => { set({ incidents: i }); pushToD1Async(); },
  setTeachers: (t) => { set({ teachers: t }); pushToD1Async(); },
  setEmployees: (e) => { set({ employees: e }); pushToD1Async(); },
  setTemplates: (t) => { set({ templates: t }); pushToD1Async(); },
  setAcademicYears: (y) => { set({ academicYears: y }); pushToD1Async(); },
  setSchoolInfo: (i) => { set({ schoolInfo: i }); pushToD1Async(); },
  setNotifications: (n) => { set({ notifications: n }); },
  setSchedules: (s) => { set({ schedules: s }); pushToD1Async(); },
  setExams: (e) => { set({ exams: e }); pushToD1Async(); },
  setExamGrades: (eg) => { set({ examGrades: eg }); pushToD1Async(); },
  setCurriculum: (c) => { set({ curriculum: c }); pushToD1Async(); },
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
    // Audit logs are kept in memory only (not synced to D1 — no endpoint)
  },
  setAuditLog: (logs) => { set({ auditLog: logs }); },
  setSavedSchedules: (s) => { set({ savedSchedules: s }); pushToD1Async(); },
  setCalendarEvents: (e) => { set({ calendarEvents: e }); pushToD1Async(); },
  setAdmins: (a) => { set({ admins: a }); pushToD1Async(); },

  // Purge all in-memory data and reload from D1 (no localStorage cleanup needed for business data)
  purgeCache: () => {
    set({
      students: [], classes: [], modules: [], attendance: [], grades: [],
      behavior: [], tasks: [], incidents: [], teachers: [], employees: [],
      templates: [], academicYears: [], schoolInfo: {}, notifications: [],
      admins: [], schedules: [], exams: [], examGrades: [], curriculum: [],
      auditLog: [], savedSchedules: [], calendarEvents: [],
    });
    // Only keep auth and UI preferences in localStorage
    const keep = ['attendance_auth', 'attendance_primary_color', 'attendance_language', 'attendance_d1_sync_state'];
    const keys = Object.keys(localStorage);
    keys.forEach(k => { if (!keep.includes(k)) localStorage.removeItem(k); });
    // Reload fresh data from D1
    setTimeout(() => { useAppStore.getState().loadAllData(); }, 100);
  },

  setPrimaryColor: (color) => { set({ primaryColor: color }); localStorage.setItem('attendance_primary_color', color); document.documentElement.style.setProperty('--app-primary-color', color); },

  loadAllData: async () => {
    // Load UI preferences from localStorage (these stay local)
    const savedLang = (typeof window !== 'undefined' ? localStorage.getItem('attendance_language') : null) as 'en' | 'fr' | null;
    const cachedColor = typeof window !== 'undefined' ? localStorage.getItem('attendance_primary_color') || '#10b981' : '#10b981';
    document.documentElement.style.setProperty('--app-primary-color', cachedColor);
    if (savedLang) {
      document.documentElement.lang = savedLang;
      document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
    }

    // Mark as loading from D1 to prevent push-back
    _loadingFromApi = true;

    try {
      // Pull ALL data from D1 — no local cache, D1 is the single source of truth
      const token = typeof window !== 'undefined' ? localStorage.getItem('api_token') : null;
      if (token) {
        const tenantId = getTenantId();
        const cloudRes = await localApi('GET', `/api/sync/pull?tenant_id=${encodeURIComponent(tenantId)}`);
        if (!cloudRes.ok) {
          if (cloudRes.status === 401) {
            _lastPull401Time = Date.now();
            if (token && typeof window !== 'undefined') {
              // Show session expired toast
              try {
                const authData = localStorage.getItem('attendance_auth');
                if (authData) {
                  const { toast: showToast } = await import('sonner');
                  const lang = localStorage.getItem('attendance_language') || 'en';
                  showToast.error(lang === 'fr' ? 'Session expirée — veuillez vous reconnecter' : 'Session expired — please log in again');
                }
              } catch {
                console.warn('[store] Could not show session expired toast');
              }
              console.warn('[store] Token rejected by D1 (401), forcing re-login');
              setApiToken(null);
              localStorage.removeItem('api_token');
              localStorage.removeItem('attendance_auth');
              set({ currentUser: null, isAuthenticated: false });
              return;
            }
          }
        } else {
          const cloudData = await cloudRes.json();
          if (cloudData?.success && cloudData.data) {
            const cd = cloudData.data;
            // Load directly from D1 — no merge with local, D1 is authoritative
            set({
              students: (cd.students || []) as Student[],
              classes: (cd.classes || []) as Class[],
              modules: (cd.modules || []) as Module[],
              attendance: (cd.attendance || []) as AttendanceRecord[],
              grades: (cd.grades || []) as Grade[],
              behavior: (cd.behavior || []) as BehaviorRecord[],
              tasks: (cd.tasks || []) as Task[],
              incidents: (cd.incidents || []) as Incident[],
              teachers: (cd.teachers || []) as Teacher[],
              employees: (cd.employees || []) as Employee[],
              templates: (cd.templates || []) as Template[],
              academicYears: (cd.academicYears || []) as AcademicYear[],
              schedules: (cd.schedules || []) as ClassScheduleEntry[],
              exams: (cd.exams || []) as Exam[],
              examGrades: (cd.examGrades || []) as ExamGrade[],
              curriculum: (cd.curriculum || []) as CurriculumItem[],
              savedSchedules: (cd.savedSchedules || []) as SavedSchedule[],
              calendarEvents: (cd.calendarEvents || []) as CalendarEvent[],
              admins: (cd.admins || []) as Record<string, unknown>[],
              schoolInfo: (cd.schoolInfo && typeof cd.schoolInfo === 'object' && Object.keys(cd.schoolInfo).length > 0) ? cd.schoolInfo as SchoolInfo : {},
              primaryColor: cachedColor,
              language: savedLang || 'en',
            });

            updateD1SyncState({ cloudConnected: true, cloudCounts: cloudData.counts || {} });
          }
        }
      }
    } catch (e) {
      // Silently handle errors during data load
    } finally {
      _loadingFromApi = false;
    }
  },
}));
