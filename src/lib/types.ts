export interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'teacher' | 'employee' | 'super_admin';
  password?: string;
  tenantId?: string;
  department?: string;
  is_super_admin?: boolean;
}

export interface Student {
  id: string;
  fullName: string;
  studentId: string;
  classId: string;
  className?: string;
  academicYear?: string;
  status: 'active' | 'abandoned' | 'terminated' | 'graduated';
  guardianName?: string;
  guardianPhone?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  photo?: string | null;
  group?: string;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  teacher?: string;
  room?: string;
  capacity?: number;
  academicYear?: string;
  createdAt: string;
}

export interface Module {
  id: string;
  name: string;
  code?: string;
  year?: string;
  semester?: string;
  credits?: number;
  description?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  createdAt: string;
}

export interface Grade {
  id: string;
  studentId: string;
  moduleId: string;
  grade?: string;
  percentage?: number;
  date?: string;
  createdAt: string;
}

export interface BehaviorRecord {
  id: string;
  studentId: string;
  type: 'positive' | 'negative';
  description: string;
  points?: number;
  date: string;
  teacher?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string;
  assignedBy?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  category?: string;
  dueDate?: string;
  progress?: number;
  ticketNumber?: string;
  completionReport?: string;
  attachments?: string[];
  comments?: TaskComment[];
  createdAt: string;
  completedAt?: string | null;
}

export interface TaskComment {
  id?: string;
  text: string;
  author?: string;
  createdAt?: string;
}

export interface Incident {
  id: string;
  studentId: string;
  incidentType?: string;
  description?: string;
  actionTaken?: string;
  reportedBy?: string;
  date?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  followUpNotes?: string;
  attachments?: string[];
  createdAt: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject?: string;
  email?: string;
  phone?: string;
  experience?: number;
  qualification?: string;
  notes?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  category?: string;
  createdAt: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  createdAt: string;
}

export interface SchoolInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'holiday' | 'meeting' | 'other';
  description?: string;
  color?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  urgent?: boolean;
  read?: boolean;
  timestamp: string;
  action?: string;
}

export type PageName = 'dashboard' | 'students' | 'classes' | 'modules' | 'attendance' | 'calendar' | 'grades' | 'behavior' | 'tasks' | 'incidents' | 'messaging' | 'reports' | 'settings' | 'superadmin';
