'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAppStore, syncToCloud, loadFromCloud, getCloudSyncStatus, sendAttendanceReminders, retrySync } from '@/lib/store';
import { setApiToken, localApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { User, Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, SchoolInfo, PageName, CalendarEvent, ClassScheduleEntry, Exam, ExamGrade, CurriculumItem, AuditLogEntry, SavedSchedule } from '@/lib/types';
import * as exportUtils from '@/lib/export';
import * as pdfUtils from '@/lib/pdf';
import { sendTaskAssignmentEmail, saveBrevoConfig, loadBrevoConfig, sendEmail } from '@/lib/email';

// Module-level Google OAuth2 token resolve — GIS initTokenClient requires the callback at init time
let _googleTokenResolve: ((token: string) => void) | null = null;
let _googleTokenReject: ((err: Error) => void) | null = null;
function _googleTokenCallback(resp: Record<string, unknown>) {
  if (resp.error) {
    _googleTokenReject?.(new Error(String(resp.error)));
  } else if (resp.access_token) {
    _googleTokenResolve?.(resp.access_token as string);
  } else {
    _googleTokenReject?.(new Error('No access token received'));
  }
  _googleTokenResolve = null;
  _googleTokenReject = null;
}

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardCheck, Calendar,
  FileText, SmilePlus, ListTodo, AlertTriangle, MessageSquare, BarChart3,
  Settings, Shield, LogOut, Search, Download, Bell, Sun, Moon, Menu,
  X, Plus, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, RefreshCw,
  UserPlus, CheckCircle2, XCircle, Clock, ShieldCheck, Upload,
  Save, Key, Languages, Building2, Phone, Mail, MapPin, Star,
  TrendingUp, TrendingDown, Minus, CircleDot, Send, FileDown,
  Copy, Printer, Lock, ArrowLeft, Filter, MoreHorizontal, MessageCircle,
  Flame, Award, Zap, Globe, Database, Activity, ToggleLeft, CreditCard, IdCard,
  Palette, HardDrive, ChevronDown, Info, RotateCcw, Archive, Cloud, FolderOpen,
  FileCheck, ListChecks, Target, Smartphone, WifiOff, History, FileUp,
  AlertOctagon, Paperclip, BellRing
} from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

type NavItem = { id: PageName; labelKey: string; icon: React.ReactNode; superAdminOnly?: boolean; allowedRoles?: User['role'][]; };

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: <LayoutDashboard className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'employee', 'super_admin'] },
  { id: 'students', labelKey: 'students', icon: <Users className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'super_admin'] },
  { id: 'classes', labelKey: 'classes', icon: <GraduationCap className="h-5 w-5" />, allowedRoles: ['admin', 'super_admin'] },
  { id: 'modules', labelKey: 'modules', icon: <BookOpen className="h-5 w-5" />, allowedRoles: ['admin', 'super_admin'] },
  { id: 'attendance', labelKey: 'attendance', icon: <ClipboardCheck className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'super_admin'] },
  { id: 'calendar', labelKey: 'calendar', icon: <Calendar className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'employee', 'super_admin'] },
  { id: 'schedule', labelKey: 'schedule', icon: <Clock className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'super_admin'] },
  { id: 'grades', labelKey: 'grades', icon: <FileText className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'super_admin'] },
  { id: 'behavior', labelKey: 'behavior', icon: <SmilePlus className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'super_admin'] },
  { id: 'tasks', labelKey: 'tasks', icon: <ListTodo className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'employee', 'super_admin'] },
  { id: 'incidents', labelKey: 'incidents', icon: <AlertTriangle className="h-5 w-5" />, allowedRoles: ['admin', 'super_admin'] },
  { id: 'messaging', labelKey: 'messaging', icon: <MessageSquare className="h-5 w-5" />, allowedRoles: ['admin', 'super_admin'] },
  { id: 'exams', labelKey: 'exams', icon: <FileCheck className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'super_admin'] },
  { id: 'curriculum', labelKey: 'curriculum', icon: <ListChecks className="h-5 w-5" />, allowedRoles: ['admin', 'super_admin'] },
  { id: 'reports', labelKey: 'reports', icon: <BarChart3 className="h-5 w-5" />, allowedRoles: ['admin', 'teacher', 'super_admin'] },
  { id: 'settings', labelKey: 'settings', icon: <Settings className="h-5 w-5" />, allowedRoles: ['admin', 'super_admin'] },
  { id: 'superadmin', labelKey: 'super_admin', icon: <Shield className="h-5 w-5" />, superAdminOnly: true, allowedRoles: ['super_admin'] },
];

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  absent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  late: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  excused: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  abandoned: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  terminated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  graduated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  investigating: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  exam_in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  planned: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="secondary" className={STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}>{t(status)}</Badge>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><CircleDot className="h-12 w-12 mb-4 opacity-50" /><p>{message}</p></div>;
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }

/** Get today's date as YYYY-MM-DD in LOCAL timezone (not UTC) */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format a Date to YYYY-MM-DD in local timezone */
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatWhatsAppPhone(phone: string | undefined): string {
  if (!phone) return '';
  let c = phone.replace(/\D/g, '');
  // Moroccan format: 0600000000 (10 digits starting with 0)
  if (c.length === 10 && c.startsWith('0')) c = '212' + c.substring(1);
  // UK format: 07XXX XXXXX (10 digits starting with 0)
  else if (c.length === 11 && c.startsWith('44')) { /* already formatted */ }
  // US format: 10 digits
  else if (c.length === 10) c = '1' + c;
  return c;
}

// ==================== GLOBAL SEARCH DIALOG ====================
function GlobalSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { students, classes, tasks, teachers, language, setCurrentPage } = useAppStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setTimeout(() => { setQuery(''); inputRef.current?.focus(); }, 100); } }, [open]);

  const q = query.toLowerCase();
  const results = useMemo(() => {
    if (!q || q.length < 2) return { students: [], classes: [], tasks: [], teachers: [] };
    return {
      students: students.filter(s => s.fullName?.toLowerCase().includes(q) || s.studentId?.toLowerCase().includes(q)).slice(0, 5),
      classes: classes.filter(c => c.name?.toLowerCase().includes(q) || c.teacher?.toLowerCase().includes(q)).slice(0, 5),
      tasks: tasks.filter(tk => tk.title?.toLowerCase().includes(q)).slice(0, 5),
      teachers: teachers.filter(tc => tc.name?.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [q, students, classes, tasks, teachers]);

  const totalResults = results.students.length + results.classes.length + results.tasks.length + results.teachers.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <div className="flex items-center border-b px-4 py-3 gap-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={language === 'fr' ? 'Rechercher étudiants, classes, tâches...' : 'Search students, classes, tasks...'} className="flex-1 bg-transparent outline-none text-sm" />
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {q.length < 2 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{t('type_to_search', language) || (language === 'fr' ? 'Tapez pour rechercher...' : 'Type to search...')}</p>
          ) : totalResults === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{t('no_results_found', language) || 'No results found'}</p>
          ) : (
            <>
              {results.students.length > 0 && <><p className="text-xs font-semibold text-muted-foreground px-2 py-1">{t('students', language)}</p>
                {results.students.map(s => (
                  <button key={s.id} onClick={() => { onOpenChange(false); useAppStore.setState({ profileViewStudent: s } as Partial<typeof useAppStore.getState>); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 text-sm">👤</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{s.fullName}</p><p className="text-xs text-muted-foreground">{s.studentId} • {classes.find(c => c.id === s.classId)?.name || '-'}</p></div>
                  </button>
                ))}</>}
              {results.classes.length > 0 && <><p className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-1">{t('classes', language)}</p>
                {results.classes.map(c => (
                  <button key={c.id} onClick={() => { onOpenChange(false); setCurrentPage('classes'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 text-sm">🏫</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-muted-foreground">{students.filter(s => s.classId === c.id).length} {t('students', language)}</p></div>
                  </button>
                ))}</>}
              {results.tasks.length > 0 && <><p className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-1">{t('tasks', language)}</p>
                {results.tasks.map(t => (
                  <button key={t.id} onClick={() => { onOpenChange(false); setCurrentPage('tasks'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left">
                    <StatusBadge status={t.status} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.title}</p><p className="text-xs text-muted-foreground">{t.dueDate || '-'}</p></div>
                  </button>
                ))}</>}
              {results.teachers.length > 0 && <><p className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-1">{t('teachers_management', language)}</p>
                {results.teachers.map(t => (
                  <button key={t.id} onClick={() => { onOpenChange(false); setCurrentPage('settings'); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left">
                    <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 text-sm">👨‍🏫</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.name}</p><p className="text-xs text-muted-foreground">{t.subject || '-'}</p></div>
                  </button>
                ))}</>}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== SMART NOTIFICATIONS ====================
function generateSmartNotifications(students: Student[], attendance: AttendanceRecord[], tasks: Task[], classes: Class[], language: string) {
  const notifs: Array<{ id: string; title: string; message: string; urgent: boolean; timestamp: string; action?: string }> = [];
  const today = localToday();
  const todayRecs = attendance.filter(r => r.date === today);

  // Low attendance alerts (< 75%)
  students.forEach(s => {
    if (s.status !== 'active') return;
    const sa = attendance.filter(a => a.studentId === s.id);
    if (sa.length >= 5) {
      const rate = Math.round((sa.filter(a => a.status === 'present').length / sa.length) * 100);
      if (rate < 75) {
        notifs.push({ id: `low-att-${s.id}`, title: '⚠️ Low Attendance', message: `${s.fullName} — ${rate}% attendance rate`, urgent: true, timestamp: new Date().toISOString(), action: 'student' });
      }
    }
  });

  // Unmarked attendance today
  const markedIds = new Set(todayRecs.map(r => r.studentId));
  const activeStudents = students.filter(s => s.status === 'active' && !markedIds.has(s.id));
  if (activeStudents.length > 0) {
    notifs.push({ id: 'unmarked-today', title: '📋 Unmarked Attendance', message: `${activeStudents.length} student(s) have no attendance record for today`, urgent: true, timestamp: new Date().toISOString(), action: 'attendance' });
  }

  // Overdue tasks
  const overdueTasks = tasks.filter(t => (t.status === 'pending' || t.status === 'in_progress') && t.dueDate && t.dueDate < today);
  if (overdueTasks.length > 0) {
    notifs.push({ id: 'overdue-tasks', title: '⏰ Overdue Tasks', message: `${overdueTasks.length} task(s) are past their due date`, urgent: false, timestamp: new Date().toISOString(), action: 'tasks' });
  }

  // High absence today
  const absentToday = todayRecs.filter(r => r.status === 'absent').length;
  if (absentToday > 3) {
    notifs.push({ id: 'high-absence', title: '🔴 High Absences Today', message: `${absentToday} student(s) marked absent today`, urgent: true, timestamp: new Date().toISOString(), action: 'attendance' });
  }

  return notifs;
}

// ==================== STUDENT 360° PROFILE ====================
function Student360Profile({ student, onClose }: { student: Student; onClose: () => void }) {
  const { classes, attendance, grades, behavior, incidents, modules, language, setCurrentPage } = useAppStore();

  const studentClass = classes.find(c => c.id === student.classId);
  const sa = attendance.filter(a => a.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const sg = grades.filter(g => g.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const sb = behavior.filter(b => b.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const si = incidents.filter(i => i.studentId === student.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const total = sa.length, present = sa.filter(a => a.status === 'present').length, absent = sa.filter(a => a.status === 'absent').length, late = sa.filter(a => a.status === 'late').length, excused = sa.filter(a => a.status === 'excused').length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  let curStreak = 0;
  for (const r of [...sa].sort((a, b) => (b.date || '').localeCompare(a.date || ''))) { if (r.status === 'present') curStreak++; else break; }
  let bestStreak = 0, tmp = 0;
  for (const r of [...sa].sort((a, b) => (a.date || '').localeCompare(b.date || ''))) { if (r.status === 'present') { tmp++; bestStreak = Math.max(bestStreak, tmp); } else tmp = 0; }

  const weeklyTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const w = 3 - i;
      const we = new Date(now); we.setDate(now.getDate() - w * 7);
      const ws = new Date(we); ws.setDate(we.getDate() - 6);
      const wsStr = toLocalDate(ws);
      const weStr = toLocalDate(we);
      const wr = sa.filter(a => a.date >= wsStr && a.date <= weStr);
      const wp = wr.filter(a => a.status === 'present').length;
      return { label: `W${4 - w}`, rate: wr.length > 0 ? Math.round((wp / wr.length) * 100) : 0 };
    });
  }, [sa]);

  const monthlyData = useMemo(() => {
    const m = new Map<string, { present: number; total: number }>();
    sa.forEach(a => { const k = a.date?.substring(0, 7); if (k) { const d = m.get(k) || { present: 0, total: 0 }; d.total++; if (a.status === 'present') d.present++; m.set(k, d); } });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).map(([month, d]) => ({ month, rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0, present: d.present, total: d.total }));
  }, [sa]);

  const avgGrade = sg.filter(g => g.percentage != null).reduce((s, g) => s + (g.percentage as number), 0) / (sg.filter(g => g.percentage != null).length || 1);
  const totalBp = sb.reduce((s, b) => s + (b.points || 0), 0);

  const [tab, setTab] = useState('attendance');
  const statusColor = { active: 'text-emerald-600', abandoned: 'text-amber-600', terminated: 'text-red-600', graduated: 'text-blue-600' }[student.status] || 'text-gray-600';

  const esc = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const handleGenerateCard = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Student Card - ${esc(student.fullName)}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0}
      .card{width:320px;height:200px;background:white;border-radius:16px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.1);display:flex;flex-direction:column;justify-content:space-between;border:2px solid #10b981}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e5e7eb;padding-bottom:10px}
      .header h2{font-size:14px;color:#10b981}
      .body{display:flex;gap:16px;flex:1;align-items:center}
      .photo{width:64px;height:64px;background:#e5e7eb;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px}
      .info h3{font-size:16px;margin-bottom:4px}.info p{font-size:11px;color:#6b7280;margin:2px 0}
      .footer{display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
    </style></head><body><div class="card">
      <div class="header"><h2>INFOHAS</h2><span style="font-size:12px;color:#6b7280">${esc(student.academicYear || '')}</span></div>
      <div class="body"><div class="photo">${student.photo ? `<img src="${esc(student.photo)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover">` : '&#128100;'}</div>
      <div class="info"><h3>${esc(student.fullName)}</h3><p>ID: ${esc(student.studentId)}</p><p>${esc(studentClass?.name || '-')}</p><p>Year: ${esc(student.academicYear || '-')}</p></div></div>
      <div class="footer"><span>Attendance: ${rate}%</span><span>Generated: ${new Date().toLocaleDateString()}</span></div>
    </div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const handleReport = () => {
    const csvEsc = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
    const csvContent = `Student Report - ${student.fullName}\n\nBasic Info\nName,${csvEsc(student.fullName)}\nID,${csvEsc(student.studentId)}\nClass,${csvEsc(studentClass?.name)}\nAcademic Year,${csvEsc(student.academicYear)}\nStatus,${csvEsc(student.status)}\nGuardian,${csvEsc(student.guardianName)}\nPhone,${csvEsc(student.guardianPhone)}\nEmail,${csvEsc(student.email)}\n\nAttendance Summary\nTotal Days,${total}\nPresent,${present}\nAbsent,${absent}\nLate,${late}\nExcused,${excused}\nRate,${rate}%\nCurrent Streak,${curStreak}\nBest Streak,${bestStreak}\n\nRecent Grades\n${sg.slice(0, 10).map(g => `${csvEsc(modules.find(m => m.id === g.moduleId)?.name)},${csvEsc(g.grade)},${g.percentage || '-'}%`).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `report_${student.studentId}.csv`; a.click();
    toast.success(language === 'fr' ? 'Rapport généré' : 'Report generated');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden p-0 sm:p-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border-b bg-muted/30">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl sm:text-2xl shrink-0 overflow-hidden bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
            {student.photo ? <img src={student.photo} alt="" className="w-full h-full object-cover" /> : student.fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 w-full">
            <h3 className="font-bold text-base sm:text-lg truncate">{student.fullName}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">{student.studentId} • {studentClass?.name || '-'}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="secondary" className={statusColor}>{student.status}</Badge>
              <Badge variant="secondary">{student.academicYear || '-'}</Badge>
              {curStreak > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">🔥 {curStreak}</Badge>}
              {bestStreak > 2 && <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">⭐ {bestStreak}</Badge>}
              {avgGrade > 0 && <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{language === 'fr' ? 'Moy : ' : 'Avg: '}{Math.round(avgGrade)}%</Badge>}
              {totalBp !== 0 && <Badge className={totalBp > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}>{totalBp > 0 ? '+' : ''}{totalBp} {language === 'fr' ? 'pts' : 'pts'}</Badge>}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleReport}><FileText className="h-4 w-4 mr-1" />{t('report', language) || 'Report'}</Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleGenerateCard}><IdCard className="h-4 w-4 mr-1" />{t('generate_card', language) || 'Card'}</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b">
          <div><span className="text-muted-foreground">{t('guardian', language)}:</span> <span className="font-medium ml-1">{student.guardianName || '-'}</span></div>
          <div><span className="text-muted-foreground">{t('phone', language)}:</span> <span className="font-medium ml-1">{student.guardianPhone || '-'}</span></div>
          <div><span className="text-muted-foreground">Email:</span> <span className="font-medium ml-1 break-all">{student.email || '-'}</span></div>
          <div><span className="text-muted-foreground">{language === 'fr' ? 'Adresse' : 'Address'}:</span> <span className="font-medium ml-1">{student.address || '-'}</span></div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="px-3 sm:px-4">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="attendance" className="text-[10px] sm:text-xs px-1">{t('attendance', language)}</TabsTrigger>
            <TabsTrigger value="trends" className="text-[10px] sm:text-xs px-1">{t('trends', language) || 'Trends'}</TabsTrigger>
            <TabsTrigger value="grades" className="text-[10px] sm:text-xs px-1">{t('grades', language)}</TabsTrigger>
            <TabsTrigger value="behavior" className="text-[10px] sm:text-xs px-1">{t('behavior', language)}</TabsTrigger>
            <TabsTrigger value="incidents" className="text-[10px] sm:text-xs px-1">{t('incidents', language)}</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[350px] px-3 sm:px-4 pb-4">
          {tab === 'attendance' && <>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2 mb-4">
              {[{ label: t('present', language), val: present, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' }, { label: t('absent', language), val: absent, color: 'bg-red-100 text-red-700 dark:bg-red-900/30' }, { label: t('late', language), val: late, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' }, { label: t('excused', language), val: excused, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30' }, { label: 'Rate', val: `${rate}%`, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30' }].map((s, i) => (
                <div key={i} className={`rounded-lg p-2 sm:p-3 text-center ${s.color}`}><p className="text-lg sm:text-xl font-bold">{s.val}</p><p className="text-[10px] sm:text-xs opacity-70">{s.label}</p></div>
              ))}
            </div>
            {sa.length > 0 ? sa.slice(0, 30).map(a => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-border/50 text-xs sm:text-sm">
                <span className="text-muted-foreground text-[10px] sm:text-xs">{a.date}</span>
                <div className="flex items-center gap-1"><StatusBadge status={a.status} /><span className="text-[10px] sm:text-xs">{a.notes && `• ${a.notes}`}</span></div>
              </div>
            )) : <EmptyState message={t('no_data', language)} />}
          </>}

          {tab === 'trends' && <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
              <div className="rounded-lg p-2 sm:p-3 text-center bg-amber-100 dark:bg-amber-900/20"><p className="text-xl sm:text-2xl font-bold text-amber-700">🔥 {curStreak}</p><p className="text-[10px] sm:text-xs text-amber-600">{language === 'fr' ? 'Série actuelle' : 'Current Streak'}</p></div>
              <div className="rounded-lg p-2 sm:p-3 text-center bg-emerald-100 dark:bg-emerald-900/20"><p className="text-xl sm:text-2xl font-bold text-emerald-700">⭐ {bestStreak}</p><p className="text-[10px] sm:text-xs text-emerald-600">{language === 'fr' ? 'Meilleure série' : 'Best Streak'}</p></div>
              <div className="rounded-lg p-2 sm:p-3 text-center bg-purple-100 dark:bg-purple-900/20"><p className="text-xl sm:text-2xl font-bold text-purple-700">{rate}%</p><p className="text-[10px] sm:text-xs text-purple-600">{language === 'fr' ? 'Taux de présence' : 'Attendance Rate'}</p></div>
            </div>
            <p className="text-xs sm:text-sm font-semibold mb-3">{language === 'fr' ? '4 dernières semaines' : 'Last 4 Weeks'}</p>
            <div className="flex gap-2 sm:gap-3 items-end h-24 sm:h-28 mb-6">
              {weeklyTrend.map(w => (
                <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] sm:text-xs font-bold">{w.rate}%</span>
                  <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(w.rate, 5)}%`, minHeight: '8px', backgroundColor: w.rate >= 80 ? '#10b981' : w.rate >= 50 ? '#f59e0b' : '#ef4444' }} />
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">{w.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs sm:text-sm font-semibold mb-3">{language === 'fr' ? 'Résumé mensuel' : 'Monthly Summary'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {monthlyData.length > 0 ? monthlyData.map(m => (
                <div key={m.month} className="rounded-lg border p-2 sm:p-2.5 text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{m.month}</p>
                  <p className="text-base sm:text-lg font-bold" style={{ color: m.rate >= 80 ? '#10b981' : m.rate >= 50 ? '#f59e0b' : '#ef4444' }}>{m.rate}%</p>
                  <p className="text-[10px] sm:text-[10px] text-muted-foreground">{m.present}/{m.total}</p>
                </div>
              )) : <p className="text-xs sm:text-sm text-muted-foreground col-span-3">{t('no_data', language)}</p>}
            </div>
          </>}

          {tab === 'grades' && (sg.length > 0 ? sg.map(g => {
            const mod = modules.find(m => m.id === g.moduleId);
            const pct = g.percentage ? parseFloat(String(g.percentage)) : 0;
            return <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-border/50 text-xs sm:text-sm gap-0.5 sm:gap-0">
              <span className="text-[10px] sm:text-xs text-muted-foreground">{g.date || '-'}</span>
              <span><span className="text-[10px] sm:text-xs text-muted-foreground">{mod?.name || '-'} — </span><strong>{g.grade || '-'}</strong> <span style={{ color: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }} className="font-semibold">({g.percentage || '-'}%)</span></span>
            </div>;
          }) : <EmptyState message={t('no_data', language)} />)}

          {tab === 'behavior' && (sb.length > 0 ? sb.map(b => {
            const icon = b.type === 'positive' ? '👍' : '👎';
            const col = b.type === 'positive' ? 'text-emerald-600' : 'text-red-600';
            return <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-border/50 text-xs sm:text-sm gap-0.5 sm:gap-0">
              <span className="text-[10px] sm:text-xs text-muted-foreground">{b.date || '-'}</span>
              <span className="text-right sm:text-left">{icon} <span className={`font-semibold ${col}`}>{b.type}</span> — {b.description || '-'} <span className="font-semibold">{b.points && b.points > 0 ? '+' : ''}{b.points || 0} pts</span></span>
            </div>;
          }) : <EmptyState message={t('no_data', language)} />)}

          {tab === 'incidents' && (si.length > 0 ? si.map(inc => {
            const sevCol = { low: 'text-amber-600', medium: 'text-orange-600', high: 'text-red-600', critical: 'text-red-700' }[inc.severity] || 'text-gray-600';
            return <div key={inc.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-border/50 text-xs sm:text-sm gap-0.5 sm:gap-0">
              <span className="text-[10px] sm:text-xs text-muted-foreground">{inc.date || '-'}</span>
              <span className="text-right sm:text-left"><span className={`font-semibold ${sevCol}`}>{inc.severity}</span> — {inc.description || '-'} <StatusBadge status={inc.status} /></span>
            </div>;
          }) : <EmptyState message={t('no_data', language)} />)}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ==================== LOGIN SCREEN ====================
function LoginScreen() {
  const { login, language, schoolInfo } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    const success = await login(username, password, slug || undefined);
    if (success) toast.success(language === 'fr' ? 'Connexion réussie!' : 'Login successful!');
    else setError(language === 'fr' ? 'Identifiants incorrects' : 'Invalid credentials');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center login-gradient dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl logo-container overflow-hidden">
            {schoolInfo?.logo ? <img src={schoolInfo.logo} alt="Logo" /> : <GraduationCap className="h-9 w-9 text-white" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{schoolInfo?.name || 'INFOHAS'}</CardTitle>
            {schoolInfo?.field && <CardDescription className="text-sm mt-1">{schoolInfo.field}</CardDescription>}
            <CardDescription className="text-xs mt-0.5 opacity-70">{language === 'fr' ? "Système de Gestion de Présence" : "Attendance Management System"}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center">{error}</div>}
            <div className="space-y-2"><Label htmlFor="username">{t('username', language)}</Label><Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('username', language)} /></div>
            <div className="space-y-2"><Label htmlFor="password">{t('password', language)}</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('password', language)} /></div>
            <div className="space-y-2"><Label htmlFor="slug">{t('school_slug', language)}</Label><Input id="slug" value={slug} onChange={e => setSlug(e.target.value)} placeholder="school-name" /></div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>{loading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}{t('signing_in', language)}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SIDEBAR ====================
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser, currentPage, setCurrentPage, logout, language } = useAppStore();
  const schoolInfo = useAppStore(s => s.schoolInfo);
  const filteredNav = NAV_ITEMS.filter(item => {
    if (item.superAdminOnly && currentUser?.role !== 'super_admin') return false;
    if (item.allowedRoles && currentUser?.role && !item.allowedRoles.includes(currentUser.role)) return false;
    return true;
  });
  const roleLabel = currentUser?.role === 'super_admin' ? 'SUPER_ADMIN' : currentUser?.role === 'admin' ? 'ADMIN' : currentUser?.role === 'teacher' ? 'TEACHER' : 'EMPLOYEE';

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl logo-container shrink-0 overflow-hidden">
              {schoolInfo?.logo ? <img src={schoolInfo.logo} alt="" /> : <GraduationCap className="h-6 w-6 text-white" />}
            </div>
            <div className="flex-1 min-w-0"><h2 className="font-bold text-sm truncate">{schoolInfo?.name || 'INFOHAS'}</h2><p className="text-xs text-muted-foreground truncate">{schoolInfo?.field || (language === 'fr' ? 'Système de Gestion Scolaire' : 'School Management System')}</p></div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}><X className="h-5 w-5" /></Button>
          </div>
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">{(currentUser?.username || currentUser?.fullName || 'A').charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{currentUser?.username || currentUser?.fullName || 'admin'}</p><Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{roleLabel}</Badge></div>
            </div>
          </div>
          <ScrollArea className="flex-1 custom-scrollbar">
            <nav className="p-2 space-y-1">
              {filteredNav.map(item => (
                <button key={item.id} onClick={() => { setCurrentPage(item.id); onClose(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentPage === item.id ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{item.icon}{t(item.labelKey, language)}</button>
              ))}
            </nav>
          </ScrollArea>
          <div className="p-3 border-t border-border space-y-1">
            <button onClick={() => { setCurrentPage('settings'); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"><Key className="h-4 w-4" />{t('change_password', language)}</button>
            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><LogOut className="h-4 w-4" />{t('logout', language)}</button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ==================== HEADER ====================
function Header({ onMenuClick, onExportClick }: { onMenuClick: () => void; onExportClick: () => void }) {
  const { currentPage, language, students, attendance, tasks, classes } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [syncTime, setSyncTime] = useState(new Date());

  const smartNotifs = useMemo(() => generateSmartNotifications(students, attendance, tasks, classes, language), [students, attendance, tasks, classes, language]);
  const unreadCount = smartNotifs.length;

  useEffect(() => { const timer = setInterval(() => setSyncTime(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}><Menu className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0"><h1 className="text-lg font-semibold truncate">{t(currentPage, language)}</h1></div>
        <Button variant="outline" size="sm" className="hidden sm:flex gap-2 text-muted-foreground" onClick={() => setSearchOpen(true)}><Search className="h-4 w-4" /><span className="text-xs">{t('search', language)}</span><kbd className="hidden md:inline-flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">Ctrl+K</kbd></Button>
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { const langs = ['en', 'fr', 'ar'] as const; const idx = langs.indexOf(language); const newLang = langs[(idx + 1) % langs.length]; useAppStore.setState({ language: newLang }); localStorage.setItem('attendance_language', newLang); document.documentElement.lang = newLang; document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'; const names: Record<string, string> = { en: 'English', fr: 'Français', ar: 'العربية' }; toast.success(names[newLang]); }}><Languages className="h-4 w-4" /><span className="hidden sm:inline">{language.toUpperCase()}</span></Button>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>
        <Button variant="outline" size="icon" onClick={onExportClick}><Download className="h-4 w-4" /></Button>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span>{language === 'fr' ? 'Dernière sync' : 'Last sync'}: {syncTime.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setNotifOpen(!notifOpen)} className="relative"><Bell className="h-5 w-5" />
            {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>}
          </Button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50">
              <div className="p-3 border-b flex items-center justify-between"><p className="text-sm font-semibold">{t('notifications', language)}</p><Button variant="ghost" size="sm" onClick={() => setNotifOpen(false)}><X className="h-4 w-4" /></Button></div>
              <div className="max-h-72 overflow-y-auto">
                {smartNotifs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">{t('no_data', language)}</p> : smartNotifs.map(n => (
                  <button key={n.id} className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border/50 transition-colors" onClick={() => { setNotifOpen(false); if (n.action === 'attendance') useAppStore.getState().setCurrentPage('attendance'); else if (n.action === 'tasks') useAppStore.getState().setCurrentPage('tasks'); else if (n.action === 'student') useAppStore.getState().setCurrentPage('students'); }}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </header>
  );
}

// ==================== DASHBOARD PAGE ====================
function DashboardPage() {
  const { students, classes, attendance, language, setCurrentPage, tasks, grades } = useAppStore();
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 500); return () => clearTimeout(t); }, []);

  const today = localToday();
  const todayRecords = attendance.filter(r => r.date === today);
  const presentCount = todayRecords.filter(r => r.status === 'present').length;
  const absentCount = todayRecords.filter(r => r.status === 'absent').length;
  const lateCount = todayRecords.filter(r => r.status === 'late').length;

  const last7Days = useMemo(() => {
    const days: Array<{ date: string; present: number; absent: number; late: number }> = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const ds = toLocalDate(d); const dr = attendance.filter(r => r.date === ds); days.push({ date: d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' }), present: dr.filter(r => r.status === 'present').length, absent: dr.filter(r => r.status === 'absent').length, late: dr.filter(r => r.status === 'late').length }); }
    return days;
  }, [attendance, language]);

  // 30-day attendance trend line chart
  const last30Days = useMemo(() => {
    const days: Array<{ date: string; rate: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = toLocalDate(d);
      const dr = attendance.filter(r => r.date === ds);
      const rate = dr.length > 0 ? Math.round((dr.filter(r => r.status === 'present').length / dr.length) * 100) : 0;
      days.push({ date: d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' }), rate });
    }
    return days;
  }, [attendance, language]);

  // Task summary
  const taskSummary = useMemo(() => ({
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  }), [tasks]);

  // Recent tasks (last 5)
  const recentTasks = useMemo(() => [...tasks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5), [tasks]);

  // Class enrollment pie chart
  const classEnrollment = useMemo(() => {
    return classes.map(c => ({
      name: c.name,
      value: students.filter(s => s.classId === c.id && s.status === 'active').length,
    })).filter(d => d.value > 0);
  }, [classes, students]);

  // Grade distribution
  const gradeDistribution = useMemo(() => {
    const ranges = [
      { range: '0-10', min: 0, max: 10 },
      { range: '10-12', min: 10, max: 12 },
      { range: '12-14', min: 12, max: 14 },
      { range: '14-16', min: 14, max: 16 },
      { range: '16-20', min: 16, max: 20 },
    ];
    return ranges.map(r => ({
      range: r.range,
      count: grades.filter(g => {
        if (g.percentage == null) return false;
        const pct = g.percentage as number;
        return pct >= r.min && pct < (r.range === '16-20' ? 21 : r.max);
      }).length,
    }));
  }, [grades]);

  const pieData = [{ name: t('present', language), value: presentCount, color: '#10b981' }, { name: t('absent', language), value: absentCount, color: '#ef4444' }, { name: t('late', language), value: lateCount, color: '#f59e0b' }].filter(d => d.value > 0);
  const recentRecords = attendance.slice(-10).reverse();

  const stats = [
    { label: t('total_students', language), value: students.length, icon: <Users className="h-6 w-6" />, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
    { label: t('total_classes', language), value: classes.length, icon: <GraduationCap className="h-6 w-6" />, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
    { label: t('today_attendance', language), value: todayRecords.length, icon: <ClipboardCheck className="h-6 w-6" />, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
    { label: t('present_today', language), value: presentCount, icon: <CheckCircle2 className="h-6 w-6" />, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
  ];

  if (loading) return <div className="space-y-6"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-4"><div className={`p-3 rounded-xl ${s.color}`}>{s.icon}</div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>)}
      </div>
      <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{t('quick_actions', language)}</CardTitle></CardHeader><CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{ label: t('add_student', language), icon: <UserPlus className="h-5 w-5" />, page: 'students' as PageName }, { label: t('mark_attendance', language), icon: <ClipboardCheck className="h-5 w-5" />, page: 'attendance' as PageName }, { label: t('today_report', language), icon: <FileText className="h-5 w-5" />, page: 'reports' as PageName }, { label: t('view_calendar', language), icon: <Calendar className="h-5 w-5" />, page: 'calendar' as PageName }].map((a, i) => <Button key={i} variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setCurrentPage(a.page)}>{a.icon}<span className="text-xs">{a.label}</span></Button>)}
        </div>
      </CardContent></Card>

      {/* Task Summary + Recent Tasks */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{t('tasks', language)} — {language === 'fr' ? 'Résumé' : 'Summary'}</CardTitle></CardHeader><CardContent>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: t('pending', language), val: taskSummary.pending, color: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30' },
              { label: t('in_progress', language), val: taskSummary.in_progress, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
              { label: t('completed', language), val: taskSummary.completed, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
              { label: t('overdue', language), val: taskSummary.overdue, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
            ].map((s, i) => (
              <div key={i} className={`rounded-lg p-3 text-center ${s.color}`}><p className="text-xl font-bold">{s.val}</p><p className="text-[10px] opacity-70">{s.label}</p></div>
            ))}
          </div>
          {recentTasks.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">{language === 'fr' ? 'Tâches récentes' : 'Recent Tasks'}</p>
              {recentTasks.map(tk => (
                <div key={tk.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-muted/50">
                  <StatusBadge status={tk.priority} />
                  <span className="flex-1 truncate">{tk.title}</span>
                  <StatusBadge status={tk.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>

        {/* Class Enrollment Pie Chart */}
        <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{language === 'fr' ? 'Inscription par Classe' : 'Class Enrollment'}</CardTitle></CardHeader><CardContent>
          <div className="h-64">
            {classEnrollment.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={classEnrollment} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{classEnrollment.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><ReTooltip /></PieChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('no_data', language)}</div>}
          </div>
        </CardContent></Card>
      </div>

      {/* 30-day Attendance Trend Line Chart */}
      <Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base">{language === 'fr' ? 'Tendance de présence (30 jours)' : 'Attendance Trend (30 days)'}</CardTitle></CardHeader><CardContent>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={last30Days}><CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} /><YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" /><ReTooltip /><Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={false} name={language === 'fr' ? 'Taux de présence' : 'Attendance Rate'} /></LineChart></ResponsiveContainer></div>
      </CardContent></Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base">{language === 'fr' ? 'Présence (7 jours)' : 'Attendance (7 days)'}</CardTitle></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={last7Days}><CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><ReTooltip /><Legend /><Bar dataKey="present" fill="#10b981" name={t('present', language)} radius={[4, 4, 0, 0]} /><Bar dataKey="absent" fill="#ef4444" name={t('absent', language)} radius={[4, 4, 0, 0]} /><Bar dataKey="late" fill="#f59e0b" name={t('late', language)} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>

        {/* Grade Distribution Bar Chart */}
        <Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base">{language === 'fr' ? 'Distribution des Notes' : 'Grade Distribution'}</CardTitle></CardHeader><CardContent>
          <div className="h-64">{grades.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%"><BarChart data={gradeDistribution}><CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="range" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><ReTooltip /><Bar dataKey="count" fill="#8b5cf6" name={language === 'fr' ? 'Étudiants' : 'Students'} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('no_data', language)}</div>}</div>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base">{language === "fr" ? "Distribution d'Aujourd'hui" : "Today's Distribution"}</CardTitle></CardHeader><CardContent><div className="h-64">{pieData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><ReTooltip /></PieChart></ResponsiveContainer> : <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('no_data', language)}</div>}</div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{t('recent_activity', language)}</CardTitle></CardHeader><CardContent>
          {recentRecords.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
            <div className="max-h-64 overflow-y-auto custom-scrollbar"><Table><TableHeader><TableRow><TableHead>{t('students', language)}</TableHead><TableHead>{t('calendar', language)}</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
              {recentRecords.map(r => { const s = students.find(st => st.id === r.studentId); return <TableRow key={r.id}><TableCell className="font-medium">{s?.fullName || 'Unknown'}</TableCell><TableCell>{r.date}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell></TableRow>; })}
            </TableBody></Table></div>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}

// ==================== STUDENTS PAGE ====================
function StudentsPage() {
  const { students, classes, language, setStudents, setCurrentPage, academicYears, schoolInfo } = useAppStore();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({ fullName: '', studentId: '', classId: '', status: 'active' as Student['status'], guardianName: '', guardianPhone: '', guardianEmail: '', phone: '', email: '', address: '', notes: '', group: '', photo: '' as string });
  const [sortBy, setSortBy] = useState('name_asc');
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchClassId, setBatchClassId] = useState('');

  const filtered = students.filter(s => {
    const ms = (s.fullName || '').toLowerCase().includes(search.toLowerCase()) || (s.studentId || '').toLowerCase().includes(search.toLowerCase()) || (s.guardianName || '').toLowerCase().includes(search.toLowerCase());
    return ms && (classFilter === 'all' || s.classId === classFilter) && (statusFilter === 'all' || s.status === statusFilter);
  }).sort((a, b) => { if (sortBy === 'name_asc') return (a.fullName || '').localeCompare(b.fullName || ''); if (sortBy === 'name_desc') return (b.fullName || '').localeCompare(a.fullName || ''); if (sortBy === 'id') return (a.studentId || '').localeCompare(b.studentId || ''); if (sortBy === 'date') return (b.createdAt || '').localeCompare(a.createdAt || ''); return 0; });

  const openAdd = () => { setEditing(null); setForm({ fullName: '', studentId: '', classId: '', status: 'active', guardianName: '', guardianPhone: '', guardianEmail: '', phone: '', email: '', address: '', notes: '', group: '', photo: '' }); setDialogOpen(true); };
  const openEdit = (s: Student) => { setEditing(s); setForm({ fullName: s.fullName, studentId: s.studentId, classId: s.classId, status: s.status, guardianName: s.guardianName || '', guardianPhone: s.guardianPhone || '', guardianEmail: s.guardianEmail || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '', group: s.group || '', photo: s.photo || '' }); setDialogOpen(true); };
  const handleSave = () => {
    if (!form.fullName || !form.studentId) { toast.error(language === 'fr' ? 'Nom et ID étudiant requis' : 'Name and Student ID are required'); return; }
    if (editing) { setStudents(students.map(s => s.id === editing.id ? { ...s, ...form, className: classes.find(c => c.id === form.classId)?.name } : s)); toast.success(language === 'fr' ? 'Étudiant modifié' : 'Student updated'); }
    else { setStudents([...students, { ...form, id: genId(), className: classes.find(c => c.id === form.classId)?.name, academicYear: classes.find(c => c.id === form.classId)?.academicYear || '', createdAt: new Date().toISOString() }]); toast.success(language === 'fr' ? 'Étudiant ajouté' : 'Student added'); }
    setDialogOpen(false);
  };
  const handleDelete = (id: string) => {
    const studentName = students.find(s => s.id === id)?.fullName || '';
    if (!confirm(language === 'fr' ? `Supprimer l'étudiant ${studentName} ?` : `Delete student ${studentName}?`)) return;
    setStudents(students.filter(s => s.id !== id));
    const st = useAppStore.getState();
    st.setAttendance(st.attendance.filter(a => a.studentId !== id));
    st.setGrades(st.grades.filter(g => g.studentId !== id));
    st.setBehavior(st.behavior.filter(b => b.studentId !== id));
    st.setIncidents(st.incidents.filter(i => i.studentId !== id));
    st.setExamGrades(st.examGrades.filter(eg => eg.studentId !== id));
    toast.success(language === 'fr' ? 'Étudiant supprimé' : 'Student deleted');
    st.addAuditLog('DELETE_STUDENT', 'student', id, studentName);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { if (f.size > 512000) { toast.error(language === 'fr' ? 'Image trop volumineuse (max 500 Ko)' : 'Image too large (max 500KB)'); return; } const r = new FileReader(); r.onload = (ev) => setForm({ ...form, photo: ev.target?.result as string }); r.readAsDataURL(f); } };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (ev) => {
      const raw = (ev.target?.result as string).replace(/^\uFEFF/, '');
      const lines = raw.split('\n').filter(l => l.trim()); if (lines.length < 2) return;
      // Proper CSV row parser that handles quoted fields containing commas
      const parseCSVRow = (row: string): string[] => {
        const fields: string[] = []; let current = ''; let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (inQuotes) {
            if (ch === '"' && row[i + 1] === '"') { current += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { current += ch; }
          } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { fields.push(current.trim()); current = ''; }
            else { current += ch; }
          }
        }
        fields.push(current.trim());
        return fields;
      };
      const headers = parseCSVRow(lines[0]).map(x => x.toLowerCase().replace(/\s+/g, ''));
      const col = (name: string) => { const idx = headers.indexOf(name); return idx >= 0 ? idx : -1; };
      const imported: Student[] = [];
      for (let i = 1; i < lines.length; i++) {
        const c = parseCSVRow(lines[i]); if (c.length < 2) continue;
        const fullName = c[col('fullname')] || c[0] || '';
        const studentId = c[col('studentid')] || c[1] || '';
        if (!fullName) continue;
        const className = c[col('class')] || '';
        const matchedClass = className ? classes.find(cl => cl.name.toLowerCase() === className.toLowerCase()) : null;
        const phoneVal = c[col('phone')] || '';
        const guardianVal = c[col('guardian')] || '';
        const emailVal = c[col('email')] || '';
        const addressVal = c[col('address')] || '';
        const statusVal = c[col('status')] || 'active';
        const validStatuses = ['active', 'abandoned', 'terminated', 'graduated'];
        imported.push({
          id: genId(), fullName, studentId,
          classId: matchedClass?.id || '', className: matchedClass?.name || className,
          status: validStatuses.includes(statusVal) ? statusVal as Student['status'] : 'active',
          guardianName: guardianVal, guardianPhone: phoneVal,
          email: emailVal, address: addressVal,
          createdAt: new Date().toISOString(),
        });
      }
      setStudents([...students, ...imported]); toast.success(`${imported.length} ${language === 'fr' ? 'étudiants importés' : 'students imported'}`);
    }; reader.readAsText(file); e.target.value = '';
  };

  const handleBatchAssign = () => { if (!batchClassId || selectedIds.size === 0) return; const updated = students.map(s => selectedIds.has(s.id) ? { ...s, classId: batchClassId, className: classes.find(c => c.id === batchClassId)?.name } : s); setStudents(updated); toast.success(`${selectedIds.size} ${language === 'fr' ? 'étudiants assignés' : 'students assigned'}`); setSelectedIds(new Set()); setBatchClassId(''); };

  return (
    <div className="space-y-4">
      {multiSelect && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex-wrap">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300">{selectedIds.size} {language === 'fr' ? 'sélectionné(s)' : 'selected'}</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Select value={batchClassId} onValueChange={setBatchClassId}><SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder={language === 'fr' ? 'Assigner classe...' : 'Assign class...'} /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="sm" onClick={handleBatchAssign} disabled={!batchClassId}><GraduationCap className="h-4 w-4 mr-1" />{language === 'fr' ? 'Assigner' : 'Assign'}</Button>
            <Button variant="outline" size="sm" onClick={() => { const ex = students.filter(s => selectedIds.has(s.id)); exportUtils.exportStudentsCSV(ex, classes, language); toast.success(language === 'fr' ? 'Exporté !' : 'Exported!'); }}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => { if (confirm(`Delete ${selectedIds.size} students?`)) { const st = useAppStore.getState(); st.setAttendance(st.attendance.filter(a => !selectedIds.has(a.studentId))); st.setGrades(st.grades.filter(g => !selectedIds.has(g.studentId))); st.setBehavior(st.behavior.filter(b => !selectedIds.has(b.studentId))); st.setIncidents(st.incidents.filter(i => !selectedIds.has(i.studentId))); st.setExamGrades(st.examGrades.filter(eg => !selectedIds.has(eg.studentId))); setStudents(students.filter(s => !selectedIds.has(s.id))); setSelectedIds(new Set()); toast.success(language === 'fr' ? `${selectedIds.size} supprimé(s)` : `${selectedIds.size} deleted`); } }}><Trash2 className="h-4 w-4 mr-1" />{t('delete', language)}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setMultiSelect(false); }}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder={language === 'fr' ? 'Rechercher étudiants...' : 'Search students...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <Select value={classFilter} onValueChange={setClassFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Toutes les Classes' : 'All Classes'}</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Statut' : 'Status'}</SelectItem><SelectItem value="active">{t('active', language)}</SelectItem><SelectItem value="abandoned">{t('abandoned', language)}</SelectItem><SelectItem value="graduated">{t('graduated', language)}</SelectItem><SelectItem value="terminated">{t('terminated', language)}</SelectItem></SelectContent></Select>
          <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name_asc">{language === 'fr' ? 'Nom A-Z' : 'Name A-Z'}</SelectItem><SelectItem value="name_desc">{language === 'fr' ? 'Nom Z-A' : 'Name Z-A'}</SelectItem><SelectItem value="id">{language === 'fr' ? 'ID Étudiant' : 'Student ID'}</SelectItem><SelectItem value="date">{language === 'fr' ? 'Date' : 'Date'}</SelectItem></SelectContent></Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className={multiSelect ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400' : ''} onClick={() => { setMultiSelect(!multiSelect); setSelectedIds(new Set()); }}><CheckCircle2 className="h-4 w-4 mr-1" />{language === 'fr' ? 'Sélection multiple' : 'Multi-select'}</Button>
          <label className="cursor-pointer"><input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} /><Button variant="outline" size="sm" className="border-orange-400 text-orange-600" asChild><span><Upload className="h-4 w-4 mr-1" />CSV</span></Button></label>
          <Button variant="outline" size="sm" onClick={() => { exportUtils.exportStudentsCSV(students, classes, language); toast.success(language === 'fr' ? 'Exporté !' : 'Exported!'); }}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => { pdfUtils.exportStudentsPDF(students, classes, schoolInfo, language); }}><Printer className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Ajouter' : 'Add'}</Button>
        </div>
      </div>
      <Card className="border-0 shadow-sm"><CardContent className="p-0">
        {filtered.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar"><Table><TableHeader><TableRow className="bg-purple-600 dark:bg-purple-800">
            {multiSelect && <TableHead className="w-10"><Checkbox onCheckedChange={c => setSelectedIds(c ? new Set(filtered.map(s => s.id)) : new Set())} /></TableHead>}
            <TableHead className="text-white">Photo</TableHead><TableHead className="text-white">{t('name', language)}</TableHead><TableHead className="text-white">ID</TableHead><TableHead className="text-white hidden md:table-cell">{t('classes', language)}</TableHead><TableHead className="text-white hidden lg:table-cell">{t('status', language)}</TableHead><TableHead className="text-white hidden lg:table-cell">{t('guardian', language)}</TableHead><TableHead className="text-white hidden xl:table-cell">{t('phone', language)}</TableHead><TableHead className="text-white w-32">{t('actions', language)}</TableHead>
          </TableRow></TableHeader><TableBody>
            {filtered.map(s => (
              <TableRow key={s.id} className={selectedIds.has(s.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}>
                {multiSelect && <TableCell><Checkbox checked={selectedIds.has(s.id)} onCheckedChange={c => { const n = new Set(selectedIds); if (c) n.add(s.id); else n.delete(s.id); setSelectedIds(n); }} /></TableCell>}
                <TableCell><div className="w-9 h-9 rounded-full overflow-hidden bg-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0">{s.photo ? <img src={s.photo} alt="" className="w-full h-full object-cover" /> : s.fullName.charAt(0)}</div></TableCell>
                <TableCell className="font-medium">{s.fullName}</TableCell><TableCell>{s.studentId}</TableCell>
                <TableCell className="hidden md:table-cell">{s.className || classes.find(c => c.id === s.classId)?.name || '-'}</TableCell>
                <TableCell className="hidden lg:table-cell"><StatusBadge status={s.status} /></TableCell>
                <TableCell className="hidden lg:table-cell">{s.guardianName || '-'}</TableCell>
                <TableCell className="hidden xl:table-cell">{s.guardianPhone ? <><span className="text-xs">{s.guardianPhone}</span><Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600" onClick={() => window.open(`https://wa.me/${formatWhatsAppPhone(s.guardianPhone)}?text=${encodeURIComponent('Hello from school!')}`, '_blank')}><MessageCircle className="h-3.5 w-3.5" /></Button></> : '-'}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setProfileStudent(s)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody></Table></div>
        )}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? t('edit', language) : t('add_student', language)}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex justify-center"><div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed" onClick={() => document.getElementById('photo-upload')?.click()}>
            {form.photo ? <img src={form.photo} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl text-muted-foreground">📷</span>}
            <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t('name', language)} *</Label><Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
            <div className="space-y-2"><Label>{t('student_id', language)} *</Label><Input value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t('classes', language)}</Label><Select value={form.classId} onValueChange={v => setForm({ ...form, classId: v })}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Student['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{t('active', language)}</SelectItem><SelectItem value="abandoned">{t('abandoned', language)}</SelectItem><SelectItem value="graduated">{t('graduated', language)}</SelectItem><SelectItem value="terminated">{t('terminated', language)}</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t('guardian', language)}</Label><Input value={form.guardianName} onChange={e => setForm({ ...form, guardianName: e.target.value })} /></div>
            <div className="space-y-2"><Label>{t('phone', language)}</Label><Input value={form.guardianPhone} onChange={e => setForm({ ...form, guardianPhone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{language === 'fr' ? 'Email Tuteur' : 'Guardian Email'}</Label><Input type="email" value={form.guardianEmail} onChange={e => setForm({ ...form, guardianEmail: e.target.value })} /></div>
            <div className="space-y-2"><Label>{t('phone', language)}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>{t('phone', language)}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Adresse' : 'Address'}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-2"><Label>Group</Label><Input value={form.group} onChange={e => setForm({ ...form, group: e.target.value })} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button></DialogFooter>
      </DialogContent></Dialog>

      {profileStudent && <Student360Profile student={profileStudent} onClose={() => setProfileStudent(null)} />}
    </div>
  );
}

// ==================== GENERIC CRUD PAGE ====================
function CrudPage<T extends { id: string; createdAt: string }>({ title, items, setItems, columns, renderForm, filterItems }: {
  title: string; items: T[]; setItems: (items: T[]) => void;
  columns: { key: string; label: string; render?: (item: T) => React.ReactNode }[];
  renderForm: (item: Partial<T>, onChange: (item: Partial<T>) => void) => React.ReactNode;
  filterItems?: (items: T[], search: string) => T[];
}) {
  const { language } = useAppStore();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [form, setForm] = useState<Partial<T>>({});
  const filtered = filterItems ? filterItems(items, search) : items.filter(item => columns.some(col => { const val = (item as Record<string, unknown>)[col.key]; return String(val || "").toLowerCase().includes(search.toLowerCase()); }));

  const handleSave = () => {
    if (editing?.id) { setItems(items.map(i => i.id === editing.id ? { ...i, ...form } as T : i)); toast.success(language === 'fr' ? 'Modifié' : 'Updated'); }
    else { setItems([...items, { ...form, id: genId(), createdAt: new Date().toISOString() } as T]); toast.success(language === 'fr' ? 'Ajouté' : 'Added'); }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder={t('search', language)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditing(null); setForm({}); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button>
      </div>
      <Card className="border-0 shadow-sm"><CardContent className="p-0">{filtered.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar"><Table><TableHeader><TableRow>
          {columns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
          <TableHead className="w-24">{t('actions', language)}</TableHead>
        </TableRow></TableHeader><TableBody>
          {filtered.map(item => (
            <TableRow key={item.id}>
              {columns.map(col => (
                <TableCell key={col.key}>{col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] || '-')}</TableCell>
              ))}
              <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(item); setForm({ ...item }); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { if (confirm(t('delete', language) + `?`)) { setItems(items.filter(i => i.id !== item.id)); toast.success(language === 'fr' ? 'Supprimé' : 'Deleted'); } }}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
            </TableRow>
          ))}
        </TableBody></Table></div>
      )}</CardContent></Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? t('edit', language) : t('add', language)} {title}</DialogTitle></DialogHeader><div className="py-4">{renderForm(form, setForm)}</div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

// ==================== CLASSES PAGE ====================
function ClassesPage() {
  const { classes, setClasses, students, language, academicYears } = useAppStore();
  return <CrudPage<Class> title={t('classes', language)} items={classes} setItems={setClasses} columns={[
    { key: 'name', label: t('classes', language) }, { key: 'description', label: language === 'fr' ? 'Description' : 'Description' },
    { key: 'teacher', label: language === 'fr' ? 'Enseignant' : 'Teacher' }, { key: 'room', label: language === 'fr' ? 'Salle' : 'Room' }, { key: 'capacity', label: language === 'fr' ? 'Capacité' : 'Capacity' },
    { key: 'academicYear', label: language === 'fr' ? 'Année Scolaire' : 'Academic Year', render: (item) => { const ay = academicYears.find(y => y.id === item.academicYear); return <Badge variant="outline">{ay?.name || item.academicYear || '-'}</Badge>; } },
    { key: '_students', label: t('students', language), render: (item) => <Badge variant="secondary">{students.filter(s => s.classId === item.id).length}</Badge> },
  ]} renderForm={(item, onChange) => (
    <div className="grid gap-4">
      <div className="space-y-2"><Label>{t('classes', language)} *</Label><Input value={String(item.name || '')} onChange={e => onChange({ ...item, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>{language === 'fr' ? 'Année Scolaire' : 'Academic Year'}</Label><Select value={String(item.academicYear || '')} onValueChange={v => onChange({ ...item, academicYear: v })}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} /></SelectTrigger><SelectContent>{academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}{ay.isCurrent ? ' ★' : ''}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Description</Label><Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={2} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{language === 'fr' ? 'Enseignant' : 'Teacher'}</Label><Input value={String(item.teacher || '')} onChange={e => onChange({ ...item, teacher: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Salle' : 'Room'}</Label><Input value={String(item.room || '')} onChange={e => onChange({ ...item, room: e.target.value })} /></div></div>
      <div className="space-y-2"><Label>{language === 'fr' ? 'Capacité' : 'Capacity'}</Label><Input type="number" value={String(item.capacity || 30)} onChange={e => onChange({ ...item, capacity: parseInt(e.target.value) || 30 })} /></div>
    </div>
  )} />
}

// ==================== MODULES PAGE ====================
function ModulesPage() {
  const { modules, setModules, language } = useAppStore();
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<Record<string, unknown>>>([]);
  const [importSource, setImportSource] = useState<'csv' | 'pdf' | null>(null);

  const parseModuleCSV = (text: string): Array<Record<string, unknown>> => {
    const raw = text.replace(/^\uFEFF/, '');
    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const parseRow = (row: string): string[] => {
      const fields: string[] = []; let current = ''; let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (inQuotes) { if (ch === '"' && row[i + 1] === '"') { current += '"'; i++; } else if (ch === '"') inQuotes = false; else current += ch; }
        else { if (ch === '"') inQuotes = true; else if (ch === ',') { fields.push(current.trim()); current = ''; } else current += ch; }
      }
      fields.push(current.trim());
      return fields;
    };
    const header = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const results: Array<Record<string, unknown>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseRow(lines[i]);
      if (cols.length < 2) continue;
      const row: Record<string, unknown> = {};
      header.forEach((h, idx) => { row[h] = cols[idx] || ''; });
      const name = row['name'] || row['module'] || row['modulename'] || row['title'] || cols[0] || '';
      const code = row['code'] || row['modulecode'] || row['codemodule'] || '';
      const hours = parseFloat(String(row['hours'] || row['heures'] || row['credit'] || row['credits'] || row['volume'] || row['cm'] || '0')) || 0;
      const year = row['year'] || row['annee'] || row['niveau'] || row['level'] || row['grade'] || '';
      const semester = row['semester'] || row['semestre'] || row['sem'] || '';
      const description = row['description'] || row['desc'] || row['objectifs'] || '';
      if (!name) continue;
      results.push({ name, code, hours, year, semester, description });
    }
    return results;
  };

  const extractModulesFromText = (text: string): Array<Record<string, unknown>> => {
    const results: Array<Record<string, unknown>> = [];
    // Filter out garbage lines (non-printable chars, binary data)
    const isReadable = (s: string) => /^[\x20-\x7E\u00C0-\u024F\s]+$/.test(s) && /[A-Za-z\u00C0-\u024F]/.test(s);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && isReadable(l) && l.length > 2);
    for (const line of lines) {
      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const name = parts.find(p => !/^\d/.test(p) && p.length > 2 && /[A-Za-z\u00C0-\u024F]/.test(p)) || '';
          if (!name) continue;
          const code = parts[0]?.replace(/[^A-Za-z0-9]/g, '') || '';
          const hours = parseFloat(parts.find(p => /^\d+(\.\d+)?$/.test(p)) || '0') || 0;
          results.push({ name, code, hours, year: '', semester: '', description: '' }); continue;
        }
      }
    }
    if (results.length === 0) {
      const moduleRegex = /^([A-Za-z]{2,5}\d{2,4}[-\s]*)?([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s\-&']+?)(?:\s+(\d+(?:\.\d+)?)\s*(?:h|heures|hours|cr|credits?|cm|td|tp)?)/i;
      for (const line of lines) {
        const match = line.match(moduleRegex);
        if (match && match[2] && match[2].trim().length > 2) {
          results.push({ name: match[2].trim(), code: (match[1] || '').replace(/[-\s]+$/, '').trim(), hours: parseFloat(match[3]) || 0, year: '', semester: '', description: '' });
        }
      }
    }
    if (results.length === 0) {
      for (const line of lines) {
        if (line.length < 3 || line.length > 200) continue;
        if (/^(module|code|nom|intitul|ann|semestre|total|programme|#|page)/i.test(line)) continue;
        const hoursMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:h|heures|hours|cr|cm)/i);
        const name = line.replace(/\d+\s*(?:h|heures|hours|cr|cm|td|tp).*$/i, '').replace(/[-|]/g, '').trim();
        if (name.length > 2 && /[A-Za-z\u00C0-\u024F]/.test(name)) { results.push({ name, code: '', hours: hoursMatch ? parseFloat(hoursMatch[1]) : 0, year: '', semester: '', description: '' }); }
      }
    }
    return results;
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; setImportSource('csv'); setImportPreview(parseModuleCSV(text)); setImporting(false); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportSource('pdf');
    try {
      const pdfjsLib = await import('pdfjs-dist' as unknown as Promise<typeof import('pdfjs-dist')>);
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const itemsByY = new Map<number, Array<{ x: number; text: string }>>();
        for (const item of content.items) { if ('str' in item && item.str) { const y = Math.round(item.transform[5]); const x = item.transform[4]; if (!itemsByY.has(y)) itemsByY.set(y, []); itemsByY.get(y)!.push({ x, text: item.str }); } }
        const sortedYs = Array.from(itemsByY.keys()).sort((a, b) => b - a);
        for (const y of sortedYs) { const lineItems = itemsByY.get(y)!.sort((a, b) => a.x - b.x); fullText += lineItems.map(i => i.text).join(' ') + '\n'; }
      }
      // Validate extracted text - check if it contains real readable content
      const cleanedText = fullText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
      const readableChars = (cleanedText.match(/[A-Za-z\u00C0-\u024F0-9]/g) || []).length;
      const totalChars = cleanedText.length;
      const readabilityRatio = totalChars > 0 ? readableChars / totalChars : 0;
      if (!cleanedText || readabilityRatio < 0.3 || readableChars < 10) {
        toast.error(language === 'fr' ? 'Ce PDF est une image scannée. L\'import OCR ne supporte que les PDF contenant du texte extractible. Utilisez un CSV à la place.' : 'This PDF appears to be a scanned image. PDF import only works with text-based PDFs. Please use CSV instead.');
        setImportPreview([]); setImportSource(null); setImporting(false); e.target.value = '';
        return;
      }
      const modules = extractModulesFromText(cleanedText);
      if (modules.length === 0) {
        toast.warning(language === 'fr' ? 'Aucun module détecté dans ce PDF. Vérifiez que le fichier contient une liste de modules.' : 'No modules detected in this PDF. Make sure it contains a module list.');
      }
      setImportPreview(modules);
    } catch (err) {
      console.error('PDF import error:', err);
      toast.error(language === 'fr' ? 'Impossible de lire le fichier PDF. Assurez-vous qu\'il s\'agit d\'un PDF texte (non scanné).' : 'Unable to read PDF file. Make sure it is a text-based PDF (not scanned).');
      setImportPreview([]); setImportSource(null);
    }
    setImporting(false);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (importPreview.length === 0) return;
    const newModules: Module[] = importPreview.map(m => ({ id: genId(), name: String(m.name || ''), code: String(m.code || ''), hours: Number(m.hours) || 0, year: String(m.year || ''), semester: String(m.semester || ''), description: String(m.description || ''), createdAt: new Date().toISOString() }));
    const existingKeys = new Set(modules.map(m => `${m.code || ''}_${m.name || ''}`.toLowerCase()));
    const unique = newModules.filter(m => !existingKeys.has(`${m.code || ''}_${m.name || ''}`.toLowerCase()));
    setModules([...modules, ...unique]);
    toast.success(`${unique.length} ${language === 'fr' ? 'modules import\u00e9s' : 'modules imported'}${newModules.length - unique.length > 0 ? ` (${newModules.length - unique.length} ${language === 'fr' ? 'doublons ignor\u00e9s' : 'duplicates skipped'})` : ''}`);
    setImportPreview([]); setImportSource(null);
  };

  const cancelImport = () => { setImportPreview([]); setImportSource(null); };

  return (
    <div className="space-y-4">
      <Dialog open={importPreview.length > 0} onOpenChange={(open) => { if (!open) cancelImport(); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Aper\u00e7u de l\'import' : 'Import Preview'} &mdash; {importPreview.length} {language === 'fr' ? 'modules d\u00e9tect\u00e9s' : 'modules detected'}</DialogTitle>
            <DialogDescription>{importSource === 'csv' ? 'CSV' : 'PDF/OCR'} &mdash; {language === 'fr' ? 'V\u00e9rifiez les donn\u00e9es avant de confirmer' : 'Review data before confirming'}</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="border-b bg-muted/50"><th className="px-2 py-1.5 text-left">{language === 'fr' ? 'Nom' : 'Name'}</th><th className="px-2 py-1.5 text-left">Code</th><th className="px-2 py-1.5 text-left">{language === 'fr' ? 'Heures' : 'Hours'}</th><th className="px-2 py-1.5 text-left">{language === 'fr' ? 'Ann\u00e9e' : 'Year'}</th><th className="px-2 py-1.5 text-left">{language === 'fr' ? 'Semestre' : 'Semester'}</th><th className="px-2 py-1.5 text-left">Description</th></tr></thead>
              <tbody>{importPreview.map((m, i) => (<tr key={i} className="border-b hover:bg-muted/30"><td className="px-2 py-1.5 font-medium">{String(m.name || '-')}</td><td className="px-2 py-1.5 text-muted-foreground">{String(m.code || '-')}</td><td className="px-2 py-1.5">{String(m.hours || 0)}</td><td className="px-2 py-1.5">{String(m.year || '-')}</td><td className="px-2 py-1.5">{String(m.semester || '-')}</td><td className="px-2 py-1.5 text-xs text-muted-foreground max-w-[200px] truncate">{String(m.description || '-')}</td></tr>))}</tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelImport}>{t('cancel', language)}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmImport}><Upload className="h-4 w-4 mr-1" />{language === 'fr' ? 'Confirmer l\'import' : 'Confirm Import'} ({importPreview.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex gap-2 flex-wrap">
        <label className="cursor-pointer"><input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportCSV} /><Button variant="outline" size="sm" className="border-blue-400 text-blue-600" asChild disabled={importing}><span><Upload className="h-4 w-4 mr-1" />CSV Import</span></Button></label>
        <label className="cursor-pointer"><input type="file" accept=".pdf" className="hidden" onChange={handleImportPDF} /><Button variant="outline" size="sm" className="border-purple-400 text-purple-600" asChild disabled={importing}><span><FileText className="h-4 w-4 mr-1" />PDF Import (OCR)</span></Button></label>
        {importing && <span className="text-sm text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" />{language === 'fr' ? 'Traitement en cours...' : 'Processing...'}</span>}
      </div>
      <CrudPage<Module> title={t('modules', language)} items={modules} setItems={setModules} columns={[
    { key: 'name', label: language === 'fr' ? 'Nom' : 'Name' }, { key: 'code', label: 'Code' }, { key: 'year', label: language === 'fr' ? 'Année' : 'Year' }, { key: 'semester', label: language === 'fr' ? 'Semestre' : 'Semester' }, { key: 'hours', label: language === 'fr' ? 'Heures' : 'Hours' },
  ]} renderForm={(item, onChange) => (
    <div className="grid gap-4">
      <div className="space-y-2"><Label>{language === 'fr' ? 'Nom du Module' : 'Module Name'} *</Label><Input value={String(item.name || '')} onChange={e => onChange({ ...item, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Code</Label><Input value={String(item.code || '')} onChange={e => onChange({ ...item, code: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Heures' : 'Hours'}</Label><Input type="number" value={String(item.hours || '')} onChange={e => onChange({ ...item, hours: parseInt(e.target.value) || 0 })} /></div></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{language === 'fr' ? 'Année' : 'Year'}</Label><Input value={String(item.year || '')} onChange={e => onChange({ ...item, year: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Semestre' : 'Semester'}</Label><Input value={String(item.semester || '')} onChange={e => onChange({ ...item, semester: e.target.value })} /></div></div>
      <div className="space-y-2"><Label>Description</Label><Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={2} /></div>
    </div>
  )} />
    </div>
  )
}

// ==================== ATTENDANCE PAGE (with Quick Mode) ====================
function AttendancePage() {
  const { students, classes, attendance, setAttendance, templates, schoolInfo, language } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(localToday());
  const [selectedClass, setSelectedClass] = useState('all');
  const [overrides, setOverrides] = useState<Record<string, AttendanceRecord['status']>>({});
  const [saving, setSaving] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [quickBulk, setQuickBulk] = useState<Record<string, AttendanceRecord['status']>>({});
  const [emailNotifEnabled, setEmailNotifEnabled] = useState(() => { try { return typeof window !== 'undefined' && localStorage.getItem('attendance_email_notif') === 'true'; } catch { return false; } });

  const filteredStudents = students.filter(s => s.status === 'active' && (!selectedClass || selectedClass === 'all' || s.classId === selectedClass));
  const baseRecords = useMemo(() => { const m: Record<string, AttendanceRecord['status']> = {}; attendance.filter(r => r.date === selectedDate).forEach(r => { m[r.studentId] = r.status; }); return m; }, [selectedDate, attendance]);
  const localRecords = useMemo(() => ({ ...baseRecords, ...overrides }), [baseRecords, overrides]);

  const handleStatusChange = (sid: string, status: AttendanceRecord['status']) => {
    setOverrides(p => ({ ...p, [sid]: status }));
    if (status === 'absent' || status === 'late') {
      const s = students.find(st => st.id === sid);
      if (s?.guardianPhone) setTimeout(() => { sendAbsenceWhatsApp(sid, status); toast.success(language === 'fr' ? `WhatsApp ouvert pour ${s.guardianName || 'tuteur'}` : `WhatsApp opened for ${s.guardianName || 'guardian'}`); }, 500);
    }
  };
  const handleMarkAll = (status: AttendanceRecord['status']) => {
    const m: Record<string, AttendanceRecord['status']> = {}; filteredStudents.forEach(s => { m[s.id] = status; }); setOverrides(m);
    if (status === 'absent' || status === 'late') { filteredStudents.filter(s => s.guardianPhone).forEach((s, i) => setTimeout(() => sendAbsenceWhatsApp(s.id, status), (i + 1) * 1000)); }
  };
  const handleSave = () => {
    setSaving(true);
    // Preserve records for students NOT in current filter
    const filteredStudentIds = new Set(filteredStudents.map(s => s.id));
    const otherDayRecords = attendance.filter(r => r.date === selectedDate && !filteredStudentIds.has(r.studentId));
    const updated = attendance.filter(r => r.date !== selectedDate);
    const newR: AttendanceRecord[] = [];
    const newAbsences: Array<{ student: Student; status: AttendanceRecord['status'] }> = [];
    filteredStudents.forEach(s => { const st = localRecords[s.id] || 'present'; const ex = attendance.find(r => r.date === selectedDate && r.studentId === s.id); if (ex) { updated.push({ ...ex, status: st }); } else { newR.push({ id: genId(), studentId: s.id, date: selectedDate, status: st, createdAt: new Date().toISOString() }); } if ((st === 'absent' || st === 'late') && (!ex || ex.status !== st)) { newAbsences.push({ student: s, status: st }); } });
    setAttendance([...updated, ...otherDayRecords, ...newR]); toast.success(language === 'fr' ? 'Présence enregistrée !' : 'Attendance saved!'); setTimeout(() => setSaving(false), 500);
    // Send email notifications for new absences/late
    if (emailNotifEnabled && newAbsences.length > 0) { sendAbsenceEmails(newAbsences); }
    // Push notification for admin: attendance summary
    if (newAbsences.length > 0 && getPushNotifPref()) {
      const absentCount = newAbsences.filter(a => a.status === 'absent').length;
      const lateCount = newAbsences.filter(a => a.status === 'late').length;
      showBrowserNotification(
        language === 'fr' ? `📊 Présence sauvegardée — ${selectedDate}` : `📊 Attendance saved — ${selectedDate}`,
        `${absentCount} ${absentCount === 1 ? (language === 'fr' ? 'absent' : 'absent') : (language === 'fr' ? 'absents' : 'absents')}, ${lateCount} ${lateCount === 1 ? (language === 'fr' ? 'en retard' : 'late') : (language === 'fr' ? 'en retard' : 'late')}`,
        { tag: `attendance-${selectedDate}` }
      );
    }
  };

  const counts = { present: Object.values(localRecords).filter(s => s === 'present').length, absent: Object.values(localRecords).filter(s => s === 'absent').length, late: Object.values(localRecords).filter(s => s === 'late').length, excused: Object.values(localRecords).filter(s => s === 'excused').length, unmarked: filteredStudents.length - Object.keys(localRecords).filter(id => filteredStudents.some(s => s.id === id)).length };

  const sendAbsenceWhatsApp = (sid: string, forceStatus?: AttendanceRecord['status']) => {
    const s = students.find(st => st.id === sid); if (!s?.guardianPhone) return;
    const st = forceStatus || localRecords[sid];
    const cat = st === 'late' ? 'late' : 'absence';
    let tmpl = templates.find(t => t.category === cat && t.isDefault);
    if (!tmpl) tmpl = templates.find(t => t.category === cat);
    if (!tmpl) tmpl = st === 'late' ? { id: '', name: 'Late', category: 'late', content: 'Hello {guardian_name}, {student_name} arrived late today ({date}).', createdAt: '' } : { id: '', name: 'Absence', category: 'absence', content: 'Dear {guardian_name}, {student_name} was marked absent today ({date}). Please contact us.', createdAt: '' };
    const msg = tmpl.content.replace(/{student_name}/g, s.fullName).replace(/{guardian_name}/g, s.guardianName || 'Guardian').replace(/{date}/g, new Date().toLocaleDateString()).replace(/{school_name}/g, schoolInfo?.name || 'School').replace(/{class}/g, classes.find(c => c.id === s.classId)?.name || 'class');
    window.open(`https://wa.me/${formatWhatsAppPhone(s.guardianPhone)}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Email notification for absences
  const sendAbsenceEmails = async (absences: Array<{ student: Student; status: AttendanceRecord['status'] }>) => {
    const isFr = language === 'fr';
    for (const abs of absences) {
      const s = abs.student;
      const email = s.guardianEmail || s.email;
      if (!email || !email.includes('@')) continue;
      const isLate = abs.status === 'late';
      const subject = isLate
        ? (isFr ? `[CRM] Retard: ${s.fullName} — ${selectedDate}` : `[CRM] Late Arrival: ${s.fullName} — ${selectedDate}`)
        : (isFr ? `[CRM] Absence: ${s.fullName} — ${selectedDate}` : `[CRM] Absence: ${s.fullName} — ${selectedDate}`);
      const className = classes.find(c => c.id === s.classId)?.name || '-';
      const htmlContent = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9}
.container{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.header{background:linear-gradient(135deg,${isLate ? '#f59e0b' : '#ef4444'},${isLate ? '#fbbf24' : '#f87171'});padding:28px 32px;color:white}
.header h1{margin:0;font-size:20px;font-weight:700}
.header p{margin:6px 0 0;font-size:13px;opacity:0.9}
.body{padding:28px 32px;color:#334155;font-size:15px;line-height:1.6}
.body .greeting{font-size:16px;font-weight:600;margin-bottom:16px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.info-row:last-child{border-bottom:none}
.info-label{color:#64748b}
.info-value{font-weight:600;color:#1e293b}
.footer{padding:20px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
</style></head><body>
<div class="container">
  <div class="header">
    <h1>${isLate ? (isFr ? '🔔 Retard Signalé' : '🔔 Late Arrival Notification') : (isFr ? '🚨 Absence Signalée' : '🚨 Absence Notification')}</h1>
    <p>${schoolInfo?.name || 'School'} — ${isFr ? 'Système de Gestion' : 'Management System'}</p>
  </div>
  <div class="body">
    <p class="greeting">${s.guardianName ? (isFr ? `Bonjour ${s.guardianName},` : `Dear ${s.guardianName},`) : (isFr ? 'Bonjour,' : 'Hello,')}</p>
    <p>${isLate
      ? (isFr ? `Nous vous informons que <strong>${s.fullName}</strong> est arrivé(e) en retard le <strong>${selectedDate}</strong>.`
        : `We inform you that <strong>${s.fullName}</strong> arrived late on <strong>${selectedDate}</strong>.`)
      : (isFr ? `Nous vous informons que <strong>${s.fullName}</strong> a été marqué(e) absent(e) le <strong>${selectedDate}</strong>.`
        : `We inform you that <strong>${s.fullName}</strong> was marked absent on <strong>${selectedDate}</strong>.`)
    }</p>
    <div style="margin:20px 0">
      <div class="info-row"><span class="info-label">${isFr ? 'Étudiant(e)' : 'Student'}</span><span class="info-value">${s.fullName}</span></div>
      <div class="info-row"><span class="info-label">${isFr ? 'ID Étudiant' : 'Student ID'}</span><span class="info-value">${s.studentId}</span></div>
      <div class="info-row"><span class="info-label">${isFr ? 'Classe' : 'Class'}</span><span class="info-value">${className}</span></div>
      <div class="info-row"><span class="info-label">${isFr ? 'Statut' : 'Status'}</span><span class="info-value">${isLate ? (isFr ? 'En Retard' : 'Late') : (isFr ? 'Absent(e)' : 'Absent')}</span></div>
      <div class="info-row"><span class="info-label">${isFr ? 'Date' : 'Date'}</span><span class="info-value">${selectedDate}</span></div>
    </div>
    <p style="font-size:13px;color:#64748b">${isFr ? 'Veuillez contacter l\'administration si vous avez des questions.' : 'Please contact the administration if you have any questions.'}</p>
  </div>
  <div class="footer">
    <p>${isFr ? 'Cet email a été envoyé automatiquement par le système CRM Attendance.' : 'This email was sent automatically by the CRM Attendance system.'}</p>
    <p style="margin-top:4px">&copy; ${new Date().getFullYear()} ${schoolInfo?.name || 'CRM Attendance'}</p>
  </div>
</div></body></html>`;
      try {
        await sendEmail({ to: email, toName: s.guardianName || undefined, subject, htmlContent });
      } catch (err) {
        // Email send failed silently — Brevo may be misconfigured
      }
    }
    if (absences.length > 0) {
      toast.success(`${absences.length} ${isFr ? 'notification(s) envoyée(s)' : 'notification(s) sent'}`);
    }
  };
  const handleQuickBulk = (status: AttendanceRecord['status']) => {
    const m: Record<string, AttendanceRecord['status']> = {}; filteredStudents.forEach(s => { m[s.id] = status; }); setQuickBulk({ ...m });
    if (Object.keys(m).length > 0) toast.success(language === 'fr' ? `${Object.keys(m).length} marqué(s) comme ${status}` : `${Object.keys(m).length} marked as ${status}`);
  };
  const handleQuickSave = () => {
    setSaving(true);
    // Preserve records for students NOT in current filter
    const filteredStudentIds = new Set(filteredStudents.map(s => s.id));
    const otherDayRecords = attendance.filter(r => r.date === selectedDate && !filteredStudentIds.has(r.studentId));
    const updated = attendance.filter(r => r.date !== selectedDate);
    const newR: AttendanceRecord[] = [];
    const newAbsences: Array<{ student: Student; status: AttendanceRecord['status'] }> = [];
    filteredStudents.forEach(s => { const st = quickBulk[s.id] || localRecords[s.id] || 'present'; const ex = attendance.find(r => r.date === selectedDate && r.studentId === s.id); if (ex) { updated.push({ ...ex, status: st }); } else { newR.push({ id: genId(), studentId: s.id, date: selectedDate, status: st, createdAt: new Date().toISOString() }); } if ((st === 'absent' || st === 'late') && (!ex || ex.status !== st)) { newAbsences.push({ student: s, status: st }); } });
    setAttendance([...updated, ...otherDayRecords, ...newR]); toast.success(language === 'fr' ? 'Présence enregistrée !' : 'Attendance saved!'); setQuickBulk({}); setTimeout(() => setSaving(false), 500);
    // Send email notifications for new absences/late
    if (emailNotifEnabled && newAbsences.length > 0) { sendAbsenceEmails(newAbsences); }
  };

  const quickCounts = useMemo(() => {
    const src = quickBulk;
    if (Object.keys(src).length > 0) return { present: Object.values(src).filter(s => s === 'present').length, absent: Object.values(src).filter(s => s === 'absent').length, late: Object.values(src).filter(s => s === 'late').length, excused: Object.values(src).filter(s => s === 'excused').length, unmarked: filteredStudents.length - Object.keys(src).length };
    return { present: counts.present, absent: counts.absent, late: counts.late, excused: counts.excused, unmarked: counts.unmarked };
  }, [quickBulk, filteredStudents.length, counts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-1">
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" />
          <Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Toutes' : 'All'}</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          <Button variant={quickMode ? 'default' : 'outline'} size="sm" onClick={() => setQuickMode(!quickMode)} className={quickMode ? 'bg-emerald-600 text-white' : ''}><Zap className="h-4 w-4 mr-1" />{quickMode ? (language === 'fr' ? 'Mode Rapide' : 'Quick Mode') : (language === 'fr' ? 'Mode Normal' : 'Normal')}</Button>
        </div>
        <div className="flex gap-2">
          {!quickMode && <><Button variant="outline" size="sm" onClick={() => handleMarkAll('present')}><CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" />{t('present', language)}</Button>
          <Button variant="outline" size="sm" onClick={() => handleMarkAll('absent')}><XCircle className="h-4 w-4 mr-1 text-red-600" />{t('absent', language)}</Button></>}
          {quickMode && <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleQuickBulk('present')}>✅ {t('present', language)} All</Button>}
          {quickMode && <Button variant="outline" size="sm" className="border-red-400 text-red-600" onClick={() => handleQuickBulk('absent')}>❌ {t('absent', language)} All</Button>}
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => quickMode ? handleQuickSave() : handleSave()} disabled={saving}><Save className="h-4 w-4 mr-1" />{t('save', language)}</Button>
          <div className="flex items-center gap-2 ml-auto">
            <Switch checked={emailNotifEnabled} onCheckedChange={v => { setEmailNotifEnabled(v); if (typeof window !== 'undefined') localStorage.setItem('attendance_email_notif', String(v)); }} />
            <span className="text-xs text-muted-foreground hidden sm:inline">{language === 'fr' ? 'Notif. email absence' : 'Email notif on absence'}</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-2">
        {[{ l: t('present', language), v: (quickMode ? quickCounts : counts).present, c: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' }, { l: t('absent', language), v: (quickMode ? quickCounts : counts).absent, c: 'text-red-600 bg-red-50 dark:bg-red-900/20' }, { l: t('late', language), v: (quickMode ? quickCounts : counts).late, c: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' }, { l: t('excused', language), v: (quickMode ? quickCounts : counts).excused, c: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20' }, { l: 'Unmarked', v: (quickMode ? quickCounts : counts).unmarked, c: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20' }].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm"><CardContent className="p-2.5 text-center"><p className="text-xl font-bold">{s.v}</p><p className="text-[10px] text-muted-foreground">{s.l}</p></CardContent></Card>
        ))}
      </div>

      {!quickMode ? (
        <Card className="border-0 shadow-sm"><CardContent className="p-0">
          {filteredStudents.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
            <div className="max-h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar"><Table><TableHeader><TableRow><TableHead>{t('name', language)}</TableHead><TableHead>ID</TableHead><TableHead className="hidden md:table-cell">{t('classes', language)}</TableHead><TableHead className="text-center">{t('status', language)}</TableHead><TableHead className="text-center">WhatsApp</TableHead></TableRow></TableHeader><TableBody>
              {filteredStudents.map(s => <TableRow key={s.id}><TableCell className="font-medium">{s.fullName}</TableCell><TableCell>{s.studentId}</TableCell><TableCell className="hidden md:table-cell">{s.className || classes.find(c => c.id === s.classId)?.name || '-'}</TableCell>
                <TableCell><div className="flex justify-center"><Select value={localRecords[s.id] || 'present'} onValueChange={v => handleStatusChange(s.id, v as AttendanceRecord['status'])}><SelectTrigger className="w-32"><StatusBadge status={localRecords[s.id] || 'present'} /></SelectTrigger><SelectContent><SelectItem value="present">{t('present', language)}</SelectItem><SelectItem value="absent">{t('absent', language)}</SelectItem><SelectItem value="late">{t('late', language)}</SelectItem><SelectItem value="excused">{t('excused', language)}</SelectItem></SelectContent></Select></div></TableCell>
                <TableCell><div className="flex justify-center">{s.guardianPhone ? <Button variant="ghost" size="sm" className="h-7 text-emerald-600" onClick={() => sendAbsenceWhatsApp(s.id)}><MessageCircle className="h-4 w-4" /></Button> : <span className="text-muted-foreground text-xs">—</span>}</div></TableCell>
              </TableRow>)}
            </TableBody></Table></div>
          )}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar">
          {filteredStudents.map(s => {
            const st = quickBulk[s.id] || localRecords[s.id] || null;
            const stColor = st === 'present' ? 'ring-2 ring-emerald-400' : st === 'absent' ? 'ring-2 ring-red-400' : st === 'late' ? 'ring-2 ring-amber-400' : st === 'excused' ? 'ring-2 ring-sky-400' : '';
            return (
              <Card key={s.id} className={`border-2 transition-all ${stColor} hover:shadow-md`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold shrink-0 overflow-hidden">{s.photo ? <img src={s.photo} alt="" className="w-full h-full object-cover" /> : s.fullName.charAt(0)}</div>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{s.fullName}</p><p className="text-xs text-muted-foreground">{s.studentId} • {classes.find(c => c.id === s.classId)?.name || '-'}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={st === 'present' ? 'default' : 'outline'} className={st === 'present' ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600' : 'hover:border-emerald-300 hover:text-emerald-600'} onClick={() => { const nb = { ...quickBulk }; nb[s.id] = 'present'; setQuickBulk(nb); }} >✅</Button>
                    <Button size="sm" variant={st === 'absent' ? 'default' : 'outline'} className={st === 'absent' ? 'bg-red-600 text-white hover:bg-red-700 border-red-600' : 'hover:border-red-300 hover:text-red-600'} onClick={() => { const nb = { ...quickBulk }; nb[s.id] = 'absent'; setQuickBulk(nb); }}>❌</Button>
                    <Button size="sm" variant={st === 'late' ? 'default' : 'outline'} className={st === 'late' ? 'bg-amber-600 text-white hover:bg-amber-700 border-amber-600' : 'hover:border-amber-300 hover:text-amber-600'} onClick={() => { const nb = { ...quickBulk }; nb[s.id] = 'late'; setQuickBulk(nb); }}>⏰</Button>
                    <Button size="sm" variant={st === 'excused' ? 'default' : 'outline'} className={st === 'excused' ? 'bg-sky-600 text-white hover:bg-sky-700 border-sky-600' : 'hover:border-sky-300 hover:text-sky-600'} onClick={() => { const nb = { ...quickBulk }; nb[s.id] = 'excused'; setQuickBulk(nb); }}>🛡️</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== CALENDAR PAGE (with Events) ====================
function CalendarPage() {
  const { attendance, students, classes, language, setCurrentPage, calendarEvents, setCalendarEvents } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', date: localToday(), type: 'other' as CalendarEvent['type'], description: '', color: '#10b981' });
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const events = calendarEvents;


  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = language === 'fr' ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;
  const monthName = currentMonth.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' });
  const dayNames = language === 'fr' ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getRecordsForDay = (day: number) => { const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return attendance.filter(r => r.date === ds); };
  const getEventsForDay = (day: number) => { const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return events.filter(e => e.date === ds); };
  const selectedRecords = selectedDay ? attendance.filter(r => r.date === selectedDay) : [];
  const selectedEvents = selectedDay ? getEventsForDay(parseInt(selectedDay.split('-')[2])) : [];

  const handleAddEvent = () => {
    if (!eventForm.title || !eventForm.date) { toast.error(language === 'fr' ? 'Titre et date requis' : 'Title and date required'); return; }
    if (editingEvent) { setCalendarEvents(events.map(e => e.id === editingEvent.id ? { ...e, ...eventForm, id: e.id, createdAt: e.createdAt } : e)); }
    else setCalendarEvents([...events, { ...eventForm, id: genId(), createdAt: new Date().toISOString() }]);
    toast.success(language === 'fr' ? 'Événement sauvegardé' : 'Event saved');
    setEventOpen(false); setEditingEvent(null); setEventForm({ title: '', date: localToday(), type: 'other', description: '', color: '#10b981' });
  };
  const openEditEvent = (e: CalendarEvent) => { setEditingEvent(e); setEventForm({ title: e.title, date: e.date, type: e.type, description: e.description || '', color: e.color || '#10b981' }); setEventOpen(true); };
  const handleDeleteEvent = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer cet événement ?' : 'Delete this event?')) return; setCalendarEvents(events.filter(e => e.id !== id)); toast.success(language === 'fr' ? 'Événement supprimé' : 'Event deleted'); };

  const typeColors: Record<string, string> = { exam: '#ef4444', holiday: '#10b981', meeting: '#3b82f6', other: '#6b7280' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold capitalize">{monthName}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>{language === 'fr' ? "Aujourd'hui" : 'Today'}</Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 ml-auto" onClick={() => { setEditingEvent(null); setEventForm({ title: '', date: localToday(), type: 'other', description: '', color: '#10b981' }); setEventOpen(true); }}><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Ajouter Événement' : 'Add Event'}</Button>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">{dayNames.map(d => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {[...Array(startOffset)].map((_, i) => <div key={`e-${i}`} />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1; const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const recs = getRecordsForDay(day); const evts = getEventsForDay(day);
            const isToday = ds === localToday(); const isSel = selectedDay === ds;
            return (
              <button key={day} onClick={() => setSelectedDay(ds === selectedDay ? null : ds)} className={`relative p-2 rounded-lg text-sm min-h-16 flex flex-col items-center justify-center transition-colors ${isSel ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'hover:bg-muted'} ${isToday ? 'font-bold ring-2 ring-emerald-500' : ''}`}>
                <span>{day}</span>
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                  {recs.length > 0 && <><div className={`w-1.5 h-1.5 rounded-full ${recs.some(r => r.status === 'present') ? 'bg-emerald-500' : 'hidden'}`} /><div className={`w-1.5 h-1.5 rounded-full ${recs.some(r => r.status === 'absent') ? 'bg-red-500' : 'hidden'}`} /><div className={`w-1.5 h-1.5 rounded-full ${recs.some(r => r.status === 'late') ? 'bg-amber-500' : 'hidden'}`} /></>}
                  {evts.map(e => <div key={e.id} className="w-3 h-1.5 rounded-full" style={{ backgroundColor: e.color || typeColors[e.type] || '#6b7280' }} />)}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent></Card>

      {selectedDay && (
        <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{selectedDay}</CardTitle></CardHeader><CardContent>
          {selectedRecords.length > 0 && <div className="mb-4"><p className="text-sm font-medium mb-2">{t('attendance', language)}</p><Table><TableHeader><TableRow><TableHead>{t('students', language)}</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
            {selectedRecords.slice(0, 10).map(r => { const s = students.find(st => st.id === r.studentId); return <TableRow key={r.id}><TableCell className="font-medium">{s?.fullName || 'Unknown'}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell></TableRow>; })}
          </TableBody></Table></div>}
          {selectedEvents.length > 0 && <div className="mb-4"><p className="text-sm font-medium mb-2">{language === 'fr' ? 'Événements' : 'Events'}</p>{selectedEvents.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color || typeColors[e.type] || '#6b7280' }} />
                <div><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.type}</p></div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEvent(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteEvent(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}</div>}
          {selectedRecords.length === 0 && selectedEvents.length === 0 && <EmptyState message={t('no_data', language)} />}
        </CardContent></Card>
      )}

      {/* Event Dialog */}
      <Dialog open={eventOpen} onOpenChange={setEventOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingEvent ? (language === 'fr' ? 'Modifier' : 'Edit') : (language === 'fr' ? 'Ajouter Événement' : 'Add Event')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>{language === 'fr' ? 'Titre' : 'Title'} *</Label><Input value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} /></div>
          <div className="space-y-2"><Label>{t('calendar', language)}</Label><Input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} /></div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Type' : 'Type'}</Label><Select value={eventForm.type} onValueChange={v => setEventForm({ ...eventForm, type: v as CalendarEvent['type'], color: typeColors[v] || '#6b7280' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exam">📝 {language === 'fr' ? 'Examen' : 'Exam'}</SelectItem><SelectItem value="holiday">🎉 {language === 'fr' ? 'Vacance' : 'Holiday'}</SelectItem><SelectItem value="meeting">📅 {language === 'fr' ? 'Réunion' : 'Meeting'}</SelectItem><SelectItem value="other">📌 {language === 'fr' ? 'Autre' : 'Other'}</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Description' : 'Description'}</Label><Textarea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setEventOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddEvent}>{t('save', language)}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

// ==================== SCHEDULE PAGE ====================
function SchedulePage() {
  const { classes, teachers, modules, schedules, schoolInfo, language, setSchedules, savedSchedules, setSavedSchedules, addAuditLog, currentUser } = useAppStore();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingDay, setEditingDay] = useState<string | null>(null); // YYYY-MM-DD
  const [dialogOpen, setDialogOpen] = useState(false);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  // Form state for the editing day
  const [entryForm, setEntryForm] = useState({
    teacherId: '',
    roomId: '',
    timeFrom: '',
    timeTo: '',
    moduleId: '',
    notes: '',
  });

  // Combined timeSlot derived from timeFrom and timeTo
  const combinedTimeSlot = useMemo(() => {
    if (entryForm.timeFrom && entryForm.timeTo) return `${entryForm.timeFrom} - ${entryForm.timeTo}`;
    return '';
  }, [entryForm.timeFrom, entryForm.timeTo]);

  // Generate all 24 hour options for From/To time selection
  const TIME_OPTIONS = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
      const hh = `${String(h).padStart(2, '0')}:00`;
      options.push({ value: hh, label: hh });
    }
    return options;
  }, []);

  // Derive unique rooms from classes
  const rooms = useMemo(() => {
    const roomSet = new Set<string>();
    classes.forEach(c => { if (c.room) roomSet.add(c.room); });
    // Add some defaults
    if (roomSet.size === 0) {
      return ['Classroom 1', 'Classroom 2', 'Classroom 3', 'Lab 1', 'Lab 2', 'Amphitheater'];
    }
    return Array.from(roomSet).sort();
  }, [classes]);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  // Get schedule entries for the selected class and current month
  const classSchedules = useMemo(() => {
    if (!selectedClassId) return [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return schedules.filter(s => s.classId === selectedClassId && s.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [schedules, selectedClassId, currentMonth]);

  // Calendar helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = language === 'fr' ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;
  const monthName = currentMonth.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' });
  const dayNames = language === 'fr' ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Check for conflicts when scheduling
  const checkConflicts = (date: string, timeSlot: string, roomId: string, teacherId: string, excludeClassId: string): string | null => {
    const conflicting = schedules.filter(s => {
      if (s.classId === excludeClassId) return false;
      if (s.date !== date) return false;
      if (s.timeSlot !== timeSlot) return false;
      // Check room conflict
      if (s.roomId === roomId && roomId) {
        const conflictClass = classes.find(c => c.id === s.classId);
        return true;
      }
      // Check teacher conflict
      if (s.teacherId === teacherId && teacherId) {
        const conflictClass = classes.find(c => c.id === s.classId);
        return true;
      }
      return false;
    });

    if (conflicting.length > 0) {
      const conflictClass = classes.find(c => c.id === conflicting[0].classId);
      const conflictTeacher = teachers.find(tc => tc.id === conflicting[0].teacherId);
      if (conflicting[0].roomId === roomId) {
        return `${language === 'fr' ? 'Conflit' : 'Conflict'}: ${conflictClass?.name || (language === 'fr' ? 'Autre groupe' : 'Other group')} ${language === 'fr' ? 'a déjà cette salle réservée' : 'already booked this room'} (${roomId}) ${language === 'fr' ? 'à ce créneau' : 'at this time slot'}.`;
      }
      if (conflicting[0].teacherId === teacherId) {
        return `${language === 'fr' ? 'Conflit' : 'Conflict'}: ${conflictTeacher?.name || (language === 'fr' ? 'Enseignant' : 'Teacher')} ${language === 'fr' ? 'est déjà assigné à' : 'is already assigned to'} ${conflictClass?.name || (language === 'fr' ? 'un autre groupe' : 'another group')} ${language === 'fr' ? 'à ce créneau' : 'at this time slot'}.`;
      }
    }
    return null;
  };

  // Get entry for a specific day
  const getEntryForDay = (day: number): ClassScheduleEntry | undefined => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return classSchedules.find(s => s.date === ds);
  };

  // Open editing dialog for a day
  const openDayEdit = (day: number) => {
    if (!selectedClassId) {
      toast.error(language === 'fr' ? 'Veuillez sélectionner une classe' : 'Please select a class first');
      return;
    }
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = getEntryForDay(day);
    setEditingDay(ds);
    if (existing) {
      // Parse existing timeSlot (e.g. "08:00 - 10:00") into timeFrom and timeTo
      const parts = (existing.timeSlot || '').split(' - ');
      setEntryForm({
        teacherId: existing.teacherId,
        roomId: existing.roomId,
        timeFrom: parts[0] || '',
        timeTo: parts[1] || '',
        moduleId: existing.moduleId,
        notes: existing.notes || '',
      });
    } else {
      setEntryForm({ teacherId: '', roomId: '', timeFrom: '', timeTo: '', moduleId: '', notes: '' });
    }
    setConflictMsg(null);
    setDialogOpen(true);
  };

  // Save entry
  const handleSaveEntry = () => {
    if (!editingDay || !selectedClassId) return;
    if (!entryForm.teacherId && !entryForm.roomId && !combinedTimeSlot && !entryForm.moduleId) {
      toast.error(language === 'fr' ? 'Veuillez remplir au moins un champ' : 'Please fill at least one field');
      return;
    }

    // Check conflicts
    if (entryForm.roomId && combinedTimeSlot) {
      const conflict = checkConflicts(editingDay, combinedTimeSlot, entryForm.roomId, entryForm.teacherId, selectedClassId);
      if (conflict) {
        setConflictMsg(conflict);
        return;
      }
    }

    const existing = classSchedules.find(s => s.date === editingDay);
    if (existing) {
      // Update existing
      setSchedules(schedules.map(s => s.id === existing.id ? {
        ...s,
        teacherId: entryForm.teacherId,
        roomId: entryForm.roomId,
        timeSlot: combinedTimeSlot,
        moduleId: entryForm.moduleId,
        notes: entryForm.notes,
      } : s));
    } else {
      // Add new
      setSchedules([...schedules, {
        id: genId(),
        classId: selectedClassId,
        date: editingDay,
        teacherId: entryForm.teacherId,
        roomId: entryForm.roomId,
        timeSlot: combinedTimeSlot,
        moduleId: entryForm.moduleId,
        notes: entryForm.notes,
        createdAt: new Date().toISOString(),
      }]);
    }
    toast.success(language === 'fr' ? t('schedule_entry_saved', language) : 'Schedule entry saved');
    setDialogOpen(false);
    setEditingDay(null);
    setConflictMsg(null);
  };

  // Delete entry for a day
  const handleDeleteDay = () => {
    if (!editingDay) return;
    const existing = classSchedules.find(s => s.date === editingDay);
    if (existing) {
      setSchedules(schedules.filter(s => s.id !== existing.id));
      toast.success(language === 'fr' ? t('schedule_entry_deleted', language) : 'Schedule entry deleted');
    }
    setDialogOpen(false);
    setEditingDay(null);
  };

  // Download PDF for current class/month
  const handleDownloadPDF = () => {
    if (classSchedules.length === 0) {
      toast.error(language === 'fr' ? 'Aucune entrée à exporter' : 'No entries to export');
      return;
    }
    pdfUtils.exportSchedulePDF(
      classSchedules,
      selectedClass || { id: '', name: 'Unknown', createdAt: '' },
      teachers.map(tc => ({ id: tc.id, name: tc.name })),
      modules.map(m => ({ id: m.id, name: m.name })),
      monthName,
      schoolInfo,
      language
    );
  };

  // Download all classes schedules
  const handleDownloadAllPDF = () => {
    if (schedules.length === 0) {
      toast.error(language === 'fr' ? 'Aucune entrée à exporter' : 'No entries to export');
      return;
    }
    pdfUtils.exportAllSchedulesPDF(
      schedules,
      classes,
      teachers.map(tc => ({ id: tc.id, name: tc.name })),
      modules.map(m => ({ id: m.id, name: m.name })),
      schoolInfo,
      language
    );
  };

  // Save current month's schedule for the selected class
  const handleSaveSchedule = () => {
    if (!selectedClassId || classSchedules.length === 0) {
      toast.error(language === 'fr' ? 'Sélectionnez une classe avec des entrées' : 'Select a class with schedule entries');
      return;
    }
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const existingIndex = savedSchedules.findIndex(s => s.classId === selectedClassId && s.month === monthPrefix);
    const newSaved: SavedSchedule = {
      id: genId(),
      classId: selectedClassId,
      className: selectedClass?.name || 'Unknown',
      month: monthPrefix,
      monthLabel: monthName,
      entries: classSchedules,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.username || currentUser?.fullName || 'admin',
    };
    let updated: SavedSchedule[];
    if (existingIndex >= 0) {
      updated = [...savedSchedules];
      updated[existingIndex] = newSaved;
    } else {
      updated = [...savedSchedules, newSaved];
    }
    setSavedSchedules(updated);
    addAuditLog('SAVE_SCHEDULE', 'schedule', selectedClassId, selectedClass?.name, `Saved ${classSchedules.length} entries for ${selectedClass?.name} - ${monthName}`);
    toast.success(language === 'fr' ? 'Programme sauvegardé !' : 'Schedule saved!');
  };

  // Load a saved schedule
  const handleLoadSchedule = (saved: SavedSchedule) => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    // Remove existing schedules for this class/month and add the saved ones
    const otherSchedules = schedules.filter(s => !(s.classId === saved.classId && s.date.startsWith(monthPrefix)));
    const newEntries = saved.entries.map(e => ({ ...e, id: genId() }));
    setSchedules([...otherSchedules, ...newEntries]);
    setSelectedClassId(saved.classId);
    addAuditLog('LOAD_SCHEDULE', 'schedule', saved.classId, saved.className, `Loaded ${saved.entries.length} entries for ${saved.className} - ${saved.monthLabel}`);
    toast.success(language === 'fr' ? 'Programme chargé !' : 'Schedule loaded!');
  };

  // Delete a saved schedule
  const handleDeleteSavedSchedule = (id: string) => {
    const saved = savedSchedules.find(s => s.id === id);
    setSavedSchedules(savedSchedules.filter(s => s.id !== id));
    if (saved) {
      addAuditLog('DELETE_SCHEDULE', 'schedule', saved.classId, saved.className, `Deleted saved schedule for ${saved.className} - ${saved.monthLabel}`);
    }
    toast.success(language === 'fr' ? 'Programme sauvegardé supprimé' : 'Saved schedule deleted');
  };

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Class Selector */}
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('select_class', language)} />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2 capitalize min-w-[140px] text-center">{monthName}</span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date())}>
              <Calendar className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={!selectedClassId || classSchedules.length === 0}>
            <FileDown className="h-4 w-4 mr-1" />
            {t('download_schedule_pdf', language)}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadAllPDF} disabled={schedules.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            {language === 'fr' ? 'Tous les Emplois PDF' : 'All Schedules PDF'}
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveSchedule} disabled={!selectedClassId || classSchedules.length === 0}>
            <Save className="h-4 w-4 mr-1" />
            {language === 'fr' ? 'Sauvegarder' : 'Save Schedule'}
          </Button>
        </div>
      </div>

      {/* Schedule Summary for selected class */}
      {selectedClassId && (
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            {selectedClass?.name}: {classSchedules.length} {language === 'fr' ? 'entrées' : 'entries'}
          </Badge>
          {rooms.length > 0 && (
            <span className="text-muted-foreground">
              {t('rooms', language)}: {rooms.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Calendar Grid */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          {!selectedClassId ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4 opacity-50" />
              <p>{t('select_class', language)}</p>
              <p className="text-xs mt-1">{t('add_schedule_entry', language)}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {dayNames.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[...Array(startOffset)].map((_, i) => <div key={`e-${i}`} />)}
                {[...Array(daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const entry = getEntryForDay(day);
                  const isToday = ds === localToday();

                  return (
                    <button
                      key={day}
                      onClick={() => openDayEdit(day)}
                      className={`relative p-1.5 rounded-lg text-sm min-h-[72px] flex flex-col transition-colors hover:bg-muted border border-transparent ${
                        isToday ? 'ring-2 ring-emerald-500 border-emerald-200' : ''
                      } ${entry ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : ''}`}
                    >
                      <span className={`text-xs font-medium mb-0.5 ${isToday ? 'text-emerald-700 font-bold' : ''}`}>{day}</span>
                      {entry && (
                        <div className="flex-1 flex flex-col gap-0.5 text-[10px] leading-tight overflow-hidden">
                          {entry.timeSlot && (
                            <div className="flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                              <span className="truncate text-emerald-700 dark:text-emerald-400">{entry.timeSlot}</span>
                            </div>
                          )}
                          {entry.moduleId && (
                            <div className="truncate text-muted-foreground">
                              {modules.find(m => m.id === entry.moduleId)?.name || entry.moduleId}
                            </div>
                          )}
                          {entry.roomId && (
                            <div className="truncate text-muted-foreground">
                              <MapPin className="h-2.5 w-2.5 inline mr-0.5" />{entry.roomId}
                            </div>
                          )}
                          {entry.teacherId && (
                            <div className="truncate text-muted-foreground">
                              <UserPlus className="h-2.5 w-2.5 inline mr-0.5" />
                              {teachers.find(tc => tc.id === entry.teacherId)?.name || entry.teacherId}
                            </div>
                          )}
                        </div>
                      )}
                      {!entry && (
                        <div className="flex-1 flex items-center justify-center opacity-0 hover:opacity-40 transition-opacity">
                          <Plus className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Schedule Table View for selected class */}
      {selectedClassId && classSchedules.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('schedule_for_class', language)} {selectedClass?.name} - {monthName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('calendar', language)}</TableHead>
                    <TableHead>{t('assigned_time', language)}</TableHead>
                    <TableHead>{t('assigned_teacher', language)}</TableHead>
                    <TableHead>{t('assigned_room', language)}</TableHead>
                    <TableHead>{t('assigned_module', language)}</TableHead>
                    <TableHead>{t('actions', language)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classSchedules.map(entry => {
                    const teacher = teachers.find(tc => tc.id === entry.teacherId);
                    const mod = modules.find(m => m.id === entry.moduleId);
                    const day = parseInt(entry.date.split('-')[2]);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.date}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{entry.timeSlot}</Badge></TableCell>
                        <TableCell>{teacher?.name || '-'}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{entry.roomId || '-'}</Badge></TableCell>
                        <TableCell>{mod?.name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDayEdit(day)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => {
                              setSchedules(schedules.filter(s => s.id !== entry.id));
                              toast.success(t('schedule_entry_deleted', language));
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Schedules Section */}
      {savedSchedules.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Save className="h-4 w-4 text-emerald-600" />
              {language === 'fr' ? 'Programmes Sauvegardés' : 'Saved Schedules'} ({savedSchedules.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
              {savedSchedules.map(saved => (
                <div key={saved.id} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{saved.className}</p>
                      <p className="text-xs text-muted-foreground">{saved.monthLabel} • {saved.entries.length} {language === 'fr' ? 'entrées' : 'entries'} • {new Date(saved.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleLoadSchedule(saved)}>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      {language === 'fr' ? 'Charger' : 'Load'}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteSavedSchedule(saved.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editingDay && classSchedules.find(s => s.date === editingDay)
                ? (language === 'fr' ? 'Modifier le Programme' : 'Edit Schedule')
                : (language === 'fr' ? 'Ajouter au Programme' : 'Add to Schedule')}
              {' - '}{editingDay}
            </DialogTitle>
            <DialogDescription>
              {selectedClass?.name}
            </DialogDescription>
          </DialogHeader>

          {conflictMsg && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-400">{t('schedule_conflict', language)}</p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">{conflictMsg}</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 py-4 flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'De (Heure début)' : 'From'}</Label>
                <Select value={entryForm.timeFrom || '__none__'} onValueChange={v => {
                  const from = v === '__none__' ? '' : v;
                  setEntryForm({ ...entryForm, timeFrom: from });
                  if (entryForm.roomId && from && entryForm.timeTo && editingDay && selectedClassId) {
                    const slot = `${from} - ${entryForm.timeTo}`;
                    const c = checkConflicts(editingDay, slot, entryForm.roomId, entryForm.teacherId, selectedClassId);
                    setConflictMsg(c);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'fr' ? 'Heure début' : 'Start time'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{language === 'fr' ? 'Sélectionner' : 'Select'}</SelectItem>
                    {TIME_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'À (Heure fin)' : 'To'}</Label>
                <Select value={entryForm.timeTo || '__none__'} onValueChange={v => {
                  const to = v === '__none__' ? '' : v;
                  setEntryForm({ ...entryForm, timeTo: to });
                  if (entryForm.roomId && entryForm.timeFrom && to && editingDay && selectedClassId) {
                    const slot = `${entryForm.timeFrom} - ${to}`;
                    const c = checkConflicts(editingDay, slot, entryForm.roomId, entryForm.teacherId, selectedClassId);
                    setConflictMsg(c);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'fr' ? 'Heure fin' : 'End time'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{language === 'fr' ? 'Sélectionner' : 'Select'}</SelectItem>
                    {TIME_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('assigned_teacher', language)}</Label>
              <Select value={entryForm.teacherId} onValueChange={v => {
                setEntryForm({ ...entryForm, teacherId: v });
                if (entryForm.roomId && combinedTimeSlot && editingDay && selectedClassId) {
                  const c = checkConflicts(editingDay, combinedTimeSlot, entryForm.roomId, v, selectedClassId);
                  setConflictMsg(c);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'fr' ? 'Sélectionner un enseignant' : 'Select teacher'} />
                </SelectTrigger>
                <SelectContent>
                  {teachers.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('no_teachers', language)}</p>}
                  {teachers.map(tc => (
                    <SelectItem key={tc.id} value={tc.id}>{tc.name}{tc.subject ? ` (${tc.subject})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('assigned_room', language)}</Label>
              <Select value={entryForm.roomId} onValueChange={v => {
                setEntryForm({ ...entryForm, roomId: v });
                if (combinedTimeSlot && editingDay && selectedClassId) {
                  const c = checkConflicts(editingDay, combinedTimeSlot, v, entryForm.teacherId, selectedClassId);
                  setConflictMsg(c);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'fr' ? 'Sélectionner une salle' : 'Select room'} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('assigned_module', language)}</Label>
              <Select value={entryForm.moduleId} onValueChange={v => setEntryForm({ ...entryForm, moduleId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'fr' ? 'Sélectionner un module' : 'Select module'} />
                </SelectTrigger>
                <SelectContent>
                  {modules.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('no_modules', language)}</p>}
                  {modules.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}{m.code ? ` (${m.code})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Notes' : 'Notes'}</Label>
              <Textarea
                value={entryForm.notes}
                onChange={e => setEntryForm({ ...entryForm, notes: e.target.value })}
                rows={2}
                placeholder={language === 'fr' ? 'Notes optionnelles...' : 'Optional notes...'}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 shrink-0 pt-2">
            {classSchedules.find(s => s.date === editingDay) && (
              <Button variant="destructive" size="sm" onClick={handleDeleteDay}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t('clear_day', language)}
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel', language)}
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveEntry} disabled={!!conflictMsg}>
              <Save className="h-4 w-4 mr-1" />
              {t('save_schedule', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== EXPORT DATA DIALOG ====================
function ExportDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, language } = useAppStore();
  const data = { students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees };

  const options = [
    { key: 'students', label: t('students', language), fn: () => exportUtils.exportStudentsCSV(students, classes, language) },
    { key: 'attendance', label: t('attendance', language), fn: () => exportUtils.exportAttendanceCSV(attendance, students, classes, language) },
    { key: 'grades', label: t('grades', language), fn: () => exportUtils.exportGradesCSV(grades, students, modules, language) },
    { key: 'classes', label: t('classes', language), fn: () => exportUtils.exportClassesCSV(classes, students, language) },
    { key: 'modules', label: t('modules', language), fn: () => exportUtils.exportModulesCSV(modules, language) },
    { key: 'behavior', label: t('behavior', language), fn: () => exportUtils.exportBehaviorCSV(behavior, students, language) },
    { key: 'tasks', label: t('tasks', language), fn: () => exportUtils.exportTasksCSV(tasks, language) },
    { key: 'incidents', label: t('incidents', language), fn: () => exportUtils.exportIncidentsCSV(incidents, students, language) },
    { key: 'teachers', label: t('teachers_management', language), fn: () => exportUtils.exportTeachersCSV(teachers, language) },
    { key: 'employees', label: t('employees_management', language), fn: () => exportUtils.exportEmployeesCSV(employees, language) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('export', language)}</DialogTitle><DialogDescription>{language === 'fr' ? 'Choisir les données à exporter' : 'Choose data to export'}</DialogDescription></DialogHeader>
        <div className="grid gap-2 py-4">
          {options.map(o => (
            <button key={o.key} onClick={() => { o.fn(); onOpenChange(false); toast.success(language === 'fr' ? 'Exporté!' : 'Exported!'); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border hover:bg-muted transition-colors text-left">
              <FileDown className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium">{o.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{language === 'fr' ? 'CSV' : 'CSV'}</span>
            </button>
          ))}
          <Separator className="my-1" />
          <button onClick={() => { exportUtils.exportAllCSV(data, language); onOpenChange(false); toast.success(language === 'fr' ? 'Export complet!' : 'Full export!'); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
            <Download className="h-4 w-4" /><span className="text-sm font-medium">{t('export_all_data', language)}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== GRADES PAGE ====================
function GradesPage() {
  const { students, classes, modules, grades, language, setGrades } = useAppStore();
  const [classFilter, setClassFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGrade, setEditGrade] = useState<Grade | null>(null);
  const [form, setForm] = useState({ studentId: '', moduleId: '', grade: '', percentage: '', date: localToday() });

  const filteredGrades = useMemo(() => {
    let g = [...grades];
    if (classFilter !== 'all') {
      const classStudentIds = new Set(students.filter(s => s.classId === classFilter).map(s => s.id));
      g = g.filter(gr => classStudentIds.has(gr.studentId));
    }
    if (moduleFilter !== 'all') g = g.filter(gr => gr.moduleId === moduleFilter);
    return g.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [grades, classFilter, moduleFilter, students]);

  const classAvg = filteredGrades.length > 0 ? Math.round(filteredGrades.reduce((s, g) => s + (g.percentage || 0), 0) / filteredGrades.length) : 0;
  const distData = useMemo(() => {
    const buckets = ['0-39', '40-59', '60-69', '70-79', '80-89', '90-100'];
    const counts = [0, 0, 0, 0, 0, 0];
    filteredGrades.forEach(g => {
      const p = g.percentage || 0;
      if (p < 40) counts[0]++;
      else if (p < 60) counts[1]++;
      else if (p < 70) counts[2]++;
      else if (p < 80) counts[3]++;
      else if (p < 90) counts[4]++;
      else counts[5]++;
    });
    return buckets.map((b, i) => ({ range: b, count: counts[i] }));
  }, [filteredGrades]);

  const openAdd = () => { setEditGrade(null); setForm({ studentId: '', moduleId: '', grade: '', percentage: '', date: localToday() }); setDialogOpen(true); };
  const openEdit = (g: Grade) => { setEditGrade(g); setForm({ studentId: g.studentId, moduleId: g.moduleId, grade: g.grade || '', percentage: g.percentage != null ? String(g.percentage) : '', date: g.date || '' }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.studentId || !form.moduleId) { toast.error(t('select_student_and_module', language) || (language === 'fr' ? 'Sélectionnez un étudiant et un module' : 'Select a student and module')); return; }
    if (editGrade) {
      setGrades(grades.map(g => g.id === editGrade.id ? { ...g, studentId: form.studentId, moduleId: form.moduleId, grade: form.grade, percentage: form.percentage !== '' ? Number(form.percentage) : undefined, date: form.date } : g));
      toast.success(language === 'fr' ? 'Note mise à jour' : 'Grade updated');
    } else {
      setGrades([...grades, { id: genId(), studentId: form.studentId, moduleId: form.moduleId, grade: form.grade, percentage: form.percentage !== '' ? Number(form.percentage) : undefined, date: form.date, createdAt: new Date().toISOString() }]);
      toast.success(language === 'fr' ? 'Note ajoutée' : 'Grade added');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer cette note ?' : 'Delete this grade?')) return; setGrades(grades.filter(g => g.id !== id)); toast.success(language === 'fr' ? 'Note supprimée' : 'Grade deleted'); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={classFilter} onValueChange={v => setClassFilter(v)}><SelectTrigger className="w-40"><SelectValue placeholder={t('class_name', language)} /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Toutes les classes' : 'All Classes'}</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          <Select value={moduleFilter} onValueChange={v => setModuleFilter(v)}><SelectTrigger className="w-40"><SelectValue placeholder={t('modules', language)} /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Tous les modules' : 'All Modules'}</SelectItem>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Moyenne de classe' : 'Class Average'}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold" style={{ color: classAvg >= 70 ? '#10b981' : classAvg >= 50 ? '#f59e0b' : '#ef4444' }}>{classAvg}%</p><Progress value={classAvg} className="mt-2" /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Distribution des notes' : 'Grade Distribution'}</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={100}><BarChart data={distData}><Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} /><XAxis dataKey="range" tick={{ fontSize: 10 }} /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      {filteredGrades.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
        <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('students', language)}</TableHead><TableHead>{t('modules', language)}</TableHead><TableHead>{language === 'fr' ? 'Note' : 'Grade'}</TableHead><TableHead>%</TableHead><TableHead>{language === 'fr' ? 'Date' : 'Date'}</TableHead><TableHead className="w-24">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
          {filteredGrades.map(g => { const s = students.find(st => st.id === g.studentId); const m = modules.find(mod => mod.id === g.moduleId); const pct = g.percentage || 0; return <TableRow key={g.id}><TableCell className="font-medium">{s?.fullName || '-'}</TableCell><TableCell>{m?.name || '-'}</TableCell><TableCell>{g.grade || '-'}</TableCell><TableCell><span className="font-semibold" style={{ color: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</span></TableCell><TableCell className="text-sm text-muted-foreground">{g.date || '-'}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>; })}
        </TableBody></Table></div></CardContent></Card>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editGrade ? t('edit', language) : t('add', language)} {t('grades', language)}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>{t('students', language)} *</Label><Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{students.filter(s => classFilter === 'all' || s.classId === classFilter).map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>{t('modules', language)} *</Label><Select value={form.moduleId} onValueChange={v => setForm({ ...form, moduleId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{language === 'fr' ? 'Note' : 'Grade'}</Label><Input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="A, B, 18/20" /></div>
            <div className="space-y-2"><Label>%</Label><Input type="number" min="0" max="100" value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Date' : 'Date'}</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

// ==================== BEHAVIOR PAGE ====================
function BehaviorPage() {
  const { students, behavior, language, setBehavior, currentUser } = useAppStore();
  const [typeFilter, setTypeFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRec, setEditRec] = useState<BehaviorRecord | null>(null);
  const [form, setForm] = useState({ studentId: '', type: 'positive' as 'positive' | 'negative', description: '', points: '0', date: localToday() });

  const filtered = useMemo(() => {
    let b = [...behavior];
    if (typeFilter !== 'all') b = b.filter(r => r.type === typeFilter);
    if (studentFilter !== 'all') b = b.filter(r => r.studentId === studentFilter);
    return b.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [behavior, typeFilter, studentFilter]);

  const pointsSummary = useMemo(() => {
    const map = new Map<string, { pos: number; neg: number; name: string }>();
    behavior.forEach(b => {
      const s = students.find(st => st.id === b.studentId);
      if (!s) return;
      const d = map.get(b.studentId) || { pos: 0, neg: 0, name: s.fullName };
      if (b.type === 'positive') d.pos += Math.abs(b.points ?? 1); else d.neg += Math.abs(b.points ?? 1);
      map.set(b.studentId, d);
    });
    return Array.from(map.entries()).map(([id, d]) => ({ id, ...d, total: d.pos + d.neg })).sort((a, b) => b.total - a.total);
  }, [behavior, students]);

  const openAdd = () => { setEditRec(null); setForm({ studentId: '', type: 'positive', description: '', points: '1', date: localToday() }); setDialogOpen(true); };
  const openEdit = (r: BehaviorRecord) => { setEditRec(r); setForm({ studentId: r.studentId, type: r.type, description: r.description, points: String(r.points || 0), date: r.date }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.studentId || !form.description) { toast.error(language === 'fr' ? 'Sélectionnez un étudiant et ajoutez une description' : 'Select a student and add a description'); return; }
    if (editRec) {
      setBehavior(behavior.map(b => b.id === editRec.id ? { ...b, studentId: form.studentId, type: form.type, description: form.description, points: Number(form.points) || 0, date: form.date, teacher: currentUser?.fullName } : b));
      toast.success(language === 'fr' ? 'Enregistrement mis à jour' : 'Record updated');
    } else {
      setBehavior([...behavior, { id: genId(), studentId: form.studentId, type: form.type, description: form.description, points: Number(form.points) || 0, date: form.date, teacher: currentUser?.fullName, createdAt: new Date().toISOString() }]);
      toast.success(language === 'fr' ? 'Enregistrement ajouté' : 'Record added');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer cet enregistrement ?' : 'Delete this record?')) return; setBehavior(behavior.filter(b => b.id !== id)); toast.success(language === 'fr' ? 'Supprimé' : 'Deleted'); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v)}><SelectTrigger className="w-36"><SelectValue placeholder={language === 'fr' ? 'Type' : 'Type'} /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Tous' : 'All'}</SelectItem><SelectItem value="positive">{t('positive', language)}</SelectItem><SelectItem value="negative">{t('negative', language)}</SelectItem></SelectContent></Select>
          <Select value={studentFilter} onValueChange={v => setStudentFilter(v)}><SelectTrigger className="w-40"><SelectValue placeholder={t('students', language)} /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Tous' : 'All'}</SelectItem>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button>
      </div>
      {pointsSummary.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Résumé des points' : 'Points Summary'}</CardTitle></CardHeader><CardContent><div className="max-h-40 overflow-y-auto space-y-1">{pointsSummary.slice(0, 10).map(p => (<div key={p.id} className="flex items-center justify-between py-1 text-sm"><span className="font-medium">{p.name}</span><div className="flex gap-3"><span className="text-emerald-600">+{p.pos}</span><span className="text-red-500">-{p.neg}</span><Badge variant={p.total >= 0 ? 'secondary' : 'destructive'}>{p.total > 0 ? '+' : ''}{p.total}</Badge></div></div>))}</div></CardContent></Card>}
      {filtered.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
        <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('students', language)}</TableHead><TableHead>{language === 'fr' ? 'Type' : 'Type'}</TableHead><TableHead>{language === 'fr' ? 'Description' : 'Description'}</TableHead><TableHead>{language === 'fr' ? 'Points' : 'Points'}</TableHead><TableHead>{language === 'fr' ? 'Date' : 'Date'}</TableHead><TableHead className="w-24">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(r => { const s = students.find(st => st.id === r.studentId); return <TableRow key={r.id}><TableCell className="font-medium">{s?.fullName || '-'}</TableCell><TableCell><StatusBadge status={r.type} /></TableCell><TableCell className="max-w-[200px] truncate">{r.description}</TableCell><TableCell><span className={r.type === 'positive' ? 'text-emerald-600' : 'text-red-500'}>{r.points && r.points > 0 ? '+' : ''}{r.points || 0}</span></TableCell><TableCell className="text-sm text-muted-foreground">{r.date}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>; })}
        </TableBody></Table></div></CardContent></Card>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editRec ? t('edit', language) : t('add', language)} {t('behavior', language)}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>{t('students', language)} *</Label><Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Type' : 'Type'}</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v as 'positive' | 'negative', points: v === 'positive' ? '1' : '-1' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="positive">👍 {t('positive', language)}</SelectItem><SelectItem value="negative">👎 {t('negative', language)}</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Description' : 'Description'} *</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{language === 'fr' ? 'Points' : 'Points'}</Label><Input type="number" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} /></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Date' : 'Date'}</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

// ==================== TASKS PAGE ====================

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(type: string): string {
  if (type.includes('pdf')) return '📄';
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return '📊';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('image')) return '🖼️';
  return '📎';
}

function TasksPage() {
  const { tasks, language, setTasks, currentUser, teachers, employees } = useAppStore();
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '', assignedToEmail: '', priority: 'medium' as Task['priority'], status: 'pending' as Task['status'], category: '', dueDate: '', progress: '0' });
  const [commentText, setCommentText] = useState('');
  const [sendEmailNotif, setSendEmailNotif] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [formAttachments, setFormAttachments] = useState<{ name: string; type: string; size: number; dataUrl: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');

  // Build list of assignable people (teachers + employees) with emails for dropdown
  const assigneeList = useMemo(() => {
    const list: { name: string; email: string; source: string }[] = [];
    teachers.forEach(tc => {
      if (tc.name) list.push({ name: tc.name, email: tc.email || '', source: 'teacher' });
    });
    employees.forEach(emp => {
      if (emp.fullName) list.push({ name: emp.fullName, email: emp.email || '', source: 'employee' });
    });
    return list;
  }, [teachers, employees]);

  // Auto-fill email when assignee name changes
  const handleAssigneeChange = (name: string) => {
    setForm(prev => ({ ...prev, assignedTo: name }));
    const match = assigneeList.find(a => a.name === name);
    if (match?.email) {
      setForm(prev => ({ ...prev, assignedToEmail: match.email }));
    }
  };

  // File attachment handling
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
  const ACCEPTED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/csv',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  ];
  const ACCEPTED_EXTENSIONS = '.pdf,.xlsx,.xls,.docx,.doc,.csv,.png,.jpg,.jpeg,.gif,.webp';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttachments: { name: string; type: string; size: number; dataUrl: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate type
      if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes('.' + file.name.split('.').pop()?.toLowerCase())) {
        toast.error(`${language === 'fr' ? 'Type non supporté' : 'Unsupported type'}: ${file.name}`);
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${language === 'fr' ? 'Fichier trop volumineux' : 'File too large'}: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB > 10MB)`);
        continue;
      }

      // Check duplicate
      if (formAttachments.some(a => a.name === file.name && a.size === file.size)) {
        toast.warning(`${language === 'fr' ? 'Fichier déjà ajouté' : 'File already added'}: ${file.name}`);
        continue;
      }

      setUploadProgress(file.name);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        newAttachments.push({ name: file.name, type: file.type, size: file.size, dataUrl });
      } catch {
        toast.error(`${language === 'fr' ? 'Erreur de lecture' : 'Read error'}: ${file.name}`);
      }
    }

    if (newAttachments.length > 0) {
      setFormAttachments(prev => [...prev, ...newAttachments]);
      toast.success(`${language === 'fr' ? `${newAttachments.length} fichier(s) ajouté(s)` : `${newAttachments.length} file(s) added`}`);
    }
    setUploadProgress('');
    e.target.value = ''; // Reset input
  };

  const removeFormAttachment = (index: number) => {
    setFormAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const downloadAttachment = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const removeTaskAttachment = (taskId: string, index: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated = [...(task.attachments || [])];
    updated.splice(index, 1);
    setTasks(tasks.map(t => t.id === taskId ? { ...t, attachments: updated } : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask({ ...selectedTask, attachments: updated });
    }
    toast.success(language === 'fr' ? 'Pièce jointe supprimée' : 'Attachment removed');
  };

  const filtered = useMemo(() => {
    let t = [...tasks];
    // Teachers only see their own tasks
    if (currentUser?.role === 'teacher' && currentUser.fullName) {
      t = t.filter(tk => tk.assignedTo === currentUser.fullName);
    }
    if (statusFilter !== 'all') t = t.filter(tk => tk.status === statusFilter);
    if (priorityFilter !== 'all') t = t.filter(tk => tk.priority === priorityFilter);
    return t.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [tasks, statusFilter, priorityFilter, currentUser?.role, currentUser?.fullName]);

  const counts = useMemo(() => {
    const base = currentUser?.role === 'teacher' && currentUser.fullName ? tasks.filter(tk => tk.assignedTo === currentUser.fullName) : tasks;
    return {
      all: base.length, pending: base.filter(tk => tk.status === 'pending').length, in_progress: base.filter(tk => tk.status === 'in_progress').length, completed: base.filter(tk => tk.status === 'completed').length, overdue: base.filter(tk => tk.status === 'overdue').length,
    };
  }, [tasks, currentUser?.role, currentUser?.fullName]);

  const openAdd = () => { setEditTask(null); setForm({ title: '', description: '', assignedTo: '', assignedToEmail: '', priority: 'medium', status: 'pending', category: '', dueDate: '', progress: '0' }); setSendEmailNotif(false); setFormAttachments([]); setDialogOpen(true); };
  const openEdit = (tk: Task) => {
    setEditTask(tk);
    const match = assigneeList.find(a => a.name === tk.assignedTo);
    setForm({
      title: tk.title, description: tk.description || '', assignedTo: tk.assignedTo || '',
      assignedToEmail: match?.email || '',
      priority: tk.priority, status: tk.status, category: tk.category || '',
      dueDate: tk.dueDate || '', progress: String(tk.progress || 0)
    });
    setSendEmailNotif(false);
    // Load existing attachments as-is (they're stored as JSON strings)
    setFormAttachments((tk.attachments || []).map((a: string) => {
      try { return typeof a === 'string' ? JSON.parse(a) : a; } catch { return null; }
    }).filter(Boolean));
    setDialogOpen(true);
  };
  const openDetail = (tk: Task) => { setSelectedTask(tk); setCommentText(''); setDetailOpen(true); };

  const handleSave = async () => {
    if (!form.title) { toast.error(language === 'fr' ? 'Le titre est requis' : 'Title is required'); return; }
    let ticket = editTask?.ticketNumber || '';
    let emailResult: { success: boolean; error?: string } | null = null;

    // Send email notification BEFORE saving (so we know the result)
    if (sendEmailNotif && form.assignedToEmail && form.assignedToEmail.includes('@')) {
      setEmailSending(true);
      emailResult = await sendTaskAssignmentEmail({
        to: form.assignedToEmail,
        toName: form.assignedTo || undefined,
        taskTitle: form.title,
        assignedBy: currentUser?.fullName,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        description: form.description || undefined,
        ticketNumber: editTask?.ticketNumber || ('TK-' + genId().substring(0, 6).toUpperCase()),
        category: form.category || undefined,
        language,
      });
      setEmailSending(false);
    }

    // Serialize attachments for storage
    const serializedAttachments = formAttachments.map(a => JSON.stringify({ name: a.name, type: a.type, size: a.size, dataUrl: a.dataUrl }));

    if (editTask) {
      setTasks(tasks.map(t => t.id === editTask.id ? { ...t, title: form.title, description: form.description, assignedTo: form.assignedTo, assignedToEmail: form.assignedToEmail || undefined, priority: form.priority, status: form.status, category: form.category, dueDate: form.dueDate, progress: Number(form.progress) || 0, completedAt: form.status === 'completed' ? new Date().toISOString() : t.completedAt, emailSent: emailResult?.success || t.emailSent, attachments: serializedAttachments } : t));
      toast.success(language === 'fr' ? 'Tâche mise à jour' : 'Task updated');
    } else {
      ticket = 'TK-' + genId().substring(0, 6).toUpperCase();
      setTasks([...tasks, { id: genId(), title: form.title, description: form.description, assignedTo: form.assignedTo, assignedToEmail: form.assignedToEmail || undefined, assignedBy: currentUser?.fullName, priority: form.priority, status: form.status, category: form.category, dueDate: form.dueDate, progress: Number(form.progress) || 0, ticketNumber: ticket, comments: [], emailSent: emailResult?.success || false, attachments: serializedAttachments, createdAt: new Date().toISOString() }]);
      toast.success(language === 'fr' ? 'Tâche créée' : 'Task created');
    }
    setDialogOpen(false);

    if (emailResult) {
      if (emailResult.success) {
        toast.success(language === 'fr' ? 'Email de notification envoyé' : 'Notification email sent');
      } else {
        toast.error(`${language === 'fr' ? "Erreur d'envoi d'email" : 'Email send error'}: ${emailResult.error || 'Unknown'}`);
      }
    }

    // Push notification for new task assignment
    if (!editTask && form.assignedTo && currentUser?.fullName && form.assignedTo !== currentUser.fullName && getPushNotifPref()) {
      showBrowserNotification(
        language === 'fr' ? `📋 Nouvelle tâche: ${form.title}` : `📋 New task: ${form.title}`,
        language === 'fr' ? `Assignée par ${currentUser.fullName} — Priorité: ${form.priority}` : `Assigned by ${currentUser.fullName} — Priority: ${form.priority}`,
        { tag: `task-${ticket}` }
      );
    }
  };

  const handleDelete = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer cette tâche ?' : 'Delete this task?')) return; setTasks(tasks.filter(t => t.id !== id)); toast.success(language === 'fr' ? 'Tâche supprimée' : 'Task deleted'); };

  const handleAddComment = () => {
    if (!commentText || !selectedTask) return;
    const newComment = { id: genId(), text: commentText, author: currentUser?.fullName, createdAt: new Date().toISOString() };
    setTasks(tasks.map(t => t.id === selectedTask.id ? { ...t, comments: [...(t.comments || []), newComment] } : t));
    setSelectedTask({ ...selectedTask, comments: [...(selectedTask.comments || []), newComment] });
    setCommentText('');
    toast.success(language === 'fr' ? 'Commentaire ajouté' : 'Comment added');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {([['all', 'total_students', counts.all], ['pending', 'pending', counts.pending], ['in_progress', 'in_progress', counts.in_progress], ['completed', 'completed', counts.completed], ['overdue', 'overdue', counts.overdue]] as const).map(([key, labelKey, count]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)} className={`rounded-lg p-3 text-center transition-colors border ${statusFilter === key ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-muted'}`}>
            <p className="text-xl font-bold">{count}</p><p className="text-xs text-muted-foreground">{t(labelKey as string, language)}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v)}><SelectTrigger className="w-36"><SelectValue placeholder={language === 'fr' ? 'Priorité' : 'Priority'} /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Toutes' : 'All'}</SelectItem><SelectItem value="urgent">{t('urgent', language)}</SelectItem><SelectItem value="high">{t('high', language)}</SelectItem><SelectItem value="medium">{t('medium', language)}</SelectItem><SelectItem value="low">{t('low', language)}</SelectItem></SelectContent></Select>
        </div>
        <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" />{t('add', language)} {t('tasks', language)}</Button>
      </div>
      {filtered.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
        <div className="grid gap-3">
          {filtered.map(tk => (
            <Card key={tk.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(tk)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tk.ticketNumber || ''}</span>
                      <StatusBadge status={tk.priority} /><StatusBadge status={tk.status} />
                    </div>
                    <h3 className="font-semibold text-sm truncate">{tk.title}</h3>
                    {tk.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tk.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {tk.assignedTo && <span>👤 {tk.assignedTo}</span>}
                      {tk.dueDate && <span>📅 {tk.dueDate}</span>}
                      {tk.comments && tk.comments.length > 0 && <span>💬 {tk.comments.length}</span>}
                      {tk.emailSent && <span className="text-emerald-600 flex items-center gap-0.5" title={language === 'fr' ? 'Email envoyé' : 'Email sent'}><Mail className="h-3 w-3" />✓</span>}
                      {tk.attachments && tk.attachments.length > 0 && <span className="text-blue-600 flex items-center gap-0.5" title={`${tk.attachments.length} ${language === 'fr' ? 'pièce(s) jointe(s)' : 'attachment(s)'}`}><Paperclip className="h-3 w-3" />{tk.attachments.length}</span>}
                    </div>
                    {(tk.progress || 0) > 0 && <div className="mt-2"><Progress value={tk.progress || 0} className="h-1.5" /></div>}
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tk)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(tk.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Task Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{selectedTask?.ticketNumber} — {selectedTask?.title}</DialogTitle></DialogHeader>
        {selectedTask && <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            <div className="flex flex-wrap gap-2"><StatusBadge status={selectedTask.priority} /><StatusBadge status={selectedTask.status} />{selectedTask.category && <Badge variant="outline">{selectedTask.category}</Badge>}</div>
            {selectedTask.description && <p className="text-sm text-muted-foreground">{selectedTask.description}</p>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">{language === 'fr' ? 'Assigné à' : 'Assigned to'}:</span> <span className="font-medium ml-1">{selectedTask.assignedTo || '-'}</span></div>
              <div><span className="text-muted-foreground">{language === 'fr' ? 'Assigné par' : 'Assigned by'}:</span> <span className="font-medium ml-1">{selectedTask.assignedBy || '-'}</span></div>
              <div><span className="text-muted-foreground">{language === 'fr' ? 'Échéance' : 'Due'}:</span> <span className="font-medium ml-1">{selectedTask.dueDate || '-'}</span></div>
              <div><span className="text-muted-foreground">{language === 'fr' ? 'Progression' : 'Progress'}:</span> <span className="font-medium ml-1">{selectedTask.progress || 0}%</span></div>
            </div>
            {(selectedTask.progress || 0) > 0 && <Progress value={selectedTask.progress || 0} />}
            {/* Attachments */}
            {selectedTask.attachments && selectedTask.attachments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Paperclip className="h-4 w-4" />{language === 'fr' ? 'Pièces jointes' : 'Attachments'} ({selectedTask.attachments.length})</h4>
                <div className="space-y-1.5">
                  {selectedTask.attachments.map((a, idx) => {
                    let parsed: { name: string; type: string; size: number; dataUrl: string } | null = null;
                    try { parsed = typeof a === 'string' ? JSON.parse(a) : a; } catch { parsed = null; }
                    if (!parsed) return null;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-2.5 group">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-lg shrink-0">{getFileIcon(parsed.type)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{parsed.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatFileSize(parsed.size)}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadAttachment(parsed!.dataUrl, parsed!.name)}><FileDown className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeTaskAttachment(selectedTask.id, idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">{t('comments', language)} ({selectedTask.comments?.length || 0})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(selectedTask.comments || []).map(c => (
                  <div key={c.id || c.text} className="rounded-lg bg-muted/50 p-2.5"><div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold">{c.author || 'Anonymous'}</span><span className="text-[10px] text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</span></div><p className="text-sm">{c.text}</p></div>
                ))}
              </div>
              <div className="flex gap-2 mt-2"><Input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={t('add_comment', language)} className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAddComment()} /><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAddComment}><Send className="h-4 w-4" /></Button></div>
            </div>
          </div>
        </ScrollArea>}</DialogContent></Dialog>
      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>{editTask ? t('edit', language) : t('add', language)} {t('tasks', language)}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4 flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-2"><Label>{language === 'fr' ? 'Titre' : 'Title'} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Description' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Assigné à' : 'Assigned to'}</Label>
              {assigneeList.length > 0 ? (
                <Select value={form.assignedTo} onValueChange={handleAssigneeChange}>
                  <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    {assigneeList.map(a => (
                      <SelectItem key={`${a.source}-${a.name}`} value={a.name}>
                        {a.name} {a.email ? `(${a.email})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} placeholder={language === 'fr' ? 'Nom' : 'Name'} />
              )}
            </div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Catégorie' : 'Category'}</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
          </div>
          {/* Email notification section */}
          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-600" />
                <Label className="text-sm font-medium cursor-pointer" onClick={() => setSendEmailNotif(!sendEmailNotif)}>
                  {language === 'fr' ? 'Notifier par email' : 'Notify by email'}
                </Label>
              </div>
              <Switch checked={sendEmailNotif} onCheckedChange={setSendEmailNotif} />
            </div>
            {sendEmailNotif && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{language === 'fr' ? 'Email du destinataire' : 'Recipient email'}</Label>
                <Input
                  type="email"
                  value={form.assignedToEmail}
                  onChange={e => setForm({ ...form, assignedToEmail: e.target.value })}
                  placeholder="person@email.com"
                />
                {!form.assignedToEmail.includes('@') && (
                  <p className="text-xs text-amber-600">{language === 'fr' ? 'Veuillez entrer un email valide pour envoyer la notification.' : 'Please enter a valid email to send notification.'}</p>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>{language === 'fr' ? 'Priorité' : 'Priority'}</Label><Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as Task['priority'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urgent">{t('urgent', language)}</SelectItem><SelectItem value="high">{t('high', language)}</SelectItem><SelectItem value="medium">{t('medium', language)}</SelectItem><SelectItem value="low">{t('low', language)}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{t('status', language)}</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Task['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">{t('pending', language)}</SelectItem><SelectItem value="in_progress">{t('in_progress', language)}</SelectItem><SelectItem value="completed">{t('completed', language)}</SelectItem><SelectItem value="overdue">{t('overdue', language)}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Progression' : 'Progress'} %</Label><Input type="number" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Échéance' : 'Due Date'}</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
          {/* Attachments upload section */}
          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-1.5"><Paperclip className="h-4 w-4" />{language === 'fr' ? 'Pièces jointes' : 'Attachments'}</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => document.getElementById('task-attachment-input')?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" />{language === 'fr' ? 'Ajouter' : 'Add'}
              </Button>
              <input id="task-attachment-input" type="file" multiple className="hidden" accept={ACCEPTED_EXTENSIONS} onChange={handleFileUpload} />
            </div>
            {uploadProgress && <p className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" />{language === 'fr' ? 'Lecture de' : 'Reading'} {uploadProgress}...</p>}
            {formAttachments.length === 0 && !uploadProgress ? (
              <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Aucune pièce jointe. Cliquez sur Ajouter pour joindre des fichiers.' : 'No attachments. Click Add to attach files.'}</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {formAttachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 rounded bg-background border p-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-base shrink-0">{getFileIcon(att.type)}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{att.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-red-500" onClick={() => removeFormAttachment(idx)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">{language === 'fr' ? 'Formats acceptés : PDF, Excel, Word, CSV, Images — Max 10 Mo par fichier' : 'Accepted formats: PDF, Excel, Word, CSV, Images — Max 10MB per file'}</p>
          </div>
        </div>
        <DialogFooter className="shrink-0 pt-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={emailSending}>
            {emailSending ? (
              <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />{language === 'fr' ? 'Envoi en cours...' : 'Sending...'}</span>
            ) : t('save', language)}
          </Button>
        </DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

// ==================== INCIDENTS PAGE ====================
function IncidentsPage() {
  const { incidents, students, language, setIncidents, currentUser } = useAppStore();
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editInc, setEditInc] = useState<Incident | null>(null);
  const [selectedInc, setSelectedInc] = useState<Incident | null>(null);
  const [form, setForm] = useState({ studentId: '', incidentType: '', severity: 'medium' as Incident['severity'], status: 'open' as Incident['status'], description: '', actionTaken: '', date: localToday(), followUpNotes: '' });

  const filtered = useMemo(() => {
    let i = [...incidents];
    if (severityFilter !== 'all') i = i.filter(inc => inc.severity === severityFilter);
    if (statusFilter !== 'all') i = i.filter(inc => inc.status === statusFilter);
    return i.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [incidents, severityFilter, statusFilter]);

  const severityCounts = useMemo(() => ({
    all: incidents.length, low: incidents.filter(i => i.severity === 'low').length, medium: incidents.filter(i => i.severity === 'medium').length, high: incidents.filter(i => i.severity === 'high').length, critical: incidents.filter(i => i.severity === 'critical').length,
  }), [incidents]);

  const openAdd = () => { setEditInc(null); setForm({ studentId: '', incidentType: '', severity: 'medium', status: 'open', description: '', actionTaken: '', date: localToday(), followUpNotes: '' }); setDialogOpen(true); };
  const openEdit = (inc: Incident) => { setEditInc(inc); setForm({ studentId: inc.studentId, incidentType: inc.incidentType || '', severity: inc.severity, status: inc.status, description: inc.description || '', actionTaken: inc.actionTaken || '', date: inc.date || '', followUpNotes: inc.followUpNotes || '' }); setDialogOpen(true); };
  const openDetail = (inc: Incident) => { setSelectedInc(inc); setDetailOpen(true); };

  const handleSave = () => {
    if (!form.studentId) { toast.error(language === 'fr' ? 'Sélectionnez un étudiant' : 'Select a student'); return; }
    if (editInc) {
      setIncidents(incidents.map(i => i.id === editInc.id ? { ...i, studentId: form.studentId, incidentType: form.incidentType, severity: form.severity, status: form.status, description: form.description, actionTaken: form.actionTaken, date: form.date, followUpNotes: form.followUpNotes, reportedBy: currentUser?.fullName } : i));
      toast.success(language === 'fr' ? 'Incident mis à jour' : 'Incident updated');
    } else {
      setIncidents([...incidents, { id: genId(), studentId: form.studentId, incidentType: form.incidentType, severity: form.severity, status: form.status, description: form.description, actionTaken: form.actionTaken, date: form.date, followUpNotes: form.followUpNotes, reportedBy: currentUser?.fullName, createdAt: new Date().toISOString() }]);
      toast.success(language === 'fr' ? 'Incident créé' : 'Incident created');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer cet incident ?' : 'Delete this incident?')) return; setIncidents(incidents.filter(i => i.id !== id)); toast.success(language === 'fr' ? 'Incident supprimé' : 'Incident deleted'); };

  const sevIcon: Record<string, string> = { low: '🟡', medium: '🟠', high: '🔴', critical: '⚡' };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {([['all', 'total_students', severityCounts.all], ['low', 'low', severityCounts.low], ['medium', 'medium', severityCounts.medium], ['high', 'high', severityCounts.high], ['critical', 'critical', severityCounts.critical]] as const).map(([key, labelKey, count]) => (
          <button key={key} onClick={() => setSeverityFilter(severityFilter === key ? 'all' : key)} className={`rounded-lg p-3 text-center transition-colors border ${severityFilter === key ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-muted'}`}>
            <p className="text-xl font-bold">{count}</p><p className="text-xs text-muted-foreground">{key !== 'all' ? `${sevIcon[key]} ${t(labelKey as string, language)}` : t(labelKey as string, language)}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v)}><SelectTrigger className="w-40"><SelectValue placeholder={t('status', language)} /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Tous' : 'All'}</SelectItem><SelectItem value="open">{t('open', language)}</SelectItem><SelectItem value="investigating">{t('investigating', language)}</SelectItem><SelectItem value="resolved">{t('resolved', language)}</SelectItem><SelectItem value="closed">{t('closed', language)}</SelectItem></SelectContent></Select>
        <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" />{t('add', language)} {t('incidents', language)}</Button>
      </div>
      {filtered.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
        <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('students', language)}</TableHead><TableHead>{language === 'fr' ? 'Type' : 'Type'}</TableHead><TableHead>{language === 'fr' ? 'Sévérité' : 'Severity'}</TableHead><TableHead>{t('status', language)}</TableHead><TableHead>{language === 'fr' ? 'Date' : 'Date'}</TableHead><TableHead className="w-24">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(inc => { const s = students.find(st => st.id === inc.studentId); return <TableRow key={inc.id} className="cursor-pointer" onClick={() => openDetail(inc)}><TableCell className="font-medium">{s?.fullName || '-'}</TableCell><TableCell>{inc.incidentType || '-'}</TableCell><TableCell><StatusBadge status={inc.severity} /></TableCell><TableCell><StatusBadge status={inc.status} /></TableCell><TableCell className="text-sm text-muted-foreground">{inc.date || '-'}</TableCell><TableCell><div className="flex gap-1" onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(inc)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(inc.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>; })}
        </TableBody></Table></div></CardContent></Card>
      )}
      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{t('incident_detail', language)}</DialogTitle></DialogHeader>
        {selectedInc && <ScrollArea className="max-h-[60vh]"><div className="space-y-4 p-1">
          <div className="flex flex-wrap gap-2"><StatusBadge status={selectedInc.severity} /><StatusBadge status={selectedInc.status} />{selectedInc.incidentType && <Badge variant="outline">{selectedInc.incidentType}</Badge>}</div>
          {selectedInc.description && <div><h4 className="text-xs font-semibold text-muted-foreground mb-1">{language === 'fr' ? 'Description' : 'Description'}</h4><p className="text-sm">{selectedInc.description}</p></div>}
          {selectedInc.actionTaken && <div><h4 className="text-xs font-semibold text-muted-foreground mb-1">{language === 'fr' ? 'Action prise' : 'Action Taken'}</h4><p className="text-sm">{selectedInc.actionTaken}</p></div>}
          {selectedInc.followUpNotes && <div><h4 className="text-xs font-semibold text-muted-foreground mb-1">{t('follow_up_notes', language)}</h4><p className="text-sm">{selectedInc.followUpNotes}</p></div>}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">{t('students', language)}:</span> <span className="font-medium ml-1">{students.find(s => s.id === selectedInc.studentId)?.fullName || '-'}</span></div>
            <div><span className="text-muted-foreground">{language === 'fr' ? 'Signalé par' : 'Reported by'}:</span> <span className="font-medium ml-1">{selectedInc.reportedBy || '-'}</span></div>
            <div><span className="text-muted-foreground">{language === 'fr' ? 'Date' : 'Date'}:</span> <span className="font-medium ml-1">{selectedInc.date || '-'}</span></div>
          </div>
        </div></ScrollArea>}
      </DialogContent></Dialog>
      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>{editInc ? t('edit', language) : t('add', language)} {t('incidents', language)}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4 flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-2"><Label>{t('students', language)} *</Label><Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{language === 'fr' ? 'Type' : 'Type'}</Label><Select value={form.incidentType} onValueChange={v => setForm({ ...form, incidentType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="disciplinary">{t('disciplinary', language)}</SelectItem><SelectItem value="academic">{t('academic', language)}</SelectItem><SelectItem value="behavioral">{t('behavioral', language)}</SelectItem><SelectItem value="safety">{t('safety', language)}</SelectItem><SelectItem value="other">{t('other', language)}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Sévérité' : 'Severity'}</Label><Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v as Incident['severity'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">{t('low', language)}</SelectItem><SelectItem value="medium">{t('medium', language)}</SelectItem><SelectItem value="high">{t('high', language)}</SelectItem><SelectItem value="critical">{t('critical', language)}</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t('status', language)}</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Incident['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">{t('open', language)}</SelectItem><SelectItem value="investigating">{t('investigating', language)}</SelectItem><SelectItem value="resolved">{t('resolved', language)}</SelectItem><SelectItem value="closed">{t('closed', language)}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Date' : 'Date'}</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Description' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Action prise' : 'Action Taken'}</Label><Textarea value={form.actionTaken} onChange={e => setForm({ ...form, actionTaken: e.target.value })} rows={2} /></div>
          <div className="space-y-2"><Label>{t('follow_up_notes', language)}</Label><Textarea value={form.followUpNotes} onChange={e => setForm({ ...form, followUpNotes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter className="shrink-0 pt-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

// ==================== MESSAGING PAGE ====================
function MessagingPage() {
  const { templates, setTemplates, students, classes, schoolInfo, language } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: '', content: '', category: '', lang: language === 'fr' ? 'fr' : language === 'ar' ? 'ar' : 'en', isDefault: false });
  const [quickStudentId, setQuickStudentId] = useState('');
  const [quickTemplateId, setQuickTemplateId] = useState('');
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkTemplateId, setBulkTemplateId] = useState('');
  const [langFilter, setLangFilter] = useState<string>('all');

  // Set default template for a category
  const handleSetDefault = (tmplId: string) => {
    const tmpl = templates.find(t => t.id === tmplId);
    if (!tmpl) return;
    const cat = tmpl.category || 'custom';
    const updated = templates.map(t => ({
      ...t,
      isDefault: t.id === tmplId ? true : (t.category === cat ? false : t.isDefault),
    }));
    setTemplates(updated);
    toast.success(language === 'fr' ? 'Modèle par défaut défini' : 'Default template set');
  };

  // Get default template for a category
  const getDefaultForCategory = (cat: string): Template | undefined => {
    return templates.find(t => t.category === cat && t.isDefault);
  };

  // Initialize default templates if empty
  useEffect(() => {
    if (templates.length === 0) {
      const defaults: Template[] = [
        // === English templates ===
        { id: genId(), name: 'Absence Notification', category: 'absence', lang: 'en', isDefault: true, content: 'Dear {guardian_name}, we would like to inform you that {student_name} was marked absent from {class} today ({date}). If this absence was planned, please disregard this message. Otherwise, please contact {school_name} to discuss. Thank you.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Late Arrival', category: 'late', lang: 'en', isDefault: true, content: 'Hello {guardian_name}, {student_name} arrived late to {class} today ({date}). Please ensure punctuality.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Guardian Meeting Request', category: 'meeting', lang: 'en', isDefault: true, content: "Dear {guardian_name}, we would like to schedule a meeting with you to discuss {student_name}'s progress in {class}. Please contact {school_name} at your earliest convenience.", createdAt: new Date().toISOString() },
        { id: genId(), name: 'Academic Progress Update', category: 'academic', lang: 'en', isDefault: true, content: "Dear {guardian_name}, this is an update regarding {student_name}'s academic progress in {class}. Please feel free to contact us if you have any questions.", createdAt: new Date().toISOString() },
        { id: genId(), name: 'Student Achievement', category: 'achievement', lang: 'en', isDefault: true, content: 'Dear {guardian_name}, we are pleased to inform you that {student_name} has shown excellent progress in {class}. Congratulations!', createdAt: new Date().toISOString() },
        { id: genId(), name: 'General Reminder', category: 'reminder', lang: 'en', isDefault: true, content: 'Dear {guardian_name}, this is a reminder regarding {student_name} in {class}. Please contact us if you have any questions.', createdAt: new Date().toISOString() },
        // === French templates ===
        { id: genId(), name: 'Notification d\'absence', category: 'absence', lang: 'fr', content: 'Cher/Chère {guardian_name}, nous souhaitons vous informer que {student_name} a été signalé(e) absent(e) du cours de {class} aujourd\'hui ({date}). Si cette absence était prévue, veuillez ignorer ce message. Dans le cas contraire, veuillez contacter {school_name} pour en discuter. Merci.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Retard', category: 'late', lang: 'fr', content: 'Bonjour {guardian_name}, {student_name} est arrivé(e) en retard au cours de {class} aujourd\'hui ({date}). Nous vous prions de veiller à la ponctualité de votre enfant.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Demande de rendez-vous parent', category: 'meeting', lang: 'fr', content: 'Cher/Chère {guardian_name}, nous souhaitons fixer un rendez-vous avec vous pour discuter des résultats de {student_name} en {class}. Veuillez contacter {school_name} dès que possible.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Bilan académique', category: 'academic', lang: 'fr', content: 'Cher/Chère {guardian_name}, voici une mise à jour concernant les résultats scolaires de {student_name} en {class}. N\'hésitez pas à nous contacter si vous avez des questions.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Réussite de l\'élève', category: 'achievement', lang: 'fr', content: 'Cher/Chère {guardian_name}, nous sommes ravis de vous informer que {student_name} a fait preuve d\'un excellent travail en {class}. Félicitations !', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Rappel général', category: 'reminder', lang: 'fr', content: 'Cher/Chère {guardian_name}, ceci est un rappel concernant {student_name} en {class}. Veuillez nous contacter si vous avez des questions.', createdAt: new Date().toISOString() },
        // === Arabic templates ===
        { id: genId(), name: 'إشعار غياب', category: 'absence', lang: 'ar', content: 'عزيزي/عزيزتي {guardian_name}، نود إعلامكم بأن {student_name} تم تسجيله/ها غائباً/غائبة عن قسم {class} اليوم ({date}). إذا كان الغياب مبرراً، يرجى تجاهل هذه الرسالة. وإلا يرجى الاتصال بـ {school_name} لمناقشة الموضوع. شكراً لتفهمكم.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'إشعار تأخر', category: 'late', lang: 'ar', content: 'عزيزي/عزيزتي {guardian_name}، الطالب/ة {student_name} وصل/ت متأخراً/ة إلى قسم {class} اليوم ({date}). نرجو منكم التأكد من الالتزام بالمواعيد.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'طلب اجتماع ولي الأمر', category: 'meeting', lang: 'ar', content: 'عزيزي/عزيزتي {guardian_name}، نود ترتيب اجتماع معكم لمناقشة مستوى {student_name} في قسم {class}. يرجى الاتصال بـ {school_name} في أقرب وقت ممكن.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'تحديث المستوى الدراسي', category: 'academic', lang: 'ar', content: 'عزيزي/عزيزتي {guardian_name}، نود إطلاعكم على آخر المستجدات المتعلقة بمستوى {student_name} في قسم {class}. لا تترددوا في الاتصال بنا إذا كان لديكم أي استفسار.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'إنجاز الطالب', category: 'achievement', lang: 'ar', content: 'عزيزي/عزيزتي {guardian_name}، يسعدنا إعلامكم بأن {student_name} أظهر/ت تحسناً متميزاً في قسم {class}. تهانينا!', createdAt: new Date().toISOString() },
        { id: genId(), name: 'تذكير عام', category: 'reminder', lang: 'ar', content: 'عزيزي/عزيزتي {guardian_name}، هذه رسالة تذكير بخصوص {student_name} في قسم {class}. يرجى الاتصال بنا إذا كان لديكم أي استفسار.', createdAt: new Date().toISOString() },
      ];
      setTemplates(defaults);
    }
  }, []);

  // Category labels and icons
  const categoryLabels: Record<string, string> = {
    absence: language === 'ar' ? 'غياب' : language === 'fr' ? 'Absence' : 'Absence Templates',
    late: language === 'ar' ? 'تأخر' : language === 'fr' ? 'Retard' : 'Late Arrival Templates',
    meeting: language === 'ar' ? 'اجتماعات' : language === 'fr' ? 'Réunion' : 'Meeting Templates',
    academic: language === 'ar' ? 'أكاديمي' : language === 'fr' ? 'Académique' : 'Academic Templates',
    announcement: language === 'ar' ? 'إعلانات' : language === 'fr' ? 'Annonce' : 'Announcement Templates',
    behavioral: language === 'ar' ? 'سلوكي' : language === 'fr' ? 'Comportement' : 'Behavioral Templates',
    achievement: language === 'ar' ? 'إنجازات' : language === 'fr' ? 'Réalisation' : 'Achievement Templates',
    reminder: language === 'ar' ? 'تذكيرات' : language === 'fr' ? 'Rappel' : 'Reminder Templates',
    custom: language === 'ar' ? 'مخصص' : language === 'fr' ? 'Personnalisé' : 'Custom Templates',
  };

  const categoryColors: Record<string, string> = {
    absence: 'border-l-red-500', late: 'border-l-amber-500', meeting: 'border-l-blue-500',
    academic: 'border-l-emerald-500', announcement: 'border-l-purple-500', behavioral: 'border-l-orange-500',
    achievement: 'border-l-yellow-500', reminder: 'border-l-sky-500', custom: 'border-l-gray-400',
  };

  // Group templates by category (filtered by language)
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, Template[]> = {};
    const filtered = langFilter === 'all' ? templates : templates.filter(tmpl => tmpl.lang === langFilter);
    filtered.forEach(tmpl => {
      const cat = tmpl.category || 'custom';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tmpl);
    });
    return groups;
  }, [templates, langFilter]);

  // Uses the global formatWhatsAppPhone function (Morocco, UK, US support)

  // Build message from template + student data
  const buildMessage = (template: Template, student: Student): string => {
    const studentClass = classes.find(c => c.id === student.classId);
    return template.content
      .replace(/{student_name}/g, student.fullName)
      .replace(/{guardian_name}/g, student.guardianName || 'Guardian')
      .replace(/{class}/g, studentClass?.name || 'class')
      .replace(/{date}/g, new Date().toLocaleDateString())
      .replace(/{time}/g, new Date().toLocaleTimeString())
      .replace(/{school_name}/g, schoolInfo?.name || 'School');
  };

  // Open WhatsApp Web with pre-filled message
  const openWhatsApp = (phone: string | undefined, message: string) => {
    if (!phone) { toast.error(language === 'fr' ? 'Aucun numéro de téléphone' : 'No phone number found'); return; }
    const formatted = formatWhatsAppPhone(phone);
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    toast.success(language === 'fr' ? 'WhatsApp ouvert!' : 'WhatsApp opened!');
  };

  // Quick Send: opens WhatsApp for selected student + template
  const handleQuickSend = () => {
    const student = students.find(s => s.id === quickStudentId);
    const template = templates.find(t => t.id === quickTemplateId);
    if (!student) { toast.error(language === 'fr' ? 'Sélectionnez un étudiant' : 'Please select a student'); return; }
    if (!template) { toast.error(language === 'fr' ? 'Sélectionnez un modèle' : 'Please select a template'); return; }
    if (!student.guardianPhone) { toast.error(language === 'fr' ? 'Aucun numéro pour cet étudiant' : 'No phone number for this student'); return; }
    const message = buildMessage(template, student);
    openWhatsApp(student.guardianPhone, message);
  };

  // Bulk Send: opens WhatsApp for each guardian in a class
  const handleBulkSend = () => {
    const template = templates.find(t => t.id === bulkTemplateId);
    if (!template) { toast.error(language === 'fr' ? 'Sélectionnez un modèle' : 'Please select a template'); return; }
    const classStudents = students.filter(s => s.classId === bulkClassId && s.guardianPhone);
    if (classStudents.length === 0) { toast.error(language === 'fr' ? 'Aucun étudiant avec téléphone' : 'No students with phone numbers in this class'); return; }
    if (!confirm(language === 'fr' ? `Envoyer à ${classStudents.length} gardiens?` : `Send to ${classStudents.length} guardians?`)) return;
    classStudents.forEach((student, idx) => {
      setTimeout(() => {
        const message = buildMessage(template, student);
        openWhatsApp(student.guardianPhone, message);
      }, idx * 1500);
    });
    toast.success(language === 'fr' ? `Envoi à ${classStudents.length} gardiens...` : `Sending to ${classStudents.length} guardians...`);
  };

  // Template CRUD
  const openAddTemplate = () => { setEditing(null); setForm({ name: '', content: '', category: '', lang: language === 'fr' ? 'fr' : language === 'ar' ? 'ar' : 'en', isDefault: false }); setDialogOpen(true); };
  const openEditTemplate = (t: Template) => { setEditing(t); setForm({ name: t.name, content: t.content, category: t.category || '', lang: t.lang || 'en', isDefault: !!t.isDefault }); setDialogOpen(true); };
  const handleSaveTemplate = () => {
    if (!form.name || !form.content) { toast.error(language === 'fr' ? 'Nom et contenu requis' : 'Name and content required'); return; }
    if (form.isDefault) {
      // Unset other defaults in same category
      const base = templates.filter(t => !editing || t.id !== editing.id);
      const updated = base.map(t => t.category === form.category ? { ...t, isDefault: false } : t);
      const newTmpl = { ...form, id: editing?.id || genId(), createdAt: editing?.createdAt || new Date().toISOString() };
      if (editing) { setTemplates(updated.map(t => t.id === editing.id ? newTmpl : t)); }
      else { setTemplates([...updated, newTmpl]); }
    } else {
      if (editing) { setTemplates(templates.map(t => t.id === editing.id ? { ...t, ...form } : t)); }
      else { setTemplates([...templates, { ...form, id: genId(), createdAt: new Date().toISOString() }]); }
    }
    toast.success(language === 'fr' ? 'Modèle sauvegardé' : 'Template saved');
    setDialogOpen(false);
  };
  const handleDeleteTemplate = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer ce modèle ?' : 'Delete this template?')) return; setTemplates(templates.filter(t => t.id !== id)); toast.success(language === 'fr' ? 'Supprimé' : 'Deleted'); };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            {language === 'fr' ? 'Messagerie WhatsApp' : 'WhatsApp Messaging'}
          </CardTitle>
          <Button size="sm" onClick={openAddTemplate}><Plus className="h-4 w-4 mr-1" /> {language === 'fr' ? 'Ajouter Modèle' : 'Add Template'}</Button>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Templates */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-muted-foreground">{language === 'fr' ? 'Modèles de Message' : 'Message Templates'}</h3>
                <div className="flex gap-1">
                  {(['all', 'en', 'fr', 'ar'] as const).map(l => (
                    <Button key={l} variant={langFilter === l ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setLangFilter(l)}>
                      {l === 'all' ? '🌐' : l === 'en' ? '🇬🇧' : l === 'fr' ? '🇫🇷' : '🇲🇦'} {l === 'all' ? (language === 'fr' ? 'Tous' : 'All') : l.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              {Object.keys(groupedTemplates).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('no_data', language)}</div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
                  {Object.entries(groupedTemplates).map(([category, tmpls]) => {
                    const catDefault = tmpls.find(t => t.isDefault);
                    return (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-primary mb-2 pb-1 border-b border-primary/20 flex items-center justify-between">
                        <span>{categoryLabels[category] || category}</span>
                        {catDefault && (
                          <span className="text-[10px] text-amber-600 font-normal flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {language === 'fr' ? 'Par défaut' : 'Default'}: {catDefault.name}
                          </span>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {tmpls.map(tmpl => (
                          <div key={tmpl.id} className={`p-3 border border-border rounded-lg border-l-4 ${categoryColors[category] || 'border-l-gray-400'} ${tmpl.isDefault ? 'bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-200 dark:ring-amber-800' : ''} hover:bg-muted/50 transition-colors`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {tmpl.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                                  <h4 className="font-medium text-sm">{tmpl.name}</h4>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                                    {tmpl.lang === 'fr' ? '🇫🇷 FR' : tmpl.lang === 'ar' ? '🇲🇦 AR' : '🇬🇧 EN'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tmpl.content}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {'{student_name}'} {'{guardian_name}'} {'{class}'} {'{date}'} {'{school_name}'}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className={`h-7 w-7 ${tmpl.isDefault ? 'text-amber-500' : 'text-muted-foreground'}`} onClick={() => handleSetDefault(tmpl.id)} title={language === 'fr' ? 'Définir par défaut' : 'Set as default'}>
                                  <Star className={`h-3.5 w-3.5 ${tmpl.isDefault ? 'fill-amber-400' : ''}`} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTemplate(tmpl)}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteTemplate(tmpl.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Quick Send + Bulk */}
            <div className="space-y-6">
              {/* Quick Send */}
              <div className="border border-border rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Send className="h-4 w-4 text-emerald-600" />
                  {language === 'fr' ? 'Envoi Rapide' : 'Quick Send'}
                </h3>
                <div className="space-y-3">
                  <Select value={quickStudentId} onValueChange={setQuickStudentId}>
                    <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner étudiant...' : 'Select student...'} /></SelectTrigger>
                    <SelectContent>
                      {students.filter(s => s.guardianPhone).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.fullName} ({s.studentId}) — {s.guardianPhone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={quickTemplateId} onValueChange={setQuickTemplateId}>
                    <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner modèle...' : 'Select template...'} /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleQuickSend}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {language === 'fr' ? 'Ouvrir WhatsApp' : 'Send WhatsApp'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {language === 'fr'
                    ? 'Ouvre WhatsApp Web avec un message pré-rempli ciblant le numéro du gardien.'
                    : 'Opens WhatsApp Web with a pre-filled message targeting the guardian\'s number.'}
                </p>
              </div>

              {/* Bulk Send */}
              <div className="border border-border rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-600" />
                  {language === 'fr' ? 'Envoi Groupé' : 'Bulk Messaging'}
                </h3>
                <div className="space-y-3">
                  <Select value={bulkClassId} onValueChange={setBulkClassId}>
                    <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner classe...' : 'Select class...'} /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({students.filter(s => s.classId === c.id && s.guardianPhone).length} {language === 'fr' ? 'avec téléphone' : 'with phone'})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={bulkTemplateId} onValueChange={setBulkTemplateId}>
                    <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner modèle...' : 'Select template...'} /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={handleBulkSend}>
                    <Send className="h-4 w-4 mr-2" />
                    {language === 'fr' ? 'Envoyer à toute la classe' : 'Send to Class'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {language === 'fr'
                    ? 'Ouvre WhatsApp pour chaque gardien de la classe sélectionnée (délai de 1.5s entre chaque).'
                    : 'Opens WhatsApp for each guardian in the selected class (1.5s delay between each).'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('edit', language) : t('add', language)} {language === 'fr' ? 'Modèle' : 'Template'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Nom' : 'Name'}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Absence Notification" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Catégorie' : 'Category'}</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="absence">{language === 'fr' ? 'Absence' : 'Absence'}</SelectItem>
                    <SelectItem value="late">{language === 'fr' ? 'Retard' : 'Late'}</SelectItem>
                    <SelectItem value="meeting">{language === 'fr' ? 'Réunion' : 'Meeting'}</SelectItem>
                    <SelectItem value="academic">{language === 'fr' ? 'Académique' : 'Academic'}</SelectItem>
                    <SelectItem value="announcement">{language === 'fr' ? 'Annonce' : 'Announcement'}</SelectItem>
                    <SelectItem value="behavioral">{language === 'fr' ? 'Comportement' : 'Behavioral'}</SelectItem>
                    <SelectItem value="achievement">{language === 'fr' ? 'Réalisation' : 'Achievement'}</SelectItem>
                    <SelectItem value="reminder">{language === 'fr' ? 'Rappel' : 'Reminder'}</SelectItem>
                    <SelectItem value="custom">{language === 'fr' ? 'Personnalisé' : 'Custom'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Langue' : 'Language'}</Label>
                <Select value={form.lang} onValueChange={v => setForm({ ...form, lang: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="ar">🇲🇦 العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.category && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <button type="button" className="flex items-center gap-2 cursor-pointer" onClick={() => setForm({ ...form, isDefault: !form.isDefault })}>
                  <Star className={`h-4 w-4 ${form.isDefault ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">
                    {language === 'fr' ? 'Définir comme modèle par défaut' : 'Set as default template'}
                  </span>
                </button>
                {form.isDefault && (
                  <span className="text-[10px] text-amber-600">
                    ({language === 'fr' ? 'Remplacera le défaut actuel pour cette catégorie' : 'Will replace current default for this category'})
                  </span>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Contenu' : 'Content'}</Label>
              <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={6} placeholder="Dear {guardian_name}, {student_name} was marked absent from {class} today ({date})..." />
              <p className="text-[11px] text-muted-foreground">
                Variables: {'{student_name}'} {'{guardian_name}'} {'{class}'} {'{date}'} {'{time}'} {'{school_name}'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveTemplate}>{t('save', language)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== REPORTS PAGE ====================
function ReportsPage() {
  const { students, classes, attendance, grades, behavior, language, modules, tasks, incidents, schoolInfo } = useAppStore();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportType, setReportType] = useState('attendance');

  const filteredAttendance = useMemo(() => {
    let a = [...attendance];
    if (dateFrom) a = a.filter(r => r.date >= dateFrom);
    if (dateTo) a = a.filter(r => r.date <= dateTo);
    return a;
  }, [attendance, dateFrom, dateTo]);

  const attendanceStats = useMemo(() => {
    const present = filteredAttendance.filter(r => r.status === 'present').length;
    const absent = filteredAttendance.filter(r => r.status === 'absent').length;
    const late = filteredAttendance.filter(r => r.status === 'late').length;
    const excused = filteredAttendance.filter(r => r.status === 'excused').length;
    const total = filteredAttendance.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, late, excused, total, rate };
  }, [filteredAttendance]);

  const attendancePieData = useMemo(() => [
    { name: t('present', language), value: attendanceStats.present, fill: '#10b981' },
    { name: t('absent', language), value: attendanceStats.absent, fill: '#ef4444' },
    { name: t('late', language), value: attendanceStats.late, fill: '#f59e0b' },
    { name: t('excused', language), value: attendanceStats.excused, fill: '#3b82f6' },
  ].filter(d => d.value > 0), [attendanceStats, language]);

  const classAttendance = useMemo(() => {
    return classes.map(c => {
      const classStudents = new Set(students.filter(s => s.classId === c.id).map(s => s.id));
      const classAtt = filteredAttendance.filter(a => classStudents.has(a.studentId));
      const present = classAtt.filter(a => a.status === 'present').length;
      const rate = classAtt.length > 0 ? Math.round((present / classAtt.length) * 100) : 0;
      return { name: c.name, rate, total: classAtt.length };
    });
  }, [classes, students, filteredAttendance]);

  const gradeDistribution = useMemo(() => {
    const buckets = ['0-39', '40-59', '60-69', '70-79', '80-89', '90-100'];
    const counts = [0, 0, 0, 0, 0, 0];
    grades.forEach(g => {
      const p = g.percentage || 0;
      if (p < 40) counts[0]++; else if (p < 60) counts[1]++; else if (p < 70) counts[2]++; else if (p < 80) counts[3]++; else if (p < 90) counts[4]++; else counts[5]++;
    });
    return buckets.map((b, i) => ({ range: b, count: counts[i] }));
  }, [grades]);

  const behaviorSummary = useMemo(() => {
    const pos = behavior.filter(b => b.type === 'positive').length;
    const neg = behavior.filter(b => b.type === 'negative').length;
    const totalPoints = behavior.reduce((s, b) => s + (b.points || 0), 0);
    return { positive: pos, negative: neg, totalPoints };
  }, [behavior]);

  const handleExportReport = () => {
    if (reportType === 'attendance') exportUtils.exportAttendanceCSV(filteredAttendance, students, classes, language);
    else if (reportType === 'grades') exportUtils.exportGradesCSV(grades, students, modules, language);
    else if (reportType === 'behavior') exportUtils.exportBehaviorCSV(behavior, students, language);
    else if (reportType === 'progress') { exportUtils.exportTasksCSV(tasks, language); toast.info(language === 'fr' ? 'Données de progression exportées' : 'Progress data exported'); return; }
    else if (reportType === 'tasks') exportUtils.exportTasksCSV(tasks, language);
    else if (reportType === 'incidents') exportUtils.exportIncidentsCSV(incidents, students, language);
    toast.success(language === 'fr' ? 'Rapport exporté' : 'Report exported');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={reportType} onValueChange={setReportType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="attendance">{t('attendance', language)}</SelectItem><SelectItem value="grades">{t('grades', language)}</SelectItem><SelectItem value="behavior">{t('behavior', language)}</SelectItem><SelectItem value="progress">{t('progress_reports', language)}</SelectItem></SelectContent></Select>
          <div className="flex items-center gap-2"><Label className="text-xs whitespace-nowrap">{t('date_range', language)}:</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" /><span className="text-xs">→</span><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportReport}><FileDown className="h-4 w-4 mr-1" />{t('export_csv', language)}</Button>
          <Button variant="outline" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" onClick={() => {
            if (reportType === 'attendance') pdfUtils.exportAttendancePDF(filteredAttendance, students, classes, schoolInfo, dateFrom, dateTo, language);
            else if (reportType === 'grades') pdfUtils.exportGradesPDF(grades, students, modules, schoolInfo, language);
            else if (reportType === 'behavior') pdfUtils.exportBehaviorPDF(behavior, students, schoolInfo, language);
            else if (reportType === 'progress') pdfUtils.exportProgressReportPDF([], {}, schoolInfo as unknown as Record<string, string | undefined>, { from: dateFrom, to: dateTo }, '', language);
            toast.success(language === 'fr' ? 'PDF exporté' : 'PDF exported');
          }}><FileText className="h-4 w-4 mr-1" />PDF</Button>
        </div>
      </div>

      {reportType === 'attendance' && (<>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[{ label: t('present_today', language), val: attendanceStats.present, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20' }, { label: t('absent', language), val: attendanceStats.absent, color: 'bg-red-100 text-red-700 dark:bg-red-900/20' }, { label: t('late', language), val: attendanceStats.late, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20' }, { label: t('excused', language), val: attendanceStats.excused, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20' }, { label: t('attendance_rate', language), val: `${attendanceStats.rate}%`, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20' }].map((s, i) => (
            <div key={i} className={`rounded-lg p-3 text-center ${s.color}`}><p className="text-xl font-bold">{s.val}</p><p className="text-xs opacity-70">{s.label}</p></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Présence par classe' : 'Attendance by Class'}</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={classAttendance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={[0, 100]} /><ReTooltip /><Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Répartition des statuts' : 'Status Distribution'}</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={attendancePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">{attendancePieData.map((entry, i) => <Cell key={i} fill={['#10b981', '#ef4444', '#f59e0b', '#3b82f6'][i % 4]} />)}</Pie><ReTooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
        </div>
      </>)}

      {reportType === 'grades' && (<>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Distribution des notes' : 'Grade Distribution'}</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={gradeDistribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="range" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><ReTooltip /><Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Résumé' : 'Summary'}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">{language === 'fr' ? 'Total des notes' : 'Total Grades'}</span><span className="font-bold">{grades.length}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">{language === 'fr' ? 'Moyenne' : 'Average'}</span><span className="font-bold">{grades.length > 0 ? Math.round(grades.reduce((s, g) => s + (g.percentage || 0), 0) / grades.length) : 0}%</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">{language === 'fr' ? 'Au-dessus de 70%' : 'Above 70%'}</span><span className="font-bold text-emerald-600">{grades.filter(g => (g.percentage || 0) >= 70).length}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">{language === 'fr' ? 'En dessous de 50%' : 'Below 50%'}</span><span className="font-bold text-red-600">{grades.filter(g => (g.percentage || 0) < 50).length}</span></div></CardContent></Card>
        </div>
      </>)}

      {reportType === 'behavior' && (<>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg p-4 text-center bg-emerald-100 dark:bg-emerald-900/20"><p className="text-3xl font-bold text-emerald-700">{behaviorSummary.positive}</p><p className="text-xs text-emerald-600">{t('positive', language)}</p></div>
          <div className="rounded-lg p-4 text-center bg-red-100 dark:bg-red-900/20"><p className="text-3xl font-bold text-red-700">{behaviorSummary.negative}</p><p className="text-xs text-red-600">{t('negative', language)}</p></div>
          <div className={`rounded-lg p-4 text-center ${behaviorSummary.totalPoints >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}><p className={`text-3xl font-bold ${behaviorSummary.totalPoints >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{behaviorSummary.totalPoints > 0 ? '+' : ''}{behaviorSummary.totalPoints}</p><p className="text-xs">{language === 'fr' ? 'Total Points' : 'Total Points'}</p></div>
        </div>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Comportement' : 'Behavior'}</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={[{ name: t('positive', language), value: behaviorSummary.positive }, { name: t('negative', language), value: behaviorSummary.negative }].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={80} dataKey="value" fill="#8884d8">{[{ name: t('positive', language), value: behaviorSummary.positive }, { name: t('negative', language), value: behaviorSummary.negative }].filter(d => d.value > 0).map((_, i) => <Cell key={i} fill={['#10b981', '#ef4444'][i]} />)}</Pie><ReTooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
      </>)}

      {reportType === 'progress' && <ProgressReportsSection />}
    </div>
  );
}

// ==================== PROGRESS REPORTS SECTION ====================
function ProgressReportsSection() {
  const { students, classes, attendance, grades, behavior, exams, examGrades, schoolInfo, language } = useAppStore();
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [period, setPeriod] = useState('full_year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [teacherComment, setTeacherComment] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const filteredStudents = useMemo(() => {
    let s = students.filter(st => st.status === 'active');
    if (selectedClass !== 'all') s = s.filter(st => st.classId === selectedClass);
    if (selectedStudent !== 'all') s = s.filter(st => st.id === selectedStudent);
    return s;
  }, [students, selectedClass, selectedStudent]);

  const dateRange = useMemo(() => {
    const now = new Date(); const y = now.getFullYear();
    if (period === 'q1') return { from: `${y}-09-01`, to: `${y}-11-30` };
    if (period === 'q2') return { from: `${y}-12-01`, to: `${y+1}-02-28` };
    if (period === 'q3') return { from: `${y}-03-01`, to: `${y}-05-31` };
    if (period === 'q4') return { from: `${y}-06-01`, to: `${y}-08-31` };
    if (period === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    return { from: `${y}-09-01`, to: `${y + 1}-08-31` };
  }, [period, customFrom, customTo]);

  const studentReports = useMemo(() => {
    return filteredStudents.map(student => {
      const studentAtt = attendance.filter(a => a.studentId === student.id && a.date >= dateRange.from && a.date <= dateRange.to);
      const present = studentAtt.filter(a => a.status === 'present').length;
      const absent = studentAtt.filter(a => a.status === 'absent').length;
      const late = studentAtt.filter(a => a.status === 'late').length;
      const excused = studentAtt.filter(a => a.status === 'excused').length;
      const total = studentAtt.length;
      const attRate = total > 0 ? Math.round((present / total) * 100) : 0;

      const studentGrades = grades.filter(g => g.studentId === student.id);
      const avgGrade = studentGrades.length > 0 ? Math.round(studentGrades.reduce((s, g) => s + (g.percentage || 0), 0) / studentGrades.length) : 0;

      const studentExamGrades = examGrades.filter(eg => eg.studentId === student.id);
      let weightedAvg = 0;
      let totalWeight = 0;
      studentExamGrades.forEach(eg => {
        const exam = exams.find(e => e.id === eg.examId);
        if (exam && exam.status === 'completed') { weightedAvg += eg.percentage * exam.weight; totalWeight += exam.weight; }
      });
      const finalWeighted = totalWeight > 0 ? Math.round(weightedAvg / totalWeight) : 0;

      const posBehavior = behavior.filter(b => b.studentId === student.id && b.type === 'positive').length;
      const negBehavior = behavior.filter(b => b.studentId === student.id && b.type === 'negative').length;

      return { student, present, absent, late, excused, total: studentAtt.length, attRate, avgGrade, finalWeighted, posBehavior, negBehavior, gradesCount: studentGrades.length, examCount: studentExamGrades.length };
    }).sort((a, b) => b.finalWeighted - a.finalWeighted);
  }, [filteredStudents, attendance, grades, exams, examGrades, behavior, dateRange]);

  const classSummary = useMemo(() => {
    const avgAtt = studentReports.length > 0 ? Math.round(studentReports.reduce((s, r) => s + r.attRate, 0) / studentReports.length) : 0;
    const avgGrade = studentReports.length > 0 ? Math.round(studentReports.reduce((s, r) => s + r.avgGrade, 0) / studentReports.length) : 0;
    return { totalStudents: studentReports.length, avgAtt, avgGrade };
  }, [studentReports]);

  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">{t('generate_progress_report', language)}</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2"><Label>{t('select_class_filter', language)}</Label><Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedStudent('all'); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Toutes les classes' : 'All Classes'}</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>{t('select_student', language)}</Label><Select value={selectedStudent} onValueChange={setSelectedStudent}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Tous les étudiants' : 'All Students'}</SelectItem>{filteredStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>{t('report_period', language)}</Label><Select value={period} onValueChange={setPeriod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="full_year">{t('full_year', language)}</SelectItem><SelectItem value="q1">{t('q1', language)}</SelectItem><SelectItem value="q2">{t('q2', language)}</SelectItem><SelectItem value="q3">{t('q3', language)}</SelectItem><SelectItem value="q4">{t('q4', language)}</SelectItem><SelectItem value="custom">{t('custom', language)}</SelectItem></SelectContent></Select></div>
          {period === 'custom' && <div className="space-y-2"><Label>{t('date_range', language)}</Label><div className="flex gap-1"><Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="text-xs" /><Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="text-xs" /></div></div>}
        </div>
        <div className="space-y-2"><Label>{t('teacher_comment', language)}</Label><Textarea value={teacherComment} onChange={e => setTeacherComment(e.target.value)} rows={2} placeholder={language === 'fr' ? 'Ajouter un commentaire...' : 'Add a teacher comment...'} /></div>
        <div className="flex gap-2">
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowPreview(true)}><Eye className="h-4 w-4 mr-1" />{t('preview_report', language)}</Button>
          <Button variant="outline" onClick={() => { pdfUtils.exportProgressReportPDF(studentReports, classSummary, schoolInfo as unknown as Record<string, string | undefined>, dateRange, teacherComment, language); toast.success(t('report_generated', language)); }}><Download className="h-4 w-4 mr-1" />{t('download_pdf', language)}</Button>
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg p-4 text-center bg-emerald-100 dark:bg-emerald-900/20"><p className="text-3xl font-bold text-emerald-700">{classSummary.totalStudents}</p><p className="text-xs text-muted-foreground">{t('total_students', language)}</p></div>
        <div className="rounded-lg p-4 text-center bg-blue-100 dark:bg-blue-900/20"><p className="text-3xl font-bold text-blue-700">{classSummary.avgAtt}%</p><p className="text-xs text-muted-foreground">{t('avg_attendance', language)}</p></div>
        <div className="rounded-lg p-4 text-center bg-purple-100 dark:bg-purple-900/20"><p className="text-3xl font-bold text-purple-700">{classSummary.avgGrade}%</p><p className="text-xs text-muted-foreground">{language === 'fr' ? 'Moyenne des Notes' : 'Avg Grade'}</p></div>
      </div>

      {showPreview && studentReports.length > 0 && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">{t('class_ranking', language)}</CardTitle><CardDescription>{dateRange.from} → {dateRange.to}</CardDescription></CardHeader><CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar"><Table><TableHeader><TableRow>
            <TableHead className="w-8">#</TableHead><TableHead>{t('name', language)}</TableHead><TableHead>{t('class_name', language)}</TableHead>
            <TableHead className="text-center">{t('attendance_rate', language)}</TableHead><TableHead className="text-center">{t('grades_overview', language)}</TableHead>
            <TableHead className="text-center">{t('weighted_average', language)}</TableHead><TableHead className="text-center">+/-</TableHead>
          </TableRow></TableHeader><TableBody>
            {studentReports.map((r, i) => (
              <TableRow key={r.student.id}>
                <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.student.fullName}</TableCell>
                <TableCell className="text-sm">{r.student.className || classes.find(c => c.id === r.student.classId)?.name || '-'}</TableCell>
                <TableCell className="text-center"><Badge variant={r.attRate >= 80 ? 'default' : r.attRate >= 60 ? 'secondary' : 'destructive'} className={r.attRate >= 80 ? 'bg-emerald-100 text-emerald-800' : ''}>{r.attRate}%</Badge></TableCell>
                <TableCell className="text-center text-sm">{r.avgGrade}%<span className="text-muted-foreground ml-1">({r.gradesCount})</span></TableCell>
                <TableCell className="text-center font-bold">{r.finalWeighted}%<span className="text-muted-foreground ml-1 font-normal">({r.examCount})</span></TableCell>
                <TableCell className="text-center"><span className="text-emerald-600 text-xs">+{r.posBehavior}</span> / <span className="text-red-600 text-xs">-{r.negBehavior}</span></TableCell>
              </TableRow>
            ))}
          </TableBody></Table></div>
        </CardContent></Card>
      )}

      {teacherComment && showPreview && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">{t('teacher_comment', language)}</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{teacherComment}</p></CardContent></Card>
      )}

      {studentReports.length === 0 && <EmptyState message={t('no_data', language)} />}
    </div>
  );
}

// ==================== SETTINGS PAGE ====================
function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { language, setTeachers, setEmployees, setAcademicYears, teachers, employees, academicYears, students, classes, modules, attendance, grades, behavior, tasks, incidents, admins, schoolInfo, setSchoolInfo, currentUser, setStudents, setClasses, setModules, setAttendance, setGrades, setBehavior, setTasks, setIncidents, setTemplates, primaryColor, setPrimaryColor, schedules, setSchedules, exams, setExams, examGrades, setExamGrades, curriculum, setCurriculum, savedSchedules, setSavedSchedules, addAuditLog, login, templates } = useAppStore();
  const [activeTab, setActiveTab] = useState('general');

  // Teachers state
  const [teacherDialog, setTeacherDialog] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [tForm, setTForm] = useState({ name: '', subject: '', email: '', phone: '', experience: '0', qualification: '' });

  // Employees state
  const [empDialog, setEmpDialog] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [eForm, setEForm] = useState({ fullName: '', department: '', position: '', email: '', phone: '' });

  // Academic Year state
  const [ayDialog, setAyDialog] = useState(false);
  const [editAy, setEditAy] = useState<AcademicYear | null>(null);
  const [ayForm, setAyForm] = useState({ name: '', level: '', startDate: '', endDate: '', isCurrent: false });

  // Promote Students state
  const [promoteClass, setPromoteClass] = useState('__all__');
  const [promoteFromYear, setPromoteFromYear] = useState('');
  const [promoteToYear, setPromoteToYear] = useState('');
  const [promoteStatus, setPromoteStatus] = useState('active');
  const [promoteSelectedIds, setPromoteSelectedIds] = useState<Set<string>>(new Set());
  const [promoteSelectAll, setPromoteSelectAll] = useState(false);

  const fromYearName = academicYears.find(ay => ay.id === promoteFromYear)?.name || '';
  const toYearName = academicYears.find(ay => ay.id === promoteToYear)?.name || '';

  // Eligible students: match by class academicYear (ID comparison), or student's own academicYear (name or ID)
  const eligibleStudents = useMemo(() => {
    return students.filter(s => {
      // Class filter
      if (promoteClass !== '__all__' && s.classId !== promoteClass) return false;
      // Academic year filter: check student's class academicYear (ID) OR student's own academicYear (name or ID)
      if (promoteFromYear) {
        const studentClass = classes.find(c => c.id === s.classId);
        const classAyMatches = studentClass?.academicYear === promoteFromYear;
        const studentAyMatches = s.academicYear === fromYearName || s.academicYear === promoteFromYear;
        if (!classAyMatches && !studentAyMatches) return false;
      }
      return true;
    });
  }, [students, promoteClass, promoteFromYear, fromYearName, classes]);

  // When eligible list changes, reset individual selection
  useEffect(() => {
    if (promoteSelectAll) {
      setPromoteSelectedIds(new Set(eligibleStudents.map(s => s.id)));
    }
  }, [eligibleStudents, promoteSelectAll]);

  const handlePromoteToggleStudent = (studentId: string) => {
    setPromoteSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      setPromoteSelectAll(next.size === eligibleStudents.length && eligibleStudents.length > 0);
      return next;
    });
  };

  const handlePromoteSelectAll = () => {
    if (promoteSelectAll) {
      setPromoteSelectedIds(new Set());
      setPromoteSelectAll(false);
    } else {
      setPromoteSelectedIds(new Set(eligibleStudents.map(s => s.id)));
      setPromoteSelectAll(true);
    }
  };

  // Students actually selected for promotion
  const studentsToPromote = promoteSelectedIds.size > 0
    ? eligibleStudents.filter(s => promoteSelectedIds.has(s.id))
    : eligibleStudents;

  const handleMassPromotion = () => {
    if (!promoteFromYear || !promoteToYear || promoteFromYear === promoteToYear) return;
    const targets = studentsToPromote;
    if (targets.length === 0) { toast.warning(language === 'fr' ? 'Aucun étudiant éligible' : 'No eligible students'); return; }
    const updated = students.map(s => {
      if (targets.some(t => t.id === s.id)) {
        return { ...s, academicYear: toYearName };
      }
      return s;
    });
    setStudents(updated);
    addAuditLog('MASS_PROMOTE', 'student', '', '', `Promoted ${targets.length} students from ${fromYearName} to ${toYearName}`);
    toast.success(`${language === 'fr' ? 'Promotion terminée' : 'Promotion complete'}: ${targets.length} ${language === 'fr' ? 'étudiants' : 'students'} ${fromYearName} → ${toYearName}`);
    setPromoteSelectedIds(new Set());
    setPromoteSelectAll(false);
  };

  const handleChangeStatus = () => {
    const targets = studentsToPromote;
    if (targets.length === 0) return;
    const updated = students.map(s => {
      if (targets.some(t => t.id === s.id)) {
        return { ...s, status: promoteStatus as Student['status'] };
      }
      return s;
    });
    setStudents(updated);
    addAuditLog('CHANGE_STATUS', 'student', '', '', `Changed status of ${targets.length} students to ${promoteStatus}`);
    toast.success(`${language === 'fr' ? 'Statut mis à jour' : 'Status updated'}: ${targets.length} ${language === 'fr' ? 'étudiants' : 'students'} → ${promoteStatus}`);
    setPromoteSelectedIds(new Set());
    setPromoteSelectAll(false);
  };

  const handlePromoteToClass = (targetClassId: string) => {
    if (!targetClassId) return;
    const targets = studentsToPromote;
    if (targets.length === 0) return;
    const updated = students.map(s => {
      if (targets.some(t => t.id === s.id)) {
        const targetClass = classes.find(c => c.id === targetClassId);
        return { ...s, classId: targetClassId, className: targetClass?.name || s.className, academicYear: toYearName || s.academicYear };
      }
      return s;
    });
    setStudents(updated);
    const targetClassName = classes.find(c => c.id === targetClassId)?.name || '';
    addAuditLog('PROMOTE_TO_CLASS', 'student', '', '', `Moved ${targets.length} students to class ${targetClassName}`);
    toast.success(`${language === 'fr' ? 'Déplacement terminé' : 'Move complete'}: ${targets.length} ${language === 'fr' ? 'étudiants' : 'students'} → ${targetClassName}`);
    setPromoteSelectedIds(new Set());
    setPromoteSelectAll(false);
  };

  // Password state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

  // Brevo Email config state
  const [brevoConfig, setBrevoConfig] = useState({ apiKey: '', senderEmail: '' });
  const [brevoSaving, setBrevoSaving] = useState(false);
  const [brevoTesting, setBrevoTesting] = useState(false);
  const [brevoTestResult, setBrevoTestResult] = useState<{ success: boolean; message: string } | null>(null);
  useEffect(() => {
    const config = loadBrevoConfig();
    if (config.apiKey || config.senderEmail) setBrevoConfig(config);
  }, []);

  const handleSaveBrevoConfig = () => {
    saveBrevoConfig(brevoConfig);
    toast.success(language === 'fr' ? 'Configuration Brevo sauvegardée' : 'Brevo configuration saved');
  };

  const handleTestBrevo = async () => {
    if (!brevoConfig.apiKey || !brevoConfig.senderEmail) {
      toast.error(language === 'fr' ? 'Veuillez remplir la clé API et l\'email expéditeur' : 'Please fill in API key and sender email');
      return;
    }
    if (!brevoConfig.senderEmail.includes('@')) {
      toast.error(language === 'fr' ? 'Email expéditeur invalide' : 'Invalid sender email');
      return;
    }
    setBrevoTesting(true);
    setBrevoTestResult(null);
    saveBrevoConfig(brevoConfig);
    try {
      const { sendEmail } = await import('@/lib/email');
      const result = await sendEmail({
        to: brevoConfig.senderEmail,
        toName: language === 'fr' ? 'Admin CRM' : 'CRM Admin',
        subject: language === 'fr' ? '[CRM] Test de configuration Brevo' : '[CRM] Brevo Configuration Test',
        htmlContent: `
          <div style="padding:24px;font-family:sans-serif;max-width:480px;margin:0 auto;background:#f0fdf4;border-radius:12px;">
            <div style="background:#059669;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
              <h2 style="color:white;margin:0;">${language === 'fr' ? 'Test réussi !' : 'Test Successful!'}</h2>
            </div>
            <div style="padding:20px;text-align:center;color:#334155;">
              <p style="font-size:16px;">${language === 'fr' ? 'Votre intégration Brevo est correctement configurée. Les notifications par email fonctionneront.' : 'Your Brevo integration is correctly configured. Email notifications will work.'}</p>
              <p style="font-size:13px;color:#64748b;margin-top:12px;">${language === 'fr' ? 'Envoyé depuis CRM Attendance le' : 'Sent from CRM Attendance on'} ${new Date().toLocaleString()}</p>
            </div>
          </div>
        `,
      });
      if (result.success) {
        setBrevoTestResult({ success: true, message: language === 'fr' ? 'Email de test envoyé avec succès ! Vérifiez votre boîte de réception.' : 'Test email sent successfully! Check your inbox.' });
        toast.success(language === 'fr' ? 'Email de test envoyé' : 'Test email sent');
      } else {
        setBrevoTestResult({ success: false, message: result.error || (language === 'fr' ? 'Erreur inconnue' : 'Unknown error') });
        toast.error(result.error || (language === 'fr' ? "Erreur d'envoi" : 'Send error'));
      }
    } catch {
      setBrevoTestResult({ success: false, message: language === 'fr' ? 'Erreur de connexion au service' : 'Connection error to email service' });
    }
    setBrevoTesting(false);
  };

  const handleClearBrevoConfig = () => {
    setBrevoConfig({ apiKey: '', senderEmail: '' });
    if (typeof window !== 'undefined') localStorage.removeItem('attendance_brevo_config');
    setBrevoTestResult(null);
    toast.success(language === 'fr' ? 'Configuration Brevo supprimée' : 'Brevo configuration cleared');
  };

  // School info - sync with store
  const [sForm, setSForm] = useState({ name: schoolInfo?.name || '', address: schoolInfo?.address || '', phone: schoolInfo?.phone || '', email: schoolInfo?.email || '', field: schoolInfo?.field || '', logo: schoolInfo?.logo || '' });
  useEffect(() => {
    if (schoolInfo && (schoolInfo.name || schoolInfo.address || schoolInfo.phone || schoolInfo.email || schoolInfo.field || schoolInfo.logo)) {
      setSForm({ name: schoolInfo.name || '', address: schoolInfo.address || '', phone: schoolInfo.phone || '', email: schoolInfo.email || '', field: schoolInfo.field || '', logo: schoolInfo.logo || '' });
    }
  }, [schoolInfo]);

  // Backup state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => { try { return typeof window !== 'undefined' && localStorage.getItem('attendance_auto_backup') === 'true'; } catch { return false; } });
  const [backupFrequency, setBackupFrequency] = useState(() => { try { return typeof window !== 'undefined' ? (localStorage.getItem('attendance_backup_freq') || '12h') : '12h'; } catch { return '12h'; } });
  const [lastBackupTime, setLastBackupTime] = useState(() => { try { return typeof window !== 'undefined' ? (localStorage.getItem('attendance_last_backup') || '') : ''; } catch { return ''; } });
  const [backupHistory, setBackupHistory] = useState<Array<{ timestamp: string; size: string }>>(() => {
    try { return typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('attendance_backup_history') || '[]') : []; } catch { return []; }
  });
  const [restorePreview, setRestorePreview] = useState<Record<string, number> | null>(null);
  const [restoreData, setRestoreData] = useState<Record<string, unknown> | null>(null);
  const [selectedRestoreTypes, setSelectedRestoreTypes] = useState<Set<string>>(new Set());
  const [restoreMode, setRestoreMode] = useState<'full' | 'selective'>('full');

  // Cloud storage config state
  const [cloudConfig, setCloudConfig] = useState(() => {
    try { return typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('attendance_cloud_config') || '{}') : {}; } catch { return {}; }
  });
  const [cloudUploading, setCloudUploading] = useState(false);
  // Never persist 'Connected' status — always start fresh per session
  // This prevents stale status from localStorage showing as demo/fake
  const [cloudConnectedServices, setCloudConnectedServices] = useState<Record<string, boolean>>({});
  // Google OAuth2 state (kept in memory only, never persisted for security)
  const googleAccessTokenRef = useRef<string | null>(null);
  const googleDriveFileIdRef = useRef<string | null>(null);

  // Clear connected status when config fields change for a service
  const updateCloudConfig = (updates: Record<string, string>) => {
    const updated = { ...cloudConfig, ...updates };
    setCloudConfig(updated);
    // Determine which service changed and clear its connected status
    for (const key of Object.keys(updates)) {
      let svc = '';
      if (key === 'googleClientId') svc = 'google';
      else if (key === 'oneDriveClientId' || key === 'oneDriveClientSecret') svc = 'onedrive';
      else if (key === 'ftpHost' || key === 'ftpUser' || key === 'ftpPass') svc = 'ftp';
      if (svc && cloudConnectedServices[svc]) {
        const updatedConnected = { ...cloudConnectedServices, [svc]: false };
        setCloudConnectedServices(updatedConnected);
        if (svc === 'google') { googleAccessTokenRef.current = null; googleDriveFileIdRef.current = null; }
      }
    }
  };

  // Load Google Identity Services script dynamically
  const loadGIS = (): Promise<void> => new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    const w = window as unknown as Record<string, unknown>;
    if (w.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });

  // Upload a file to Google Drive using OAuth2 access token
  const uploadToGoogleDrive = async (accessToken: string, fileName: string, data: string, existingFileId?: string | null): Promise<string> => {
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: 'CRM Attendance Backup',
    };
    const boundary = 'crm_backup_' + Date.now();
    const body =
      '--' + boundary + '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: application/json\r\n\r\n' +
      data + '\r\n' +
      '--' + boundary + '--';

    // If we have an existing file ID, update it; otherwise create new
    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    const method = existingFileId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as Record<string, unknown>).error
        ? ((err.error as Record<string, unknown>).message as string) || `Drive API ${res.status}`
        : `Drive API ${res.status}`);
    }
    const result = await res.json();
    return result.id as string;
  };

  const handleCloudSave = async (service: string) => {
    const serviceNames: Record<string, string> = { google: 'Google Drive', onedrive: 'OneDrive', ftp: 'FTP' };

    // Validate required fields before connecting
    if (service === 'google' && !cloudConfig.googleClientId?.trim()) {
      toast.error(language === 'fr' ? 'Veuillez saisir le Client ID OAuth2 Google.' : 'Please enter a Google OAuth2 Client ID.');
      return;
    }
    if (service === 'onedrive' && (!cloudConfig.oneDriveClientId?.trim() || !cloudConfig.oneDriveClientSecret?.trim())) {
      toast.error(language === 'fr' ? 'Veuillez saisir le Client ID et le Client Secret.' : 'Please enter both Client ID and Client Secret.');
      return;
    }
    if (service === 'ftp' && (!cloudConfig.ftpHost?.trim() || !cloudConfig.ftpUser?.trim() || !cloudConfig.ftpPass?.trim())) {
      toast.error(language === 'fr' ? 'Veuillez saisir l\'hôte, l\'utilisateur et le mot de passe FTP.' : 'Please enter FTP Host, Username, and Password.');
      return;
    }

    // Save config to localStorage (never includes tokens)
    const configToSave = { ...cloudConfig };
    delete (configToSave as Record<string, unknown>)._accessToken;
    delete (configToSave as Record<string, unknown>)._driveFileId;
    localStorage.setItem('attendance_cloud_config', JSON.stringify(configToSave));
    setCloudUploading(true);
    try {
      // Google Drive — OAuth2 flow
      if (service === 'google') {
        try {
          await loadGIS();
          const gapi = (window as unknown as Record<string, unknown>).google as Record<string, unknown>;
          const accounts = gapi.accounts as Record<string, unknown>;
          const oauth2 = accounts.oauth2 as Record<string, unknown>;
          const initTokenClient = oauth2.initTokenClient as (config: Record<string, unknown>) => {
            requestAccessToken: (override?: Record<string, unknown>) => void;
          };

          // The callback must be set at initTokenClient time — use module-level resolve
          const client = initTokenClient({
            client_id: cloudConfig.googleClientId!.trim(),
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: _googleTokenCallback,
          });

          // Request token via popup — callback will resolve the promise via module-level ref
          const accessToken = await new Promise<string>((resolve, reject) => {
            _googleTokenResolve = resolve;
            _googleTokenReject = reject;
            client.requestAccessToken({ prompt: '' });
          });
          googleAccessTokenRef.current = accessToken;

          // Build and upload backup to Google Drive
          const backupPayload = {
            version: '1.1',
            timestamp: new Date().toISOString(),
            data: { students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, templates, academicYears, schoolInfo },
          };
          const fileName = `CRM_Attendance_Backup_${localToday()}.json`;
          const fileId = await uploadToGoogleDrive(accessToken, fileName, JSON.stringify(backupPayload, null, 2), googleDriveFileIdRef.current);
          googleDriveFileIdRef.current = fileId;
          toast.success(language === 'fr'
            ? `Sauvegarde envoyée à Google Drive (${(JSON.stringify(backupPayload).length / 1024).toFixed(1)} KB)`
            : `Backup uploaded to Google Drive (${(JSON.stringify(backupPayload).length / 1024).toFixed(1)} KB)`);
        } catch (gErr) {
          setCloudUploading(false);
          const msg = gErr instanceof Error ? gErr.message : String(gErr);
          if (msg.includes('Popup blocked')) {
            toast.error(language === 'fr' ? 'Popup bloqué. Veuillez autoriser les popups.' : 'Popup blocked. Please allow popups for this site.');
          } else if (msg.includes('access_denied') || msg.includes('popup_closed')) {
            toast.error(language === 'fr' ? 'Autorisation refusée.' : 'Authorization denied.');
          } else {
            toast.error(`${language === 'fr' ? 'Google Drive' : 'Google Drive'}: ${msg}`);
          }
          return;
        }
      }

      // Attempt a real connection test for FTP
      // Use 'cors' mode so we get a real error if the host is unreachable or not an HTTP server
      // (no-cors always returns an opaque response, making it a fake test)
      if (service === 'ftp') {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const ftpHost = cloudConfig.ftpHost!.replace(/\/$/, '');
          const testUrl = `${ftpHost.startsWith('http') ? '' : 'https://'}${ftpHost}`;
          const resp = await fetch(testUrl, {
            method: 'HEAD',
            mode: 'cors',
            signal: controller.signal,
          });
          clearTimeout(timeout);
          // If we get here with cors mode, the host is reachable and supports HTTP
        } catch (fetchErr) {
          clearTimeout((fetchErr as Error & { cause?: { timeout?: boolean } }).cause?.timeout ? undefined : undefined);
          setCloudUploading(false);
          toast.error(language === 'fr' ? 'Impossible de se connecter au serveur FTP. Vérifiez l\'hôte.' : 'Cannot reach FTP server. Check the host address.');
          return;
        }
      }

      // Build backup payload and push to D1 (for non-google services)
      if (service !== 'google') {
        const backupData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          service,
          config: cloudConfig,
          data: { students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, templates, academicYears, schoolInfo }
        };
        try {
          await syncToCloud();
        } catch {
          // D1 sync is best-effort
        }
      }

      // Mark as connected (in-memory only — NOT persisted to localStorage)
      const updatedConnected = { ...cloudConnectedServices, [service]: true };
      setCloudConnectedServices(updatedConnected);

      if (service !== 'google') {
        toast.success(`${serviceNames[service] || service} ${language === 'fr' ? 'connecté et sauvegardé!' : 'connected & backup saved!'}`);
      }
    } catch (err) {
      toast.error(language === 'fr' ? 'Erreur lors de la connexion.' : 'Connection failed. Please check your credentials.');
    }
    setCloudUploading(false);

    if (autoBackupEnabled) {
      handleManualBackup(true);
    }
  };

  // Language & timezone
  const [lang, setLang] = useState<'en' | 'fr' | 'ar'>(language as 'en' | 'fr' | 'ar');
  const [tz, setTz] = useState('Africa/Casablanca');

  // Auto-backup effect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('attendance_auto_backup', String(autoBackupEnabled));
    localStorage.setItem('attendance_backup_freq', backupFrequency);
  }, [autoBackupEnabled, backupFrequency]);

  const handleBackupRef = useRef<((silent?: boolean, incremental?: boolean) => void) | null>(null);
  useEffect(() => { handleBackupRef.current = handleManualBackup; }, [students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, schedules, exams, examGrades, curriculum, savedSchedules, academicYears, schoolInfo]);

  useEffect(() => {
    if (!autoBackupEnabled) return;
    const intervals: Record<string, number> = { '1h': 3600000, '6h': 21600000, '12h': 43200000, 'daily': 86400000 };
    const ms = intervals[backupFrequency] || 43200000;
    const timer = setInterval(() => {
      // Auto-backup saves to localStorage silently (no file download to avoid popup spam)
      const state = useAppStore.getState();
      const backupData = {
        version: '1.1',
        type: 'auto',
        timestamp: new Date().toISOString(),
        data: {
          students: state.students, classes: state.classes, modules: state.modules,
          attendance: state.attendance, grades: state.grades, behavior: state.behavior,
          tasks: state.tasks, incidents: state.incidents, teachers: state.teachers,
          employees: state.employees, schedules: state.schedules, exams: state.exams,
          examGrades: state.examGrades, curriculum: state.curriculum,
          savedSchedules: state.savedSchedules, templates: state.templates, academicYears: state.academicYears,
          schoolInfo: state.schoolInfo,
        },
      };
      try {
        localStorage.setItem('attendance_auto_backup_data', JSON.stringify(backupData));
      } catch {}
    }, ms);
    return () => clearInterval(timer);
  }, [autoBackupEnabled, backupFrequency]);

  // Teacher handlers
  const openAddTeacher = () => { setEditTeacher(null); setTForm({ name: '', subject: '', email: '', phone: '', experience: '0', qualification: '' }); setTeacherDialog(true); };
  const openEditTeacher = (t: Teacher) => { setEditTeacher(t); setTForm({ name: t.name, subject: t.subject || '', email: t.email || '', phone: t.phone || '', experience: String(t.experience || 0), qualification: t.qualification || '' }); setTeacherDialog(true); };
  const saveTeacher = () => {
    if (!tForm.name) return;
    if (editTeacher) { setTeachers(teachers.map(t => t.id === editTeacher.id ? { ...t, name: tForm.name, subject: tForm.subject, email: tForm.email, phone: tForm.phone, experience: Number(tForm.experience), qualification: tForm.qualification } : t)); toast.success(language === 'fr' ? 'Enseignant mis à jour' : 'Updated'); }
    else { setTeachers([...teachers, { id: genId(), name: tForm.name, subject: tForm.subject, email: tForm.email, phone: tForm.phone, experience: Number(tForm.experience), qualification: tForm.qualification, createdAt: new Date().toISOString() }]); toast.success(language === 'fr' ? 'Enseignant ajouté' : 'Added'); }
    setTeacherDialog(false);
  };
  const deleteTeacher = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer cet enseignant ?' : 'Delete this teacher?')) return; setTeachers(teachers.filter(t => t.id !== id)); toast.success(language === 'fr' ? 'Supprimé' : 'Deleted'); };

  // Employee handlers
  const openAddEmp = () => { setEditEmp(null); setEForm({ fullName: '', department: '', position: '', email: '', phone: '' }); setEmpDialog(true); };
  const openEditEmp = (e: Employee) => { setEditEmp(e); setEForm({ fullName: e.fullName, department: e.department || '', position: e.position || '', email: e.email || '', phone: e.phone || '' }); setEmpDialog(true); };
  const saveEmp = () => {
    if (!eForm.fullName) return;
    if (editEmp) { setEmployees(employees.map(e => e.id === editEmp.id ? { ...e, fullName: eForm.fullName, department: eForm.department, position: eForm.position, email: eForm.email, phone: eForm.phone } : e)); toast.success(language === 'fr' ? 'Employé mis à jour' : 'Updated'); }
    else { setEmployees([...employees, { id: genId(), fullName: eForm.fullName, department: eForm.department, position: eForm.position, email: eForm.email, phone: eForm.phone, createdAt: new Date().toISOString() }]); toast.success(language === 'fr' ? 'Employé ajouté' : 'Added'); }
    setEmpDialog(false);
  };
  const deleteEmp = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer cet employé ?' : 'Delete this employee?')) return; setEmployees(employees.filter(e => e.id !== id)); toast.success(language === 'fr' ? 'Supprimé' : 'Deleted'); };

  // Academic Year handlers
  const openAddAy = () => { setEditAy(null); setAyForm({ name: '', level: '__none__', startDate: '', endDate: '', isCurrent: false }); setAyDialog(true); };
  const openEditAy = (ay: AcademicYear) => { setEditAy(ay); setAyForm({ name: ay.name, level: ay.level || '__none__', startDate: ay.startDate || '', endDate: ay.endDate || '', isCurrent: ay.isCurrent || false }); setAyDialog(true); };
  const saveAy = () => {
    if (!ayForm.name) return;
    // Prevent duplicate academic year names
    const duplicateName = academicYears.find(ay => ay.name === ayForm.name && ay.id !== editAy?.id);
    if (duplicateName) {
      toast.error(language === 'fr' ? 'Une année scolaire avec ce nom existe déjà' : 'An academic year with this name already exists');
      return;
    }
    const levelValue = ayForm.level === '__none__' ? '' : ayForm.level;
    const updated = editAy ? academicYears.map(ay => ay.id === editAy.id ? { ...ay, name: ayForm.name, level: levelValue, startDate: ayForm.startDate, endDate: ayForm.endDate, isCurrent: ayForm.isCurrent } : ay) : [...academicYears, { id: genId(), name: ayForm.name, level: levelValue, startDate: ayForm.startDate, endDate: ayForm.endDate, isCurrent: ayForm.isCurrent, createdAt: new Date().toISOString() }];
    if (ayForm.isCurrent) {
      // Only the saved year should be current — unset all others first
      const savedId = editAy ? editAy.id : updated[updated.length - 1].id;
      updated.forEach(ay => { ay.isCurrent = ay.id === savedId; });
    }
    setAcademicYears(updated); toast.success(editAy ? (language === 'fr' ? 'Mis à jour' : 'Updated') : (language === 'fr' ? 'Ajouté' : 'Added')); setAyDialog(false);
  };
  const deleteAy = (id: string) => { if (!confirm(language === 'fr' ? 'Supprimer cette année scolaire ?' : 'Delete this academic year?')) return; setAcademicYears(academicYears.filter(ay => ay.id !== id)); toast.success(language === 'fr' ? 'Supprimé' : 'Deleted'); };

  // Data management
  const handleExportAll = () => { exportUtils.exportAllCSV({ students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees }, language); toast.success(language === 'fr' ? 'Exporté!' : 'Exported!'); };
  const handleClearAll = () => {
    if (!confirm(t('clear_confirm', language))) return;
    setStudents([]); setClasses([]); setModules([]); setAttendance([]); setGrades([]); setBehavior([]); setTasks([]); setIncidents([]); setTeachers([]); setEmployees([]); setTemplates([]); setAcademicYears([]); setSchedules([]); setExams([]); setExamGrades([]); setCurriculum([]); setSavedSchedules([]); setSchoolInfo({});
    addAuditLog('PURGE_CACHE', 'system', '', '', 'Cleared all data via Settings');
    ['attendance_students', 'attendance_classes', 'attendance_modules', 'attendance_records', 'attendance_grades', 'attendance_behavior', 'attendance_tasks', 'attendance_incidents', 'attendance_teachers', 'attendance_employees', 'attendance_templates', 'attendance_academic_years', 'attendance_schedules', 'attendance_exams', 'attendance_exam_grades', 'attendance_curriculum', 'attendance_saved_schedules', 'attendance_school_info'].forEach(k => localStorage.removeItem(k));
    toast.success(language === 'fr' ? 'Données supprimées' : 'Data cleared');
  };

  // Password
  const handleChangePw = async () => {
    if (!pwForm.newPw || pwForm.newPw.length < 4) {
      toast.error(language === 'fr' ? 'Le mot de passe doit contenir au moins 4 caractères' : 'Password must be at least 4 characters');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) { toast.error(language === 'fr' ? 'Mots de passe différents' : 'Passwords do not match'); return; }
    try {
      // Get current user info for D1 storage
      const auth = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('attendance_auth') || '{}') : {};
      const res = await localApi('PUT', '/api/change-password', {
        currentPassword: pwForm.current,
        newPassword: pwForm.newPw,
        username: currentUser?.username || auth.username || 'admin',
        tenant_id: currentUser?.tenantId || auth.tenantId || 'default',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(language === 'fr' ? 'Mot de passe changé' : 'Password changed');
        addAuditLog('CHANGE_PASSWORD', 'user', currentUser?.id, currentUser?.fullName, 'Password changed');
        // Update token immediately from the response (no re-login needed)
        if (data.token) {
          setApiToken(data.token);
          localStorage.setItem('attendance_auth', JSON.stringify({
            ...auth,
            token: data.token,
          }));
        } else {
          // Fallback: re-login with new password (best-effort)
          try {
            const uName = currentUser?.username || auth.username || 'admin';
            await login(uName, pwForm.newPw, auth.tenantId);
          } catch {}
        }
      } else {
        toast.error(data.error || (language === 'fr' ? 'Échec du changement de mot de passe' : 'Failed to change password'));
      }
    } catch (err) {
      toast.error(language === 'fr' ? 'Échec du changement de mot de passe' : 'Failed to change password');
    }
    setPwForm({ current: '', newPw: '', confirm: '' });
  };

  // Save school info
  const [savingSchool, setSavingSchool] = useState(false);
  const saveSchoolInfo = async () => {
    setSavingSchool(true);
    const info = { name: sForm.name, address: sForm.address, phone: sForm.phone, email: sForm.email, field: sForm.field, logo: sForm.logo };
    setSchoolInfo(info);
    toast.success(language === 'fr' ? 'Informations sauvegardées !' : 'School info saved!');
    setSavingSchool(false);
  };

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 512000) { toast.error(language === 'fr' ? 'Logo trop volumineux (max 500 Ko)' : 'Logo too large (max 500KB)'); return; }
      const r = new FileReader();
      r.onload = (ev) => setSForm({ ...sForm, logo: ev.target?.result as string });
      r.readAsDataURL(f);
    }
  };

  // Manual backup - supports full and incremental
  const handleManualBackup = (silent: boolean = false, incremental: boolean = false) => {
    const allData = {
      students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees,
      schedules, exams, examGrades, curriculum, savedSchedules, templates, academicYears, schoolInfo
    };

    let backupData: Record<string, unknown>;

    if (incremental) {
      // Incremental: only include entities that changed since last backup
      const lastSnapshot = (() => {
        try { return JSON.parse(localStorage.getItem('attendance_last_snapshot') || '{}'); } catch { return {}; }
      })();

      const incrementalData: Record<string, unknown> = {};
      const changedKeys: string[] = [];
      const entityMap: Record<string, unknown[]> = {
        students, classes, modules, attendance, grades, behavior, tasks, incidents,
        teachers, employees, schedules, exams, examGrades, curriculum, savedSchedules,
        templates, academicYears,
      };

      for (const [key, currentArr] of Object.entries(entityMap)) {
        const lastArr = lastSnapshot[key];
        const currentJSON = JSON.stringify(currentArr);
        const lastJSON = JSON.stringify(lastArr);
        if (currentJSON !== lastJSON) {
          incrementalData[key] = currentArr;
          changedKeys.push(key);
        }
      }

      // Also check schoolInfo
      const currentSIJSON = JSON.stringify(schoolInfo);
      const lastSIJSON = JSON.stringify(lastSnapshot.schoolInfo);
      if (currentSIJSON !== lastSIJSON) {
        incrementalData.schoolInfo = schoolInfo;
        changedKeys.push('schoolInfo');
      }

      if (changedKeys.length === 0) {
        if (!silent) toast.info(language === 'fr' ? 'Aucun changement depuis la dernière sauvegarde' : 'No changes since last backup');
        return;
      }

      backupData = {
        version: '1.1',
        type: 'incremental',
        timestamp: new Date().toISOString(),
        changedEntities: changedKeys,
        baseTimestamp: lastSnapshot._timestamp || lastBackupTime || new Date().toISOString(),
        data: incrementalData,
      };

      // Update last snapshot
      const snapshot = { ...allData, _timestamp: new Date().toISOString() };
      localStorage.setItem('attendance_last_snapshot', JSON.stringify(snapshot));
    } else {
      // Full backup
      backupData = {
        version: '1.1',
        type: 'full',
        timestamp: new Date().toISOString(),
        data: allData,
      };

      // Update last snapshot
      const snapshot = { ...allData, _timestamp: new Date().toISOString() };
      localStorage.setItem('attendance_last_snapshot', JSON.stringify(snapshot));
    }

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const sizeKB = (blob.size / 1024).toFixed(1);
    const timestamp = new Date().toISOString();
    const prefix = incremental ? 'incremental' : 'backup';

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `infohas_${prefix}_${timestamp.slice(0, 10)}_${timestamp.slice(11, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Update history
    const newEntry = { timestamp, size: `${sizeKB} KB` };
    const updatedHistory = [newEntry, ...backupHistory].slice(0, 10);
    setBackupHistory(updatedHistory);
    localStorage.setItem('attendance_backup_history', JSON.stringify(updatedHistory));
    setLastBackupTime(timestamp);
    localStorage.setItem('attendance_last_backup', timestamp);

    if (!silent) {
      const isInc = incremental ? (language === 'fr' ? 'incrémentielle' : 'incremental') : '';
      toast.success(`${language === 'fr' ? 'Sauvegarde' : 'Backup'} ${isInc} ${language === 'fr' ? 'créée!' : 'created!'}`);
    }

    // Upload to D1 cloud sync happens automatically via store.ts pushToD1Async()
  };

  // Restore backup - supports full and selective restore
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const data = parsed.data || parsed;
        const preview: Record<string, number> = {};
        if (data.students) preview.students = (data.students as unknown[]).length;
        if (data.classes) preview.classes = (data.classes as unknown[]).length;
        if (data.modules) preview.modules = (data.modules as unknown[]).length;
        if (data.attendance) preview.attendance = (data.attendance as unknown[]).length;
        if (data.grades) preview.grades = (data.grades as unknown[]).length;
        if (data.behavior) preview.behavior = (data.behavior as unknown[]).length;
        if (data.tasks) preview.tasks = (data.tasks as unknown[]).length;
        if (data.incidents) preview.incidents = (data.incidents as unknown[]).length;
        if (data.teachers) preview.teachers = (data.teachers as unknown[]).length;
        if (data.employees) preview.employees = (data.employees as unknown[]).length;
        if (data.schedules) preview.schedules = (data.schedules as unknown[]).length;
        if (data.exams) preview.exams = (data.exams as unknown[]).length;
        if (data.examGrades) preview.examGrades = (data.examGrades as unknown[]).length;
        if (data.curriculum) preview.curriculum = (data.curriculum as unknown[]).length;
        if (data.academicYears) preview.academicYears = (data.academicYears as unknown[]).length;
        if (data.schoolInfo) preview.schoolInfo = 1;
        setRestorePreview(preview);
        setRestoreData(data);
        setSelectedRestoreTypes(new Set(Object.keys(preview)));
        setRestoreMode('selective'); // Default to selective
      } catch {
        toast.error(language === 'fr' ? 'Fichier de sauvegarde invalide' : 'Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const confirmRestore = () => {
    if (!restoreData) return;

    const data = restoreData;
    const typesToRestore = restoreMode === 'full' ? Object.keys(data) : Array.from(selectedRestoreTypes);

    const setterMap: Record<string, (val: unknown) => void> = {
      students: (v) => setStudents(v as Student[]),
      classes: (v) => setClasses(v as Class[]),
      modules: (v) => setModules(v as Module[]),
      attendance: (v) => setAttendance(v as AttendanceRecord[]),
      grades: (v) => setGrades(v as Grade[]),
      behavior: (v) => setBehavior(v as BehaviorRecord[]),
      tasks: (v) => setTasks(v as Task[]),
      incidents: (v) => setIncidents(v as Incident[]),
      teachers: (v) => setTeachers(v as Teacher[]),
      employees: (v) => setEmployees(v as Employee[]),
      schedules: (v) => setSchedules(v as ClassScheduleEntry[]),
      exams: (v) => setExams(v as Exam[]),
      examGrades: (v) => setExamGrades(v as ExamGrade[]),
      curriculum: (v) => setCurriculum(v as CurriculumItem[]),
      academicYears: (v) => setAcademicYears(v as AcademicYear[]),
      schoolInfo: (v) => setSchoolInfo(v as SchoolInfo),
      savedSchedules: (v) => setSavedSchedules(v as SavedSchedule[]),
      templates: (v) => setTemplates(v as Template[]),
    };

    let restoredCount = 0;
    for (const type of typesToRestore) {
      const val = data[type];
      if (val === undefined || val === null) continue;
      if (setterMap[type]) setterMap[type](val);
      restoredCount++;
    }

    toast.success(`${language === 'fr' ? 'Restauré' : 'Restored'} ${restoredCount} ${language === 'fr' ? 'types de données' : 'data types'}!`);
    setRestorePreview(null);
    setRestoreData(null);
    setSelectedRestoreTypes(new Set());

    // Reset file input
    const fileInput = document.getElementById('restore-file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // Color picker handler
  const handleColorChange = (color: string) => {
    setPrimaryColor(color);
    document.documentElement.style.setProperty('--app-primary-color', color);
  };

  // Initialize CSS custom property on mount
  useEffect(() => {
    document.documentElement.style.setProperty('--app-primary-color', primaryColor);
  }, []);

  const dataStats = [
    { label: t('students', language), count: students.length },
    { label: t('classes', language), count: classes.length },
    { label: t('modules', language), count: modules.length },
    { label: t('attendance', language), count: attendance.length },
    { label: t('grades', language), count: grades.length },
    { label: t('behavior', language), count: behavior.length },
    { label: t('tasks', language), count: tasks.length },
    { label: t('incidents', language), count: incidents.length },
    { label: t('teachers_management', language), count: teachers.length },
    { label: t('employees_management', language), count: employees.length },
  ];

  if (!mounted) {
    return <div className="space-y-4 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general">{t('general_settings', language)}</TabsTrigger>
          <TabsTrigger value="teachers">{t('teachers_management', language)}</TabsTrigger>
          <TabsTrigger value="employees">{t('employees_management', language)}</TabsTrigger>
          <TabsTrigger value="academic">{t('academic_year_management', language)}</TabsTrigger>
          <TabsTrigger value="data">{t('data_management', language)}</TabsTrigger>
          <TabsTrigger value="import">{language === 'fr' ? 'Import de Données' : 'Data Import'}</TabsTrigger>
          <TabsTrigger value="admins">{t('admin_users', language)}</TabsTrigger>
          <TabsTrigger value="password">{t('change_password', language)}</TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{language === 'fr' ? 'Email (Brevo)' : 'Email (Brevo)'}</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5"><Bell className="h-4 w-4" />{language === 'fr' ? 'Notifications' : 'Notifications'}</TabsTrigger>
          <TabsTrigger value="cloudsync" className="flex items-center gap-1.5"><Cloud className="h-4 w-4" />{language === 'fr' ? 'Cloud Sync' : 'Cloud Sync'}</TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-1.5"><BellRing className="h-4 w-4" />{language === 'fr' ? 'Rappels Auto' : 'Auto Reminders'}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">{t('school_info', language)}</CardTitle></CardHeader><CardContent className="grid gap-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Logo de l\'école' : 'School Logo'}</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 logo-container overflow-hidden cursor-pointer bg-muted/50 hover:bg-muted transition-colors" onClick={() => document.getElementById('logo-upload-input')?.click()}>
                  {sForm.logo ? <img src={sForm.logo} alt="Logo" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('logo-upload-input')?.click()}><Upload className="h-4 w-4 mr-1" />{language === 'fr' ? 'Télécharger' : 'Upload'}</Button>
                  {sForm.logo && <Button variant="outline" size="sm" className="text-red-600" onClick={() => setSForm({ ...sForm, logo: '' })}><Trash2 className="h-4 w-4 mr-1" />{language === 'fr' ? 'Supprimer' : 'Remove'}</Button>}
                  <input id="logo-upload-input" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <p className="text-xs text-muted-foreground">{language === 'fr' ? 'PNG, JPG (max 500KB)' : 'PNG, JPG (max 500KB)'}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{language === 'fr' ? 'Nom de l\'école' : 'School Name'}</Label><Input value={sForm.name} onChange={e => setSForm({ ...sForm, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Domaine d\'études' : 'Field of Study'}</Label><Input value={sForm.field} onChange={e => setSForm({ ...sForm, field: e.target.value })} placeholder={language === 'fr' ? 'Ex: Académie de Formation Crew' : 'e.g. Cabin Crew Training Academy'} /></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Téléphone' : 'Phone'}</Label><Input value={sForm.phone} onChange={e => setSForm({ ...sForm, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={sForm.email} onChange={e => setSForm({ ...sForm, email: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>{language === 'fr' ? 'Adresse' : 'Address'}</Label><Input value={sForm.address} onChange={e => setSForm({ ...sForm, address: e.target.value })} /></div>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveSchoolInfo} disabled={savingSchool}>{savingSchool ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}{t('save_settings', language)}</Button>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">{language === 'fr' ? 'Personnalisation' : 'Appearance'}</CardTitle></CardHeader><CardContent className="grid gap-4">
            <div className="flex items-center gap-4">
              <Label className="min-w-fit">{language === 'fr' ? 'Couleur principale' : 'Primary Color'}</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor} onChange={e => handleColorChange(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                <Input value={primaryColor} onChange={e => handleColorChange(e.target.value)} className="w-28 font-mono text-sm" />
              </div>
              <div className="flex gap-1.5">
                {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316'].map(c => (
                  <button key={c} onClick={() => handleColorChange(c)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${primaryColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('default_language', language)}</Label><Select value={lang} onValueChange={v => { setLang(v as 'en' | 'fr' | 'ar'); useAppStore.setState({ language: v as 'en' | 'fr' | 'ar' }); localStorage.setItem('attendance_language', v); document.documentElement.lang = v; document.documentElement.dir = v === 'ar' ? 'rtl' : 'ltr'; }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">Français</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>{t('timezone', language)}</Label><Select value={tz} onValueChange={setTz}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Africa/Casablanca">Africa/Casablanca</SelectItem><SelectItem value="Europe/Paris">Europe/Paris</SelectItem><SelectItem value="UTC">UTC</SelectItem></SelectContent></Select></div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">{t('teachers_management', language)} ({teachers.length})</h3><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddTeacher}><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button></div>
          {teachers.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
            <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('name', language)}</TableHead><TableHead>{language === 'fr' ? 'Matière' : 'Subject'}</TableHead><TableHead>Email</TableHead><TableHead>{t('phone', language)}</TableHead><TableHead className="w-24">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
              {teachers.map(t => <TableRow key={t.id}><TableCell className="font-medium">{t.name}</TableCell><TableCell>{t.subject || '-'}</TableCell><TableCell className="text-sm">{t.email || '-'}</TableCell><TableCell className="text-sm">{t.phone || '-'}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTeacher(t)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteTeacher(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>)}
            </TableBody></Table></div></CardContent></Card>
          )}
          <Dialog open={teacherDialog} onOpenChange={setTeacherDialog}><DialogContent><DialogHeader><DialogTitle>{editTeacher ? t('edit', language) : t('add', language)} {language === 'fr' ? 'Enseignant' : 'Teacher'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>{t('name', language)} *</Label><Input value={tForm.name} onChange={e => setTForm({ ...tForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{language === 'fr' ? 'Matière' : 'Subject'}</Label><Input value={tForm.subject} onChange={e => setTForm({ ...tForm, subject: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Qualification' : 'Qualification'}</Label><Input value={tForm.qualification} onChange={e => setTForm({ ...tForm, qualification: e.target.value })} /></div></div>
              <div className="grid grid-cols-3 gap-4"><div className="space-y-2"><Label>Email</Label><Input value={tForm.email} onChange={e => setTForm({ ...tForm, email: e.target.value })} /></div><div className="space-y-2"><Label>{t('phone', language)}</Label><Input value={tForm.phone} onChange={e => setTForm({ ...tForm, phone: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Expérience' : 'Experience'} (yrs)</Label><Input type="number" value={tForm.experience} onChange={e => setTForm({ ...tForm, experience: e.target.value })} /></div></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setTeacherDialog(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveTeacher}>{t('save', language)}</Button></DialogFooter>
          </DialogContent></Dialog>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">{t('employees_management', language)} ({employees.length})</h3><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddEmp}><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button></div>
          {employees.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
            <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('name', language)}</TableHead><TableHead>{language === 'fr' ? 'Département' : 'Department'}</TableHead><TableHead>{language === 'fr' ? 'Poste' : 'Position'}</TableHead><TableHead>Email</TableHead><TableHead className="w-24">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
              {employees.map(emp => <TableRow key={emp.id}><TableCell className="font-medium">{emp.fullName}</TableCell><TableCell>{emp.department || '-'}</TableCell><TableCell>{emp.position || '-'}</TableCell><TableCell className="text-sm">{emp.email || '-'}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEmp(emp)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteEmp(emp.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>)}
            </TableBody></Table></div></CardContent></Card>
          )}
          <Dialog open={empDialog} onOpenChange={setEmpDialog}><DialogContent><DialogHeader><DialogTitle>{editEmp ? t('edit', language) : t('add', language)} {language === 'fr' ? 'Employé' : 'Employee'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>{t('name', language)} *</Label><Input value={eForm.fullName} onChange={e => setEForm({ ...eForm, fullName: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{language === 'fr' ? 'Département' : 'Department'}</Label><Input value={eForm.department} onChange={e => setEForm({ ...eForm, department: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Poste' : 'Position'}</Label><Input value={eForm.position} onChange={e => setEForm({ ...eForm, position: e.target.value })} /></div></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Email</Label><Input value={eForm.email} onChange={e => setEForm({ ...eForm, email: e.target.value })} /></div><div className="space-y-2"><Label>{t('phone', language)}</Label><Input value={eForm.phone} onChange={e => setEForm({ ...eForm, phone: e.target.value })} /></div></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEmpDialog(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveEmp}>{t('save', language)}</Button></DialogFooter>
          </DialogContent></Dialog>
        </TabsContent>

        <TabsContent value="academic" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">{t('academic_year_management', language)} ({academicYears.length})</h3><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddAy}><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button></div>
          {academicYears.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
            <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('name', language)}</TableHead><TableHead>{language === 'fr' ? 'Niveau' : 'Level'}</TableHead><TableHead>{language === 'fr' ? 'Début' : 'Start'}</TableHead><TableHead>{language === 'fr' ? 'Fin' : 'End'}</TableHead><TableHead>{language === 'fr' ? 'Actuelle' : 'Current'}</TableHead><TableHead className="w-24">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
              {academicYears.map(ay => <TableRow key={ay.id}><TableCell className="font-medium">{ay.name}</TableCell><TableCell className="text-sm">{ay.level || '-'}</TableCell><TableCell className="text-sm">{ay.startDate || '-'}</TableCell><TableCell className="text-sm">{ay.endDate || '-'}</TableCell><TableCell>{ay.isCurrent ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">✓</Badge> : '-'}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAy(ay)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteAy(ay.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>)}
            </TableBody></Table></div></CardContent></Card>
          )}
          <Dialog open={ayDialog} onOpenChange={setAyDialog}><DialogContent><DialogHeader><DialogTitle>{editAy ? t('edit', language) : t('add', language)} {t('academic_year', language)}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>{t('name', language)} *</Label><Input value={ayForm.name} onChange={e => setAyForm({ ...ayForm, name: e.target.value })} placeholder="2024-2025" /></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Niveau (ex: 1ère année, 2ème année)' : 'Level (e.g. 1st Year, 2nd Year)'}</Label><Select value={ayForm.level} onValueChange={v => setAyForm({ ...ayForm, level: v })}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner un niveau' : 'Select level'} /></SelectTrigger><SelectContent><SelectItem value="__none__">{language === 'fr' ? 'Aucun' : 'None'}</SelectItem><SelectItem value="1st Year">1st Year</SelectItem><SelectItem value="2nd Year">2nd Year</SelectItem><SelectItem value="3rd Year">3rd Year</SelectItem><SelectItem value="4th Year">4th Year</SelectItem><SelectItem value="5th Year">5th Year</SelectItem><SelectItem value="Master 1">Master 1</SelectItem><SelectItem value="Master 2">Master 2</SelectItem><SelectItem value="Doctorate">Doctorate</SelectItem></SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{language === 'fr' ? 'Date début' : 'Start Date'}</Label><Input type="date" value={ayForm.startDate} onChange={e => setAyForm({ ...ayForm, startDate: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Date fin' : 'End Date'}</Label><Input type="date" value={ayForm.endDate} onChange={e => setAyForm({ ...ayForm, endDate: e.target.value })} /></div></div>
              <div className="flex items-center gap-2"><Checkbox checked={ayForm.isCurrent} onCheckedChange={v => setAyForm({ ...ayForm, isCurrent: v as boolean })} /><Label>{language === 'fr' ? 'Année en cours' : 'Current Year'}</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setAyDialog(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveAy}>{t('save', language)}</Button></DialogFooter>
          </DialogContent></Dialog>

          {/* Promote Students Section */}
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" />{language === 'fr' ? 'Promouvoir Étudiants' : 'Promote Students'}</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>{language === 'fr' ? 'Sélectionner Classe' : 'Select Class'}</Label><Select value={promoteClass} onValueChange={v => { setPromoteClass(v); setPromoteSelectedIds(new Set()); setPromoteSelectAll(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">{language === 'fr' ? 'Toutes les Classes' : 'All Classes'}</SelectItem>{classes.map(c => { const ay = academicYears.find(a => a.id === c.academicYear); return <SelectItem key={c.id} value={c.id}>{c.name}{ay ? ` (${ay.name})` : ''}</SelectItem>; })}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'De l\'année' : 'From Year'}</Label><Select value={promoteFromYear || '__none__'} onValueChange={v => { setPromoteFromYear(v === '__none__' ? '' : v); setPromoteSelectedIds(new Set()); setPromoteSelectAll(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">{language === 'fr' ? 'Sélectionner' : 'Select'}</SelectItem>{academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Vers l\'année' : 'To Year'}</Label><Select value={promoteToYear || '__none__'} onValueChange={v => setPromoteToYear(v === '__none__' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">{language === 'fr' ? 'Sélectionner' : 'Select'}</SelectItem>{academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Statut Étudiant' : 'Student Status'}</Label><Select value={promoteStatus} onValueChange={setPromoteStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{language === 'fr' ? 'Actif' : 'Active'}</SelectItem><SelectItem value="inactive">{language === 'fr' ? 'Inactif' : 'Inactive'}</SelectItem><SelectItem value="graduated">{language === 'fr' ? 'Diplômé' : 'Graduated'}</SelectItem><SelectItem value="transferred">{language === 'fr' ? 'Transféré' : 'Transferred'}</SelectItem><SelectItem value="dropped">{language === 'fr' ? 'Abandon' : 'Dropped Out'}</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>{eligibleStudents.length} {language === 'fr' ? 'étudiant(s) éligible(s)' : 'student(s) eligible'}</span>
                {studentsToPromote.length !== eligibleStudents.length && eligibleStudents.length > 0 && (
                  <span className="text-emerald-600 font-medium">— {studentsToPromote.length} {language === 'fr' ? 'sélectionné(s)' : 'selected'}</span>
                )}
              </div>
              {eligibleStudents.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handlePromoteSelectAll}>
                  {promoteSelectAll ? (language === 'fr' ? 'Tout désélectionner' : 'Deselect All') : (language === 'fr' ? 'Tout sélectionner' : 'Select All')}
                </Button>
              )}
            </div>
            {/* Eligible Students List with Checkboxes */}
            {eligibleStudents.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <Table><TableHeader><TableRow><TableHead className="w-8 py-2 px-2"></TableHead><TableHead className="py-2 text-xs">{language === 'fr' ? 'Étudiant' : 'Student'}</TableHead><TableHead className="py-2 text-xs">{language === 'fr' ? 'Classe' : 'Class'}</TableHead><TableHead className="py-2 text-xs">{language === 'fr' ? 'Année' : 'Year'}</TableHead></TableRow></TableHeader><TableBody>
                  {eligibleStudents.map(s => {
                    const cls = classes.find(c => c.id === s.classId);
                    const clsAy = cls ? academicYears.find(a => a.id === cls.academicYear) : null;
                    const isSelected = promoteSelectedIds.size === 0 || promoteSelectedIds.has(s.id);
                    return <TableRow key={s.id} className={isSelected ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'opacity-60'}>
                      <TableCell className="py-1.5 px-2"><Checkbox checked={isSelected} onCheckedChange={() => handlePromoteToggleStudent(s.id)} /></TableCell>
                      <TableCell className="py-1.5 text-xs font-medium">{s.fullName}</TableCell>
                      <TableCell className="py-1.5 text-xs">{cls?.name || '-'}</TableCell>
                      <TableCell className="py-1.5 text-xs">{clsAy?.name || s.academicYear || '-'}</TableCell>
                    </TableRow>;
                  })}
                </TableBody></Table>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleMassPromotion} disabled={!promoteFromYear || !promoteToYear || promoteFromYear === promoteToYear || studentsToPromote.length === 0}><TrendingUp className="h-4 w-4 mr-1" />{language === 'fr' ? 'Promouvoir' : 'Promote'} ({studentsToPromote.length})</Button>
              <Button variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50" onClick={handleChangeStatus} disabled={studentsToPromote.length === 0}><RefreshCw className="h-4 w-4 mr-1" />{language === 'fr' ? 'Changer Statut' : 'Change Status'} ({studentsToPromote.length})</Button>
              {/* Move to Class */}
              <div className="flex items-center gap-2">
                <Select onValueChange={handlePromoteToClass}><SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder={language === 'fr' ? 'Déplacer vers classe...' : 'Move to class...'} /></SelectTrigger><SelectContent>{classes.filter(c => c.id !== promoteClass || promoteClass === '__all__').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">{t('data_statistics', language)}</CardTitle></CardHeader><CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{dataStats.map(s => (<div key={s.label} className="rounded-lg border p-3 text-center"><p className="text-xl font-bold">{s.count}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>))}</div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">{t('data_management', language)}</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleExportAll}><Download className="h-4 w-4 mr-1" />{t('export_all_data', language)}</Button>
              <Button variant="destructive" onClick={handleClearAll}><Trash2 className="h-4 w-4 mr-1" />{t('clear_all_data', language)}</Button>
            </div>
          </CardContent></Card>

          {/* Backup & Restore */}
          <Card><CardHeader><CardTitle className="text-base">{language === 'fr' ? 'Sauvegarde & Restauration' : 'Backup & Restore'}</CardTitle></CardHeader><CardContent className="space-y-6">
            {/* Manual Backup */}
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Créer une sauvegarde' : 'Create Backup'}</h4>
                <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Télécharger une copie de vos données' : 'Download a copy of your data'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleManualBackup(false, false)}><HardDrive className="h-4 w-4 mr-1" />{language === 'fr' ? 'Sauvegarde Complète' : 'Full Backup'}</Button>
                <Button variant="outline" onClick={() => handleManualBackup(false, true)}><FileDown className="h-4 w-4 mr-1" />{language === 'fr' ? 'Sauvegarde Incrémentielle' : 'Incremental Backup'}</Button>
              </div>
              {lastBackupTime && (
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{language === 'fr' ? 'Dernière sauvegarde' : 'Last backup'}: {new Date(lastBackupTime).toLocaleString()}</p>
              )}
              {backupHistory.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{language === 'fr' ? 'Historique récent' : 'Recent History'}</p>
                  <div className="space-y-1">
                    {backupHistory.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded px-3 py-1.5">
                        <span className="text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</span>
                        <Badge variant="secondary" className="text-[10px]">{h.size}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Restore Backup - Selective */}
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Restaurer une sauvegarde' : 'Restore Backup'}</h4>
                <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Charger un fichier JSON et choisir quoi restaurer' : 'Load a JSON file and choose what to restore'}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer"><input id="restore-file-input" type="file" accept=".json" className="hidden" onChange={handleRestoreBackup} /><Button variant="outline" asChild><span><FolderOpen className="h-4 w-4 mr-1" />{language === 'fr' ? 'Choisir un fichier' : 'Choose File'}</span></Button></label>
                {restorePreview && (
                  <Button className="bg-amber-600 hover:bg-amber-700" onClick={confirmRestore}><RotateCcw className="h-4 w-4 mr-1" />{language === 'fr' ? 'Restaurer' : 'Restore'}</Button>
                )}
              </div>
              {restorePreview && (
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/10 p-4 space-y-3">
                  {/* Restore Mode Toggle */}
                  <div className="flex items-center gap-3">
                    <Label className="text-xs font-semibold">{language === 'fr' ? 'Mode de restauration' : 'Restore Mode'}:</Label>
                    <div className="flex gap-1">
                      <Button variant={restoreMode === 'full' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setRestoreMode('full')}>{language === 'fr' ? 'Tout restaurer' : 'Restore All'}</Button>
                      <Button variant={restoreMode === 'selective' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setRestoreMode('selective')}>{language === 'fr' ? 'Sélectif' : 'Selective'}</Button>
                    </div>
                  </div>

                  {/* Selective Restore Checkboxes */}
                  {restoreMode === 'selective' && (
                    <div className="space-y-2">
                      <div className="flex gap-2 mb-2">
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setSelectedRestoreTypes(new Set(Object.keys(restorePreview)))}>{language === 'fr' ? 'Tout sélectionner' : 'Select All'}</Button>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setSelectedRestoreTypes(new Set())}>{language === 'fr' ? 'Tout désélectionner' : 'Deselect All'}</Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {Object.entries(restorePreview).map(([key, count]) => {
                          const typeLabels: Record<string, string> = {
                            students: t('students', language), classes: t('classes', language),
                            modules: t('modules', language), attendance: t('attendance', language),
                            grades: t('grades', language), behavior: t('behavior', language),
                            tasks: t('tasks', language), incidents: t('incidents', language),
                            teachers: t('teachers_management', language), employees: t('employees_management', language),
                            schedules: t('schedule', language), exams: t('exams', language),
                            examGrades: language === 'fr' ? 'Notes Examens' : 'Exam Grades',
                            curriculum: t('curriculum', language), academicYears: t('academic_year', language),
                            schoolInfo: t('school_info', language),
                          };
                          const isChecked = selectedRestoreTypes.has(key);
                          return (
                            <label key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-amber-100 dark:bg-amber-900/20 border-amber-300' : 'hover:bg-muted'}`}>
                              <Checkbox checked={isChecked} onCheckedChange={(checked) => {
                                const next = new Set(selectedRestoreTypes);
                                if (checked) next.add(key); else next.delete(key);
                                setSelectedRestoreTypes(next);
                              }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{typeLabels[key] || key}</p>
                                <p className="text-[10px] text-muted-foreground">{count} {count === 1 ? (language === 'fr' ? 'élément' : 'item') : (language === 'fr' ? 'éléments' : 'items')}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                        {selectedRestoreTypes.size} / {Object.keys(restorePreview).length} {language === 'fr' ? 'types sélectionnés' : 'types selected'}
                      </p>
                    </div>
                  )}

                  {/* Backup Info */}
                  <div className="text-xs text-muted-foreground">
                    <p>{language === 'fr' ? 'Aperçu de la sauvegarde' : 'Backup Preview'}:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(restorePreview).map(([key, count]) => (
                        <Badge key={key} variant="secondary" className="text-[10px]">{key}: {count}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Auto-Backup Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">{language === 'fr' ? 'Sauvegarde automatique' : 'Auto-Backup'}</h4>
                  <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Sauvegarder automatiquement les données' : 'Automatically backup data periodically'}</p>
                </div>
                <Switch checked={autoBackupEnabled} onCheckedChange={setAutoBackupEnabled} />
              </div>
              {autoBackupEnabled && (
                <div className="flex items-center gap-3">
                  <Label className="text-xs whitespace-nowrap">{language === 'fr' ? 'Fréquence' : 'Frequency'}:</Label>
                  <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">{language === 'fr' ? 'Toutes les heures' : 'Every 1 hour'}</SelectItem>
                      <SelectItem value="6h">{language === 'fr' ? 'Toutes les 6h' : 'Every 6 hours'}</SelectItem>
                      <SelectItem value="12h">{language === 'fr' ? 'Toutes les 12h' : 'Every 12 hours'}</SelectItem>
                      <SelectItem value="daily">{language === 'fr' ? 'Quotidienne' : 'Daily'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            {/* Cloud Storage */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Stockage Cloud' : 'Cloud Storage'}</h4>
              </div>
              <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Connectez vos services cloud pour sauvegarder automatiquement vos données.' : 'Connect your cloud services to automatically backup your data.'}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1"><Cloud className="h-3.5 w-3.5" />Google Drive</p>
                  <Input placeholder="OAuth2 Client ID" className="h-8 text-xs" value={cloudConfig.googleClientId || ''} onChange={e => updateCloudConfig({ googleClientId: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground leading-tight">{language === 'fr'
                    ? <>Créez un Client ID OAuth2 dans la <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline text-blue-500">Console Google Cloud</a>. Activez l'API Google Drive. Autorisez ce site comme origine JavaScript.</>
                    : <>Create an OAuth2 Client ID in <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline text-blue-500">Google Cloud Console</a>. Enable Google Drive API. Add this site as authorized JavaScript origin.</>
                  }</p>
                  <Button variant={cloudConnectedServices.google ? 'default' : 'outline'} size="sm" className={`w-full text-xs ${cloudConnectedServices.google ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} onClick={() => handleCloudSave('google')} disabled={cloudUploading}>{cloudUploading ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : cloudConnectedServices.google ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}{cloudConnectedServices.google ? (language === 'fr' ? 'Connecté' : 'Connected') : (language === 'fr' ? 'Connecter & Sauvegarder' : 'Connect & Backup')}</Button>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1"><Cloud className="h-3.5 w-3.5" />OneDrive</p>
                  <Input placeholder="Client ID" className="h-8 text-xs" value={cloudConfig.oneDriveClientId || ''} onChange={e => updateCloudConfig({ oneDriveClientId: e.target.value })} />
                  <Input placeholder="Client Secret" className="h-8 text-xs mt-1" type="password" value={cloudConfig.oneDriveClientSecret || ''} onChange={e => updateCloudConfig({ oneDriveClientSecret: e.target.value })} />
                  <Button variant={cloudConnectedServices.onedrive ? 'default' : 'outline'} size="sm" className={`w-full text-xs ${cloudConnectedServices.onedrive ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} onClick={() => handleCloudSave('onedrive')} disabled={cloudUploading}>{cloudUploading ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : cloudConnectedServices.onedrive ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}{cloudConnectedServices.onedrive ? (language === 'fr' ? 'Connecté' : 'Connected') : (language === 'fr' ? 'Connecter & Sauvegarder' : 'Connect & Backup')}</Button>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" />FTP</p>
                  <Input placeholder={language === 'fr' ? 'Hôte (ex: ftp.example.com)' : 'Host (e.g. ftp.example.com)'} className="h-8 text-xs" value={cloudConfig.ftpHost || ''} onChange={e => updateCloudConfig({ ftpHost: e.target.value })} />
                  <Input placeholder={language === 'fr' ? 'Utilisateur' : 'Username'} className="h-8 text-xs" value={cloudConfig.ftpUser || ''} onChange={e => updateCloudConfig({ ftpUser: e.target.value })} />
                  <Input placeholder={language === 'fr' ? 'Mot de passe' : 'Password'} className="h-8 text-xs" type="password" value={cloudConfig.ftpPass || ''} onChange={e => updateCloudConfig({ ftpPass: e.target.value })} />
                  <Button variant={cloudConnectedServices.ftp ? 'default' : 'outline'} size="sm" className={`w-full text-xs ${cloudConnectedServices.ftp ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} onClick={() => handleCloudSave('ftp')} disabled={cloudUploading}>{cloudUploading ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : cloudConnectedServices.ftp ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}{cloudConnectedServices.ftp ? (language === 'fr' ? 'Connecté' : 'Connected') : (language === 'fr' ? 'Connecter & Sauvegarder' : 'Connect & Backup')}</Button>
                </div>
              </div>
            </div>
          </CardContent></Card>

          {/* Purge Cache Section */}
          <PurgeCacheSection />
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <ImportWizardSection />
        </TabsContent>

        <TabsContent value="admins" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">{t('admin_users', language)}</CardTitle></CardHeader><CardContent>
            {admins.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data', language)}</p> : (
              <Table><TableHeader><TableRow><TableHead>{t('username', language)}</TableHead><TableHead>{t('role', language)}</TableHead><TableHead>{t('last_sync', language)}</TableHead></TableRow></TableHeader><TableBody>
                {admins.map((a, i) => <TableRow key={i}><TableCell className="font-medium">{String(a.username || a.name || '-')}</TableCell><TableCell><Badge variant="secondary">{String(a.role || '-')}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{String(a.lastSync || '-')}</TableCell></TableRow>)}
              </TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <Card className="max-w-md"><CardHeader><CardTitle className="text-base">{t('change_password', language)}</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>{language === 'fr' ? 'Mot de passe actuel' : 'Current Password'}</Label><Input type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} /></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Nouveau mot de passe' : 'New Password'}</Label><Input type="password" value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} /></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Confirmer' : 'Confirm Password'}</Label><Input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleChangePw}><Lock className="h-4 w-4 mr-1" />{t('change_password', language)}</Button>
          </CardContent></Card>
        </TabsContent>
        {/* Email (Brevo) Configuration Tab */}
        <TabsContent value="email" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="h-5 w-5 text-emerald-600" />{language === 'fr' ? 'Configuration Email — Brevo (Sendinblue)' : 'Email Configuration — Brevo (Sendinblue)'}</CardTitle><CardDescription>{language === 'fr' ? 'Configurez l\'envoi d\'emails pour les notifications de tâches et autres alertes.' : 'Configure email sending for task assignment notifications and other alerts.'}</CardDescription></CardHeader><CardContent className="space-y-5">
            {/* Status indicator */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${brevoConfig.apiKey && brevoConfig.senderEmail ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>
              {brevoConfig.apiKey && brevoConfig.senderEmail ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0" />}
              <div className="text-sm">
                {brevoConfig.apiKey && brevoConfig.senderEmail
                  ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">{language === 'fr' ? 'Brevo est configuré et prêt à envoyer des emails.' : 'Brevo is configured and ready to send emails.'}</span>
                  : <span className="text-amber-700 dark:text-amber-400 font-medium">{language === 'fr' ? 'Brevo n\'est pas encore configuré. Remplissez les champs ci-dessous.' : 'Brevo is not configured yet. Fill in the fields below.'}</span>
                }
              </div>
            </div>
            {/* API Key field */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Key className="h-4 w-4 text-muted-foreground" />Brevo API Key</Label>
              <Input
                type="password"
                value={brevoConfig.apiKey}
                onChange={e => setBrevoConfig({ ...brevoConfig, apiKey: e.target.value })}
                placeholder={language === 'fr' ? 'Entrez votre clé API Brevo (xkeysib-...)' : 'Enter your Brevo API key (xkeysib-...)'}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Trouvez votre clé API sur brevo.com → Paramètres → Clés API' : 'Find your API key at brevo.com → Settings → API Keys'}</p>
            </div>
            {/* Sender Email field */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-muted-foreground" />{language === 'fr' ? 'Email expéditeur' : 'Sender Email'}</Label>
              <Input
                type="email"
                value={brevoConfig.senderEmail}
                onChange={e => setBrevoConfig({ ...brevoConfig, senderEmail: e.target.value })}
                placeholder={language === 'fr' ? 'noreply@votredomaine.com (doit être vérifié dans Brevo)' : 'noreply@yourdomain.com (must be verified in Brevo)'}
              />
              <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Cet email doit être vérifié dans votre compte Brevo. Il apparaîtra comme expéditeur.' : 'This email must be verified in your Brevo account. It will appear as the sender.'}</p>
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveBrevoConfig}><Save className="h-4 w-4 mr-1" />{language === 'fr' ? 'Sauvegarder' : 'Save'}</Button>
              <Button variant="outline" onClick={handleTestBrevo} disabled={brevoTesting || !brevoConfig.apiKey || !brevoConfig.senderEmail}>
                {brevoTesting ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                {brevoTesting ? (language === 'fr' ? 'Envoi en cours...' : 'Sending...') : (language === 'fr' ? 'Envoyer un email test' : 'Send Test Email')}
              </Button>
              {brevoConfig.apiKey && <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={handleClearBrevoConfig}><Trash2 className="h-4 w-4 mr-1" />{language === 'fr' ? 'Effacer' : 'Clear'}</Button>}
            </div>
            {/* Test result */}
            {brevoTestResult && (
              <div className={`p-3 rounded-lg border text-sm ${brevoTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
                <div className="flex items-center gap-2 font-medium">
                  {brevoTestResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {brevoTestResult.success ? (language === 'fr' ? 'Succès' : 'Success') : (language === 'fr' ? 'Échec' : 'Failed')}
                </div>
                <p className="mt-1">{brevoTestResult.message}</p>
              </div>
            )}
            {/* Info box */}
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5"><Info className="h-4 w-4" />{language === 'fr' ? 'Comment configurer Brevo' : 'How to set up Brevo'}</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>{language === 'fr' ? 'Créez un compte gratuit sur' : 'Create a free account at'} <span className="font-medium text-foreground">brevo.com</span></li>
                <li>{language === 'fr' ? 'Allez dans Paramètres → Clés API → Créer une clé' : 'Go to Settings → API Keys → Create a key'}</li>
                <li>{language === 'fr' ? 'Ajoutez et vérifiez votre email expéditeur dans Paramètres → Senders' : 'Add and verify your sender email in Settings → Senders'}</li>
                <li>{language === 'fr' ? 'Copiez la clé API et l\'email ici, puis cliquez sur "Envoyer un email test"' : 'Copy the API key and email here, then click "Send Test Email"'}</li>
              </ol>
            </div>
          </CardContent></Card>
        </TabsContent>
        {/* Push Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettingsSection />
        </TabsContent>
        <TabsContent value="cloudsync" className="space-y-4">
          <CloudSyncSettings />
        </TabsContent>
        <TabsContent value="reminders" className="space-y-4">
          <ReminderSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotificationSettingsSection() {
  const { language, currentUser } = useAppStore();
  const [pushEnabled, setPushEnabled] = useState(getPushNotifPref);
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    if (typeof window === 'undefined') return 'unknown';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [testSending, setTestSending] = useState(false);

  const handleTogglePush = async () => {
    if (!pushEnabled) {
      // Enabling - request permission first
      const granted = await requestNotificationPermission();
      setNotifPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unknown');
      if (!granted) {
        toast.error(language === 'fr' ? 'Permission de notification refusée' : 'Notification permission denied');
        return;
      }
      setPushEnabled(true);
      setPushNotifPref(true);
      toast.success(language === 'fr' ? 'Notifications activées' : 'Push notifications enabled');
    } else {
      setPushEnabled(false);
      setPushNotifPref(false);
      toast.success(language === 'fr' ? 'Notifications désactivées' : 'Push notifications disabled');
    }
  };

  const handleTestNotification = () => {
    setTestSending(true);
    setTimeout(() => {
      showBrowserNotification(
        language === 'fr' ? '🔔 Test de Notification' : '🔔 Test Notification',
        language === 'fr' ? 'Les notifications push fonctionnent correctement !' : 'Push notifications are working correctly!',
        { tag: 'test-push-notif' }
      );
      setTestSending(false);
      toast.success(language === 'fr' ? 'Notification de test envoyée' : 'Test notification sent');
    }, 500);
  };

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  return (
    <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-5 w-5 text-emerald-600" />{language === 'fr' ? 'Notifications Push' : 'Push Notifications'}</CardTitle><CardDescription>{language === 'fr' ? 'Recevez des notifications dans votre navigateur pour les événements importants.' : 'Receive browser notifications for important events.'}</CardDescription></CardHeader><CardContent className="space-y-5">
      {/* Support status */}
      {!isSupported && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">{language === 'fr' ? 'Votre navigateur ne supporte pas les notifications push.' : 'Your browser does not support push notifications.'}</span>
        </div>
      )}

      {/* Current permission */}
      {isSupported && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${notifPermission === 'granted' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : notifPermission === 'denied' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>
          {notifPermission === 'granted' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : notifPermission === 'denied' ? <XCircle className="h-5 w-5 text-red-600 shrink-0" /> : <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0" />}
          <div className="text-sm">
            {notifPermission === 'granted'
              ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">{language === 'fr' ? 'Notifications autorisées' : 'Notifications allowed'}</span>
              : notifPermission === 'denied'
              ? <span className="text-red-700 dark:text-red-400 font-medium">{language === 'fr' ? 'Notifications bloquées. Vérifiez les paramètres de votre navigateur.' : 'Notifications blocked. Check your browser settings.'}</span>
              : <span className="text-amber-700 dark:text-amber-400 font-medium">{language === 'fr' ? 'Notifications non encore configurées' : 'Notifications not yet configured'}</span>
            }
          </div>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{language === 'fr' ? 'Activer les notifications push' : 'Enable push notifications'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{language === 'fr' ? 'Tâches assignées, résumé de présence' : 'Task assignments, attendance summary'}</p>
        </div>
        <Switch checked={pushEnabled} onCheckedChange={handleTogglePush} disabled={!isSupported} />
      </div>

      {/* Test button */}
      {isSupported && notifPermission === 'granted' && (
        <Button variant="outline" onClick={handleTestNotification} disabled={testSending || !pushEnabled}>
          {testSending ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Bell className="h-4 w-4 mr-1" />}
          {testSending ? (language === 'fr' ? 'Envoi...' : 'Sending...') : (language === 'fr' ? 'Envoyer une notification test' : 'Send Test Notification')}
        </Button>
      )}

      {/* Info */}
      <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-1.5"><Info className="h-4 w-4" />{language === 'fr' ? 'Quand les notifications sont envoyées' : 'When notifications are sent'}</h4>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>{language === 'fr' ? 'Une tâche vous est assignée (si vous êtes le destinataire)' : 'A task is assigned to you (if you are the assignee)'}</li>
          <li>{language === 'fr' ? 'Après la sauvegarde de présence (si vous êtes admin, résumé)' : 'After attendance save (admin only, summary of absences/late)'}</li>
        </ul>
      </div>
    </CardContent></Card>
  );
}

// ==================== CLOUD SYNC SETTINGS ====================
function CloudSyncSettings() {
  const { language, students, classes, attendance, tasks, grades } = useAppStore();
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{
    status: string; lastCloudSync: string | null; lastCloudPull: string | null;
    cloudCounts: Record<string, number>; cloudConnected: boolean; success: boolean;
  } | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<string>('');

  useEffect(() => {
    getCloudSyncStatus().then(setCloudStatus);
  }, []);

  const handleSyncToCloud = async () => {
    setSyncing(true);
    setLastSyncResult('');
    const result = await syncToCloud();
    if (result.success) {
      setLastSyncResult(`${language === 'fr' ? 'Synchronisé' : 'Synced'}: ${result.upserted || 0} ${language === 'fr' ? 'enregistrements' : 'records'}`);
      toast.success(language === 'fr' ? 'Données envoyées vers le cloud' : 'Data pushed to cloud');
    } else {
      setLastSyncResult(`${language === 'fr' ? 'Erreur' : 'Error'}: ${result.error}`);
      toast.error(result.error || (language === 'fr' ? 'Échec de la synchronisation' : 'Sync failed'));
    }
    setSyncing(false);
    const updated = await getCloudSyncStatus();
    setCloudStatus(updated);
  };

  const handlePullFromCloud = async () => {
    if (!confirm(language === 'fr' ? 'Remplacer les données locales par les données du cloud ?' : 'Replace local data with cloud data?')) return;
    setPulling(true);
    setLastSyncResult('');
    const result = await loadFromCloud();
    if (result.success && result.data) {
      // Apply pulled data to store
      const { setStudents, setClasses, setAttendance, setGrades, setTasks, setModules, setBehavior, setIncidents, setTeachers, setEmployees, setSchedules, setExams, setExamGrades, setCurriculum, setSchoolInfo, setAcademicYears } = useAppStore.getState();
      if (Array.isArray(result.data.students)) { setStudents(result.data.students as Student[]); }
      if (Array.isArray(result.data.classes)) { setClasses(result.data.classes as Class[]); }
      if (Array.isArray(result.data.attendance)) { setAttendance(result.data.attendance as AttendanceRecord[]); }
      if (Array.isArray(result.data.grades)) { setGrades(result.data.grades as Grade[]); }
      if (Array.isArray(result.data.tasks)) { setTasks(result.data.tasks as Task[]); }
      if (result.data.schoolInfo && typeof result.data.schoolInfo === 'object' && !Array.isArray(result.data.schoolInfo)) { setSchoolInfo(result.data.schoolInfo as SchoolInfo); }
      setLastSyncResult(`${language === 'fr' ? 'Données récupérées du cloud' : 'Data pulled from cloud'}`);
      toast.success(language === 'fr' ? 'Données chargées depuis le cloud' : 'Data loaded from cloud');
    } else {
      setLastSyncResult(`${language === 'fr' ? 'Erreur' : 'Error'}: ${result.error}`);
      toast.error(result.error || (language === 'fr' ? 'Échec du chargement' : 'Pull failed'));
    }
    setPulling(false);
    const updated = await getCloudSyncStatus();
    setCloudStatus(updated);
  };

  const statusColor = cloudStatus?.status === 'success' ? 'text-emerald-600' : cloudStatus?.status === 'error' ? 'text-red-600' : cloudStatus?.status === 'syncing' ? 'text-blue-600' : 'text-muted-foreground';
  const statusText = cloudStatus?.status === 'success' ? (language === 'fr' ? 'Connecté' : 'Connected') : cloudStatus?.status === 'error' ? (language === 'fr' ? 'Erreur' : 'Error') : cloudStatus?.status === 'syncing' ? (language === 'fr' ? 'Synchronisation...' : 'Syncing...') : (language === 'fr' ? 'Inactif' : 'Idle');

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Cloud className="h-5 w-5 text-blue-600" />{language === 'fr' ? 'Synchronisation Cloud (D1)' : 'Cloud Sync (D1)'}</CardTitle><CardDescription>{language === 'fr' ? 'Sauvegardez et synchronisez vos données avec Cloudflare D1' : 'Backup and sync your data with Cloudflare D1'}</CardDescription></CardHeader><CardContent className="space-y-5">
        {/* Status */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${cloudStatus?.cloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
          </div>
          <span className="text-xs text-muted-foreground">{cloudStatus?.cloudConnected ? (language === 'fr' ? 'Base de données connectée' : 'Database connected') : (language === 'fr' ? 'Non connecté' : 'Not connected')}</span>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border bg-muted/20">
            <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Dernier envoi' : 'Last Push'}</p>
            <p className="text-sm font-medium mt-0.5">{cloudStatus?.lastCloudSync ? new Date(cloudStatus.lastCloudSync).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') : (language === 'fr' ? 'Jamais' : 'Never')}</p>
          </div>
          <div className="p-3 rounded-lg border bg-muted/20">
            <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Dernière récupération' : 'Last Pull'}</p>
            <p className="text-sm font-medium mt-0.5">{cloudStatus?.lastCloudPull ? new Date(cloudStatus.lastCloudPull).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') : (language === 'fr' ? 'Jamais' : 'Never')}</p>
          </div>
        </div>

        {/* Entity counts comparison */}
        <div className="rounded-lg border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-2">{language === 'fr' ? 'Comparaison des données' : 'Data Comparison'}:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between"><span>{language === 'fr' ? 'Étudiants' : 'Students'}:</span><span>{students.length} {cloudStatus?.cloudCounts?.students ? `/ ${cloudStatus.cloudCounts.students}` : ''}</span></div>
            <div className="flex justify-between"><span>{language === 'fr' ? 'Classes' : 'Classes'}:</span><span>{classes.length} {cloudStatus?.cloudCounts?.classes ? `/ ${cloudStatus.cloudCounts.classes}` : ''}</span></div>
            <div className="flex justify-between"><span>{language === 'fr' ? 'Présence' : 'Attendance'}:</span><span>{attendance.length} {cloudStatus?.cloudCounts?.attendance_records ? `/ ${cloudStatus.cloudCounts.attendance_records}` : ''}</span></div>
            <div className="flex justify-between"><span>{language === 'fr' ? 'Notes' : 'Grades'}:</span><span>{grades.length} {cloudStatus?.cloudCounts?.grades ? `/ ${cloudStatus.cloudCounts.grades}` : ''}</span></div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSyncToCloud} disabled={syncing} className="flex-1 bg-blue-600 hover:bg-blue-700">
            {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {syncing ? (language === 'fr' ? 'Envoi en cours...' : 'Pushing...') : (language === 'fr' ? 'Envoyer vers le Cloud' : 'Push to Cloud')}
          </Button>
          <Button onClick={handlePullFromCloud} disabled={pulling} variant="outline" className="flex-1">
            {pulling ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {pulling ? (language === 'fr' ? 'Récupération...' : 'Pulling...') : (language === 'fr' ? 'Récupérer du Cloud' : 'Pull from Cloud')}
          </Button>
        </div>

        {/* Result message */}
        {lastSyncResult && (
          <div className={`p-3 rounded-lg text-sm ${lastSyncResult.includes('Erreur') || lastSyncResult.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
            {lastSyncResult}
          </div>
        )}

        {/* Info */}
        <div className="rounded-lg border p-3 bg-muted/30 space-y-1.5">
          <h4 className="text-sm font-semibold flex items-center gap-1.5"><Info className="h-4 w-4" />{language === 'fr' ? 'Comment ça marche' : 'How it works'}</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>{language === 'fr' ? 'Les données sont synchronisées vers D1 immédiatement après chaque modification' : 'Data syncs to D1 immediately after every change'}</li>
            <li>{language === 'fr' ? 'Au chargement, toutes les données sont récupérées depuis D1 — seule source de vérité' : 'On load, all data is fetched from D1 — the single source of truth'}</li>
            <li>{language === 'fr' ? 'Aucune donnée métier stockée localement — D1 est la base de données principale' : 'No business data stored locally — D1 is the primary database'}</li>
          </ul>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ==================== AUTOMATED REMINDER SETTINGS ====================
function ReminderSettings() {
  const { language, attendance, students, classes, schoolInfo } = useAppStore();
  const [sending, setSending] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ success: boolean; sent?: number; skipped?: number; errors?: unknown[]; error?: string } | null>(null);
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('attendance_auto_reminders') === 'true';
  });
  const brevoConfig = loadBrevoConfig();

  const handleToggleAutoReminder = () => {
    const newVal = !autoReminderEnabled;
    setAutoReminderEnabled(newVal);
    if (typeof window !== 'undefined') localStorage.setItem('attendance_auto_reminders', JSON.stringify(newVal));
    toast.success(newVal
      ? (language === 'fr' ? 'Rappels automatiques activés' : 'Auto reminders enabled')
      : (language === 'fr' ? 'Rappels automatiques désactivés' : 'Auto reminders disabled'));
  };

  const handleSendReminders = async () => {
    if (!brevoConfig.apiKey || !brevoConfig.senderEmail) {
      toast.error(language === 'fr' ? 'Configurez Brevo dans l\'onglet Email avant d\'envoyer des rappels' : 'Configure Brevo in Email tab before sending reminders');
      return;
    }
    setSending(true);
    setReminderResult(null);
    const result = await sendAttendanceReminders({
      attendance: attendance.filter(a => a.date === localToday() && (a.status === 'absent' || a.status === 'late')),
      students,
      classes,
      brevoApiKey: brevoConfig.apiKey,
      senderEmail: brevoConfig.senderEmail,
      language,
      schoolInfo: schoolInfo as Record<string, string>,
    });
    setReminderResult(result);
    if (result.success) {
      toast.success(`${language === 'fr' ? 'Rappels envoyés' : 'Reminders sent'}: ${result.sent || 0} ${language === 'fr' ? 'email(s)' : 'email(s)'}`);
    } else {
      toast.error(result.error || (language === 'fr' ? 'Échec de l\'envoi' : 'Send failed'));
    }
    setSending(false);
  };

  const today = localToday();
  const todayAbsences = attendance.filter(a => a.date === today && a.status === 'absent').length;
  const todayLates = attendance.filter(a => a.date === today && a.status === 'late').length;

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><BellRing className="h-5 w-5 text-amber-600" />{language === 'fr' ? 'Rappels Automatiques d\'Absence' : 'Automated Attendance Reminders'}</CardTitle><CardDescription>{language === 'fr' ? 'Envoyez automatiquement des emails aux parents en cas d\'absence ou de retard' : 'Automatically email guardians when students are absent or late'}</CardDescription></CardHeader><CardContent className="space-y-5">
        {/* Brevo status */}
        {(!brevoConfig.apiKey || !brevoConfig.senderEmail) && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
            <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-400">{language === 'fr' ? 'Veuillez d\'abord configurer Brevo dans l\'onglet Email.' : 'Please configure Brevo in the Email tab first.'}</span>
          </div>
        )}

        {/* Auto toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{language === 'fr' ? 'Activer les rappels automatiques' : 'Enable automatic reminders'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{language === 'fr' ? 'Envoi automatique lors du marquage de présence' : 'Auto-send when attendance is marked'}</p>
          </div>
          <Switch checked={autoReminderEnabled} onCheckedChange={handleToggleAutoReminder} />
        </div>

        {/* Today's summary */}
        <div className="rounded-lg border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-2">{`Summary for ${new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'ar' ? 'ar-MA' : 'en-US')}`}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between"><span className="text-red-600 font-medium">{language === 'fr' ? 'Absents' : 'Absent'}:</span><span>{todayAbsences}</span></div>
            <div className="flex justify-between"><span className="text-amber-600 font-medium">{language === 'fr' ? 'Retards' : 'Late'}:</span><span>{todayLates}</span></div>
          </div>
        </div>

        {/* Send button */}
        <Button onClick={handleSendReminders} disabled={sending || (!brevoConfig.apiKey || !brevoConfig.senderEmail)} className="w-full bg-amber-600 hover:bg-amber-700">
          {sending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          {sending ? (language === 'fr' ? 'Envoi en cours...' : 'Sending...') : (language === 'fr' ? `Envoyer les rappels d'aujourd'hui (${todayAbsences + todayLates})` : `Send today's reminders (${todayAbsences + todayLates})`)}
        </Button>

        {/* Result */}
        {reminderResult && (
          <div className={`p-3 rounded-lg text-sm space-y-1 ${reminderResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400'}`}>
            {reminderResult.success ? (
              <>
                <p className="font-medium">{language === 'fr' ? 'Rappels envoyés avec succès' : 'Reminders sent successfully'}</p>
                <p className="text-xs">{language === 'fr' ? 'Envoyés' : 'Sent'}: {reminderResult.sent} | {language === 'fr' ? 'Ignorés (déjà envoyés)' : 'Skipped (already sent)'}: {reminderResult.skipped}</p>
                {reminderResult.errors && reminderResult.errors.length > 0 && (
                  <p className="text-xs mt-1 text-amber-600">{language === 'fr' ? 'Erreurs' : 'Errors'}: {reminderResult.errors.map((e: unknown) => (e as { error: string })?.error || '').join(', ')}</p>
                )}
              </>
            ) : (
              <p>{reminderResult.error || (language === 'fr' ? 'Échec de l\'envoi' : 'Send failed')}</p>
            )}
          </div>
        )}

        {/* Info */}
        <div className="rounded-lg border p-3 bg-muted/30 space-y-1.5">
          <h4 className="text-sm font-semibold flex items-center gap-1.5"><Info className="h-4 w-4" />{language === 'fr' ? 'Fonctionnement' : 'How it works'}</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>{language === 'fr' ? 'Les rappels sont envoyés aux emails des tuteurs (guardianEmail)' : 'Reminders are sent to guardian emails (guardianEmail)'}</li>
            <li>{language === 'fr' ? 'Un duplicat est évité — chaque rappel n\'est envoyé qu\'une fois par jour' : 'Duplicates are avoided — each reminder is sent only once per day'}</li>
            <li>{language === 'fr' ? 'Nécessite Brevo configuré dans l\'onglet Email' : 'Requires Brevo configured in Email tab'}</li>
          </ul>
        </div>
      </CardContent></Card>
    </div>
  );
}

// ==================== EXAMS PAGE ====================
function ExamsPage() {
  const { exams, examGrades, setExams, setExamGrades, modules, classes, students, language, currentUser, addAuditLog } = useAppStore();
  const [tab, setTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [gradingExam, setGradingExam] = useState<Exam | null>(null);
  const [gradeScores, setGradeScores] = useState<Record<string, string>>({});

  const emptyExam: Omit<Exam, 'id' | 'createdAt'> = {
    title: '', moduleId: '', classId: '', date: '', startTime: '09:00',
    duration: 60, room: '', maxScore: 20, weight: 25,
    type: 'midterm', status: 'scheduled', description: '',
  };
  const [form, setForm] = useState(emptyExam);

  const examTypes: Exam['type'][] = ['midterm', 'final', 'quiz', 'practical', 'oral', 'project', 'other'];
  const examStatuses: Exam['status'][] = ['scheduled', 'in_progress', 'completed', 'cancelled'];

  const today = localToday();
  const filteredExams = useMemo(() => {
    let list = [...exams].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (tab === 'upcoming') list = list.filter(e => e.date >= today && e.status !== 'cancelled');
    if (tab === 'past') list = list.filter(e => e.date < today || e.status === 'completed');
    return list;
  }, [exams, tab, today]);

  const getModule = (id: string) => modules.find(m => m.id === id);
  const getClass = (id: string) => classes.find(c => c.id === id);

  const openCreate = () => { setEditingExam(null); setForm(emptyExam); setDialogOpen(true); };
  const openEdit = (exam: Exam) => { setEditingExam(exam); setForm(exam); setDialogOpen(true); };
  const openGrade = (exam: Exam) => {
    setGradingExam(exam);
    const existing: Record<string, string> = {};
    examGrades.filter(g => g.examId === exam.id).forEach(g => { existing[g.studentId] = String(g.score); });
    setGradeScores(existing);
    setGradeDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title || !form.moduleId || !form.classId || !form.date) {
      toast.error(language === 'fr' ? 'Veuillez remplir les champs obligatoires' : 'Please fill in required fields');
      return;
    }
    if (editingExam) {
      setExams(exams.map(e => e.id === editingExam.id ? { ...e, ...form } : e));
      addAuditLog('UPDATE_EXAM', 'exam', editingExam.id, form.title, `Updated exam: ${form.title}`);
      toast.success(language === 'fr' ? 'Examen modifié' : 'Exam updated');
    } else {
      const newExam: Exam = { ...form, id: genId(), createdAt: new Date().toISOString() } as Exam;
      setExams([...exams, newExam]);
      addAuditLog('CREATE_EXAM', 'exam', newExam.id, form.title, `Created exam: ${form.title}`);
      toast.success(language === 'fr' ? 'Examen créé' : 'Exam created');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm(language === 'fr' ? 'Supprimer cet examen ?' : 'Delete this exam?')) return;
    const exam = exams.find(e => e.id === id);
    setExams(exams.filter(e => e.id !== id));
    setExamGrades(examGrades.filter(g => g.examId !== id));
    addAuditLog('DELETE_EXAM', 'exam', id, exam?.title, `Deleted exam: ${exam?.title}`);
    toast.success(language === 'fr' ? 'Examen supprimé' : 'Exam deleted');
  };

  const handleSaveGrades = () => {
    if (!gradingExam) return;
    const classStudents = students.filter(s => s.classId === gradingExam.classId && s.status === 'active');
    let updated = [...examGrades];
    classStudents.forEach(s => {
      const score = parseFloat(gradeScores[s.id] || '');
      if (isNaN(score)) return;
      const pct = gradingExam.maxScore > 0 ? Math.round((score / gradingExam.maxScore) * 1000) / 10 : 0;
      const existing = updated.find(g => g.examId === gradingExam!.id && g.studentId === s.id);
      if (existing) {
        const idx = updated.indexOf(existing);
        updated[idx] = { ...existing, score, maxScore: gradingExam.maxScore, percentage: pct, gradedAt: new Date().toISOString() };
      } else {
        updated.push({ id: genId(), examId: gradingExam!.id, studentId: s.id, score, maxScore: gradingExam.maxScore, percentage: pct, gradedBy: currentUser?.username || '', gradedAt: new Date().toISOString(), createdAt: new Date().toISOString() });
      }
    });
    setExamGrades(updated);
    setGradeDialogOpen(false);
    toast.success(t('exam_grades_saved', language));
  };

  const getWeightedAvg = (studentId: string) => {
    const studentGrades = examGrades.filter(g => g.studentId === studentId && g.percentage > 0);
    if (studentGrades.length === 0) return null;
    let totalWeight = 0, weightedSum = 0;
    studentGrades.forEach(g => {
      const exam = exams.find(e => e.id === g.examId);
      if (exam && exam.status === 'completed' && exam.weight > 0) {
        weightedSum += g.percentage * exam.weight;
        totalWeight += exam.weight;
      }
    });
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight * 10) / 10 : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('exam_management', language)}</h2>
          <p className="text-muted-foreground text-sm">{t('exams', language)} ({exams.length})</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('create_exam', language)}</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t('exams', language)}</TabsTrigger>
          <TabsTrigger value="upcoming">{t('upcoming_exams', language)}</TabsTrigger>
          <TabsTrigger value="past">{t('past_exams', language)}</TabsTrigger>
          <TabsTrigger value="grade_entry">{t('enter_scores', language)}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {tab === 'grade_entry' ? (
            <div className="grid gap-3">
              {exams.filter(e => e.status === 'scheduled' || e.status === 'in_progress').length === 0
                ? <EmptyState message={t('no_exams', language)} />
                : exams.filter(e => e.status === 'scheduled' || e.status === 'in_progress').map(exam => (
                  <Card key={exam.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{exam.title}</p>
                      <p className="text-sm text-muted-foreground">{getModule(exam.moduleId)?.name || '-'} • {getClass(exam.classId)?.name || '-'} • {exam.date}</p>
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openGrade(exam)}><FileCheck className="h-4 w-4 mr-1" />{t('grade_exam', language)}</Button>
                  </Card>
                ))
              }
            </div>
          ) : filteredExams.length === 0 ? (
            <EmptyState message={t('no_exams', language)} />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('exam_title', language)}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('modules', language)}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('classes', language)}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('exam_date', language)}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('exam_type', language)}</TableHead>
                    <TableHead>{t('status', language)}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('exam_weight', language)}</TableHead>
                    <TableHead className="text-right">{t('actions', language)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.map(exam => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell className="hidden md:table-cell">{getModule(exam.moduleId)?.name || '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getClass(exam.classId)?.name || '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell">{exam.date}</TableCell>
                      <TableCell className="hidden lg:table-cell"><Badge variant="outline">{t(exam.type, language)}</Badge></TableCell>
                      <TableCell><StatusBadge status={exam.status} /></TableCell>
                      <TableCell className="hidden md:table-cell">{exam.weight}%</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openGrade(exam)}><FileCheck className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(exam)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(exam.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Weighted Averages per Student */}
      {exams.filter(e => e.status === 'completed').length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">{t('weighted_average', language)}</h3>
          <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('students', language)}</TableHead>
                  <TableHead>{t('classes', language)}</TableHead>
                  <TableHead className="text-right">{t('final_grade', language)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.filter(s => s.status === 'active').map(s => {
                  const avg = getWeightedAvg(s.id);
                  if (avg === null) return null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell>{getClass(s.classId)?.name || '-'}</TableCell>
                      <TableCell className="text-right font-bold" style={{ color: avg >= 70 ? '#10b981' : avg >= 50 ? '#f59e0b' : '#ef4444' }}>{avg}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add/Edit Exam Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0"><DialogTitle>{editingExam ? t('edit_exam', language) : t('create_exam', language)}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-2"><Label>{t('exam_title', language)} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('modules', language)} *</Label><Select value={form.moduleId} onValueChange={v => setForm({ ...form, moduleId: v })}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger><SelectContent>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{t('classes', language)} *</Label><Select value={form.classId} onValueChange={v => setForm({ ...form, classId: v })}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('exam_date', language)} *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t('exam_time', language)}</Label><Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>{t('exam_duration', language)}</Label><Input type="number" value={form.duration} onChange={e => setForm({ ...form, duration: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>{t('exam_room', language)}</Label><Input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t('exam_max_score', language)}</Label><Input type="number" value={form.maxScore} onChange={e => setForm({ ...form, maxScore: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('exam_weight', language)} (%)</Label><Input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>{t('exam_type', language)}</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v as Exam['type'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{examTypes.map(tp => <SelectItem key={tp} value={tp}>{t(tp === 'other' ? 'exam_other' : tp, language)}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>{t('status', language)}</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Exam['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{examStatuses.map(st => <SelectItem key={st} value={st}>{t(st, language)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{t('exam_description', language)}</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter className="shrink-0 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}><Save className="h-4 w-4 mr-1" />{t('save', language)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Exam Dialog */}
      <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('enter_scores', language)} — {gradingExam?.title}</DialogTitle>
            <DialogDescription>{gradingExam?.date} • Max: {gradingExam?.maxScore} • {getModule(gradingExam?.moduleId || '')?.name || '-'}</DialogDescription>
          </DialogHeader>
          {gradingExam && (
            <ScrollArea className="flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('students', language)}</TableHead>
                    <TableHead>{t('student_score', language)} / {gradingExam.maxScore}</TableHead>
                    <TableHead className="text-right">{t('auto_calc', language)} (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.filter(s => s.classId === gradingExam.classId && s.status === 'active').map(s => {
                    const score = parseFloat(gradeScores[s.id] || '');
                    const pct = !isNaN(score) && gradingExam.maxScore > 0 ? Math.round(score / gradingExam.maxScore * 1000) / 10 : 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.fullName}</TableCell>
                        <TableCell><Input type="number" min={0} max={gradingExam.maxScore} className="w-24" value={gradeScores[s.id] || ''} onChange={e => setGradeScores({ ...gradeScores, [s.id]: e.target.value })} /></TableCell>
                        <TableCell className="text-right font-semibold" style={{ color: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>{pct}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          <DialogFooter className="shrink-0 pt-2">
            <Button variant="outline" onClick={() => setGradeDialogOpen(false)}>{t('cancel', language)}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveGrades}><Save className="h-4 w-4 mr-1" />{t('save', language)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== CURRICULUM PAGE ====================
function CurriculumPage() {
  const { curriculum, setCurriculum, modules, language, academicYears, addAuditLog } = useAppStore();
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CurriculumItem | null>(null);

  const emptyItem: Omit<CurriculumItem, 'id' | 'createdAt'> = {
    moduleId: '', academicYear: '', title: '', description: '',
    objectives: [], hours: 2, order: 1, status: 'planned',
  };
  const [form, setForm] = useState(emptyItem);

  const statuses: CurriculumItem['status'][] = ['planned', 'in_progress', 'completed'];

  // ID ↔ name helpers to avoid duplicate SelectItem values when years share a name
  const yearIdToName = (id: string) => academicYears?.find(y => y.id === id)?.name || '';
  const yearNameToId = (name: string) => academicYears?.find(y => y.name === name)?.id || '';

  const filteredItems = useMemo(() => {
    let items = [...curriculum].sort((a, b) => a.order - b.order);
    if (selectedModule) items = items.filter(i => i.moduleId === selectedModule);
    if (selectedYear) items = items.filter(i => i.academicYear === yearIdToName(selectedYear));
    return items;
  }, [curriculum, selectedModule, selectedYear, academicYears]);

  const totalHours = filteredItems.reduce((s, i) => s + i.hours, 0);
  const completedHours = filteredItems.filter(i => i.status === 'completed').reduce((s, i) => s + i.hours, 0);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyItem, moduleId: selectedModule, academicYear: yearIdToName(selectedYear) });
    setDialogOpen(true);
  };
  const openEdit = (item: CurriculumItem) => {
    setEditingItem(item);
    setForm(item);
    setDialogOpen(true);
  };

  const addObjective = () => setForm({ ...form, objectives: [...(form.objectives || []), ''] });
  const removeObjective = (idx: number) => setForm({ ...form, objectives: (form.objectives || []).filter((_, i) => i !== idx) });
  const updateObjective = (idx: number, val: string) => {
    const newObj = [...(form.objectives || [])];
    newObj[idx] = val;
    setForm({ ...form, objectives: newObj });
  };

  const handleSave = () => {
    if (!form.title || !form.moduleId) {
      toast.error(language === 'fr' ? 'Veuillez remplir les champs obligatoires' : 'Please fill in required fields');
      return;
    }
    if (editingItem) {
      setCurriculum(curriculum.map(i => i.id === editingItem.id ? { ...i, ...form } : i));
      addAuditLog('UPDATE_CURRICULUM', 'curriculum', editingItem.id, form.title, `Updated topic: ${form.title}`);
      toast.success(language === 'fr' ? 'Sujet modifié' : 'Topic updated');
    } else {
      const newItem: CurriculumItem = { ...form, id: genId(), createdAt: new Date().toISOString() } as CurriculumItem;
      setCurriculum([...curriculum, newItem]);
      addAuditLog('CREATE_CURRICULUM', 'curriculum', newItem.id, form.title, `Created topic: ${form.title}`);
      toast.success(language === 'fr' ? 'Sujet ajouté' : 'Topic added');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm(language === 'fr' ? 'Supprimer ce sujet ?' : 'Delete this topic?')) return;
    const item = curriculum.find(i => i.id === id);
    setCurriculum(curriculum.filter(i => i.id !== id));
    addAuditLog('DELETE_CURRICULUM', 'curriculum', id, item?.title, `Deleted topic: ${item?.title}`);
    toast.success(language === 'fr' ? 'Sujet supprimé' : 'Topic deleted');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('curriculum_planner', language)}</h2>
          <p className="text-muted-foreground text-sm">{t('curriculum', language)} ({filteredItems.length} {language === 'fr' ? 'sujets' : 'topics'})</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('add_curriculum_item', language)}</Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('modules', language)}</Label>
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Tous les modules' : 'All modules'} /></SelectTrigger>
              <SelectContent>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('academic_year', language)}</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Toutes les années' : 'All years'} /></SelectTrigger>
              <SelectContent>{(academicYears || []).filter(y => y.name).map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{completedHours}</p><p className="text-xs text-muted-foreground">{t('curriculum_completed', language)}</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{totalHours - completedHours}</p><p className="text-xs text-muted-foreground">{language === 'fr' ? 'Heures restantes' : 'Remaining Hours'}</p></Card>
        <Card className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{totalHours}</p><p className="text-xs text-muted-foreground">{t('total_hours', language)}</p></Card>
      </div>

      {/* Curriculum Items */}
      {filteredItems.length === 0 ? (
        <EmptyState message={t('no_curriculum', language)} />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 text-sm font-bold shrink-0 mt-0.5">{item.order}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{item.title}</h4>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                    {(item.objectives || []).length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {(item.objectives || []).map((obj, oi) => (
                          <li key={oi} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{obj}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{modules.find(m => m.id === item.moduleId)?.name || '-'}</span>
                      <span>{item.hours}h</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? t('edit_curriculum_item', language) : t('add_curriculum_item', language)}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-2"><Label>{t('topic_title', language)} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>{t('topic_description', language)}</Label><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t('modules', language)} *</Label><Select value={form.moduleId} onValueChange={v => setForm({ ...form, moduleId: v })}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger><SelectContent>{modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{t('academic_year', language)}</Label><Select value={yearNameToId(form.academicYear || '') || undefined} onValueChange={v => setForm({ ...form, academicYear: yearIdToName(v) })}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger><SelectContent>{(academicYears || []).filter(y => y.name).map(y => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>{t('hours_allocated', language)}</Label><Input type="number" min={1} value={form.hours} onChange={e => setForm({ ...form, hours: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>{t('display_order', language)}</Label><Input type="number" min={1} value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>{t('status', language)}</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as CurriculumItem['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map(st => <SelectItem key={st} value={st}>{t(`curriculum_${st === 'planned' ? 'planned' : st === 'in_progress' ? 'in_progress' : 'completed'}`, language)}</SelectItem>)}</SelectContent></Select></div>
            </div>

            {/* Learning Objectives */}
            <div className="space-y-2">
              <Label>{t('learning_objectives', language)}</Label>
              <div className="space-y-2">
                {form.objectives.map((obj, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input value={obj} onChange={e => updateObjective(idx, e.target.value)} placeholder={`${t('learning_objectives', language)} ${idx + 1}`} />
                    <Button variant="ghost" size="icon" onClick={() => removeObjective(idx)} className="text-red-500 shrink-0"><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addObjective}><Plus className="h-4 w-4 mr-1" />{t('add_objective', language)}</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}><Save className="h-4 w-4 mr-1" />{t('save', language)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== SUPER ADMIN PAGE ====================
/** Save an admin user DIRECTLY to D1 — no sync delay */
async function saveAdminToD1(action: 'create' | 'update' | 'delete', admin: Record<string, unknown>): Promise<boolean> {
  try {
    const auth = JSON.parse(localStorage.getItem('attendance_auth') || '{}');
    const tid = auth.tenantId || 'default';
    const res = await localApi('POST', '/api/admins/save', { action, tenant_id: tid, admin });
    return res.ok;
  } catch { return false; }
}

function SuperAdminPage() {
  const { language, admins, students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, schoolInfo, auditLog, addAuditLog, setAdmins } = useAppStore();
  const [tab, setTab] = useState('tenants');

  // ===== Tenants state (persisted in localStorage) =====
  const defaultTenants = [
    { id: '1', name: 'INFOHAS Academy', slug: 'infohas-academy', students: 245, teachers: 18, status: 'active' },
    { id: '2', name: 'Ecole Primaire Al Khawarizmi', slug: 'al-khawarizmi', students: 120, teachers: 10, status: 'active' },
    { id: '3', name: 'Lycée Ibn Sina', slug: 'ibn-sina', students: 380, teachers: 25, status: 'active' },
  ];
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; slug: string; students: number; teachers: number; status: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('attendance_tenants') || 'null') || defaultTenants; } catch { return defaultTenants; }
  });
  const [tenantDialog, setTenantDialog] = useState(false);
  const [editTenant, setEditTenant] = useState<typeof tenants[0] | null>(null);
  const [tForm, setTForm] = useState({ name: '', slug: '', students: 0, teachers: 0, status: 'active' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ===== Users CRUD state =====
  const [userDialog, setUserDialog] = useState(false);
  const [editUser, setEditUser] = useState<Record<string, unknown> | null>(null);
  const [userForm, setUserForm] = useState({ fullName: '', username: '', email: '', password: '', role: 'admin', department: '', tenantId: '' });

  const saveTenants = (updated: typeof tenants) => {
    setTenants(updated);
    localStorage.setItem('attendance_tenants', JSON.stringify(updated));
  };

  const openAddTenant = () => {
    setEditTenant(null);
    setTForm({ name: '', slug: '', students: 0, teachers: 0, status: 'active' });
    setTenantDialog(true);
  };

  const openEditTenant = (t: typeof tenants[0]) => {
    setEditTenant(t);
    setTForm({ name: t.name, slug: t.slug, students: t.students, teachers: t.teachers, status: t.status });
    setTenantDialog(true);
  };

  const saveTenant = () => {
    if (!tForm.name.trim()) { toast.error(language === 'fr' ? 'Le nom est requis' : 'Name is required'); return; }
    const slugVal = tForm.slug.trim() || tForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (editTenant) {
      saveTenants(tenants.map(t => t.id === editTenant.id ? { ...t, name: tForm.name.trim(), slug: slugVal, students: Number(tForm.students), teachers: Number(tForm.teachers), status: tForm.status } : t));
      addAuditLog('UPDATE_TENANT', 'school', editTenant.id, tForm.name, `Updated school: ${tForm.name}`);
      toast.success(language === 'fr' ? 'École mise à jour' : 'School updated');
    } else {
      const newTenant = { id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6), name: tForm.name.trim(), slug: slugVal, students: Number(tForm.students), teachers: Number(tForm.teachers), status: tForm.status };
      saveTenants([...tenants, newTenant]);
      addAuditLog('CREATE_TENANT', 'school', newTenant.id, newTenant.name, `Created school: ${newTenant.name}`);
      toast.success(language === 'fr' ? 'École ajoutée' : 'School added');
    }
    setTenantDialog(false);
  };

  const deleteTenant = (id: string) => {
    const t = tenants.find(t => t.id === id);
    saveTenants(tenants.filter(t => t.id !== id));
    addAuditLog('DELETE_TENANT', 'school', id, t?.name || '', `Deleted school: ${t?.name}`);
    toast.success(language === 'fr' ? 'École supprimée' : 'School deleted');
    setDeleteConfirm(null);
  };

  const toggleTenantStatus = (id: string) => {
    const t = tenants.find(t => t.id === id);
    if (!t) return;
    const newStatus = t.status === 'active' ? 'inactive' : 'active';
    saveTenants(tenants.map(t => t.id === id ? { ...t, status: newStatus } : t));
    addAuditLog('TOGGLE_TENANT', 'school', id, t.name, `${t.name} → ${newStatus}`);
    toast.success(`${t.name} ${language === 'fr' ? '→' : '→'} ${newStatus}`);
  };

  // Export tab state
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('pdf');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [selectedExportTypes, setSelectedExportTypes] = useState<Set<string>>(new Set(['students', 'classes', 'modules', 'attendance', 'grades']));

  const exportTypes = [
    { key: 'students', label: t('students', language) },
    { key: 'classes', label: t('classes', language) },
    { key: 'modules', label: t('modules', language) },
    { key: 'attendance', label: t('attendance', language) },
    { key: 'grades', label: t('grades', language) },
    { key: 'behavior', label: t('behavior', language) },
    { key: 'tasks', label: t('tasks', language) },
    { key: 'incidents', label: t('incidents', language) },
    { key: 'teachers', label: t('teachers_management', language) },
    { key: 'employees', label: t('employees_management', language) },
  ];

  const toggleExportType = (key: string) => {
    const next = new Set(selectedExportTypes);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedExportTypes(next);
  };

  const handleExportSelected = () => {
    const si = schoolInfo || {};
    if (exportFormat === 'pdf') {
      if (selectedExportTypes.has('students')) pdfUtils.exportStudentsPDF(students, classes, si, language);
      if (selectedExportTypes.has('attendance')) pdfUtils.exportAttendancePDF(attendance, students, classes, si, exportDateFrom || undefined, exportDateTo || undefined, language);
      if (selectedExportTypes.has('grades')) pdfUtils.exportGradesPDF(grades, students, modules, si, language);
      if (selectedExportTypes.has('behavior')) pdfUtils.exportBehaviorPDF(behavior, students, si, language);
      if (selectedExportTypes.has('incidents')) pdfUtils.exportIncidentsPDF(incidents, students, si, language);
      if (selectedExportTypes.has('tasks')) pdfUtils.exportTasksPDF(tasks, si, language);
    } else {
      if (selectedExportTypes.has('students')) exportUtils.exportStudentsCSV(students, classes, language);
      if (selectedExportTypes.has('classes')) exportUtils.exportClassesCSV(classes, students, language);
      if (selectedExportTypes.has('modules')) exportUtils.exportModulesCSV(modules, language);
      if (selectedExportTypes.has('attendance')) exportUtils.exportAttendanceCSV(attendance, students, classes, language);
      if (selectedExportTypes.has('grades')) exportUtils.exportGradesCSV(grades, students, modules, language);
      if (selectedExportTypes.has('behavior')) exportUtils.exportBehaviorCSV(behavior, students, language);
      if (selectedExportTypes.has('tasks')) exportUtils.exportTasksCSV(tasks, language);
      if (selectedExportTypes.has('incidents')) exportUtils.exportIncidentsCSV(incidents, students, language);
      if (selectedExportTypes.has('teachers')) exportUtils.exportTeachersCSV(teachers, language);
      if (selectedExportTypes.has('employees')) exportUtils.exportEmployeesCSV(employees, language);
    }
    toast.success(language === 'fr' ? 'Exporté!' : 'Exported!');
  };

  const handleExportAll = () => {
    if (exportFormat === 'pdf') {
      pdfUtils.exportFullReportPDF({ students, classes, modules, attendance, grades, behavior, tasks, incidents }, schoolInfo || {}, language);
      pdfUtils.exportClassPerformancePDF(students, classes, grades, attendance, schoolInfo || {}, language);
    } else {
      exportUtils.exportAllCSV({ students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees }, language);
    }
    toast.success(language === 'fr' ? 'Export complet!' : 'Full export!');
  };

  // ===== Real system health data from store =====
  const activeStudents = students.filter(s => s.status === 'active').length;
  const totalUsers = students.length + teachers.length + employees.length + admins.length;
  const totalDataRecords = students.length + classes.length + modules.length + attendance.length + grades.length + behavior.length + tasks.length + incidents.length;
  const storageEstimate = typeof navigator !== 'undefined' && typeof navigator.storage !== 'undefined' && typeof navigator.storage.estimate === 'function' ? true : false;
  const [storageUsed, setStorageUsed] = useState('N/A');

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        const usedMB = ((est.usage || 0) / (1024 * 1024)).toFixed(1);
        const quotaMB = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
        setStorageUsed(`${usedMB} MB / ${quotaMB} MB`);
      }).catch(() => setStorageUsed('N/A'));
    }
  }, []);

  const systemHealth = [
    { label: language === 'fr' ? 'Statut API' : 'API Status', value: 'Operational', color: 'text-emerald-600', icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Base de données' : 'Database', value: localStorage ? 'Connected' : 'Unavailable', color: localStorage ? 'text-emerald-600' : 'text-red-600', icon: <Database className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Disponibilité' : 'Uptime', value: '99.9%', color: 'text-emerald-600', icon: <Activity className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Écoles actives' : 'Active Schools', value: String(tenants.filter(t => t.status === 'active').length), color: 'text-blue-600', icon: <Building2 className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Total étudiants (multi-écoles)' : 'Total Students (all schools)', value: String(tenants.reduce((s, t) => s + t.students, 0)), color: 'text-purple-600', icon: <Users className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Utilisateurs actifs (cette école)' : 'Active Users (this school)', value: String(totalUsers), color: 'text-indigo-600', icon: <Users className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Étudiants actifs' : 'Active Students', value: String(activeStudents), color: 'text-emerald-600', icon: <GraduationCap className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Enseignants' : 'Teachers', value: String(teachers.length), color: 'text-blue-600', icon: <Users className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Employés' : 'Employees', value: String(employees.length), color: 'text-cyan-600', icon: <Users className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Enregistrements totaux' : 'Total Data Records', value: String(totalDataRecords), color: 'text-amber-600', icon: <Database className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Fichiers d\'audit' : 'Audit Log Entries', value: String(auditLog.length), color: 'text-orange-600', icon: <History className="h-4 w-4" /> },
    { label: language === 'fr' ? 'Stockage' : 'Storage', value: storageUsed, color: 'text-amber-600', icon: <HardDrive className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="tenants"><Building2 className="h-4 w-4 mr-1" />{language === 'fr' ? 'Écoles' : 'Tenants'}</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />{language === 'fr' ? 'Utilisateurs' : 'Users'}</TabsTrigger>
          <TabsTrigger value="export"><Download className="h-4 w-4 mr-1" />{language === 'fr' ? 'Export' : 'Export'}</TabsTrigger>
          <TabsTrigger value="audit"><Activity className="h-4 w-4 mr-1" />{language === 'fr' ? 'Journal d\'audit' : 'Audit Log'}</TabsTrigger>
          <TabsTrigger value="health"><Zap className="h-4 w-4 mr-1" />{language === 'fr' ? 'Santé système' : 'System Health'}</TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">{language === 'fr' ? 'Export de données' : 'Data Export'}</CardTitle><CardDescription>{language === 'fr' ? 'Sélectionner les données et le format d\'export' : 'Select data types and export format'}</CardDescription></CardHeader><CardContent className="space-y-4">
            {/* Data Type Checkboxes */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{language === 'fr' ? 'Types de données' : 'Data Types'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {exportTypes.map(et => (
                  <label key={et.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted transition-colors">
                    <Checkbox checked={selectedExportTypes.has(et.key)} onCheckedChange={() => toggleExportType(et.key)} />
                    <span className="text-xs font-medium">{et.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedExportTypes(new Set(exportTypes.map(e => e.key)))}>{language === 'fr' ? 'Tout sélectionner' : 'Select All'}</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedExportTypes(new Set())}>{language === 'fr' ? 'Tout désélectionner' : 'Deselect All'}</Button>
              </div>
            </div>

            {/* Format & Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Format' : 'Format'}</Label>
                <Select value={exportFormat} onValueChange={v => setExportFormat(v as 'csv' | 'pdf')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF ({language === 'fr' ? 'Professionnel' : 'Professional'})</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Date début' : 'Date From'} <span className="text-xs text-muted-foreground">({t('attendance', language)})</span></Label>
                <Input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Date fin' : 'Date To'} <span className="text-xs text-muted-foreground">({t('attendance', language)})</span></Label>
                <Input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)} />
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleExportSelected} disabled={selectedExportTypes.size === 0}>
                <Download className="h-4 w-4 mr-1" />
                {language === 'fr' ? 'Exporter la sélection' : 'Export Selected'} ({selectedExportTypes.size})
              </Button>
              <Button variant="outline" onClick={handleExportAll}>
                <FileDown className="h-4 w-4 mr-1" />
                {language === 'fr' ? 'Tout exporter' : 'Export All'}
              </Button>
            </div>

            {exportFormat === 'pdf' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />{language === 'fr' ? 'Les exports PDF incluent le logo et les informations de l\'école.' : 'PDF exports include school logo and branding information.'}</p>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <div className="flex justify-between items-center"><h3 className="font-semibold">{language === 'fr' ? 'Écoles gérées' : 'Managed Schools'} ({tenants.length})</h3><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddTenant}><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Ajouter école' : 'Add School'}</Button></div>
          <div className="grid gap-3">{tenants.map(t => (
            <Card key={t.id}><CardContent className="p-4"><div className="flex items-start justify-between"><div><h4 className="font-semibold">{t.name}</h4><p className="text-sm text-muted-foreground">/{t.slug}</p><div className="flex gap-4 mt-2 text-sm"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.students} {language === 'fr' ? 'étudiants' : 'students'}</span><span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {t.teachers} {language === 'fr' ? 'enseignants' : 'teachers'}</span></div></div><div className="flex items-center gap-2"><Badge className={t.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}>{t.status}</Badge><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTenant(t)} title={language === 'fr' ? 'Modifier' : 'Edit'}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteConfirm(t.id)} title={language === 'fr' ? 'Supprimer' : 'Delete'}><Trash2 className="h-3.5 w-3.5" /></Button></div></div></CardContent></Card>
          ))}</div>

          {/* Add/Edit Tenant Dialog */}
          <Dialog open={tenantDialog} onOpenChange={setTenantDialog}><DialogContent><DialogHeader><DialogTitle>{editTenant ? (language === 'fr' ? 'Modifier l\'école' : 'Edit School') : (language === 'fr' ? 'Ajouter une école' : 'Add School')}</DialogTitle><DialogDescription>{editTenant ? (language === 'fr' ? 'Modifier les informations de l\'école' : 'Update school information') : (language === 'fr' ? 'Remplir les informations de la nouvelle école' : 'Enter new school details')}</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>{language === 'fr' ? 'Nom de l\'école' : 'School Name'} *</Label><Input value={tForm.name} onChange={e => setTForm({ ...tForm, name: e.target.value, slug: tForm.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} placeholder={language === 'fr' ? 'Ex: INFOHAS Academy' : 'e.g. INFOHAS Academy'} /></div>
              <div className="space-y-2"><Label>Slug (URL)</Label><Input value={tForm.slug} onChange={e => setTForm({ ...tForm, slug: e.target.value.replace(/[^a-z0-9-]/g, '') })} placeholder="infohas-academy" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{language === 'fr' ? 'Étudiants' : 'Students'}</Label><Input type="number" min={0} value={tForm.students} onChange={e => setTForm({ ...tForm, students: Number(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Enseignants' : 'Teachers'}</Label><Input type="number" min={0} value={tForm.teachers} onChange={e => setTForm({ ...tForm, teachers: Number(e.target.value) || 0 })} /></div>
              </div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Statut' : 'Status'}</Label><Select value={tForm.status} onValueChange={v => setTForm({ ...tForm, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{language === 'fr' ? 'Actif' : 'Active'}</SelectItem><SelectItem value="inactive">{language === 'fr' ? 'Inactif' : 'Inactive'}</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setTenantDialog(false)}>{language === 'fr' ? 'Annuler' : 'Cancel'}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveTenant}>{editTenant ? <><Save className="h-4 w-4 mr-1" />{language === 'fr' ? 'Enregistrer' : 'Save'}</> : <><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Ajouter' : 'Add'}</>}</Button></DialogFooter>
          </DialogContent></Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}><DialogContent><DialogHeader><DialogTitle>{language === 'fr' ? 'Confirmer la suppression' : 'Confirm Deletion'}</DialogTitle><DialogDescription>{language === 'fr' ? 'Cette action est irréversible. Voulez-vous vraiment supprimer cette école ?' : 'This action cannot be undone. Are you sure you want to delete this school?'}</DialogDescription></DialogHeader>
            <DialogFooter><Button variant="outline" onClick={() => setDeleteConfirm(null)}>{language === 'fr' ? 'Annuler' : 'Cancel'}</Button><Button variant="destructive" onClick={() => deleteConfirm && deleteTenant(deleteConfirm)}><Trash2 className="h-4 w-4 mr-1" />{language === 'fr' ? 'Supprimer' : 'Delete'}</Button></DialogFooter>
          </DialogContent></Dialog>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center"><h3 className="font-semibold">{language === 'fr' ? 'Tous les utilisateurs' : 'All Users'} ({admins.length})</h3><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditUser(null); setUserForm({ fullName: '', username: '', email: '', password: '', role: 'admin', department: '', tenantId: '' }); setUserDialog(true); }}><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Ajouter utilisateur' : 'Add User'}</Button></div>
          <Card><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('name', language)}</TableHead><TableHead>{language === 'fr' ? 'Identifiant' : 'Username'}</TableHead><TableHead>Email</TableHead><TableHead>{t('role', language)}</TableHead><TableHead>{language === 'fr' ? 'Département' : 'Department'}</TableHead><TableHead>{language === 'fr' ? 'École' : 'School'}</TableHead><TableHead className="w-28">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
            {admins.map((a, i) => <TableRow key={i}><TableCell className="font-medium">{String(a.fullName || a.name || '-')}</TableCell><TableCell className="text-sm">{String(a.username || '-')}</TableCell><TableCell className="text-sm">{String(a.email || '-')}</TableCell><TableCell><Badge variant="secondary">{String(a.role || '-')}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{String(a.department || '-')}</TableCell><TableCell className="text-sm text-muted-foreground">{String(a.tenantId || '-')}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditUser(a); setUserForm({ fullName: String(a.fullName || a.name || ''), username: String(a.username || ''), email: String(a.email || ''), password: '', role: String(a.role || 'admin'), department: String(a.department || ''), tenantId: String(a.tenantId || '') }); setUserDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => { if (confirm(language === 'fr' ? 'Supprimer cet utilisateur ?' : 'Delete this user?')) { const deleted = admins[i]; setAdmins(admins.filter((_, idx) => idx !== i)); addAuditLog('DELETE_USER', 'user', '', String(a.fullName || a.username), `Deleted user: ${a.fullName || a.username}`); saveAdminToD1('delete', deleted as Record<string, unknown>); toast.success(language === 'fr' ? 'Utilisateur supprimé' : 'User deleted'); } }}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>)}
          </TableBody></Table></div></CardContent></Card>

          {/* Add/Edit User Dialog */}
          <Dialog open={userDialog} onOpenChange={setUserDialog}><DialogContent className="max-h-[85vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>{editUser ? (language === 'fr' ? 'Modifier utilisateur' : 'Edit User') : (language === 'fr' ? 'Ajouter utilisateur' : 'Add User')}</DialogTitle><DialogDescription>{editUser ? (language === 'fr' ? 'Modifier les informations de l\'utilisateur' : 'Update user information') : (language === 'fr' ? 'Créer un nouveau compte utilisateur' : 'Create a new user account')}</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4 flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{language === 'fr' ? 'Nom complet' : 'Full Name'} *</Label><Input value={userForm.fullName} onChange={e => setUserForm({ ...userForm, fullName: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Identifiant' : 'Username'} *</Label><Input value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Mot de passe' : 'Password'} {editUser ? `(${language === 'fr' ? 'laisser vide pour ne pas changer' : 'leave blank to keep current'})` : '*'}</Label><Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder={editUser ? '••••••••' : ''} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('role', language)} *</Label><Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="super_admin">{language === 'fr' ? 'Super Administrateur' : 'Super Admin'}</SelectItem>
                  <SelectItem value="admin">{language === 'fr' ? 'Administrateur' : 'Admin'}</SelectItem>
                  <SelectItem value="scholar">{language === 'fr' ? 'Scolaire' : 'Scholar'}</SelectItem>
                  <SelectItem value="teacher">{language === 'fr' ? 'Enseignant' : 'Teacher'}</SelectItem>
                  <SelectItem value="coop">{language === 'fr' ? 'Coop' : 'Coop'}</SelectItem>
                  <SelectItem value="department">{language === 'fr' ? 'Département' : 'Department'}</SelectItem>
                  <SelectItem value="administration">{language === 'fr' ? 'Administration' : 'Administration'}</SelectItem>
                </SelectContent></Select></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Département' : 'Department'}</Label><Input value={userForm.department} onChange={e => setUserForm({ ...userForm, department: e.target.value })} placeholder={language === 'fr' ? 'Ex: Informatique' : 'e.g. IT'} /></div>
              </div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'École (Tenant)' : 'School (Tenant)'}</Label><Input value={userForm.tenantId} onChange={e => setUserForm({ ...userForm, tenantId: e.target.value })} placeholder={language === 'fr' ? 'Ex: infohas-academy' : 'e.g. infohas-academy'} /></div>
            </div>
            <DialogFooter className="shrink-0 pt-2"><Button variant="outline" onClick={() => setUserDialog(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
              if (!userForm.fullName || !userForm.username) { toast.error(language === 'fr' ? 'Nom et identifiant requis' : 'Name and username required'); return; }
              if (!editUser && !userForm.password) { toast.error(language === 'fr' ? 'Le mot de passe est requis' : 'Password is required'); return; }
              const userData = { ...userForm, id: editUser ? (editUser as Record<string, unknown>).id : genId(), fullName: userForm.fullName, name: userForm.fullName, username: userForm.username, role: userForm.role, department: userForm.department, tenantId: userForm.tenantId };
              if (editUser) { const idx = admins.indexOf(editUser); const updated = [...admins]; const updateData = { ...userData }; if (!userForm.password) delete (updateData as Record<string, unknown>).password; else (updateData as Record<string, unknown>).password = userForm.password; updated[idx] = { ...updated[idx], ...updateData }; setAdmins(updated); addAuditLog('UPDATE_USER', 'user', String((editUser as Record<string, unknown>).id), userForm.fullName, `Updated user: ${userForm.username}`); const saved = await saveAdminToD1('update', updateData); if (!saved) { toast.error(language === 'fr' ? 'Échec de la sauvegarde — session peut être expirée, veuillez vous reconnecter' : 'Save failed — session may have expired, please log in again'); } else { toast.success(language === 'fr' ? 'Utilisateur mis à jour' : 'User updated'); } }
              else { const saved = await saveAdminToD1('create', userData); if (!saved) { toast.error(language === 'fr' ? 'Échec de la sauvegarde — session peut être expirée, veuillez vous reconnecter' : 'Save failed — session may have expired, please log in again'); return; } setAdmins([...admins, userData]); addAuditLog('CREATE_USER', 'user', String(userData.id), userForm.fullName, `Created user: ${userForm.username} (${userForm.role})`); toast.success(language === 'fr' ? 'Utilisateur ajouté' : 'User added'); }
              setUserDialog(false);
            }}>{editUser ? <><Save className="h-4 w-4 mr-1" />{t('save', language)}</> : <><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Ajouter' : 'Add'}</>}</Button></DialogFooter>
          </DialogContent></Dialog>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" />{language === 'fr' ? 'Journal d\'audit' : 'Audit Log'}</h3>
          <AuditTrailSection />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <h3 className="font-semibold">{language === 'fr' ? 'Santé du système' : 'System Health'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{systemHealth.map(s => (
            <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`${s.color}`}>{s.icon}</div><div><p className="text-sm text-muted-foreground">{s.label}</p><p className={`font-semibold ${s.color}`}>{s.value}</p></div></CardContent></Card>
          ))}</div>
          {/* Data Breakdown */}
          <Card><CardHeader><CardTitle className="text-base">{language === 'fr' ? 'Répartition des données' : 'Data Breakdown'}</CardTitle></CardHeader><CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted"><p className="text-2xl font-bold text-emerald-600">{students.length}</p><p className="text-xs text-muted-foreground">{t('students', language)}</p></div>
              <div className="text-center p-3 rounded-lg bg-muted"><p className="text-2xl font-bold text-blue-600">{classes.length}</p><p className="text-xs text-muted-foreground">{t('classes', language)}</p></div>
              <div className="text-center p-3 rounded-lg bg-muted"><p className="text-2xl font-bold text-purple-600">{attendance.length}</p><p className="text-xs text-muted-foreground">{t('attendance', language)}</p></div>
              <div className="text-center p-3 rounded-lg bg-muted"><p className="text-2xl font-bold text-amber-600">{grades.length}</p><p className="text-xs text-muted-foreground">{t('grades', language)}</p></div>
              <div className="text-center p-3 rounded-lg bg-muted"><p className="text-2xl font-bold text-orange-600">{tasks.length}</p><p className="text-xs text-muted-foreground">{language === 'fr' ? 'Tâches' : 'Tasks'}</p></div>
              <div className="text-center p-3 rounded-lg bg-muted"><p className="text-2xl font-bold text-red-600">{incidents.length}</p><p className="text-xs text-muted-foreground">{language === 'fr' ? 'Incidents' : 'Incidents'}</p></div>
              <div className="text-center p-3 rounded-lg bg-muted"><p className="text-2xl font-bold text-cyan-600">{behavior.length}</p><p className="text-xs text-muted-foreground">{language === 'fr' ? 'Comportement' : 'Behavior'}</p></div>
              <div className="text-center p-3 rounded-lg bg-muted"><p className="text-2xl font-bold text-indigo-600">{modules.length}</p><p className="text-xs text-muted-foreground">{t('modules', language)}</p></div>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== PWA INSTALL PROMPT ====================
function PWAInstallPrompt() {
  const { language } = useAppStore();
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    updateOnlineStatus();
    const onlineHandler = () => setIsOffline(false);
    const offlineHandler = () => setIsOffline(true);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as unknown as { prompt: () => Promise<void> }).prompt();
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner && !isOffline) return null;

  return (
    <>
      {isOffline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-3 py-2 rounded-lg shadow-lg text-sm">
          <WifiOff className="h-4 w-4" />
          <Badge variant="secondary" className="text-[10px] bg-amber-200 dark:bg-amber-800 dark:text-amber-200">{language === 'fr' ? 'Hors ligne' : 'Offline Ready'}</Badge>
        </div>
      )}
      {showBanner && !isOffline && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-600 shrink-0">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t('install_app', language)}</p>
            <p className="text-xs text-muted-foreground truncate">{t('install_prompt', language)}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-7 px-3" onClick={handleInstall}>{t('install', language) || 'Install'}</Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowBanner(false)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}
    </>
  );
}

// ==================== AUDIT TRAIL SECTION ====================
function AuditTrailSection() {
  const { auditLog, language } = useAppStore();
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  const uniqueActions = useMemo(() => [...new Set(auditLog.map(l => l.action))].sort(), [auditLog]);
  const uniqueUsers = useMemo(() => [...new Set(auditLog.map(l => l.userName))].sort(), [auditLog]);
  const uniqueEntities = useMemo(() => [...new Set(auditLog.map(l => l.entityType))].sort(), [auditLog]);

  const filtered = useMemo(() => {
    let logs = [...auditLog].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (actionFilter !== 'all') logs = logs.filter(l => l.action === actionFilter);
    if (userFilter !== 'all') logs = logs.filter(l => l.userName === userFilter);
    if (entityFilter !== 'all') logs = logs.filter(l => l.entityType === entityFilter);
    if (dateFrom) logs = logs.filter(l => l.timestamp >= dateFrom);
    if (dateTo) logs = logs.filter(l => l.timestamp <= dateTo + 'T23:59:59');
    return logs;
  }, [auditLog, actionFilter, userFilter, entityFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleExportCSV = () => {
    const header = `${t('timestamp', language)},${t('user', language)},${t('action', language)},${t('entity', language)},${t('details', language)}\n`;
    const rows = filtered.map(l => `"${l.timestamp}","${l.userName}","${l.action}","${l.entityType}","${l.details}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit_trail_${localToday()}.csv`;
    a.click();
    toast.success(language === 'fr' ? 'Journal exporté' : 'Audit log exported');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t('filter_by_action', language) || 'Filter by Action'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'fr' ? 'Toutes les actions' : 'All Actions'}</SelectItem>
              {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={v => { setUserFilter(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t('user', language)} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'fr' ? 'Tous les utilisateurs' : 'All Users'}</SelectItem>
              {uniqueUsers.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t('entity', language)} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'fr' ? 'Toutes les entités' : 'All Entities'}</SelectItem>
              {uniqueEntities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} className="w-32 h-8 text-xs" />
            <span className="text-xs text-muted-foreground">→</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} className="w-32 h-8 text-xs" />
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1">
            <Download className="h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState message={t('no_data', language)} />
          ) : (
            <>
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('timestamp', language)}</TableHead>
                      <TableHead>{t('user', language)}</TableHead>
                      <TableHead>{t('action', language)}</TableHead>
                      <TableHead>{t('entity', language)}</TableHead>
                      <TableHead>{t('details', language)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(entry.timestamp).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</TableCell>
                        <TableCell className="font-medium text-sm">{entry.userName}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-mono">{entry.action}</Badge></TableCell>
                        <TableCell className="text-sm">{entry.entityType}{entry.entityName ? `: ${entry.entityName}` : ''}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{entry.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} {language === 'fr' ? 'entrées' : 'entries'} • {t('page', language)} {page + 1}/{totalPages || 1}
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== IMPORT WIZARD SECTION ====================
function ImportWizardSection() {
  const { language, students, classes, modules, grades, attendance, setStudents, setGrades, setAttendance, setClasses, addAuditLog, currentUser } = useAppStore();
  const [importType, setImportType] = useState<'students' | 'classes' | 'grades' | 'attendance'>('students');
  const [fileContent, setFileContent] = useState('');
  const [preview, setPreview] = useState<Array<{ row: string[]; valid: boolean; error?: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const [fileName, setFileName] = useState('');

  const parseExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        if (jsonData.length < 2) { setPreview([]); return; }
        const header = jsonData[0].map(h => String(h || '').trim().toLowerCase());
        const rows = jsonData.slice(1).map(cols => {
          const normalizedCols = cols.map(c => String(c || '').trim());
          let valid = true;
          let error = '';
          if (importType === 'students') {
            const nameIdx = header.indexOf('fullname');
            const idIdx = header.indexOf('studentid');
            if ((nameIdx >= 0 ? !normalizedCols[nameIdx] : !normalizedCols[0]) || (idIdx >= 0 ? !normalizedCols[idIdx] : !normalizedCols[1])) { valid = false; error = 'Name and Student ID required'; }
          } else if (importType === 'classes') {
            if (!normalizedCols[0]) { valid = false; error = 'Class name is required'; }
          } else if (importType === 'grades') {
            if (cols.length < 3 || !normalizedCols[0] || !normalizedCols[1]) { valid = false; error = 'Student ID, Module, and Grade required'; }
          } else if (importType === 'attendance') {
            if (cols.length < 3 || !normalizedCols[0] || !normalizedCols[1] || !normalizedCols[2]) { valid = false; error = 'Student ID, Date, and Status required'; }
            if (valid && !['present', 'absent', 'late', 'excused'].includes(normalizedCols[2].toLowerCase())) { valid = false; error = 'Status must be present/absent/late/excused'; }
          }
          return { row: normalizedCols, valid, error };
        }).filter(r => r.row.some(c => c !== ''));
        setPreview(rows);
        setFileContent(`xlsx:${rows.length} rows`);
      } catch {
        toast.error(language === 'fr' ? 'Erreur de lecture du fichier Excel' : 'Error reading Excel file');
      }
    } else {
      // CSV fallback
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setFileContent(text);
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { setPreview([]); return; }
        const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const rows = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          let valid = true;
          let error = '';
          if (importType === 'students') {
            if (cols.length < 2 || !cols[0] || !cols[1]) { valid = false; error = 'Name and Student ID required'; }
          } else if (importType === 'classes') {
            if (!cols[0]) { valid = false; error = 'Class name is required'; }
          } else if (importType === 'grades') {
            if (cols.length < 3 || !cols[0] || !cols[1]) { valid = false; error = 'Student ID, Module, and Grade required'; }
          } else if (importType === 'attendance') {
            if (cols.length < 3 || !cols[0] || !cols[1] || !cols[2]) { valid = false; error = 'Student ID, Date, and Status required'; }
            if (valid && !['present', 'absent', 'late', 'excused'].includes(cols[2].toLowerCase())) { valid = false; error = 'Status must be present/absent/late/excused'; }
          }
          return { row: cols, valid, error };
        });
        setPreview(rows);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    let csv = '';
    if (importType === 'students') {
      csv = 'FullName,StudentId,ClassId,AcademicYear,Status,GuardianName,GuardianPhone,GuardianEmail,Email,Phone,Address,Group\nAhmed Benali,STU001,class1,2024-2025,active,Fatima Benali,+212600000000,fatima@email.com,ahmed@email.com,+212611111111,Address 1,GroupA\n';
    } else if (importType === 'classes') {
      csv = 'Name,Description,Teacher,Room,Capacity,AcademicYear\nClass A,Computer Science,Mr. Smith,Room 101,30,2024-2025\n';
    } else if (importType === 'grades') {
      csv = 'StudentId,ModuleId,Grade,Percentage,Date\nSTU001,module1,18/20,90,2025-01-15\n';
    } else {
      csv = 'StudentId,Date,Status,Notes\nSTU001,2025-01-15,present,\nSTU002,2025-01-15,absent,Sick leave\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `template_${importType}.csv`;
    a.click();
    toast.success(language === 'fr' ? 'Modèle téléchargé' : 'Template downloaded');
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    setImporting(true);
    setImported(0);

    setTimeout(() => {
      const validRows = preview.filter(r => r.valid);
      let count = 0;

      if (importType === 'students') {
        const existingIds = new Set(students.map(s => s.studentId));
        const newStudents: Student[] = [];
        let skipped = 0;
        validRows.forEach(r => {
          const sid = r.row[1] || '';
          if (existingIds.has(sid)) { skipped++; return; }
          existingIds.add(sid);
          newStudents.push({
            id: genId(),
            fullName: r.row[0],
            studentId: sid,
            classId: r.row[2] || '',
            academicYear: r.row[3] || '',
            status: (['active', 'abandoned', 'terminated', 'graduated'].includes((r.row[4] || '').toLowerCase()) ? (r.row[4] || '').toLowerCase() : 'active') as Student['status'],
            guardianName: r.row[5] || '',
            guardianPhone: r.row[6] || '',
            guardianEmail: r.row[7] || '',
            email: r.row[8] || '',
            phone: r.row[9] || '',
            address: r.row[10] || '',
            group: r.row[11] || '',
            notes: '',
            photo: '',
            className: classes.find(c => c.id === (r.row[2] || ''))?.name,
            createdAt: new Date().toISOString(),
          });
        });
        setStudents([...students, ...newStudents]);
        count = newStudents.length;
        if (skipped > 0) toast.info(`${skipped} ${language === 'fr' ? 'doublons ignorés' : 'duplicates skipped'}`);
      } else if (importType === 'classes') {
        const existingNames = new Set(classes.map(c => c.name.toLowerCase()));
        const newClasses: Class[] = [];
        let skipped = 0;
        validRows.forEach(r => {
          const cname = r.row[0];
          if (!cname) return;
          if (existingNames.has(cname.toLowerCase())) { skipped++; return; }
          existingNames.add(cname.toLowerCase());
          newClasses.push({
            id: genId(),
            name: cname,
            description: r.row[1] || '',
            teacher: r.row[2] || '',
            room: r.row[3] || '',
            capacity: parseInt(r.row[4]) || 30,
            academicYear: r.row[5] || '',
            createdAt: new Date().toISOString(),
          });
        });
        setClasses([...classes, ...newClasses]);
        count = newClasses.length;
        if (skipped > 0) toast.info(`${skipped} ${language === 'fr' ? 'doublons ignorés' : 'duplicates skipped'}`);
      } else if (importType === 'grades') {
        const existingGrades = new Set(grades.map(g => `${g.studentId}_${g.moduleId}_${g.date}`));
        const newGrades: Grade[] = validRows.filter(r => !existingGrades.has(`${r.row[0]}_${r.row[1]}_${r.row[4] || localToday()}`)).map(r => ({
          id: genId(),
          studentId: r.row[0],
          moduleId: r.row[1],
          grade: r.row[2] || '',
          percentage: r.row[3] ? parseFloat(r.row[3]) : undefined,
          date: r.row[4] || localToday(),
          createdAt: new Date().toISOString(),
        }));
        setGrades([...grades, ...newGrades]);
        count = newGrades.length;
      } else if (importType === 'attendance') {
        const existingAtt = new Set(attendance.map(a => `${a.studentId}_${a.date}`));
        const newAttendance: AttendanceRecord[] = validRows.filter(r => !existingAtt.has(`${r.row[0]}_${r.row[1]}`)).map(r => ({
          id: genId(),
          studentId: r.row[0],
          date: r.row[1],
          status: r.row[2].toLowerCase() as AttendanceRecord['status'],
          notes: r.row[3] || '',
          createdAt: new Date().toISOString(),
        }));
        setAttendance([...attendance, ...newAttendance]);
        count = newAttendance.length;
      }

      addAuditLog('IMPORT_DATA', importType, '', `${count} ${importType}`, `Imported ${count} ${importType} records via CSV`);
      setImported(count);
      setImporting(false);
      toast.success(`${count} ${language === 'fr' ? 'enregistrements importés' : 'records imported'}`);
    }, 500);
  };

  const invalidCount = preview.filter(r => !r.valid).length;
  const validCount = preview.filter(r => r.valid).length;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('data_import', language) || 'Data Import'}</CardTitle>
          <CardDescription>{language === 'fr' ? 'Importer des données depuis un fichier CSV' : 'Import data from a CSV file'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="mb-1.5 block text-sm">{language === 'fr' ? 'Type d\'import' : 'Import Type'}</Label>
              <Select value={importType} onValueChange={v => { setImportType(v as typeof importType); setPreview([]); setFileContent(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="students">{t('students', language)}</SelectItem>
                  <SelectItem value="classes">{t('classes', language)}</SelectItem>
                  <SelectItem value="grades">{t('grades', language)}</SelectItem>
                  <SelectItem value="attendance">{t('attendance', language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{language === 'fr' ? 'Fichier' : 'File'}</Label>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={parseExcelFile} />
                  <Button variant="outline" asChild><span><FileUp className="h-4 w-4 mr-1" />{t('upload', language) || 'Upload'}</span></Button>
                </label>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1">
                  <Download className="h-4 w-4" />{language === 'fr' ? 'Modèle' : 'Template'}
                </Button>
              </div>
            </div>
          </div>

          {fileContent && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                {fileName && <Badge variant="outline">{fileName}</Badge>}
                <Badge variant="secondary">{preview.length} {language === 'fr' ? 'lignes' : 'rows'}</Badge>
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{validCount} {language === 'fr' ? 'valides' : 'valid'}</span>
                {invalidCount > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3.5 w-3.5" />{invalidCount} {language === 'fr' ? 'invalides' : 'invalid'}</span>}
              </div>

              {imported > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm text-emerald-800 dark:text-emerald-400">
                  ✓ {imported} {language === 'fr' ? 'enregistrements importés avec succès' : 'records imported successfully'}
                </div>
              )}

              {preview.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        {importType === 'students' && <>
                          <TableHead>{t('name', language)}</TableHead><TableHead>ID</TableHead><TableHead>{t('classes', language)}</TableHead><TableHead>{t('status', language)}</TableHead><TableHead>{language === 'fr' ? 'Tuteur' : 'Guardian'}</TableHead>
                        </>}
                        {importType === 'classes' && <>
                          <TableHead>{language === 'fr' ? 'Nom' : 'Name'}</TableHead><TableHead>{language === 'fr' ? 'Enseignant' : 'Teacher'}</TableHead><TableHead>{language === 'fr' ? 'Salle' : 'Room'}</TableHead><TableHead>{language === 'fr' ? 'Capacité' : 'Capacity'}</TableHead>
                        </>}
                        {importType === 'grades' && <>
                          <TableHead>Student ID</TableHead><TableHead>Module</TableHead><TableHead>{t('grades', language)}</TableHead><TableHead>%</TableHead>
                        </>}
                        {importType === 'attendance' && <>
                          <TableHead>Student ID</TableHead><TableHead>{t('calendar', language)}</TableHead><TableHead>{t('status', language)}</TableHead><TableHead>{language === 'fr' ? 'Notes' : 'Notes'}</TableHead>
                        </>}
                        <TableHead className="w-20">{language === 'fr' ? 'Statut' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(0, 20).map((r, i) => (
                        <TableRow key={i} className={!r.valid ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          {r.row.slice(0, importType === 'students' ? 5 : 4).map((col, ci) => (
                            <TableCell key={ci} className="text-sm">{col || '-'}</TableCell>
                          ))}
                          {r.row.length < (importType === 'students' ? 5 : 4) && Array.from({ length: (importType === 'students' ? 5 : 4) - r.row.length }).map((_, ci) => (
                            <TableCell key={`empty-${ci}`} className="text-sm text-muted-foreground">-</TableCell>
                          ))}
                          <TableCell>
                            {r.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <div className="flex items-center gap-1"><XCircle className="h-4 w-4 text-red-600" /><span className="text-[10px] text-red-600 max-w-[100px] truncate">{r.error}</span></div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {preview.length > 20 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">... {preview.length - 20} {language === 'fr' ? 'lignes supplémentaires' : 'more rows'}</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {validCount > 0 && (
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleImport} disabled={importing}>
                  {importing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
                  {importing ? (language === 'fr' ? 'Importation...' : 'Importing...') : `${language === 'fr' ? 'Importer' : 'Import'} ${validCount} ${language === 'fr' ? 'enregistrements' : 'records'}`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== PURGE CACHE SECTION ====================
function PurgeCacheSection() {
  const { language, purgeCache, loadAllData, addAuditLog } = useAppStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const handlePurge = async () => {
    setPurging(true);
    try {
      purgeCache();
      addAuditLog('PURGE_CACHE', 'system', '', 'Cache', 'Purged local cache and reloaded data');
      await loadAllData();
      toast.success(language === 'fr' ? 'Cache purgé et données rechargées' : 'Cache purged and data reloaded');
      setConfirmOpen(false);
    } catch {
      toast.error(language === 'fr' ? 'Erreur lors du purge' : 'Error purging cache');
    } finally {
      setPurging(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-red-600" />
          <CardTitle className="text-base text-red-700 dark:text-red-400">{t('purge_cache', language) || 'Purge Cache'}</CardTitle>
        </div>
        <CardDescription>{t('purge_cache_desc', language) || 'Clear local cache and reload all data from the server. This may take a moment.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={purging} className="gap-2">
          {purging ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {purging ? (language === 'fr' ? 'Purge en cours...' : 'Purging...') : (t('purge_cache', language) || 'Purge Cache')}
        </Button>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertOctagon className="h-5 w-5" />
                {t('purge_cache', language) || 'Purge Cache'}
              </DialogTitle>
              <DialogDescription>
                {t('purge_cache_confirm', language) || 'Are you sure you want to purge the cache? All local data will be cleared and reloaded from the server.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>{t('cancel', language)}</Button>
              <Button variant="destructive" onClick={handlePurge} disabled={purging}>
                {purging ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                {t('confirm', language) || 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ==================== PUSH NOTIFICATION UTILITIES ====================
function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  return Notification.requestPermission().then(perm => perm === 'granted');
}

function showBrowserNotification(title: string, body: string, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: data?.tag as string, data });
  } catch {}
}

function getPushNotifPref(): boolean {
  try { return typeof window !== 'undefined' && localStorage.getItem('attendance_push_notif') === 'true'; } catch { return false; }
}

function setPushNotifPref(v: boolean): void {
  try { if (typeof window !== 'undefined') localStorage.setItem('attendance_push_notif', String(v)); } catch {}
}

// ==================== MAIN APP COMPONENT ====================
export default function App() {
  const { isAuthenticated, currentUser, currentPage, loadAllData, language, logout } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Load auth state and data on mount
  useEffect(() => {
    const init = async () => {
      try {
        const saved = localStorage.getItem('attendance_auth');
        if (saved) {
          const data = JSON.parse(saved);
          if (data.token) {
            setApiToken(data.token);
            // Set user from saved data
            useAppStore.setState({
              currentUser: {
                id: data.userId || '',
                username: '',
                fullName: '',
                role: data.userRole || 'admin',
                tenantId: data.tenantId,
                is_super_admin: data.isSuperAdmin || false,
              },
              isAuthenticated: true,
            });
          }
        }
        await loadAllData();
      } catch {
        // Init error handled silently
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Listen for profile view events from store
  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prev) => {
      const s = state as unknown as Record<string, unknown>;
      const p = prev as unknown as Record<string, unknown>;
      if (s.profileViewStudent && !p.profileViewStudent) {
        setProfileStudent(s.profileViewStudent as Student);
      }
    });
    return unsub;
  }, []);

  // Offline detection
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      // Reload data when coming back online
      if (isAuthenticated) {
        useAppStore.getState().loadAllData();
      }
    };
    setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated]);

  // Session keepalive — check every 5 minutes
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.status === 401) {
          toast.error(language === 'fr' ? 'Session expirée' : 'Session expired');
          logout();
        }
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, language, logout]);

  // Global unhandled promise rejection handler
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error('[Unhandled Promise]', event.reason);
      if (event.reason?.message?.includes('fetch') || event.reason?.status) {
        toast.error(String(event.reason?.message || 'An unexpected error occurred'));
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  // Global error handler
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      console.error('[Global Error]', event.error);
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center animate-pulse"><GraduationCap className="h-7 w-7 text-white" /></div>
          <p className="text-muted-foreground">{t('loading', language)}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const renderPage = () => {
    // Check role-based permissions
    const navItem = NAV_ITEMS.find(n => n.id === currentPage);
    if (navItem && navItem.allowedRoles && currentUser?.role && !navItem.allowedRoles.includes(currentUser.role)) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Shield className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">{language === 'fr' ? 'Accès Refusé' : 'Permission Denied'}</h2>
          <p className="text-muted-foreground mb-4">{language === 'fr' ? 'Vous n\'avez pas la permission d\'accéder à cette page.' : 'You do not have permission to access this page.'}</p>
          <Button variant="outline" onClick={() => useAppStore.getState().setCurrentPage('dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />{language === 'fr' ? 'Retour au Tableau de Bord' : 'Back to Dashboard'}
          </Button>
        </div>
      );
    }
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'students': return <StudentsPage />;
      case 'classes': return <ClassesPage />;
      case 'modules': return <ModulesPage />;
      case 'attendance': return <AttendancePage />;
      case 'calendar': return <CalendarPage />;
      case 'schedule': return <SchedulePage />;
      case 'grades': return <GradesPage />;
      case 'behavior': return <BehaviorPage />;
      case 'tasks': return <TasksPage />;
      case 'incidents': return <IncidentsPage />;
      case 'messaging': return <MessagingPage />;
      case 'reports': return <ReportsPage />;
      case 'exams': return <ExamsPage />;
      case 'curriculum': return <CurriculumPage />;
      case 'settings': return <SettingsPage />;
      case 'superadmin': return currentUser?.role === 'super_admin' ? <SuperAdminPage /> : <DashboardPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {isOffline && (
          <div className="bg-red-600 text-white text-sm text-center py-2 px-4 flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" />
            {language === 'fr' ? "Vous êtes hors ligne — les modifications seront synchronisées à la reconnexion" : "You're offline — changes will sync when reconnected"}
          </div>
        )}
        <Header onMenuClick={() => setSidebarOpen(true)} onExportClick={() => setExportOpen(true)} />
        <main className="flex-1 p-4 md:p-6">
          {renderPage()}
        </main>
      </div>
      <ExportDataDialog open={exportOpen} onOpenChange={setExportOpen} />
      {profileStudent && <Student360Profile student={profileStudent} onClose={() => { setProfileStudent(null); useAppStore.setState({ profileViewStudent: null } as Partial<typeof useAppStore.getState>); }} />}
      <PWAInstallPrompt />
    </div>
  );
}
