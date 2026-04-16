'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { setApiToken } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, PageName, CalendarEvent } from '@/lib/types';
import * as exportUtils from '@/lib/export';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Flame, Award, Zap, Globe, Database, Activity, ToggleLeft, CreditCard, IdCard
} from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

type NavItem = { id: PageName; labelKey: string; icon: React.ReactNode; superAdminOnly?: boolean; };

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'students', labelKey: 'students', icon: <Users className="h-5 w-5" /> },
  { id: 'classes', labelKey: 'classes', icon: <GraduationCap className="h-5 w-5" /> },
  { id: 'modules', labelKey: 'modules', icon: <BookOpen className="h-5 w-5" /> },
  { id: 'attendance', labelKey: 'attendance', icon: <ClipboardCheck className="h-5 w-5" /> },
  { id: 'calendar', labelKey: 'calendar', icon: <Calendar className="h-5 w-5" /> },
  { id: 'grades', labelKey: 'grades', icon: <FileText className="h-5 w-5" /> },
  { id: 'behavior', labelKey: 'behavior', icon: <SmilePlus className="h-5 w-5" /> },
  { id: 'tasks', labelKey: 'tasks', icon: <ListTodo className="h-5 w-5" /> },
  { id: 'incidents', labelKey: 'incidents', icon: <AlertTriangle className="h-5 w-5" /> },
  { id: 'messaging', labelKey: 'messaging', icon: <MessageSquare className="h-5 w-5" /> },
  { id: 'reports', labelKey: 'reports', icon: <BarChart3 className="h-5 w-5" /> },
  { id: 'settings', labelKey: 'settings', icon: <Settings className="h-5 w-5" /> },
  { id: 'superadmin', labelKey: 'super_admin', icon: <Shield className="h-5 w-5" />, superAdminOnly: true },
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
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="secondary" className={STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}>{t(status)}</Badge>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><CircleDot className="h-12 w-12 mb-4 opacity-50" /><p>{message}</p></div>;
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }

function formatWhatsAppPhone(phone: string | undefined): string {
  if (!phone) return '';
  let c = phone.replace(/\D/g, '');
  if (c.length === 10) c = '1' + c;
  else if (c.length === 10 && c.startsWith('0')) c = '212' + c.substring(1);
  else if (c.length === 9 && c.startsWith('0')) c = '44' + c.substring(1);
  return c;
}

