import { create } from 'zustand';
import type { User, Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, SchoolInfo, PageName, Notification, ClassScheduleEntry } from './types';
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
  language: 'en',
  primaryColor: '#10b981',

  setCurrentPage: (page) => set({ currentPage: page }),

  login: async (username, password, slug) => {
    try {
      const loginData: Record<string, string> = { username, password };
      if (slug) loginData.slug = slug;
      const result = await api.post('/auth/login', loginData);
      if (result && result.success) {
        setApiToken(result.token);
        const user: User = {
          id: result.user.id,
          username: result.user.username,
          fullName: result.user.fullName || result.user.username,
          email: result.user.email,
          role: result.user.role,
          tenantId: result.user.tenant_id,
          is_super_admin: result.user.is_super_admin,
        };
        if (result.user.is_super_admin) user.role = 'super_admin';
        set({ currentUser: user, isAuthenticated: true });
        localStorage.setItem('attendance_auth', JSON.stringify({
          userId: user.id,
          userRole: user.role,
          token: result.token,
          tenantId: user.tenantId,
          isSuperAdmin: user.is_super_admin || false,
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

  setStudents: (s) => { set({ students: s }); localStorage.setItem('attendance_students', JSON.stringify(s)); },
  setClasses: (c) => { set({ classes: c }); localStorage.setItem('attendance_classes', JSON.stringify(c)); },
  setModules: (m) => { set({ modules: m }); localStorage.setItem('attendance_modules', JSON.stringify(m)); },
  setAttendance: (a) => { set({ attendance: a }); localStorage.setItem('attendance_records', JSON.stringify(a)); },
  setGrades: (g) => { set({ grades: g }); localStorage.setItem('attendance_grades', JSON.stringify(g)); },
  setBehavior: (b) => { set({ behavior: b }); localStorage.setItem('attendance_behavior', JSON.stringify(b)); },
  setTasks: (t) => { set({ tasks: t }); localStorage.setItem('attendance_tasks', JSON.stringify(t)); },
  setIncidents: (i) => { set({ incidents: i }); localStorage.setItem('attendance_incidents', JSON.stringify(i)); },
  setTeachers: (t) => { set({ teachers: t }); localStorage.setItem('attendance_teachers', JSON.stringify(t)); },
  setEmployees: (e) => { set({ employees: e }); localStorage.setItem('attendance_employees', JSON.stringify(e)); },
  setTemplates: (t) => { set({ templates: t }); localStorage.setItem('attendance_templates', JSON.stringify(t)); },
  setAcademicYears: (y) => { set({ academicYears: y }); localStorage.setItem('attendance_academic_years', JSON.stringify(y)); },
  setSchoolInfo: (i) => { set({ schoolInfo: i }); localStorage.setItem('attendance_school_info', JSON.stringify(i)); },
  setNotifications: (n) => { set({ notifications: n }); },
  setSchedules: (s) => { set({ schedules: s }); localStorage.setItem('attendance_schedules', JSON.stringify(s)); },
  setPrimaryColor: (color) => { set({ primaryColor: color }); localStorage.setItem('attendance_primary_color', color); },

  loadAllData: async () => {
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
    });

    const token = getApiToken();
    if (!token) return;

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

      const modulesRes = await api.get('/modules');
      if (modulesRes?.success && Array.isArray(modulesRes.data)) {
        set({ modules: modulesRes.data });
        localStorage.setItem('attendance_modules', JSON.stringify(modulesRes.data));
      }

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

      const usersRes = await api.get('/users');
      if (usersRes?.success && Array.isArray(usersRes.data)) {
        localStorage.setItem('attendance_users', JSON.stringify(usersRes.data));
      }
    } catch (e) {
      console.warn('Failed to load from API, using local data:', e);
    }
  },
}));
