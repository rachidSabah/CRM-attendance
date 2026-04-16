'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { setApiToken, api } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, PageName, CalendarEvent, ClassScheduleEntry } from '@/lib/types';
import * as exportUtils from '@/lib/export';
import * as pdfUtils from '@/lib/pdf';

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
  Flame, Award, Zap, Globe, Database, Activity, ToggleLeft, CreditCard, IdCard,
  Palette, HardDrive, ChevronDown, Info, RotateCcw, Archive, Cloud, FolderOpen
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
  { id: 'schedule', labelKey: 'schedule', icon: <Clock className="h-5 w-5" /> },
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
  const filteredNav = NAV_ITEMS.filter(item => !item.superAdminOnly || currentUser?.role === 'super_admin');
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
    const days: Array<{ date: string; present: number; absent: number; late: number }> = [];
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
              <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(item); setForm({ ...item }); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => { setItems(items.filter(i => i.id !== item.id)); toast.success('Deleted'); }}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
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
  )} />
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
  )} />
}

// ==================== ATTENDANCE PAGE (with Quick Mode) ====================
function AttendancePage() {
  const { students, classes, attendance, setAttendance, templates, schoolInfo, language } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [overrides, setOverrides] = useState<Record<string, AttendanceRecord['status']>>({});
  const [saving, setSaving] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [quickBulk, setQuickBulk] = useState<Record<string, AttendanceRecord['status']>>({});

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
          {quickMode && <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleQuickBulk('present')}>✅ {t('present', language)} All</Button>}
          {quickMode && <Button variant="outline" size="sm" className="border-red-400 text-red-600" onClick={() => handleQuickBulk('absent')}>❌ {t('absent', language)} All</Button>}
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => quickMode ? handleQuickSave() : handleSave()} disabled={saving}><Save className="h-4 w-4 mr-1" />{t('save', language)}</Button>
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
    if (editingEvent) { setEvents(events.map(e => e.id === editingEvent.id ? { ...e, ...eventForm, id: e.id, createdAt: e.createdAt } : e)); }
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
  const { classes, teachers, modules, schedules, schoolInfo, language, setSchedules } = useAppStore();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingDay, setEditingDay] = useState<string | null>(null); // YYYY-MM-DD
  const [dialogOpen, setDialogOpen] = useState(false);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  // Form state for the editing day
  const [entryForm, setEntryForm] = useState({
    teacherId: '',
    roomId: '',
    timeSlot: '',
    moduleId: '',
    notes: '',
  });

  const TIME_SLOTS = [
    { value: '08:00-10:00', label: language === 'fr' ? '08:00 - 10:00' : '08:00 - 10:00' },
    { value: '10:00-12:00', label: language === 'fr' ? '10:00 - 12:00' : '10:00 - 12:00' },
    { value: '13:00-15:00', label: language === 'fr' ? '13:00 - 15:00' : '13:00 - 15:00' },
    { value: '15:00-17:00', label: language === 'fr' ? '15:00 - 17:00' : '15:00 - 17:00' },
    { value: '08:00-12:00', label: language === 'fr' ? '08:00 - 12:00' : '08:00 - 12:00' },
    { value: '13:00-17:00', label: language === 'fr' ? '13:00 - 17:00' : '13:00 - 17:00' },
    { value: '09:00-12:00', label: language === 'fr' ? '09:00 - 12:00' : '09:00 - 12:00' },
    { value: '14:00-17:00', label: language === 'fr' ? '14:00 - 17:00' : '14:00 - 17:00' },
  ];

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
        return `${language === 'fr' ? 'Conflit' : 'Conflict'}: ${conflictClass?.name || language === 'fr' ? 'Autre groupe' : 'Other group'} ${language === 'fr' ? 'a déjà cette salle réservée' : 'already booked this room'} (${roomId}) ${language === 'fr' ? 'à ce créneau' : 'at this time slot'}.`;
      }
      if (conflicting[0].teacherId === teacherId) {
        return `${language === 'fr' ? 'Conflit' : 'Conflict'}: ${conflictTeacher?.name || language === 'fr' ? 'Enseignant' : 'Teacher'} ${language === 'fr' ? 'est déjà assigné à' : 'is already assigned to'} ${conflictClass?.name || language === 'fr' ? 'un autre groupe' : 'another group'} ${language === 'fr' ? 'à ce créneau' : 'at this time slot'}.`;
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
      setEntryForm({
        teacherId: existing.teacherId,
        roomId: existing.roomId,
        timeSlot: existing.timeSlot,
        moduleId: existing.moduleId,
        notes: existing.notes || '',
      });
    } else {
      setEntryForm({ teacherId: '', roomId: '', timeSlot: '', moduleId: '', notes: '' });
    }
    setConflictMsg(null);
    setDialogOpen(true);
  };

  // Save entry
  const handleSaveEntry = () => {
    if (!editingDay || !selectedClassId) return;
    if (!entryForm.teacherId && !entryForm.roomId && !entryForm.timeSlot && !entryForm.moduleId) {
      toast.error(language === 'fr' ? 'Veuillez remplir au moins un champ' : 'Please fill at least one field');
      return;
    }

    // Check conflicts
    if (entryForm.roomId && entryForm.timeSlot) {
      const conflict = checkConflicts(editingDay, entryForm.timeSlot, entryForm.roomId, entryForm.teacherId, selectedClassId);
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
        timeSlot: entryForm.timeSlot,
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
        timeSlot: entryForm.timeSlot,
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
      schoolInfo
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
      schoolInfo
    );
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

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={!selectedClassId || classSchedules.length === 0}>
            <FileDown className="h-4 w-4 mr-1" />
            {t('download_schedule_pdf', language)}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadAllPDF} disabled={schedules.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            {language === 'fr' ? 'Tous les Emplois PDF' : 'All Schedules PDF'}
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
                  const isToday = ds === new Date().toISOString().split('T')[0];

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
                    const module = modules.find(m => m.id === entry.moduleId);
                    const day = parseInt(entry.date.split('-')[2]);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.date}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{entry.timeSlot}</Badge></TableCell>
                        <TableCell>{teacher?.name || '-'}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{entry.roomId || '-'}</Badge></TableCell>
                        <TableCell>{module?.name || '-'}</TableCell>
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

      {/* Schedule Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
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

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('assigned_time', language)}</Label>
              <Select value={entryForm.timeSlot} onValueChange={v => {
                setEntryForm({ ...entryForm, timeSlot: v });
                // Auto-check conflicts on change
                if (entryForm.roomId && editingDay && selectedClassId) {
                  const c = checkConflicts(editingDay, v, entryForm.roomId, entryForm.teacherId, selectedClassId);
                  setConflictMsg(c);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'fr' ? 'Sélectionner un créneau' : 'Select time slot'} />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(ts => (
                    <SelectItem key={ts.value} value={ts.value}>{ts.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('assigned_teacher', language)}</Label>
              <Select value={entryForm.teacherId} onValueChange={v => {
                setEntryForm({ ...entryForm, teacherId: v });
                if (entryForm.roomId && entryForm.timeSlot && editingDay && selectedClassId) {
                  const c = checkConflicts(editingDay, entryForm.timeSlot, entryForm.roomId, v, selectedClassId);
                  setConflictMsg(c);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'fr' ? 'Sélectionner un enseignant' : 'Select teacher'} />
                </SelectTrigger>
                <SelectContent>
                  {teachers.length === 0 && (
                    <SelectItem value="__none" disabled>{t('no_teachers', language)}</SelectItem>
                  )}
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
                if (entryForm.timeSlot && editingDay && selectedClassId) {
                  const c = checkConflicts(editingDay, entryForm.timeSlot, v, entryForm.teacherId, selectedClassId);
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
                  {modules.length === 0 && (
                    <SelectItem value="__none" disabled>{t('no_modules', language)}</SelectItem>
                  )}
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

          <DialogFooter className="gap-2">
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
    { key: 'students', label: t('students', language), fn: () => exportUtils.exportStudentsCSV(students, classes) },
    { key: 'attendance', label: t('attendance', language), fn: () => exportUtils.exportAttendanceCSV(attendance, students, classes) },
    { key: 'grades', label: t('grades', language), fn: () => exportUtils.exportGradesCSV(grades, students, modules) },
    { key: 'classes', label: t('classes', language), fn: () => exportUtils.exportClassesCSV(classes, students) },
    { key: 'modules', label: t('modules', language), fn: () => exportUtils.exportModulesCSV(modules) },
    { key: 'behavior', label: t('behavior', language), fn: () => exportUtils.exportBehaviorCSV(behavior, students) },
    { key: 'tasks', label: t('tasks', language), fn: () => exportUtils.exportTasksCSV(tasks) },
    { key: 'incidents', label: t('incidents', language), fn: () => exportUtils.exportIncidentsCSV(incidents, students) },
    { key: 'teachers', label: t('teachers_management', language), fn: () => exportUtils.exportTeachersCSV(teachers) },
    { key: 'employees', label: t('employees_management', language), fn: () => exportUtils.exportEmployeesCSV(employees) },
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
          <button onClick={() => { exportUtils.exportAllCSV(data); onOpenChange(false); toast.success(language === 'fr' ? 'Export complet!' : 'Full export!'); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
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
  const [form, setForm] = useState({ studentId: '', moduleId: '', grade: '', percentage: '', date: new Date().toISOString().split('T')[0] });

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

  const openAdd = () => { setEditGrade(null); setForm({ studentId: '', moduleId: '', grade: '', percentage: '', date: new Date().toISOString().split('T')[0] }); setDialogOpen(true); };
  const openEdit = (g: Grade) => { setEditGrade(g); setForm({ studentId: g.studentId, moduleId: g.moduleId, grade: g.grade || '', percentage: g.percentage != null ? String(g.percentage) : '', date: g.date || '' }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.studentId || !form.moduleId) return;
    if (editGrade) {
      setGrades(grades.map(g => g.id === editGrade.id ? { ...g, studentId: form.studentId, moduleId: form.moduleId, grade: form.grade, percentage: Number(form.percentage) || undefined, date: form.date } : g));
      toast.success(language === 'fr' ? 'Note mise à jour' : 'Grade updated');
    } else {
      setGrades([...grades, { id: genId(), studentId: form.studentId, moduleId: form.moduleId, grade: form.grade, percentage: Number(form.percentage) || undefined, date: form.date, createdAt: new Date().toISOString() }]);
      toast.success(language === 'fr' ? 'Note ajoutée' : 'Grade added');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => { setGrades(grades.filter(g => g.id !== id)); toast.success(language === 'fr' ? 'Note supprimée' : 'Grade deleted'); };

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
  const [form, setForm] = useState({ studentId: '', type: 'positive' as 'positive' | 'negative', description: '', points: '0', date: new Date().toISOString().split('T')[0] });

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
      if (b.type === 'positive') d.pos += b.points || 1; else d.neg += b.points || 1;
      map.set(b.studentId, d);
    });
    return Array.from(map.entries()).map(([id, d]) => ({ id, ...d, total: d.pos + d.neg })).sort((a, b) => b.total - a.total);
  }, [behavior, students]);

  const openAdd = () => { setEditRec(null); setForm({ studentId: '', type: 'positive', description: '', points: '1', date: new Date().toISOString().split('T')[0] }); setDialogOpen(true); };
  const openEdit = (r: BehaviorRecord) => { setEditRec(r); setForm({ studentId: r.studentId, type: r.type, description: r.description, points: String(r.points || 0), date: r.date }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.studentId || !form.description) return;
    if (editRec) {
      setBehavior(behavior.map(b => b.id === editRec.id ? { ...b, studentId: form.studentId, type: form.type, description: form.description, points: Number(form.points) || 0, date: form.date, teacher: currentUser?.fullName } : b));
      toast.success(language === 'fr' ? 'Enregistrement mis à jour' : 'Record updated');
    } else {
      setBehavior([...behavior, { id: genId(), studentId: form.studentId, type: form.type, description: form.description, points: Number(form.points) || 0, date: form.date, teacher: currentUser?.fullName, createdAt: new Date().toISOString() }]);
      toast.success(language === 'fr' ? 'Enregistrement ajouté' : 'Record added');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => { setBehavior(behavior.filter(b => b.id !== id)); toast.success(language === 'fr' ? 'Supprimé' : 'Deleted'); };

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
function TasksPage() {
  const { tasks, language, setTasks, currentUser, teachers } = useAppStore();
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '', priority: 'medium' as Task['priority'], status: 'pending' as Task['status'], category: '', dueDate: '', progress: '0' });
  const [commentText, setCommentText] = useState('');

  const filtered = useMemo(() => {
    let t = [...tasks];
    if (statusFilter !== 'all') t = t.filter(tk => tk.status === statusFilter);
    if (priorityFilter !== 'all') t = t.filter(tk => tk.priority === priorityFilter);
    return t.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [tasks, statusFilter, priorityFilter]);

  const counts = useMemo(() => ({
    all: tasks.length, pending: tasks.filter(t => t.status === 'pending').length, in_progress: tasks.filter(t => t.status === 'in_progress').length, completed: tasks.filter(t => t.status === 'completed').length, overdue: tasks.filter(t => t.status === 'overdue').length,
  }), [tasks]);

  const openAdd = () => { setEditTask(null); setForm({ title: '', description: '', assignedTo: '', priority: 'medium', status: 'pending', category: '', dueDate: '', progress: '0' }); setDialogOpen(true); };
  const openEdit = (tk: Task) => { setEditTask(tk); setForm({ title: tk.title, description: tk.description || '', assignedTo: tk.assignedTo || '', priority: tk.priority, status: tk.status, category: tk.category || '', dueDate: tk.dueDate || '', progress: String(tk.progress || 0) }); setDialogOpen(true); };
  const openDetail = (tk: Task) => { setSelectedTask(tk); setCommentText(''); setDetailOpen(true); };

  const handleSave = () => {
    if (!form.title) return;
    if (editTask) {
      setTasks(tasks.map(t => t.id === editTask.id ? { ...t, title: form.title, description: form.description, assignedTo: form.assignedTo, priority: form.priority, status: form.status, category: form.category, dueDate: form.dueDate, progress: Number(form.progress) || 0, completedAt: form.status === 'completed' ? new Date().toISOString() : t.completedAt } : t));
      toast.success(language === 'fr' ? 'Tâche mise à jour' : 'Task updated');
    } else {
      const ticket = 'TK-' + genId().substring(0, 6).toUpperCase();
      setTasks([...tasks, { id: genId(), title: form.title, description: form.description, assignedTo: form.assignedTo, assignedBy: currentUser?.fullName, priority: form.priority, status: form.status, category: form.category, dueDate: form.dueDate, progress: Number(form.progress) || 0, ticketNumber: ticket, comments: [], createdAt: new Date().toISOString() }]);
      toast.success(language === 'fr' ? 'Tâche créée' : 'Task created');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => { setTasks(tasks.filter(t => t.id !== id)); toast.success(language === 'fr' ? 'Tâche supprimée' : 'Task deleted'); };

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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editTask ? t('edit', language) : t('add', language)} {t('tasks', language)}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>{language === 'fr' ? 'Titre' : 'Title'} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Description' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{language === 'fr' ? 'Assigné à' : 'Assigned to'}</Label><Input value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} placeholder={language === 'fr' ? 'Nom' : 'Name'} /></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Catégorie' : 'Category'}</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>{language === 'fr' ? 'Priorité' : 'Priority'}</Label><Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as Task['priority'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urgent">{t('urgent', language)}</SelectItem><SelectItem value="high">{t('high', language)}</SelectItem><SelectItem value="medium">{t('medium', language)}</SelectItem><SelectItem value="low">{t('low', language)}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{t('status', language)}</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Task['status'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">{t('pending', language)}</SelectItem><SelectItem value="in_progress">{t('in_progress', language)}</SelectItem><SelectItem value="completed">{t('completed', language)}</SelectItem><SelectItem value="overdue">{t('overdue', language)}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Progression' : 'Progress'} %</Label><Input type="number" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Échéance' : 'Due Date'}</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button></DialogFooter>
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
  const [form, setForm] = useState({ studentId: '', incidentType: '', severity: 'medium' as Incident['severity'], status: 'open' as Incident['status'], description: '', actionTaken: '', date: new Date().toISOString().split('T')[0], followUpNotes: '' });

  const filtered = useMemo(() => {
    let i = [...incidents];
    if (severityFilter !== 'all') i = i.filter(inc => inc.severity === severityFilter);
    if (statusFilter !== 'all') i = i.filter(inc => inc.status === statusFilter);
    return i.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [incidents, severityFilter, statusFilter]);

  const severityCounts = useMemo(() => ({
    all: incidents.length, low: incidents.filter(i => i.severity === 'low').length, medium: incidents.filter(i => i.severity === 'medium').length, high: incidents.filter(i => i.severity === 'high').length, critical: incidents.filter(i => i.severity === 'critical').length,
  }), [incidents]);

  const openAdd = () => { setEditInc(null); setForm({ studentId: '', incidentType: '', severity: 'medium', status: 'open', description: '', actionTaken: '', date: new Date().toISOString().split('T')[0], followUpNotes: '' }); setDialogOpen(true); };
  const openEdit = (inc: Incident) => { setEditInc(inc); setForm({ studentId: inc.studentId, incidentType: inc.incidentType || '', severity: inc.severity, status: inc.status, description: inc.description || '', actionTaken: inc.actionTaken || '', date: inc.date || '', followUpNotes: inc.followUpNotes || '' }); setDialogOpen(true); };
  const openDetail = (inc: Incident) => { setSelectedInc(inc); setDetailOpen(true); };

  const handleSave = () => {
    if (!form.studentId) return;
    if (editInc) {
      setIncidents(incidents.map(i => i.id === editInc.id ? { ...i, studentId: form.studentId, incidentType: form.incidentType, severity: form.severity, status: form.status, description: form.description, actionTaken: form.actionTaken, date: form.date, followUpNotes: form.followUpNotes, reportedBy: currentUser?.fullName } : i));
      toast.success(language === 'fr' ? 'Incident mis à jour' : 'Incident updated');
    } else {
      setIncidents([...incidents, { id: genId(), studentId: form.studentId, incidentType: form.incidentType, severity: form.severity, status: form.status, description: form.description, actionTaken: form.actionTaken, date: form.date, followUpNotes: form.followUpNotes, reportedBy: currentUser?.fullName, createdAt: new Date().toISOString() }]);
      toast.success(language === 'fr' ? 'Incident créé' : 'Incident created');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => { setIncidents(incidents.filter(i => i.id !== id)); toast.success(language === 'fr' ? 'Incident supprimé' : 'Incident deleted'); };

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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editInc ? t('edit', language) : t('add', language)} {t('incidents', language)}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
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
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}

// ==================== MESSAGING PAGE ====================
function MessagingPage() {
  const { students, classes, templates, language, setTemplates, attendance } = useAppStore();
  const [mode, setMode] = useState<'individual' | 'bulk' | 'template'>('individual');
  const [classFilter, setClassFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [message, setMessage] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const filteredStudents = useMemo(() => {
    let s = [...students].filter(st => st.status === 'active');
    if (classFilter !== 'all') s = s.filter(st => st.classId === classFilter);
    return s;
  }, [students, classFilter]);

  const today = new Date().toISOString().split('T')[0];
  const absentToday = useMemo(() => {
    const absentIds = new Set(attendance.filter(a => a.date === today && a.status === 'absent').map(a => a.studentId));
    return students.filter(s => absentIds.has(s.id));
  }, [students, attendance, today]);

  const lateToday = useMemo(() => {
    const lateIds = new Set(attendance.filter(a => a.date === today && a.status === 'late').map(a => a.studentId));
    return students.filter(s => lateIds.has(s.id));
  }, [students, attendance, today]);

  const sendWhatsApp = (phone: string | undefined, msg: string) => {
    const formatted = formatWhatsAppPhone(phone);
    if (!formatted) { toast.error(language === 'fr' ? 'Numéro invalide' : 'Invalid phone number'); return; }
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, '_blank');
    toast.success(language === 'fr' ? 'Ouverture WhatsApp...' : 'Opening WhatsApp...');
  };

  const handleSendIndividual = () => {
    const s = students.find(st => st.id === selectedStudent);
    if (!s) return;
    sendWhatsApp(s.guardianPhone || s.phone, message);
  };

  const handleSendBulk = () => {
    const targets = classFilter !== 'all' ? filteredStudents : students.filter(s => s.status === 'active');
    const phones = targets.map(s => s.guardianPhone || s.phone).filter(Boolean);
    if (phones.length === 0) { toast.error(language === 'fr' ? 'Aucun numéro trouvé' : 'No phone numbers found'); return; }
    phones.forEach(p => sendWhatsApp(p, message));
  };

  const handleSaveTemplate = () => {
    if (!templateName || !message) return;
    setTemplates([...templates, { id: genId(), name: templateName, content: message, category: templateCategory || 'general', createdAt: new Date().toISOString() }]);
    setSaveDialogOpen(false);
    toast.success(language === 'fr' ? 'Modèle sauvegardé' : 'Template saved');
  };

  const applyTemplate = (content: string) => { setMessage(content); setMode('individual'); };

  const absenceTemplate = (s: Student) => `${language === 'fr' ? 'Bonjour, Nous vous informons que' : 'Hello, We inform you that'} ${s.fullName} ${language === 'fr' ? 'est absent(e) aujourd\'hui.' : 'is absent today.'} ${language === 'fr' ? 'Merci de nous contacter.' : 'Please contact us.'}`;

  const lateTemplate = (s: Student) => `${language === 'fr' ? 'Bonjour, Nous vous informons que' : 'Hello, We inform you that'} ${s.fullName} ${language === 'fr' ? 'est arrivé(e) en retard aujourd\'hui.' : 'arrived late today.'} ${language === 'fr' ? 'Merci de nous contacter.' : 'Please contact us.'}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['individual', language === 'fr' ? 'Individuel' : 'Individual'], ['bulk', language === 'fr' ? 'Groupé' : 'Bulk'], ['template', language === 'fr' ? 'Modèles' : 'Templates']] as const).map(([m, label]) => (
          <Button key={m} variant={mode === m ? 'default' : 'outline'} size="sm" onClick={() => setMode(m)} className={mode === m ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>{label}</Button>
        ))}
      </div>

      {mode === 'template' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">{language === 'fr' ? 'Modèles enregistrés' : 'Saved Templates'} ({templates.length})</h3>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Nouveau modèle' : 'New Template'}</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map(tp => (
              <Card key={tp.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => applyTemplate(tp.content)}>
                <CardContent className="p-4"><div className="flex items-start justify-between"><div><h4 className="font-semibold text-sm">{tp.name}</h4>{tp.category && <Badge variant="outline" className="mt-1 text-xs">{tp.category}</Badge>}<p className="text-sm text-muted-foreground mt-2 line-clamp-3">{tp.content}</p></div><Button variant="ghost" size="sm" className="shrink-0"><Send className="h-4 w-4" /></Button></div></CardContent>
              </Card>
            ))}
          </div>
          {templates.length === 0 && <EmptyState message={language === 'fr' ? 'Aucun modèle sauvegardé' : 'No saved templates'} />}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}><DialogContent><DialogHeader><DialogTitle>{language === 'fr' ? 'Sauvegarder comme modèle' : 'Save as Template'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>{language === 'fr' ? 'Nom du modèle' : 'Template Name'}</Label><Input value={templateName} onChange={e => setTemplateName(e.target.value)} /></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Catégorie' : 'Category'}</Label><Input value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} placeholder="general, absence, ..." /></div>
              <div className="space-y-2"><Label>{language === 'fr' ? 'Contenu' : 'Content'}</Label><Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setSaveDialogOpen(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveTemplate}>{t('save', language)}</Button></DialogFooter>
          </DialogContent></Dialog>
        </div>
      )}

      {mode === 'individual' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">{language === 'fr' ? 'Envoyer un message' : 'Send Message'}</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>{t('students', language)}</Label><Select value={selectedStudent} onValueChange={v => setSelectedStudent(v)}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Choisir un étudiant' : 'Select student'} /></SelectTrigger><SelectContent>{students.filter(s => s.status === 'active').map(s => <SelectItem key={s.id} value={s.id}>{s.fullName} — {s.guardianPhone || s.phone || language === 'fr' ? 'pas de tél' : 'no phone'}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{language === 'fr' ? 'Message' : 'Message'}</Label><Textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder={language === 'fr' ? 'Écrire votre message...' : 'Write your message...'} /></div>
            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSendIndividual} disabled={!selectedStudent || !message}><Send className="h-4 w-4 mr-1" />WhatsApp</Button>
              <Button variant="outline" onClick={() => setSaveDialogOpen(true)}><Save className="h-4 w-4 mr-1" />{language === 'fr' ? 'Sauvegarder' : 'Save'}</Button>
            </div>
          </CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">{language === 'fr' ? 'Actions rapides' : 'Quick Actions'}</CardTitle></CardHeader><CardContent className="space-y-2">
            {absentToday.length > 0 && <div className="rounded-lg border p-3"><p className="text-xs font-semibold text-red-600 mb-2">🚫 {language === 'fr' ? `Absents aujourd'hui (${absentToday.length})` : `Absent today (${absentToday.length})`}</p><div className="space-y-1 max-h-32 overflow-y-auto">{absentToday.slice(0, 5).map(s => (<button key={s.id} onClick={() => { setSelectedStudent(s.id); setMessage(absenceTemplate(s)); }} className="w-full text-left text-xs p-1.5 rounded hover:bg-muted flex justify-between"><span className="font-medium">{s.fullName}</span><span className="text-muted-foreground">{s.guardianPhone || '-'}</span></button>))}</div></div>}
            {lateToday.length > 0 && <div className="rounded-lg border p-3"><p className="text-xs font-semibold text-amber-600 mb-2">⏰ {language === 'fr' ? `Retards aujourd'hui (${lateToday.length})` : `Late today (${lateToday.length})`}</p><div className="space-y-1 max-h-32 overflow-y-auto">{lateToday.slice(0, 5).map(s => (<button key={s.id} onClick={() => { setSelectedStudent(s.id); setMessage(lateTemplate(s)); }} className="w-full text-left text-xs p-1.5 rounded hover:bg-muted flex justify-between"><span className="font-medium">{s.fullName}</span><span className="text-muted-foreground">{s.guardianPhone || '-'}</span></button>))}</div></div>}
          </CardContent></Card>
        </div>
      )}

      {mode === 'bulk' && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">{language === 'fr' ? 'Envoi groupé' : 'Bulk Messaging'}</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="space-y-2"><Label>{t('class_name', language)}</Label><Select value={classFilter} onValueChange={v => setClassFilter(v)}><SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Toutes les classes' : 'All Classes'} /></SelectTrigger><SelectContent><SelectItem value="all">{language === 'fr' ? 'Tous les étudiants' : 'All Students'}</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({students.filter(s => s.classId === c.id && s.status === 'active').length})</SelectItem>)}</SelectContent></Select></div>
          <p className="text-sm text-muted-foreground">{language === 'fr' ? 'Destinataires' : 'Recipients'}: <strong>{filteredStudents.length}</strong></p>
          <div className="space-y-2"><Label>{language === 'fr' ? 'Message' : 'Message'}</Label><Textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder={language === 'fr' ? 'Écrire le message groupé...' : 'Write bulk message...'} /></div>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSendBulk} disabled={!message}><Send className="h-4 w-4 mr-1" />{language === 'fr' ? 'Envoyer à tous' : 'Send to All'}</Button>
        </CardContent></Card>
      )}
    </div>
  );
}

// ==================== REPORTS PAGE ====================
function ReportsPage() {
  const { students, classes, attendance, grades, behavior, language } = useAppStore();
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
    if (reportType === 'attendance') exportUtils.exportAttendanceCSV(filteredAttendance, students, classes);
    else if (reportType === 'grades') exportUtils.exportGradesCSV(grades, students, []);
    else if (reportType === 'behavior') exportUtils.exportBehaviorCSV(behavior, students);
    toast.success(language === 'fr' ? 'Rapport exporté' : 'Report exported');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={reportType} onValueChange={setReportType}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="attendance">{t('attendance', language)}</SelectItem><SelectItem value="grades">{t('grades', language)}</SelectItem><SelectItem value="behavior">{t('behavior', language)}</SelectItem></SelectContent></Select>
          <div className="flex items-center gap-2"><Label className="text-xs whitespace-nowrap">{t('date_range', language)}:</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" /><span className="text-xs">→</span><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" /></div>
        </div>
        <Button variant="outline" onClick={handleExportReport}><FileDown className="h-4 w-4 mr-1" />{t('export_csv', language)}</Button>
      </div>

      {reportType === 'attendance' && (<>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[{ label: t('present_today', language), val: attendanceStats.present, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20' }, { label: t('absent', language), val: attendanceStats.absent, color: 'bg-red-100 text-red-700 dark:bg-red-900/20' }, { label: t('late', language), val: attendanceStats.late, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20' }, { label: t('excused', language), val: attendanceStats.excused, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20' }, { label: t('attendance_rate', language), val: `${attendanceStats.rate}%`, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20' }].map((s, i) => (
            <div key={i} className={`rounded-lg p-3 text-center ${s.color}`}><p className="text-xl font-bold">{s.val}</p><p className="text-xs opacity-70">{s.label}</p></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Présence par classe' : 'Attendance by Class'}</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={classAttendance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} domain={[0, 100]} /><ReTooltip /><Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Répartition des statuts' : 'Status Distribution'}</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={attendancePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value"><Cell fill="#10b981" /><Cell fill="#ef4444" /><Cell fill="#f59e0b" /><Cell fill="#3b82f6" /></Pie><ReTooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{language === 'fr' ? 'Comportement' : 'Behavior'}</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={[{ name: t('positive', language), value: behaviorSummary.positive }, { name: t('negative', language), value: behaviorSummary.negative }]} cx="50%" cy="50%" outerRadius={80} dataKey="value" fill="#8884d8"><Cell fill="#10b981" /><Cell fill="#ef4444" /></Pie><ReTooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
      </>)}
    </div>
  );
}

// ==================== SETTINGS PAGE ====================
function SettingsPage() {
  const { language, setTeachers, setEmployees, setAcademicYears, teachers, employees, academicYears, students, classes, modules, attendance, grades, behavior, tasks, incidents, admins, schoolInfo, setSchoolInfo, currentUser, setStudents, setClasses, setModules, setAttendance, setGrades, setBehavior, setTasks, setIncidents, setTemplates, primaryColor, setPrimaryColor } = useAppStore();
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
  const [ayForm, setAyForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false });

  // Password state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

  // School info - sync with store
  const [sForm, setSForm] = useState({ name: schoolInfo?.name || '', address: schoolInfo?.address || '', phone: schoolInfo?.phone || '', email: schoolInfo?.email || '', field: schoolInfo?.field || '', logo: schoolInfo?.logo || '' });
  useEffect(() => {
    if (schoolInfo && (schoolInfo.name || schoolInfo.address || schoolInfo.phone || schoolInfo.email || schoolInfo.field || schoolInfo.logo)) {
      setSForm({ name: schoolInfo.name || '', address: schoolInfo.address || '', phone: schoolInfo.phone || '', email: schoolInfo.email || '', field: schoolInfo.field || '', logo: schoolInfo.logo || '' });
    }
  }, [schoolInfo]);

  // Backup state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => localStorage.getItem('attendance_auto_backup') === 'true');
  const [backupFrequency, setBackupFrequency] = useState(() => localStorage.getItem('attendance_backup_freq') || '12h');
  const [lastBackupTime, setLastBackupTime] = useState(() => localStorage.getItem('attendance_last_backup') || '');
  const [backupHistory, setBackupHistory] = useState<Array<{ timestamp: string; size: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('attendance_backup_history') || '[]'); } catch { return []; }
  });
  const [restorePreview, setRestorePreview] = useState<Record<string, number> | null>(null);

  // Cloud storage config state
  const [cloudConfig, setCloudConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('attendance_cloud_config') || '{}'); } catch { return {}; }
  });
  const [cloudUploading, setCloudUploading] = useState(false);

  const handleCloudSave = async (service: string) => {
    localStorage.setItem('attendance_cloud_config', JSON.stringify(cloudConfig));
    const serviceNames: Record<string, string> = { google: 'Google Drive', onedrive: 'OneDrive', ftp: 'FTP' };

    // Upload backup to server via API
    setCloudUploading(true);
    try {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        service,
        config: cloudConfig,
        data: { students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, templates: [], academicYears, schoolInfo }
      };
      await api.post('/backup/upload', backupData);
      toast.success(`${serviceNames[service] || service} ${language === 'fr' ? 'connecté et sauvegardé!' : 'connected & backup saved!'}`);
    } catch (err) {
      console.warn('Cloud backup upload failed:', err);
      // Still save config locally even if API upload fails
      toast.success(`${serviceNames[service] || service} ${language === 'fr' ? 'configuration sauvegardée' : 'configuration saved'}`);
      toast.error(language === 'fr' ? 'Échec de l\'envoi au serveur - config sauvegardée localement' : 'Server upload failed - config saved locally');
    }
    setCloudUploading(false);

    // Also trigger a local manual backup download
    if (autoBackupEnabled) {
      handleManualBackup(true);
    }
  };

  // Language & timezone
  const [lang, setLang] = useState<'en' | 'fr'>(language);
  const [tz, setTz] = useState('Africa/Casablanca');

  // Auto-backup effect
  useEffect(() => {
    localStorage.setItem('attendance_auto_backup', String(autoBackupEnabled));
    localStorage.setItem('attendance_backup_freq', backupFrequency);
  }, [autoBackupEnabled, backupFrequency]);

  useEffect(() => {
    if (!autoBackupEnabled) return;
    const intervals: Record<string, number> = { '1h': 3600000, '6h': 21600000, '12h': 43200000, 'daily': 86400000 };
    const ms = intervals[backupFrequency] || 43200000;
    const timer = setInterval(() => {
      handleManualBackup(true);
    }, ms);
    return () => clearInterval(timer);
  }, [autoBackupEnabled, backupFrequency]);

  // Teacher handlers
  const openAddTeacher = () => { setEditTeacher(null); setTForm({ name: '', subject: '', email: '', phone: '', experience: '0', qualification: '' }); setTeacherDialog(true); };
  const openEditTeacher = (t: Teacher) => { setEditTeacher(t); setTForm({ name: t.name, subject: t.subject || '', email: t.email || '', phone: t.phone || '', experience: String(t.experience || 0), qualification: t.qualification || '' }); setTeacherDialog(true); };
  const saveTeacher = () => {
    if (!tForm.name) return;
    if (editTeacher) { setTeachers(teachers.map(t => t.id === editTeacher.id ? { ...t, name: tForm.name, subject: tForm.subject, email: tForm.email, phone: tForm.phone, experience: Number(tForm.experience), qualification: tForm.qualification } : t)); toast.success('Updated'); }
    else { setTeachers([...teachers, { id: genId(), name: tForm.name, subject: tForm.subject, email: tForm.email, phone: tForm.phone, experience: Number(tForm.experience), qualification: tForm.qualification, createdAt: new Date().toISOString() }]); toast.success('Added'); }
    setTeacherDialog(false);
  };
  const deleteTeacher = (id: string) => { setTeachers(teachers.filter(t => t.id !== id)); toast.success('Deleted'); };

  // Employee handlers
  const openAddEmp = () => { setEditEmp(null); setEForm({ fullName: '', department: '', position: '', email: '', phone: '' }); setEmpDialog(true); };
  const openEditEmp = (e: Employee) => { setEditEmp(e); setEForm({ fullName: e.fullName, department: e.department || '', position: e.position || '', email: e.email || '', phone: e.phone || '' }); setEmpDialog(true); };
  const saveEmp = () => {
    if (!eForm.fullName) return;
    if (editEmp) { setEmployees(employees.map(e => e.id === editEmp.id ? { ...e, fullName: eForm.fullName, department: eForm.department, position: eForm.position, email: eForm.email, phone: eForm.phone } : e)); toast.success('Updated'); }
    else { setEmployees([...employees, { id: genId(), fullName: eForm.fullName, department: eForm.department, position: eForm.position, email: eForm.email, phone: eForm.phone, createdAt: new Date().toISOString() }]); toast.success('Added'); }
    setEmpDialog(false);
  };
  const deleteEmp = (id: string) => { setEmployees(employees.filter(e => e.id !== id)); toast.success('Deleted'); };

  // Academic Year handlers
  const openAddAy = () => { setEditAy(null); setAyForm({ name: '', startDate: '', endDate: '', isCurrent: false }); setAyDialog(true); };
  const openEditAy = (ay: AcademicYear) => { setEditAy(ay); setAyForm({ name: ay.name, startDate: ay.startDate || '', endDate: ay.endDate || '', isCurrent: ay.isCurrent || false }); setAyDialog(true); };
  const saveAy = () => {
    if (!ayForm.name) return;
    const updated = editAy ? academicYears.map(ay => ay.id === editAy.id ? { ...ay, name: ayForm.name, startDate: ayForm.startDate, endDate: ayForm.endDate, isCurrent: ayForm.isCurrent } : ay) : [...academicYears, { id: genId(), name: ayForm.name, startDate: ayForm.startDate, endDate: ayForm.endDate, isCurrent: ayForm.isCurrent, createdAt: new Date().toISOString() }];
    if (ayForm.isCurrent) { updated.forEach(ay => { ay.isCurrent = ay.name === ayForm.name || (editAy && ay.id === editAy.id) ? ayForm.isCurrent : false; }); }
    setAcademicYears(updated); toast.success(editAy ? 'Updated' : 'Added'); setAyDialog(false);
  };
  const deleteAy = (id: string) => { setAcademicYears(academicYears.filter(ay => ay.id !== id)); toast.success('Deleted'); };

  // Data management
  const handleExportAll = () => { exportUtils.exportAllCSV({ students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees }); toast.success(language === 'fr' ? 'Exporté!' : 'Exported!'); };
  const handleClearAll = () => {
    if (!confirm(t('clear_confirm', language))) return;
    setStudents([]); setClasses([]); setModules([]); setAttendance([]); setGrades([]); setBehavior([]); setTasks([]); setIncidents([]); setTeachers([]); setEmployees([]); setTemplates([]); setAcademicYears([]);
    ['attendance_students', 'attendance_classes', 'attendance_modules', 'attendance_records', 'attendance_grades', 'attendance_behavior', 'attendance_tasks', 'attendance_incidents', 'attendance_teachers', 'attendance_employees', 'attendance_templates', 'attendance_academic_years'].forEach(k => localStorage.removeItem(k));
    toast.success(language === 'fr' ? 'Données supprimées' : 'Data cleared');
  };

  // Password
  const handleChangePw = () => { if (pwForm.newPw !== pwForm.confirm) { toast.error(language === 'fr' ? 'Mots de passe différents' : 'Passwords do not match'); return; } toast.success(language === 'fr' ? 'Mot de passe changé' : 'Password changed'); setPwForm({ current: '', newPw: '', confirm: '' }); };

  // Save school info
  const [savingSchool, setSavingSchool] = useState(false);
  const saveSchoolInfo = async () => {
    setSavingSchool(true);
    const info = { name: sForm.name, address: sForm.address, phone: sForm.phone, email: sForm.email, field: sForm.field, logo: sForm.logo };
    setSchoolInfo(info);
    try {
      await api.put('/settings/school', info);
    } catch {}
    toast.success(language === 'fr' ? 'Informations sauvegardées !' : 'School info saved!');
    setSavingSchool(false);
  };

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const r = new FileReader();
      r.onload = (ev) => setSForm({ ...sForm, logo: ev.target?.result as string });
      r.readAsDataURL(f);
    }
  };

  // Manual backup
  const handleManualBackup = (silent: boolean = false) => {
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees,
        templates: [], academicYears, schoolInfo
      }
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const sizeKB = (blob.size / 1024).toFixed(1);
    const timestamp = new Date().toISOString();

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `infohas_backup_${timestamp.slice(0, 10)}_${timestamp.slice(11, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Update history
    const newEntry = { timestamp, size: `${sizeKB} KB` };
    const updatedHistory = [newEntry, ...backupHistory].slice(0, 5);
    setBackupHistory(updatedHistory);
    localStorage.setItem('attendance_backup_history', JSON.stringify(updatedHistory));
    setLastBackupTime(timestamp);
    localStorage.setItem('attendance_last_backup', timestamp);

    if (!silent) toast.success(language === 'fr' ? 'Sauvegarde créée!' : 'Backup created!');

    // Also upload to server in background
    api.post('/backup/upload', backupData).then(() => {
      console.log('[Backup] Uploaded to server');
    }).catch(() => {});
  };

  // Restore backup
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const data = parsed.data || parsed;
        const preview: Record<string, number> = {};
        if (data.students) preview.students = data.students.length;
        if (data.classes) preview.classes = data.classes.length;
        if (data.modules) preview.modules = data.modules.length;
        if (data.attendance) preview.attendance = data.attendance.length;
        if (data.grades) preview.grades = data.grades.length;
        if (data.behavior) preview.behavior = data.behavior.length;
        if (data.tasks) preview.tasks = data.tasks.length;
        if (data.incidents) preview.incidents = data.incidents.length;
        if (data.teachers) preview.teachers = data.teachers.length;
        if (data.employees) preview.employees = data.employees.length;
        if (data.academicYears) preview.academicYears = data.academicYears.length;
        if (data.schoolInfo) preview.schoolInfo = 1;
        setRestorePreview(preview);
      } catch {
        toast.error('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const confirmRestore = () => {
    const fileInput = document.getElementById('restore-file-input') as HTMLInputElement;
    if (!fileInput?.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const data = parsed.data || parsed;
        if (data.students) { setStudents(data.students); localStorage.setItem('attendance_students', JSON.stringify(data.students)); }
        if (data.classes) { setClasses(data.classes); localStorage.setItem('attendance_classes', JSON.stringify(data.classes)); }
        if (data.modules) { setModules(data.modules); localStorage.setItem('attendance_modules', JSON.stringify(data.modules)); }
        if (data.attendance) { setAttendance(data.attendance); localStorage.setItem('attendance_records', JSON.stringify(data.attendance)); }
        if (data.grades) { setGrades(data.grades); localStorage.setItem('attendance_grades', JSON.stringify(data.grades)); }
        if (data.behavior) { setBehavior(data.behavior); localStorage.setItem('attendance_behavior', JSON.stringify(data.behavior)); }
        if (data.tasks) { setTasks(data.tasks); localStorage.setItem('attendance_tasks', JSON.stringify(data.tasks)); }
        if (data.incidents) { setIncidents(data.incidents); localStorage.setItem('attendance_incidents', JSON.stringify(data.incidents)); }
        if (data.teachers) { setTeachers(data.teachers); localStorage.setItem('attendance_teachers', JSON.stringify(data.teachers)); }
        if (data.employees) { setEmployees(data.employees); localStorage.setItem('attendance_employees', JSON.stringify(data.employees)); }
        if (data.academicYears) { setAcademicYears(data.academicYears); localStorage.setItem('attendance_academic_years', JSON.stringify(data.academicYears)); }
        if (data.schoolInfo) { setSchoolInfo(data.schoolInfo); }
        toast.success(language === 'fr' ? 'Données restaurées!' : 'Data restored!');
        setRestorePreview(null);
      } catch {
        toast.error('Restore failed');
      }
    };
    reader.readAsText(fileInput.files[0]);
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

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general">{t('general_settings', language)}</TabsTrigger>
          <TabsTrigger value="teachers">{t('teachers_management', language)}</TabsTrigger>
          <TabsTrigger value="employees">{t('employees_management', language)}</TabsTrigger>
          <TabsTrigger value="academic">{t('academic_year_management', language)}</TabsTrigger>
          <TabsTrigger value="data">{t('data_management', language)}</TabsTrigger>
          <TabsTrigger value="admins">{t('admin_users', language)}</TabsTrigger>
          <TabsTrigger value="password">{t('change_password', language)}</TabsTrigger>
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
              <div className="space-y-2"><Label>{t('default_language', language)}</Label><Select value={lang} onValueChange={v => { setLang(v as 'en' | 'fr'); useAppStore.setState({ language: v as 'en' | 'fr' }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">Français</SelectItem></SelectContent></Select></div>
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
            <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('name', language)}</TableHead><TableHead>{language === 'fr' ? 'Début' : 'Start'}</TableHead><TableHead>{language === 'fr' ? 'Fin' : 'End'}</TableHead><TableHead>{language === 'fr' ? 'Actuelle' : 'Current'}</TableHead><TableHead className="w-24">{t('actions', language)}</TableHead></TableRow></TableHeader><TableBody>
              {academicYears.map(ay => <TableRow key={ay.id}><TableCell className="font-medium">{ay.name}</TableCell><TableCell className="text-sm">{ay.startDate || '-'}</TableCell><TableCell className="text-sm">{ay.endDate || '-'}</TableCell><TableCell>{ay.isCurrent ? <Badge className="bg-emerald-100 text-emerald-800">✓</Badge> : '-'}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAy(ay)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteAy(ay.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>)}
            </TableBody></Table></div></CardContent></Card>
          )}
          <Dialog open={ayDialog} onOpenChange={setAyDialog}><DialogContent><DialogHeader><DialogTitle>{editAy ? t('edit', language) : t('add', language)} {t('academic_year', language)}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>{t('name', language)} *</Label><Input value={ayForm.name} onChange={e => setAyForm({ ...ayForm, name: e.target.value })} placeholder="2024-2025" /></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{language === 'fr' ? 'Date début' : 'Start Date'}</Label><Input type="date" value={ayForm.startDate} onChange={e => setAyForm({ ...ayForm, startDate: e.target.value })} /></div><div className="space-y-2"><Label>{language === 'fr' ? 'Date fin' : 'End Date'}</Label><Input type="date" value={ayForm.endDate} onChange={e => setAyForm({ ...ayForm, endDate: e.target.value })} /></div></div>
              <div className="flex items-center gap-2"><Checkbox checked={ayForm.isCurrent} onCheckedChange={v => setAyForm({ ...ayForm, isCurrent: v as boolean })} /><Label>{language === 'fr' ? 'Année en cours' : 'Current Year'}</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setAyDialog(false)}>{t('cancel', language)}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveAy}>{t('save', language)}</Button></DialogFooter>
          </DialogContent></Dialog>
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
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">{language === 'fr' ? 'Sauvegarde manuelle' : 'Manual Backup'}</h4>
                  <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Télécharger une copie complète de toutes les données' : 'Download a complete copy of all data'}</p>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleManualBackup(false)}><HardDrive className="h-4 w-4 mr-1" />{language === 'fr' ? 'Créer sauvegarde' : 'Create Backup'}</Button>
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

            {/* Restore Backup */}
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Restaurer une sauvegarde' : 'Restore Backup'}</h4>
                <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Charger un fichier de sauvegarde JSON' : 'Load a JSON backup file'}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer"><input id="restore-file-input" type="file" accept=".json" className="hidden" onChange={handleRestoreBackup} /><Button variant="outline" asChild><span><FolderOpen className="h-4 w-4 mr-1" />{language === 'fr' ? 'Choisir un fichier' : 'Choose File'}</span></Button></label>
                {restorePreview && (
                  <Button className="bg-amber-600 hover:bg-amber-700" onClick={confirmRestore}><RotateCcw className="h-4 w-4 mr-1" />{language === 'fr' ? 'Restaurer' : 'Restore'}</Button>
                )}
              </div>
              {restorePreview && (
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-900/10 p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">{language === 'fr' ? 'Aperçu de la sauvegarde' : 'Backup Preview'}:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {Object.entries(restorePreview).map(([key, count]) => (
                      <div key={key} className="text-xs"><span className="font-medium">{key}</span>: <span className="text-muted-foreground">{count}</span></div>
                    ))}
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

            {/* Cloud Storage - Functional */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Stockage Cloud' : 'Cloud Storage'}</h4>
                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Active</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Connectez vos services cloud pour sauvegarder automatiquement vos données.' : 'Connect your cloud services to automatically backup your data.'}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1"><Cloud className="h-3.5 w-3.5" />Google Drive</p>
                  <Input placeholder="API Key" className="h-8 text-xs" value={cloudConfig.googleDriveKey || ''} onChange={e => setCloudConfig({ ...cloudConfig, googleDriveKey: e.target.value })} />
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => handleCloudSave('google')} disabled={cloudUploading}>{cloudUploading ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : cloudConfig.googleDriveKey ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}{cloudConfig.googleDriveKey ? (language === 'fr' ? 'Connecté' : 'Connected') : (language === 'fr' ? 'Connecter & Sauvegarder' : 'Connect & Backup')}</Button>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1"><Cloud className="h-3.5 w-3.5" />OneDrive</p>
                  <Input placeholder="Client ID" className="h-8 text-xs" value={cloudConfig.oneDriveClientId || ''} onChange={e => setCloudConfig({ ...cloudConfig, oneDriveClientId: e.target.value })} />
                  <Input placeholder="Client Secret" className="h-8 text-xs mt-1" type="password" value={cloudConfig.oneDriveClientSecret || ''} onChange={e => setCloudConfig({ ...cloudConfig, oneDriveClientSecret: e.target.value })} />
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => handleCloudSave('onedrive')} disabled={cloudUploading}>{cloudUploading ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : cloudConfig.oneDriveClientId ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}{cloudConfig.oneDriveClientId ? (language === 'fr' ? 'Connecté' : 'Connected') : (language === 'fr' ? 'Connecter & Sauvegarder' : 'Connect & Backup')}</Button>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" />FTP</p>
                  <Input placeholder={language === 'fr' ? 'Hôte (ex: ftp.example.com)' : 'Host (e.g. ftp.example.com)'} className="h-8 text-xs" value={cloudConfig.ftpHost || ''} onChange={e => setCloudConfig({ ...cloudConfig, ftpHost: e.target.value })} />
                  <Input placeholder={language === 'fr' ? 'Utilisateur' : 'Username'} className="h-8 text-xs" value={cloudConfig.ftpUser || ''} onChange={e => setCloudConfig({ ...cloudConfig, ftpUser: e.target.value })} />
                  <Input placeholder={language === 'fr' ? 'Mot de passe' : 'Password'} className="h-8 text-xs" type="password" value={cloudConfig.ftpPass || ''} onChange={e => setCloudConfig({ ...cloudConfig, ftpPass: e.target.value })} />
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => handleCloudSave('ftp')} disabled={cloudUploading}>{cloudUploading ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : cloudConfig.ftpHost ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}{cloudConfig.ftpHost ? (language === 'fr' ? 'Connecté' : 'Connected') : (language === 'fr' ? 'Connecter & Sauvegarder' : 'Connect & Backup')}</Button>
                </div>
              </div>
            </div>
          </CardContent></Card>
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
      </Tabs>
    </div>
  );
}