// ==================== GLOBAL SEARCH DIALOG ====================
function GlobalSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { students, classes, tasks, teachers, language, setCurrentPage } = useAppStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 100); } }, [open]);

  const q = query.toLowerCase();
  const results = useMemo(() => {
    if (!q || q.length < 2) return { students: [], classes: [], tasks: [], teachers: [] };
    return {
      students: students.filter(s => s.fullName?.toLowerCase().includes(q) || s.studentId?.toLowerCase().includes(q)).slice(0, 5),
      classes: classes.filter(c => c.name?.toLowerCase().includes(q) || c.teacher?.toLowerCase().includes(q)).slice(0, 5),
      tasks: tasks.filter(t => t.title?.toLowerCase().includes(q)).slice(0, 5),
      teachers: teachers.filter(t => t.name?.toLowerCase().includes(q)).slice(0, 5),
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
                  <button key={s.id} onClick={() => { onOpenChange(false); useAppStore.setState({ profileViewStudent: s }); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left">
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
  const today = new Date().toISOString().split('T')[0];
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
      const wsStr = ws.toISOString().split('T')[0];
      const weStr = we.toISOString().split('T')[0];
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

  const handleGenerateCard = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Student Card - ${student.fullName}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0}
      .card{width:320px;height:200px;background:white;border-radius:16px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.1);display:flex;flex-direction:column;justify-content:space-between;border:2px solid #10b981}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e5e7eb;padding-bottom:10px}
      .header h2{font-size:14px;color:#10b981}
      .body{display:flex;gap:16px;flex:1;align-items:center}
      .photo{width:64px;height:64px;background:#e5e7eb;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px}
      .info h3{font-size:16px;margin-bottom:4px}.info p{font-size:11px;color:#6b7280;margin:2px 0}
      .footer{display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
    </style></head><body><div class="card">
      <div class="header"><h2>INFOHAS</h2><span style="font-size:12px;color:#6b7280">${student.academicYear || ''}</span></div>
      <div class="body"><div class="photo">${student.photo ? `<img src="${student.photo}" style="width:64px;height:64px;border-radius:50%;object-fit:cover">` : '👤'}</div>
      <div class="info"><h3>${student.fullName}</h3><p>ID: ${student.studentId}</p><p>${studentClass?.name || '-'}</p><p>Year: ${student.academicYear || '-'}</p></div></div>
      <div class="footer"><span>Attendance: ${rate}%</span><span>Generated: ${new Date().toLocaleDateString()}</span></div>
    </div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const handleReport = () => {
    const csvContent = `Student Report - ${student.fullName}\n\nBasic Info\nName,${student.fullName}\nID,${student.studentId}\nClass,${studentClass?.name || '-'}\nAcademic Year,${student.academicYear || '-'}\nStatus,${student.status}\nGuardian,${student.guardianName || '-'}\nPhone,${student.guardianPhone || '-'}\nEmail,${student.email || '-'}\n\nAttendance Summary\nTotal Days,${total}\nPresent,${present}\nAbsent,${absent}\nLate,${late}\nExcused,${excused}\nRate,${rate}%\nCurrent Streak,${curStreak}\nBest Streak,${bestStreak}\n\nRecent Grades\n${sg.slice(0, 10).map(g => `${modules.find(m => m.id === g.moduleId)?.name || '-'},${g.grade || '-'},${g.percentage || '-'}%`).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `report_${student.studentId}.csv`; a.click();
    toast.success(language === 'fr' ? 'Rapport généré' : 'Report generated');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0 overflow-hidden bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
            {student.photo ? <img src={student.photo} alt="" className="w-full h-full object-cover" /> : student.fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{student.fullName}</h3>
            <p className="text-sm text-muted-foreground">{student.studentId} • {studentClass?.name || '-'}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Badge variant="secondary" className={statusColor}>{student.status}</Badge>
              <Badge variant="secondary">{student.academicYear || '-'}</Badge>
              {curStreak > 0 && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">🔥 {curStreak}</Badge>}
              {bestStreak > 2 && <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">⭐ {bestStreak}</Badge>}
              {avgGrade > 0 && <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Avg: {Math.round(avgGrade)}%</Badge>}
              {totalBp !== 0 && <Badge className={totalBp > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>{totalBp > 0 ? '+' : ''}{totalBp} pts</Badge>}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={handleReport}><FileText className="h-4 w-4 mr-1" />{t('report', language) || 'Report'}</Button>
            <Button variant="outline" size="sm" onClick={handleGenerateCard}><IdCard className="h-4 w-4 mr-1" />{t('generate_card', language) || 'Card'}</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 py-3 text-sm border-b">
          <div><span className="text-muted-foreground">{t('guardian', language)}:</span> <span className="font-medium ml-1">{student.guardianName || '-'}</span></div>
          <div><span className="text-muted-foreground">{t('phone', language)}:</span> <span className="font-medium ml-1">{student.guardianPhone || '-'}</span></div>
          <div><span className="text-muted-foreground">Email:</span> <span className="font-medium ml-1 break-all">{student.email || '-'}</span></div>
          <div><span className="text-muted-foreground">{language === 'fr' ? 'Adresse' : 'Address'}:</span> <span className="font-medium ml-1">{student.address || '-'}</span></div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="px-4">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="attendance">{t('attendance', language)}</TabsTrigger>
            <TabsTrigger value="trends">{t('trends', language) || 'Trends'}</TabsTrigger>
            <TabsTrigger value="grades">{t('grades', language)}</TabsTrigger>
            <TabsTrigger value="behavior">{t('behavior', language)}</TabsTrigger>
            <TabsTrigger value="incidents">{t('incidents', language)}</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[350px] px-4 pb-4">
          {tab === 'attendance' && <>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[{ label: t('present', language), val: present, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' }, { label: t('absent', language), val: absent, color: 'bg-red-100 text-red-700 dark:bg-red-900/30' }, { label: t('late', language), val: late, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' }, { label: t('excused', language), val: excused, color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30' }, { label: 'Rate', val: `${rate}%`, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30' }].map((s, i) => (
                <div key={i} className={`rounded-lg p-3 text-center ${s.color}`}><p className="text-xl font-bold">{s.val}</p><p className="text-xs opacity-70">{s.label}</p></div>
              ))}
            </div>
            {sa.length > 0 ? sa.slice(0, 30).map(a => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-border/50 text-sm">
                <span className="text-muted-foreground text-xs">{a.date}</span>
                <div className="flex items-center gap-1"><StatusBadge status={a.status} /><span className="text-xs">{a.notes && `• ${a.notes}`}</span></div>
              </div>
            )) : <EmptyState message={t('no_data', language)} />}
          </>}

          {tab === 'trends' && <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-lg p-3 text-center bg-amber-100 dark:bg-amber-900/20"><p className="text-2xl font-bold text-amber-700">🔥 {curStreak}</p><p className="text-xs text-amber-600">Current Streak</p></div>
              <div className="rounded-lg p-3 text-center bg-emerald-100 dark:bg-emerald-900/20"><p className="text-2xl font-bold text-emerald-700">⭐ {bestStreak}</p><p className="text-xs text-emerald-600">Best Streak</p></div>
              <div className="rounded-lg p-3 text-center bg-purple-100 dark:bg-purple-900/20"><p className="text-2xl font-bold text-purple-700">{rate}%</p><p className="text-xs text-purple-600">Attendance Rate</p></div>
            </div>
            <p className="text-sm font-semibold mb-3">{language === 'fr' ? '4 dernières semaines' : 'Last 4 Weeks'}</p>
            <div className="flex gap-3 items-end h-28 mb-6">
              {weeklyTrend.map(w => (
                <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold">{w.rate}%</span>
                  <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(w.rate, 5)}%`, minHeight: '8px', backgroundColor: w.rate >= 80 ? '#10b981' : w.rate >= 50 ? '#f59e0b' : '#ef4444' }} />
                  <span className="text-[10px] text-muted-foreground">{w.label}</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold mb-3">{language === 'fr' ? 'Résumé mensuel' : 'Monthly Summary'}</p>
            <div className="grid grid-cols-3 gap-2">
              {monthlyData.length > 0 ? monthlyData.map(m => (
                <div key={m.month} className="rounded-lg border p-2.5 text-center">
                  <p className="text-xs text-muted-foreground">{m.month}</p>
                  <p className="text-lg font-bold" style={{ color: m.rate >= 80 ? '#10b981' : m.rate >= 50 ? '#f59e0b' : '#ef4444' }}>{m.rate}%</p>
                  <p className="text-[10px] text-muted-foreground">{m.present}/{m.total}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground col-span-3">{t('no_data', language)}</p>}
            </div>
          </>}

          {tab === 'grades' && (sg.length > 0 ? sg.map(g => {
            const mod = modules.find(m => m.id === g.moduleId);
            const pct = g.percentage ? parseFloat(String(g.percentage)) : 0;
            return <div key={g.id} className="flex items-center justify-between py-1.5 border-b border-border/50 text-sm">
              <span className="text-xs text-muted-foreground">{g.date || '-'}</span>
              <span>{mod?.name || '-'} — <strong>{g.grade || '-'}</strong> <span style={{ color: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }} className="font-semibold">({g.percentage || '-'}%)</span></span>
            </div>;
          }) : <EmptyState message={t('no_data', language)} />)}

          {tab === 'behavior' && (sb.length > 0 ? sb.map(b => {
            const icon = b.type === 'positive' ? '👍' : '👎';
            const col = b.type === 'positive' ? 'text-emerald-600' : 'text-red-600';
            return <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-border/50 text-sm">
              <span className="text-xs text-muted-foreground">{b.date || '-'}</span>
              <span>{icon} <span className={`font-semibold ${col}`}>{b.type}</span> — {b.description || '-'} <span className="font-semibold">{b.points && b.points > 0 ? '+' : ''}{b.points || 0} pts</span></span>
            </div>;
          }) : <EmptyState message={t('no_data', language)} />)}

          {tab === 'incidents' && (si.length > 0 ? si.map(inc => {
            const sevCol = { low: 'text-amber-600', medium: 'text-orange-600', high: 'text-red-600', critical: 'text-red-700' }[inc.severity] || 'text-gray-600';
            return <div key={inc.id} className="flex items-center justify-between py-1.5 border-b border-border/50 text-sm">
              <span className="text-xs text-muted-foreground">{inc.date || '-'}</span>
              <span><span className={`font-semibold ${sevCol}`}>{inc.severity}</span> — {inc.description || '-'} <StatusBadge status={inc.status} /></span>
            </div>;
          }) : <EmptyState message={t('no_data', language)} />)}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ==================== LOGIN SCREEN ====================
function LoginScreen() {
  const { login, language } = useAppStore();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center"><GraduationCap className="h-9 w-9 text-white" /></div>
          <div><CardTitle className="text-2xl font-bold">INFOHAS</CardTitle><CardDescription className="text-sm mt-1">{language === 'fr' ? "Système de Gestion de Présence" : "Attendance Management System"}</CardDescription></div>
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
  const filteredNav = NAV_ITEMS.filter(item => !item.superAdminOnly || currentUser?.role === 'super_admin');
  const roleLabel = currentUser?.role === 'super_admin' ? 'SUPER_ADMIN' : currentUser?.role === 'admin' ? 'ADMIN' : currentUser?.role === 'teacher' ? 'TEACHER' : 'EMPLOYEE';

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0"><GraduationCap className="h-6 w-6 text-white" /></div>
            <div className="flex-1 min-w-0"><h2 className="font-bold text-sm truncate">{schoolInfo?.name || 'INFOHAS'}</h2><p className="text-xs text-muted-foreground truncate">{language === 'fr' ? 'Système de Gestion Scolaire' : 'School Management System'}</p></div>
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
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { useAppStore.setState({ language: language === 'en' ? 'fr' : 'en' }); toast.success(language === 'en' ? 'Langue: Français' : 'Language: English'); }}><Languages className="h-4 w-4" /><span className="hidden sm:inline">{language.toUpperCase()}</span></Button>
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
  const { students, classes, attendance, language, setCurrentPage } = useAppStore();
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 500); return () => clearTimeout(t); }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayRecords = attendance.filter(r => r.date === today);
  const presentCount = todayRecords.filter(r => r.status === 'present').length;
  const absentCount = todayRecords.filter(r => r.status === 'absent').length;
  const lateCount = todayRecords.filter(r => r.status === 'late').length;

  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const ds = d.toISOString().split('T')[0]; const dr = attendance.filter(r => r.date === ds); days.push({ date: d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' }), present: dr.filter(r => r.status === 'present').length, absent: dr.filter(r => r.status === 'absent').length, late: dr.filter(r => r.status === 'late').length }); }
    return days;
  }, [attendance, language]);

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
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base">{language === 'fr' ? 'Présence (7 jours)' : 'Attendance (7 days)'}</CardTitle></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={last7Days}><CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><ReTooltip /><Legend /><Bar dataKey="present" fill="#10b981" name={t('present', language)} radius={[4, 4, 0, 0]} /><Bar dataKey="absent" fill="#ef4444" name={t('absent', language)} radius={[4, 4, 0, 0]} /><Bar dataKey="late" fill="#f59e0b" name={t('late', language)} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base">{language === 'fr' ? "Distribution d'Aujourd'hui" : "Today's Distribution"}</CardTitle></CardHeader><CardContent><div className="h-64">{pieData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><ReTooltip /></PieChart></ResponsiveContainer> : <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('no_data', language)}</div>}</div></CardContent></Card>
      </div>
      <Card className="border-0 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{t('recent_activity', language)}</CardTitle></CardHeader><CardContent>
        {recentRecords.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
          <div className="max-h-96 overflow-y-auto custom-scrollbar"><Table><TableHeader><TableRow><TableHead>{t('students', language)}</TableHead><TableHead>{t('calendar', language)}</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
            {recentRecords.map(r => { const s = students.find(st => st.id === r.studentId); return <TableRow key={r.id}><TableCell className="font-medium">{s?.fullName || 'Unknown'}</TableCell><TableCell>{r.date}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell></TableRow>; })}
          </TableBody></Table></div>
        )}
      </CardContent></Card>
    </div>
  );
}

// ==================== STUDENTS PAGE ====================
function StudentsPage() {
  const { students, classes, language, setStudents, setCurrentPage, academicYears } = useAppStore();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({ fullName: '', studentId: '', classId: '', status: 'active' as Student['status'], guardianName: '', guardianPhone: '', phone: '', email: '', address: '', notes: '', group: '', photo: '' as string });
  const [sortBy, setSortBy] = useState('name_asc');
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchClassId, setBatchClassId] = useState('');

  const filtered = students.filter(s => {
    const ms = s.fullName.toLowerCase().includes(search.toLowerCase()) || s.studentId.toLowerCase().includes(search.toLowerCase()) || (s.guardianName || '').toLowerCase().includes(search.toLowerCase());
    return ms && (classFilter === 'all' || s.classId === classFilter) && (statusFilter === 'all' || s.status === statusFilter);
  }).sort((a, b) => { if (sortBy === 'name_asc') return a.fullName.localeCompare(b.fullName); if (sortBy === 'name_desc') return b.fullName.localeCompare(a.fullName); if (sortBy === 'id') return a.studentId.localeCompare(b.studentId); if (sortBy === 'date') return (b.createdAt || '').localeCompare(a.createdAt || ''); return 0; });

  const openAdd = () => { setEditing(null); setForm({ fullName: '', studentId: '', classId: '', status: 'active', guardianName: '', guardianPhone: '', phone: '', email: '', address: '', notes: '', group: '', photo: '' }); setDialogOpen(true); };
  const openEdit = (s: Student) => { setEditing(s); setForm({ fullName: s.fullName, studentId: s.studentId, classId: s.classId, status: s.status, guardianName: s.guardianName || '', guardianPhone: s.guardianPhone || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '', group: s.group || '', photo: s.photo || '' }); setDialogOpen(true); };
  const handleSave = () => {
    if (!form.fullName || !form.studentId) { toast.error('Name and Student ID are required'); return; }
    if (editing) { setStudents(students.map(s => s.id === editing.id ? { ...s, ...form, className: classes.find(c => c.id === form.classId)?.name } : s)); toast.success(language === 'fr' ? 'Étudiant modifié' : 'Student updated'); }
    else { setStudents([...students, { ...form, id: genId(), className: classes.find(c => c.id === form.classId)?.name, createdAt: new Date().toISOString() }]); toast.success(language === 'fr' ? 'Étudiant ajouté' : 'Student added'); }
    setDialogOpen(false);
  };
  const handleDelete = (id: string) => { setStudents(students.filter(s => s.id !== id)); toast.success(language === 'fr' ? 'Étudiant supprimé' : 'Student deleted'); };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setForm({ ...form, photo: ev.target?.result as string }); r.readAsDataURL(f); } };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (ev) => {
      const text = ev.target?.result as string; const lines = text.split('\n').filter(l => l.trim()); if (lines.length < 2) return;
      const h = lines[0].split(',').map(x => x.trim().toLowerCase()); const imported: Student[] = [];
      for (let i = 1; i < lines.length; i++) { const c = lines[i].split(',').map(x => x.trim().replace(/^"|"$/g, '')); if (c.length < 2) continue; imported.push({ id: genId(), fullName: c[h.indexOf('fullname') >= 0 ? h.indexOf('fullname') : 0] || c[0], studentId: c[h.indexOf('studentid') >= 0 ? h.indexOf('studentid') : 1] || c[1], classId: '', status: 'active', guardianName: c[h.indexOf('guardianname') >= 0 ? h.indexOf('guardianname') : -1] || '', phone: '', email: c[h.indexOf('email') >= 0 ? h.indexOf('email') : -1] || '', address: '', createdAt: new Date().toISOString() }); }
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
            <Button variant="outline" size="sm" onClick={() => { const ex = students.filter(s => selectedIds.has(s.id)); exportUtils.exportStudentsCSV(ex, classes); toast.success('Exported!'); }}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => { if (confirm(`Delete ${selectedIds.size} students?`)) { setStudents(students.filter(s => !selectedIds.has(s.id))); setSelectedIds(new Set()); toast.success('Deleted'); } }}><Trash2 className="h-4 w-4 mr-1" />{t('delete', language)}</Button>
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
          <Button variant="outline" size="sm" onClick={() => { exportUtils.exportStudentsCSV(students, classes); toast.success('Exported!'); }}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />PDF</Button>
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
  const filtered = filterItems ? filterItems(items, search) : items.filter(item => columns.some(col => String((item as Record<string, unknown>)[col.key] ?? '').toLowerCase().includes(search.toLowerCase()));

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
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar"><Table><TableHeader><TableRow>{columns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)<TableHead className="w-24">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
          {filtered.map(item => <TableRow key={item.id}>{columns.map(col => <TableCell key={col.key}>{col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '-')}</TableCell>)}
            <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(item); setForm({ ...item }); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setItems(items.filter(i => i.id !== item.id)); toast.success('Deleted'); }}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>)}
        </TableBody></Table></div>
      )}</CardContent></Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? t('edit', language) : t('add', language)} {title}</DialogTitle></DialogHeader><div className="py-4">{renderForm(form, setForm)}</div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

