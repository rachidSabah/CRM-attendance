import { create } from 'zustand';
import type { User, Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, SchoolInfo, PageName, Notification, ClassScheduleEntry, Exam, ExamGrade, CurriculumItem, AuditLogEntry, SavedSchedule } from './types';
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
let _lastPull401Time = 0; // Cooldown after sync/pull 401 to prevent console spam
const PULL_401_COOLDOWN = 5 * 60 * 1000; // 5 minutes

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
let _pushRetryCount = 0;
const MAX_PUSH_RETRIES = 3;

function scheduleD1Push() {
  // Don't push while loading from API — prevents overwriting cloud data with stale local data
  if (_loadingFromApi) return;
  if (_d1PushTimer) clearTimeout(_d1PushTimer);
  _d1PushTimer = setTimeout(pushToD1, 3000); // 3 second debounce (reduced from 5s)
}

async function pushToD1(): Promise<boolean> {
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
      admins: state.admins,
    };
    const res = await localApi('POST', '/api/sync/push', payload);
    if (!res.ok) {
      // If 401, token is bad — reset cooldown to allow pull retry on next load
      if (res.status === 401) _lastPull401Time = 0;
      updateD1SyncState({ status: 'error' });
      return false;
    }
    const data = await res.json();
    if (data.success) {
      _pushRetryCount = 0;
      updateD1SyncState({ status: 'success', lastCloudSync: new Date().toISOString(), cloudConnected: true });
      return true;
    }
    updateD1SyncState({ status: 'error' });
    return false;
  } catch (err) {
    updateD1SyncState({ status: 'error', cloudConnected: false });
    return false;
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
      admins: state.admins,
      exams: state.exams,
      examGrades: state.examGrades,
      curriculum: state.curriculum,
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
  savedSchedules: [], profileViewStudent: null,
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
        // CRITICAL: Load data from D1 after login so incognito/new sessions get persisted data
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
  setAdmins: (a) => { set({ admins: a }); localStorage.setItem('attendance_admins', JSON.stringify(a)); scheduleD1Push(); },
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
      // Pull from D1 cloud database to get latest saved data
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('api_token') : null;
        if (token) {
          const tenantId = getTenantId();
          const cloudRes = await localApi('GET', `/api/sync/pull?tenant_id=${encodeURIComponent(tenantId)}`);
          if (!cloudRes.ok) {
            if (cloudRes.status === 401) {
              _lastPull401Time = Date.now();
              // If we had a saved token, it's stale/invalid — force re-login
              if (token && typeof window !== 'undefined') {
                console.warn('[store] Saved token rejected by D1 (401), forcing re-login');
                setApiToken(null);
                localStorage.removeItem('api_token');
                localStorage.removeItem('attendance_auth');
                set({ currentUser: null, isAuthenticated: false });
                return; // Stop loading — user will see login screen
              }
            }
          } else {
            const cloudData = await cloudRes.json();
            if (cloudData?.success && cloudData.data) {
              const cd = cloudData.data;
              const currentState = useAppStore.getState();

              // Smart merge: merge local + cloud by ID, prefer the one with more records
              // This ensures D1 data is used when it's the authoritative source
              const mergeById = (local: Array<Record<string, unknown>>, cloudKey: string) => {
                const cloud = cd[cloudKey];
                if (!Array.isArray(cloud)) return local;
                // If cloud has significantly more data, use cloud (authoritative)
                if (cloud.length > local.length + 2) return cloud;
                // If local is empty, use cloud
                if (local.length === 0) return cloud;
                // Otherwise merge by ID — union of both, cloud as base, local overwrites
                const map = new Map<string, Record<string, unknown>>();
                for (const item of cloud) {
                  const id = String(item.id || '');
                  if (id) map.set(id, item);
                }
                for (const item of local) {
                  const id = String(item.id || '');
                  if (id) map.set(id, item); // local overwrites cloud
                }
                return Array.from(map.values());
              };

              const merged = {
                students: mergeById(currentState.students as unknown as Array<Record<string, unknown>>, 'students') as unknown as Student[],
                classes: mergeById(currentState.classes as unknown as Array<Record<string, unknown>>, 'classes') as unknown as Class[],
                modules: mergeById(currentState.modules as unknown as Array<Record<string, unknown>>, 'modules') as unknown as Module[],
                attendance: mergeById(currentState.attendance as unknown as Array<Record<string, unknown>>, 'attendance') as unknown as AttendanceRecord[],
                grades: mergeById(currentState.grades as unknown as Array<Record<string, unknown>>, 'grades') as unknown as Grade[],
                behavior: mergeById(currentState.behavior as unknown as Array<Record<string, unknown>>, 'behavior') as unknown as BehaviorRecord[],
                tasks: mergeById(currentState.tasks as unknown as Array<Record<string, unknown>>, 'tasks') as unknown as Task[],
                incidents: mergeById(currentState.incidents as unknown as Array<Record<string, unknown>>, 'incidents') as unknown as Incident[],
                teachers: mergeById(currentState.teachers as unknown as Array<Record<string, unknown>>, 'teachers') as unknown as Teacher[],
                employees: mergeById(currentState.employees as unknown as Array<Record<string, unknown>>, 'employees') as unknown as Employee[],
                templates: mergeById(currentState.templates as unknown as Array<Record<string, unknown>>, 'templates') as unknown as Template[],
                academicYears: mergeById(currentState.academicYears as unknown as Array<Record<string, unknown>>, 'academicYears') as unknown as AcademicYear[],
                schedules: mergeById(currentState.schedules as unknown as Array<Record<string, unknown>>, 'schedules') as unknown as ClassScheduleEntry[],
                exams: mergeById(currentState.exams as unknown as Array<Record<string, unknown>>, 'exams') as unknown as Exam[],
                examGrades: mergeById(currentState.examGrades as unknown as Array<Record<string, unknown>>, 'examGrades') as unknown as ExamGrade[],
                curriculum: mergeById(currentState.curriculum as unknown as Array<Record<string, unknown>>, 'curriculum') as unknown as CurriculumItem[],
              };
              set(merged);

              // Populate admins from cloud (stripped of passwords/tokens by server)
              if (Array.isArray(cd.admins) && cd.admins.length > 0) {
                set({ admins: cd.admins as Record<string, unknown>[] });
                localStorage.setItem('attendance_admins', JSON.stringify(cd.admins));
              }

              // Also persist merged data to localStorage so it's available on next load
              localStorage.setItem('attendance_students', JSON.stringify(merged.students));
              localStorage.setItem('attendance_classes', JSON.stringify(merged.classes));
              localStorage.setItem('attendance_modules', JSON.stringify(merged.modules));
              localStorage.setItem('attendance_records', JSON.stringify(merged.attendance));
              localStorage.setItem('attendance_grades', JSON.stringify(merged.grades));
              localStorage.setItem('attendance_behavior', JSON.stringify(merged.behavior));
              localStorage.setItem('attendance_tasks', JSON.stringify(merged.tasks));
              localStorage.setItem('attendance_incidents', JSON.stringify(merged.incidents));
              localStorage.setItem('attendance_teachers', JSON.stringify(merged.teachers));
              localStorage.setItem('attendance_employees', JSON.stringify(merged.employees));
              localStorage.setItem('attendance_templates', JSON.stringify(merged.templates));
              localStorage.setItem('attendance_academic_years', JSON.stringify(merged.academicYears));
              localStorage.setItem('attendance_schedules', JSON.stringify(merged.schedules));
              localStorage.setItem('attendance_exams', JSON.stringify(merged.exams));
              localStorage.setItem('attendance_exam_grades', JSON.stringify(merged.examGrades));
              localStorage.setItem('attendance_curriculum', JSON.stringify(merged.curriculum));

              // Merge school info
              if (cd.schoolInfo && typeof cd.schoolInfo === 'object' && Object.keys(cd.schoolInfo).length > 0) {
                const mergedInfo = { ...cd.schoolInfo as Record<string, unknown>, ...currentState.schoolInfo as Record<string, unknown> };
                set({ schoolInfo: mergedInfo as SchoolInfo });
                localStorage.setItem('attendance_school_info', JSON.stringify(mergedInfo));
              }

              updateD1SyncState({ cloudConnected: true, cloudCounts: cloudData.counts || {} });
            }
          }
        }
      } catch {}

    } catch (e) {
      // Silently handle errors during data load
    } finally {
      _loadingFromApi = false;
      // DO NOT auto-push after load — the push.js admin cleanup can delete tokens.
      // Only push when the user makes actual data changes (via setStudents, etc.)
    }
  },
}));