// ==================== SUPER ADMIN PAGE ====================
function SuperAdminPage() {
  const { language, admins, students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, schoolInfo } = useAppStore();
  const [tab, setTab] = useState('tenants');

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
      if (selectedExportTypes.has('students')) pdfUtils.exportStudentsPDF(students, classes, si);
      if (selectedExportTypes.has('attendance')) pdfUtils.exportAttendancePDF(attendance, students, classes, si, exportDateFrom || undefined, exportDateTo || undefined);
      if (selectedExportTypes.has('grades')) pdfUtils.exportGradesPDF(grades, students, modules, si);
      if (selectedExportTypes.has('behavior')) pdfUtils.exportBehaviorPDF(behavior, students, si);
      if (selectedExportTypes.has('incidents')) pdfUtils.exportIncidentsPDF(incidents, students, si);
      if (selectedExportTypes.has('tasks')) pdfUtils.exportTasksPDF(tasks, si);
    } else {
      if (selectedExportTypes.has('students')) exportUtils.exportStudentsCSV(students, classes);
      if (selectedExportTypes.has('classes')) exportUtils.exportClassesCSV(classes, students);
      if (selectedExportTypes.has('modules')) exportUtils.exportModulesCSV(modules);
      if (selectedExportTypes.has('attendance')) exportUtils.exportAttendanceCSV(attendance, students, classes);
      if (selectedExportTypes.has('grades')) exportUtils.exportGradesCSV(grades, students, modules);
      if (selectedExportTypes.has('behavior')) exportUtils.exportBehaviorCSV(behavior, students);
      if (selectedExportTypes.has('tasks')) exportUtils.exportTasksCSV(tasks);
      if (selectedExportTypes.has('incidents')) exportUtils.exportIncidentsCSV(incidents, students);
      if (selectedExportTypes.has('teachers')) exportUtils.exportTeachersCSV(teachers);
      if (selectedExportTypes.has('employees')) exportUtils.exportEmployeesCSV(employees);
    }
    toast.success(language === 'fr' ? 'Exporté!' : 'Exported!');
  };

  const handleExportAll = () => {
    if (exportFormat === 'pdf') {
      pdfUtils.exportFullReportPDF({ students, classes, modules, attendance, grades, behavior, tasks, incidents }, schoolInfo || {});
      pdfUtils.exportClassPerformancePDF(students, classes, grades, attendance, schoolInfo || {});
    } else {
      exportUtils.exportAllCSV({ students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees });
    }
    toast.success(language === 'fr' ? 'Export complet!' : 'Full export!');
  };

  const mockTenants = [
    { id: '1', name: 'INFOHAS Academy', slug: 'infohas-academy', students: 245, teachers: 18, status: 'active' },
    { id: '2', name: 'Ecole Primaire Al Khawarizmi', slug: 'al-khawarizmi', students: 120, teachers: 10, status: 'active' },
    { id: '3', name: 'Lycée Ibn Sina', slug: 'ibn-sina', students: 380, teachers: 25, status: 'active' },
  ];

  const mockAuditLogs = [
    { id: '1', action: 'LOGIN', user: 'admin@infohas.ma', timestamp: new Date().toISOString(), ip: '192.168.1.1', details: 'Successful login' },
    { id: '2', action: 'CREATE_STUDENT', user: 'teacher@infohas.ma', timestamp: new Date(Date.now() - 3600000).toISOString(), ip: '192.168.1.2', details: 'Created student: Ahmed B.' },
    { id: '3', action: 'EXPORT_DATA', user: 'admin@infohas.ma', timestamp: new Date(Date.now() - 7200000).toISOString(), ip: '192.168.1.1', details: 'Exported all data' },
    { id: '4', action: 'DELETE_INCIDENT', user: 'admin@al-khawarizmi.ma', timestamp: new Date(Date.now() - 86400000).toISOString(), ip: '10.0.0.5', details: 'Deleted incident #15' },
  ];

  const systemHealth = [
    { label: 'API Status', value: 'Operational', color: 'text-emerald-600', icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: 'Database', value: 'Connected', color: 'text-emerald-600', icon: <Database className="h-4 w-4" /> },
    { label: 'Uptime', value: '99.9%', color: 'text-emerald-600', icon: <Activity className="h-4 w-4" /> },
    { label: 'Total Requests', value: '12,458', color: 'text-blue-600', icon: <Globe className="h-4 w-4" /> },
    { label: 'Storage', value: '2.4 GB / 10 GB', color: 'text-amber-600', icon: <Database className="h-4 w-4" /> },
    { label: 'Active Users', value: String(mockTenants.reduce((s, t) => s + t.students, 0)), color: 'text-purple-600', icon: <Users className="h-4 w-4" /> },
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
          <div className="flex justify-between items-center"><h3 className="font-semibold">{language === 'fr' ? 'Écoles gérées' : 'Managed Schools'} ({mockTenants.length})</h3><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" />{language === 'fr' ? 'Ajouter école' : 'Add School'}</Button></div>
          <div className="grid gap-3">{mockTenants.map(t => (
            <Card key={t.id}><CardContent className="p-4"><div className="flex items-start justify-between"><div><h4 className="font-semibold">{t.name}</h4><p className="text-sm text-muted-foreground">/{t.slug}</p><div className="flex gap-4 mt-2 text-sm"><span>👥 {t.students} {language === 'fr' ? 'étudiants' : 'students'}</span><span>👨‍🏫 {t.teachers} {language === 'fr' ? 'enseignants' : 'teachers'}</span></div></div><Badge className={t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100'}>{t.status}</Badge></div></CardContent></Card>
          ))}</div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <h3 className="font-semibold">{language === 'fr' ? 'Tous les utilisateurs' : 'All Users'}</h3>
          <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{t('name', language)}</TableHead><TableHead>Email</TableHead><TableHead>{t('role', language)}</TableHead><TableHead>{language === 'fr' ? 'École' : 'School'}</TableHead></TableRow></TableHeader><TableBody>
            {admins.map((a, i) => <TableRow key={i}><TableCell className="font-medium">{String(a.fullName || a.name || a.username || '-')}</TableCell><TableCell className="text-sm">{String(a.email || '-')}</TableCell><TableCell><Badge variant="secondary">{String(a.role || '-')}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{String(a.tenantId || '-')}</TableCell></TableRow>)}
          </TableBody></Table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <h3 className="font-semibold">{language === 'fr' ? 'Journal d\'audit' : 'Audit Log'}</h3>
          <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>{language === 'fr' ? 'Action' : 'Action'}</TableHead><TableHead>{language === 'fr' ? 'Utilisateur' : 'User'}</TableHead><TableHead>{language === 'fr' ? 'Détails' : 'Details'}</TableHead><TableHead>IP</TableHead><TableHead>{language === 'fr' ? 'Date' : 'Date'}</TableHead></TableRow></TableHeader><TableBody>
            {mockAuditLogs.map(l => <TableRow key={l.id}><TableCell><Badge variant="outline">{l.action}</Badge></TableCell><TableCell className="font-medium">{l.user}</TableCell><TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{l.details}</TableCell><TableCell className="text-sm text-muted-foreground">{l.ip}</TableCell><TableCell className="text-sm text-muted-foreground">{new Date(l.timestamp).toLocaleString()}</TableCell></TableRow>)}
          </TableBody></Table></div></CardContent></Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <h3 className="font-semibold">{language === 'fr' ? 'Santé du système' : 'System Health'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{systemHealth.map(s => (
            <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`${s.color}`}>{s.icon}</div><div><p className="text-sm text-muted-foreground">{s.label}</p><p className={`font-semibold ${s.color}`}>{s.value}</p></div></CardContent></Card>
          ))}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== MAIN APP COMPONENT ====================
export default function App() {
  const { isAuthenticated, currentUser, currentPage, loadAllData, language } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);

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
      } catch (e) {
        console.warn('Init error:', e);
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
      case 'settings': return <SettingsPage />;
      case 'superadmin': return currentUser?.role === 'super_admin' ? <SuperAdminPage /> : <DashboardPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        <Header onMenuClick={() => setSidebarOpen(true)} onExportClick={() => setExportOpen(true)} />
        <main className="flex-1 p-4 md:p-6">
          {renderPage()}
        </main>
      </div>
      <ExportDataDialog open={exportOpen} onOpenChange={setExportOpen} />
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      {profileStudent && <Student360Profile student={profileStudent} onClose={() => { setProfileStudent(null); useAppStore.setState({ profileViewStudent: null } as Partial<typeof useAppStore.getState>); }} />}
    </div>
  );
}