// ==================== CLASSES PAGE ====================
function ClassesPage() {
  const { classes, setClasses, students, language } = useAppStore();
  return <CrudPage<Class> title={t('classes', language)} items={classes} setItems={setClasses} columns={[
    { key: 'name', label: t('classes', language) }, { key: 'description', label: language === 'fr' ? 'Description' : 'Description' },
    { key: 'teacher', label: language === 'fr' ? 'Enseignant' : 'Teacher' }, { key: 'room', label: language === 'fr' ? 'Salle' : 'Room' }, { key: 'capacity', label: language === 'fr' ? 'Capacité' : 'Capacity' },
    { key: '_students', label: t('students', language), render: (item) => <Badge variant="secondary">{students.filter(s => s.classId === item.id).length}</Badge> },
  ]} renderForm={(item, onChange) => (
    <div className="grid gap-4">
      <div className="space-y-2"><Label>{t('classes', language)} *</Label><Input value={String(item.name || '')} onChange={e => onChange({ ...item, name: e.target.value })} /></div>
      <div className="space-y-2"><Label>Description</Label><Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={2} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{language === 'fr' ? 'Enseignant' : 'Teacher'}</Label><Input value={String(item.teacher || '')} onChange={e => onChange({ ...item, teacher: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Salle' : 'Room'}</Label><Input value={String(item.room || '')} onChange={e => onChange({ ...item, room: e.target.value })} /></div></div>
      <div className="space-y-2"><Label>{language === 'fr' ? 'Capacité' : 'Capacity'}</Label><Input type="number" value={String(item.capacity || 30)} onChange={e => onChange({ ...item, capacity: parseInt(e.target.value) || 30 })} /></div>
    </div>
  />} />;
}

// ==================== MODULES PAGE ====================
function ModulesPage() {
  const { modules, setModules, language } = useAppStore();
  return <CrudPage<Module> title={t('modules', language)} items={modules} setItems={setModules} columns={[
    { key: 'name', label: language === 'fr' ? 'Nom' : 'Name' }, { key: 'code', label: 'Code' }, { key: 'year', label: language === 'fr' ? 'Année' : 'Year' }, { key: 'semester', label: language === 'fr' ? 'Semestre' : 'Semester' }, { key: 'credits', label: language === 'fr' ? 'Crédits' : 'Credits' },
  ]} renderForm={(item, onChange) => (
    <div className="grid gap-4">
      <div className="space-y-2"><Label>{language === 'fr' ? 'Nom du Module' : 'Module Name'} *</Label><Input value={String(item.name || '')} onChange={e => onChange({ ...item, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Code</Label><Input value={String(item.code || '')} onChange={e => onChange({ ...item, code: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Crédits' : 'Credits'}</Label><Input type="number" value={String(item.credits || '')} onChange={e => onChange({ ...item, credits: parseInt(e.target.value) || 0 })} /></div></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{language === 'fr' ? 'Année' : 'Year'}</Label><Input value={String(item.year || '')} onChange={e => onChange({ ...item, year: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Semestre' : 'Semester'}</Label><Input value={String(item.semester || '')} onChange={e => onChange({ ...item, semester: e.target.value })} /></div></div>
      <div className="space-y-2"><Label>Description</Label><Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={2} /></div>
    </div>
  />} />;
}

// ==================== ATTENDANCE PAGE (with Quick Mode) ====================
function AttendancePage() {
  const { students, classes, attendance, setAttendance, templates, schoolInfo, language } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [overrides, setOverrides] = useState<Record<string, AttendanceRecord['status']>>({});
  const [saving, setSaving] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [quickBulk, setQuickBulk] = useState<Record<string, boolean>>({});

  const filteredStudents = students.filter(s => s.status === 'active' && (!selectedClass || selectedClass === 'all' || s.classId === selectedClass));
  const baseRecords = useMemo(() => { const m: Record<string, AttendanceRecord['status']> = {}; attendance.filter(r => r.date === selectedDate).forEach(r => { m[r.studentId] = r.status; }); return m; }, [selectedDate, attendance]);
  const localRecords = useMemo(() => ({ ...baseRecords, ...overrides }), [baseRecords, overrides]);

  const handleStatusChange = (sid: string, status: AttendanceRecord['status']) => {
    setOverrides(p => ({ ...p, [sid]: status }));
    if (status === 'absent' || status === 'late') {
      const s = students.find(st => st.id === sid);
      if (s?.guardianPhone) setTimeout(() => { sendAbsenceWhatsApp(sid); toast.success(`WhatsApp opened for ${s.guardianName || 'guardian'}`); }, 500);
    }
  };
  const handleMarkAll = (status: AttendanceRecord['status']) => {
    const m: Record<string, AttendanceRecord['status']> = {}; filteredStudents.forEach(s => { m[s.id] = status; }); setOverrides(m);
    if (status === 'absent' || status === 'late') { filteredStudents.filter(s => s.guardianPhone).forEach((s, i) => setTimeout(() => sendAbsenceWhatsApp(s.id), (i + 1) * 1000)); }
  };
  const handleSave = () => {
    setSaving(true);
    const updated = attendance.filter(r => r.date !== selectedDate);
    const newR: AttendanceRecord[] = [];
    filteredStudents.forEach(s => { const st = localRecords[s.id] || 'present'; const ex = attendance.find(r => r.date === selectedDate && r.studentId === s.id); if (ex) updated.push({ ...ex, status: st }); else newR.push({ id: genId(), studentId: s.id, date: selectedDate, status: st, createdAt: new Date().toISOString() }); });
    setAttendance([...updated, ...newR]); toast.success('Attendance saved!'); setTimeout(() => setSaving(false), 500);
  };
  const counts = { present: Object.values(localRecords).filter(s => s === 'present').length, absent: Object.values(localRecords).filter(s => s === 'absent').length, late: Object.values(localRecords).filter(s => s === 'late').length, excused: Object.values(localRecords).filter(s => s === 'excused').length, unmarked: filteredStudents.length - Object.keys(localRecords).filter(id => filteredStudents.some(s => s.id === id)).length };

  const sendAbsenceWhatsApp = (sid: string) => {
    const s = students.find(st => st.id === sid); if (!s?.guardianPhone) return;
    const st = localRecords[sid]; let tmpl = templates.find(t => { const n = t.name.toLowerCase(); if (st === 'late') return n.includes('late'); return n.includes('absence'); });
    if (!tmpl) tmpl = st === 'late' ? { id: '', name: 'Late', category: 'late', content: 'Hello {guardian_name}, {student_name} arrived late today ({date}).', createdAt: '' } : { id: '', name: 'Absence', category: 'absence', content: 'Dear {guardian_name}, {student_name} was marked absent today ({date}). Please contact us.', createdAt: '' };
    const msg = tmpl.content.replace(/{student_name}/g, s.fullName).replace(/{guardian_name}/g, s.guardianName || 'Guardian').replace(/{date}/g, new Date().toLocaleDateString()).replace(/{school_name}/g, schoolInfo?.name || 'School').replace(/{class}/g, classes.find(c => c.id === s.classId)?.name || 'class');
    window.open(`https://wa.me/${formatWhatsAppPhone(s.guardianPhone)}?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const handleQuickBulk = (status: AttendanceRecord['status']) => {
    const m: Record<string, AttendanceRecord['status']> = {}; filteredStudents.forEach(s => { m[s.id] = status; }); setQuickBulk({ ...m });
    Object.keys(m).length > 0 && toast.success(`${Object.keys(m).length} marked as ${status}`);
  };
  const handleQuickSave = () => {
    setSaving(true);
    const updated = attendance.filter(r => r.date !== selectedDate);
    const newR: AttendanceRecord[] = [];
    filteredStudents.forEach(s => { const st = quickBulk[s.id] || localRecords[s.id] || 'present'; const ex = attendance.find(r => r.date === selectedDate && r.studentId === s.id); if (ex) updated.push({ ...ex, status: st }); else newR.push({ id: genId(), studentId: s.id, date: selectedDate, status: st, createdAt: new Date().toISOString() }); });
    setAttendance([...updated, ...newR]); toast.success('Attendance saved!'); setQuickBulk({}); setTimeout(() => setSaving(false), 500);
  };

  const quickCounts = useMemo(() => {
    const src = quickBulk; if (Object.keys(src).length > 0) return { present: Object.values(src).filter(s => s === 'present').length, absent: Object.values(src).filter(s => s === 'absent').length, late: Object.values(src).filter(s => s === 'late').length, excused: Object.values(src).filter(s => s === 'excused').length, unmarked: filteredStudents.length - Object.keys(src).length };
    return counts;
  }, [quickBulk, filteredStudents]);

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
          {quickMode && <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleQuickBulk('present')}>✅ {t('present', language)} All</Button>}
          {quickMode && <Button variant="outline" size="sm" className="border-red-400 text-red-600" onClick={() => handleQuickBulk('absent')}>❌ {t('absent', language)} All</Button>}
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={quickMode ? handleQuickSave : handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" />{t('save', language)}</Button>
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
  const { attendance, students, classes, language, setCurrentPage } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>(() => { try { return JSON.parse(localStorage.getItem('calendar_events') || '[]'); } catch { return []; } });
  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], type: 'other' as CalendarEvent['type'], description: '', color: '#10b981' });
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => { try { localStorage.setItem('calendar_events', JSON.stringify(events)); } catch {} }, [events]);

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
    if (!eventForm.title || !eventForm.date) { toast.error('Title and date required'); return; }
    if (editingEvent) { setEvents(events.map(e => e.id === editingEvent.id ? { ...eventForm } : e)); }
    else setEvents([...events, { ...eventForm, id: genId(), createdAt: new Date().toISOString() }]);
    toast.success(language === 'fr' ? 'Événement sauvegardé' : 'Event saved');
    setEventOpen(false); setEditingEvent(null); setEventForm({ title: '', date: new Date().toISOString().split('T')[0], type: 'other', description: '', color: '#10b981' });
  };
  const openEditEvent = (e: CalendarEvent) => { setEditingEvent(e); setEventForm({ title: e.title, date: e.date, type: e.type, description: e.description || '', color: e.color || '#10b981' }); setEventOpen(true); };
  const handleDeleteEvent = (id: string) => { setEvents(events.filter(e => e.id !== id)); toast.success('Event deleted'); };

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
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 ml-auto" onClick={() => { setEditingEvent(null); setEventForm({ title: '', date: new Date().toISOString().split('T')[0], type: 'other', description: '', color: '#10b981' }); setEventOpen(true); }}><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Ajouter Événement' : 'Add Event'}</Button>
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">{dayNames.map(d => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {[...Array(startOffset)].map((_, i) => <div key={`e-${i}`} />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1; const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const recs = getRecordsForDay(day); const evts = getEventsForDay(day);
            const isToday = ds === new Date().toISOString().split('T')[0]; const isSel = selectedDay === ds;
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
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-border/50"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color || typeColors[e.type] || '#6b7280' }} /><div><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.type}</p></div></div>
              <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEvent(e)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteEvent(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
            </div>
          ))}</div>
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
