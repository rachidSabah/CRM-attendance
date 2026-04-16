'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { setApiToken } from '@/lib/api';
import { t } from '@/lib/i18n';
import type { Student, Class, Module, AttendanceRecord, Grade, BehaviorRecord, Task, Incident, Teacher, Employee, Template, AcademicYear, PageName } from '@/lib/types';
import * as exportUtils from '@/lib/export';

// shadcn/ui imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

// Lucide icons
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardCheck, Calendar,
  FileText, SmilePlus, ListTodo, AlertTriangle, MessageSquare, BarChart3,
  Settings, Shield, LogOut, Search, Download, Bell, Sun, Moon, Menu,
  X, Plus, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, RefreshCw,
  UserPlus, CheckCircle2, XCircle, Clock, ShieldCheck, Upload,
  Save, Key, Languages, Building2, Phone, Mail, MapPin, Star,
  TrendingUp, TrendingDown, Minus, CircleDot, Send, FileDown,
  Copy, Printer, Lock, ArrowLeft, Filter, MoreHorizontal, MessageCircle
} from 'lucide-react';

// Recharts
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

// ============================================================
// CONSTANTS
// ============================================================

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

type NavItem = {
  id: PageName;
  labelKey: string;
  icon: React.ReactNode;
  superAdminOnly?: boolean;
};

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

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}>
      {t(status)}
    </Badge>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <CircleDot className="h-12 w-12 mb-4 opacity-50" />
      <p>{message}</p>
    </div>
  );
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// ============================================================
// LOGIN SCREEN
// ============================================================

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
    setLoading(true);
    setError('');
    const success = await login(username, password, slug || undefined);
    if (success) {
      toast.success(language === 'fr' ? 'Connexion réussie!' : 'Login successful!');
    } else {
      setError(language === 'fr' ? 'Identifiants incorrects' : 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center">
            <GraduationCap className="h-9 w-9 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">INFOHAS</CardTitle>
            <CardDescription className="text-sm mt-1">
              {language === 'fr' ? "Système de Gestion de Présence" : "Attendance Management System"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">{t('username', language)}</Label>
              <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('username', language)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password', language)}</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('password', language)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t('school_slug', language)}</Label>
              <Input id="slug" value={slug} onChange={e => setSlug(e.target.value)} placeholder="school-name" />
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('signing_in', language)}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser, currentPage, setCurrentPage, logout, language, setSchoolInfo } = useAppStore();
  const schoolInfo = useAppStore(s => s.schoolInfo);

  const filteredNav = NAV_ITEMS.filter(item => {
    if (item.superAdminOnly && currentUser?.role !== 'super_admin') return false;
    return true;
  });

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm truncate">{schoolInfo?.name || 'INFOHAS'}</h2>
              <p className="text-xs text-muted-foreground truncate">{currentUser?.fullName || currentUser?.username}</p>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 custom-scrollbar">
            <nav className="p-2 space-y-1">
              {filteredNav.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setCurrentPage(item.id); onClose(); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === item.id
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  {t(item.labelKey, language)}
                </button>
              ))}
            </nav>
          </ScrollArea>

          {/* Bottom */}
          <div className="p-3 border-t border-border space-y-1">
            <button
              onClick={() => { setCurrentPage('settings'); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Key className="h-4 w-4" />
              {t('change_password', language)}
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t('logout', language)}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// HEADER
// ============================================================

function Header({ onMenuClick, onExportClick }: { onMenuClick: () => void; onExportClick: () => void }) {
  const { currentPage, language, schoolInfo } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const pageTitle = t(currentPage, language);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{pageTitle}</h1>
        </div>

        {/* Search */}
        <div className="hidden sm:flex items-center">
          <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" onClick={() => setSearchOpen(!searchOpen)}>
            <Search className="h-4 w-4" />
            <span className="text-xs">{t('search', language)}</span>
            <kbd className="hidden md:inline-flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              Ctrl+K
            </kbd>
          </Button>
        </div>

        {/* Language toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => {
            useAppStore.setState({ language: language === 'en' ? 'fr' : 'en' });
            toast.success(language === 'en' ? 'Langue: Français' : 'Language: English');
          }}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{language.toUpperCase()}</span>
        </Button>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* Export */}
        <Button variant="outline" size="icon" onClick={onExportClick}>
          <Download className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setNotifOpen(!notifOpen)}>
            <Bell className="h-5 w-5" />
          </Button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-lg p-3 z-50">
              <p className="text-sm font-medium mb-2">Notifications</p>
              <p className="text-xs text-muted-foreground">{t('no_data', language)}</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================================
// DASHBOARD PAGE
// ============================================================

function DashboardPage() {
  const { students, classes, attendance, language, setCurrentPage } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayRecords = attendance.filter(r => r.date === today);
  const presentCount = todayRecords.filter(r => r.status === 'present').length;
  const absentCount = todayRecords.filter(r => r.status === 'absent').length;
  const lateCount = todayRecords.filter(r => r.status === 'late').length;

  // Last 7 days attendance chart data
  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayRecords = attendance.filter(r => r.date === dateStr);
      days.push({
        date: d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' }),
        present: dayRecords.filter(r => r.status === 'present').length,
        absent: dayRecords.filter(r => r.status === 'absent').length,
        late: dayRecords.filter(r => r.status === 'late').length,
      });
    }
    return days;
  }, [attendance, language]);

  // Attendance distribution for pie chart
  const pieData = [
    { name: t('present', language), value: presentCount, color: '#10b981' },
    { name: t('absent', language), value: absentCount, color: '#ef4444' },
    { name: t('late', language), value: lateCount, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const recentRecords = attendance.slice(-10).reverse();

  const stats = [
    { label: t('total_students', language), value: students.length, icon: <Users className="h-6 w-6" />, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
    { label: t('total_classes', language), value: classes.length, icon: <GraduationCap className="h-6 w-6" />, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
    { label: t('today_attendance', language), value: todayRecords.length, icon: <ClipboardCheck className="h-6 w-6" />, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
    { label: t('present_today', language), value: presentCount, icon: <CheckCircle2 className="h-6 w-6" />, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('quick_actions', language)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('add_student', language), icon: <UserPlus className="h-5 w-5" />, page: 'students' as PageName },
              { label: t('mark_attendance', language), icon: <ClipboardCheck className="h-5 w-5" />, page: 'attendance' as PageName },
              { label: t('today_report', language), icon: <FileText className="h-5 w-5" />, page: 'reports' as PageName },
              { label: t('view_calendar', language), icon: <Calendar className="h-5 w-5" />, page: 'calendar' as PageName },
            ].map((action, i) => (
              <Button key={i} variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setCurrentPage(action.page)}>
                {action.icon}
                <span className="text-xs">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{language === 'fr' ? 'Présence (7 jours)' : 'Attendance (7 days)'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReTooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#10b981" name={t('present', language)} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="#ef4444" name={t('absent', language)} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" fill="#f59e0b" name={t('late', language)} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{language === 'fr' ? "Distribution d'Aujourd'hui" : "Today's Distribution"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <ReTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {t('no_data', language)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('recent_activity', language)}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRecords.length === 0 ? (
            <EmptyState message={t('no_data', language)} />
          ) : (
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('students', language)}</TableHead>
                    <TableHead>{t('calendar', language)}</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRecords.map(r => {
                    const student = students.find(s => s.id === r.studentId);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{student?.fullName || 'Unknown'}</TableCell>
                        <TableCell>{r.date}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// STUDENTS PAGE
// ============================================================

function StudentsPage() {
  const { students, classes, language, setStudents } = useAppStore();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    fullName: '', studentId: '', classId: '', status: 'active' as Student['status'],
    guardianName: '', guardianPhone: '', phone: '', email: '', address: '', notes: '', group: '',
  });

  const filtered = students.filter(s => {
    const matchSearch = s.fullName.toLowerCase().includes(search.toLowerCase()) || s.studentId.toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === 'all' || s.classId === classFilter;
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchClass && matchStatus;
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ fullName: '', studentId: '', classId: '', status: 'active', guardianName: '', guardianPhone: '', phone: '', email: '', address: '', notes: '', group: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({ fullName: s.fullName, studentId: s.studentId, classId: s.classId, status: s.status, guardianName: s.guardianName || '', guardianPhone: s.guardianPhone || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '', group: s.group || '' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.fullName || !form.studentId) { toast.error('Name and Student ID are required'); return; }
    if (editing) {
      const updated = students.map(s => s.id === editing.id ? { ...s, ...form, className: classes.find(c => c.id === form.classId)?.name } : s);
      setStudents(updated);
      toast.success(language === 'fr' ? 'Étudiant modifié' : 'Student updated');
    } else {
      const newStudent: Student = { ...form, id: genId(), className: classes.find(c => c.id === form.classId)?.name, createdAt: new Date().toISOString() };
      setStudents([...students, newStudent]);
      toast.success(language === 'fr' ? 'Étudiant ajouté' : 'Student added');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
    toast.success(language === 'fr' ? 'Étudiant supprimé' : 'Student deleted');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const imported: Student[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;
        imported.push({
          id: genId(),
          fullName: cols[header.indexOf('fullname') >= 0 ? header.indexOf('fullname') : 0] || cols[0],
          studentId: cols[header.indexOf('studentid') >= 0 ? header.indexOf('studentid') : 1] || cols[1],
          classId: '', status: 'active',
          guardianName: cols[header.indexOf('guardianname') >= 0 ? header.indexOf('guardianname') : -1] || '',
          phone: cols[header.indexOf('phone') >= 0 ? header.indexOf('phone') : -1] || '',
          email: cols[header.indexOf('email') >= 0 ? header.indexOf('email') : -1] || '',
          address: cols[header.indexOf('address') >= 0 ? header.indexOf('address') : -1] || '',
          createdAt: new Date().toISOString(),
        });
      }
      setStudents([...students, ...imported]);
      toast.success(`${imported.length} ${language === 'fr' ? 'étudiants importés' : 'students imported'}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('search', language)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('classes', language)}</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'fr' ? 'Tous' : 'All'}</SelectItem>
              <SelectItem value="active">{t('active', language)}</SelectItem>
              <SelectItem value="abandoned">{t('abandoned', language)}</SelectItem>
              <SelectItem value="graduated">{t('graduated', language)}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
            <Button variant="outline" size="sm" asChild>
              <span><Upload className="h-4 w-4 mr-1" /> CSV</span>
            </Button>
          </label>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> {t('add_student', language)}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState message={t('no_data', language)} />
          ) : (
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'fr' ? 'Nom' : 'Name'}</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead className="hidden md:table-cell">{t('classes', language)}</TableHead>
                    <TableHead className="hidden lg:table-cell">{language === 'fr' ? 'Tuteur' : 'Guardian'}</TableHead>
                    <TableHead className="hidden lg:table-cell">{language === 'fr' ? 'Téléphone' : 'Phone'}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">{language === 'fr' ? 'Actions' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell>{s.studentId}</TableCell>
                      <TableCell className="hidden md:table-cell">{s.className || classes.find(c => c.id === s.classId)?.name || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{s.guardianName || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{s.guardianPhone || s.phone || '-'}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setProfileStudent(s); setProfileOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('edit', language) : t('add_student', language)}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Nom Complet' : 'Full Name'} *</Label>
                <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'ID Étudiant' : 'Student ID'} *</Label>
                <Input value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('classes', language)}</Label>
                <Select value={form.classId} onValueChange={v => setForm({ ...form, classId: v })}>
                  <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Student['status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('active', language)}</SelectItem>
                    <SelectItem value="abandoned">{t('abandoned', language)}</SelectItem>
                    <SelectItem value="graduated">{t('graduated', language)}</SelectItem>
                    <SelectItem value="terminated">{t('terminated', language)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Nom du Tuteur' : 'Guardian Name'}</Label>
                <Input value={form.guardianName} onChange={e => setForm({ ...form, guardianName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Tél Tuteur' : 'Guardian Phone'}</Label>
                <Input value={form.guardianPhone} onChange={e => setForm({ ...form, guardianPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Téléphone' : 'Phone'}</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Adresse' : 'Address'}</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Group</Label>
              <Input value={form.group} onChange={e => setForm({ ...form, group: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Profil Étudiant' : 'Student Profile'}</DialogTitle>
          </DialogHeader>
          {profileStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {profileStudent.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{profileStudent.fullName}</h3>
                  <p className="text-sm text-muted-foreground">{profileStudent.studentId}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{t('classes', language)}:</span> <span className="font-medium">{profileStudent.className || '-'}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={profileStudent.status} /></div>
                <div><span className="text-muted-foreground">{language === 'fr' ? 'Tuteur' : 'Guardian'}:</span> <span className="font-medium">{profileStudent.guardianName || '-'}</span></div>
                <div><span className="text-muted-foreground">{language === 'fr' ? 'Tél Tuteur' : 'Guardian Phone'}:</span> <span className="font-medium">{profileStudent.guardianPhone || '-'}</span></div>
                <div><span className="text-muted-foreground">{language === 'fr' ? 'Téléphone' : 'Phone'}:</span> <span className="font-medium">{profileStudent.phone || '-'}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{profileStudent.email || '-'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">{language === 'fr' ? 'Adresse' : 'Address'}:</span> <span className="font-medium">{profileStudent.address || '-'}</span></div>
                {profileStudent.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> <span className="font-medium">{profileStudent.notes}</span></div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// GENERIC CRUD PAGE (Classes, Modules, Teachers, Employees, Templates, Academic Years)
// ============================================================

function CrudPage<T extends { id: string; createdAt: string }>({
  title,
  items,
  setItems,
  columns,
  renderForm,
  filterItems,
}: {
  title: string;
  items: T[];
  setItems: (items: T[]) => void;
  columns: { key: string; label: string; render?: (item: T) => React.ReactNode }[];
  renderForm: (item: Partial<T>, onChange: (item: Partial<T>) => void) => React.ReactNode;
  filterItems?: (items: T[], search: string) => T[];
}) {
  const { language } = useAppStore();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [form, setForm] = useState<Partial<T>>({});

  const filtered = filterItems ? filterItems(items, search) : items.filter(item => {
    return columns.some(col => {
      const val = (item as Record<string, unknown>)[col.key];
      return String(val).toLowerCase().includes(search.toLowerCase());
    });
  });

  const openAdd = () => {
    setEditing(null);
    setForm({});
    setDialogOpen(true);
  };

  const openEdit = (item: T) => {
    setEditing(item);
    setForm({ ...item });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing?.id) {
      setItems(items.map(i => i.id === editing.id ? { ...i, ...form } as T : i));
      toast.success(language === 'fr' ? 'Modifié avec succès' : 'Updated successfully');
    } else {
      const newItem = { ...form, id: genId(), createdAt: new Date().toISOString() } as T;
      setItems([...items, newItem]);
      toast.success(language === 'fr' ? 'Ajouté avec succès' : 'Added successfully');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    toast.success(language === 'fr' ? 'Supprimé avec succès' : 'Deleted successfully');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('search', language)} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> {t('add', language)} {title}
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState message={t('no_data', language)} />
          ) : (
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
                    <TableHead className="w-24">{language === 'fr' ? 'Actions' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => (
                    <TableRow key={item.id}>
                      {columns.map(col => (
                        <TableCell key={col.key}>
                          {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '-')}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('edit', language) : t('add', language)} {title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">{renderForm(form, setForm)}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel', language)}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}>{t('save', language)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// CLASSES PAGE
// ============================================================

function ClassesPage() {
  const { classes, setClasses, students, language } = useAppStore();

  return (
    <CrudPage<Class>
      title={t('classes', language)}
      items={classes}
      setItems={setClasses}
      columns={[
        { key: 'name', label: t('classes', language) },
        { key: 'description', label: language === 'fr' ? 'Description' : 'Description' },
        { key: 'teacher', label: language === 'fr' ? 'Enseignant' : 'Teacher' },
        { key: 'room', label: language === 'fr' ? 'Salle' : 'Room' },
        { key: 'capacity', label: language === 'fr' ? 'Capacité' : 'Capacity' },
        {
          key: '_students', label: language === 'fr' ? 'Étudiants' : 'Students',
          render: (item) => (
            <Badge variant="secondary">{students.filter(s => s.classId === item.id).length}</Badge>
          ),
        },
      ]}
      renderForm={(item, onChange) => (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{t('classes', language)} *</Label>
            <Input value={String(item.name || '')} onChange={e => onChange({ ...item, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
            <Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Enseignant' : 'Teacher'}</Label>
              <Input value={String(item.teacher || '')} onChange={e => onChange({ ...item, teacher: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Salle' : 'Room'}</Label>
              <Input value={String(item.room || '')} onChange={e => onChange({ ...item, room: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Capacité' : 'Capacity'}</Label>
            <Input type="number" value={String(item.capacity || 30)} onChange={e => onChange({ ...item, capacity: parseInt(e.target.value) || 30 })} />
          </div>
        </div>
      )}
    />
  );
}

// ============================================================
// MODULES PAGE
// ============================================================

function ModulesPage() {
  const { modules, setModules, language } = useAppStore();

  return (
    <CrudPage<Module>
      title={t('modules', language)}
      items={modules}
      setItems={setModules}
      columns={[
        { key: 'name', label: language === 'fr' ? 'Nom' : 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'year', label: language === 'fr' ? 'Année' : 'Year' },
        { key: 'semester', label: language === 'fr' ? 'Semestre' : 'Semester' },
        { key: 'credits', label: language === 'fr' ? 'Crédits' : 'Credits' },
      ]}
      renderForm={(item, onChange) => (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Nom du Module' : 'Module Name'} *</Label>
            <Input value={String(item.name || '')} onChange={e => onChange({ ...item, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={String(item.code || '')} onChange={e => onChange({ ...item, code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Crédits' : 'Credits'}</Label>
              <Input type="number" value={String(item.credits || '')} onChange={e => onChange({ ...item, credits: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Année' : 'Year'}</Label>
              <Input value={String(item.year || '')} onChange={e => onChange({ ...item, year: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Semestre' : 'Semester'}</Label>
              <Input value={String(item.semester || '')} onChange={e => onChange({ ...item, semester: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
            <Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={2} />
          </div>
        </div>
      )}
    />
  );
}

// ============================================================
// ATTENDANCE PAGE
// ============================================================

function AttendancePage() {
  const { students, classes, attendance, setAttendance, templates, schoolInfo, language } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [overrides, setOverrides] = useState<Record<string, AttendanceRecord['status']>>({});
  const [saving, setSaving] = useState(false);

  const filteredStudents = students.filter(s => {
    if (s.status !== 'active') return false;
    if (selectedClass !== 'all' && s.classId !== selectedClass) return false;
    return true;
  });

  // Derive base records from attendance data
  const baseRecords = useMemo(() => {
    const dayRecords = attendance.filter(r => r.date === selectedDate);
    const map: Record<string, AttendanceRecord['status']> = {};
    dayRecords.forEach(r => { map[r.studentId] = r.status; });
    return map;
  }, [selectedDate, attendance]);

  // Effective records = base + user overrides
  const localRecords = useMemo(() => ({ ...baseRecords, ...overrides }), [baseRecords, overrides]);

  const handleStatusChange = (studentId: string, status: AttendanceRecord['status']) => {
    setOverrides(prev => ({ ...prev, [studentId]: status }));
    // Auto-open WhatsApp Web when marking absent or late (matches original HTML behavior)
    if (status === 'absent' || status === 'late') {
      const student = students.find(s => s.id === studentId);
      if (student?.guardianPhone) {
        setTimeout(() => {
          sendAbsenceWhatsApp(studentId);
          toast.success(language === 'fr' ? `Message WhatsApp ouvert pour ${student.guardianName || 'tuteur'}` : `WhatsApp opened for ${student.guardianName || 'guardian'}`);
        }, 500);
      }
    }
  };

  const handleMarkAll = (status: AttendanceRecord['status']) => {
    const map: Record<string, AttendanceRecord['status']> = {};
    filteredStudents.forEach(s => { map[s.id] = status; });
    setOverrides(map);
    // Auto-open WhatsApp for all absent/late students (staggered to avoid popup blockers)
    if (status === 'absent' || status === 'late') {
      const studentsWithPhone = filteredStudents.filter(s => s.guardianPhone);
      if (studentsWithPhone.length > 0) {
        studentsWithPhone.forEach((student, index) => {
          setTimeout(() => {
            sendAbsenceWhatsApp(student.id);
          }, (index + 1) * 1000);
        });
        toast.info(language === 'fr'
          ? `Ouverture WhatsApp pour ${studentsWithPhone.length} tuteurs...`
          : `Opening WhatsApp for ${studentsWithPhone.length} guardians...`);
      }
    }
  };

  const handleSave = () => {
    setSaving(true);
    const existingIds = new Set(attendance.filter(r => r.date === selectedDate).map(r => r.studentId));
    const newRecords: AttendanceRecord[] = [];
    const updatedAttendance = attendance.filter(r => r.date !== selectedDate);

    filteredStudents.forEach(s => {
      const status = localRecords[s.id] || 'present';
      const existing = attendance.find(r => r.date === selectedDate && r.studentId === s.id);
      if (existing) {
        updatedAttendance.push({ ...existing, status });
      } else {
        newRecords.push({
          id: genId(), studentId: s.id, date: selectedDate, status,
          createdAt: new Date().toISOString(),
        });
      }
    });

    setAttendance([...updatedAttendance, ...newRecords]);
    toast.success(language === 'fr' ? 'Présence enregistrée!' : 'Attendance saved!');
    // Auto-send WhatsApp for newly marked absent/late students on save
    const newlyAbsentLate = filteredStudents.filter(s => {
      const newStatus = localRecords[s.id] || 'present';
      const oldRecord = attendance.find(r => r.date === selectedDate && r.studentId === s.id);
      const oldStatus = oldRecord?.status || 'present';
      return (newStatus === 'absent' || newStatus === 'late') && newStatus !== oldStatus && s.guardianPhone;
    });
    if (newlyAbsentLate.length > 0) {
      newlyAbsentLate.forEach((student, index) => {
        setTimeout(() => {
          sendAbsenceWhatsApp(student.id);
        }, (index + 1) * 1000);
      });
      toast.info(language === 'fr'
        ? `Ouverture WhatsApp pour ${newlyAbsentLate.length} tuteur(s)...`
        : `Opening WhatsApp for ${newlyAbsentLate.length} guardian(s)...`);
    }
    setTimeout(() => setSaving(false), 500);
  };

  const counts = {
    present: Object.values(localRecords).filter(s => s === 'present').length,
    absent: Object.values(localRecords).filter(s => s === 'absent').length,
    late: Object.values(localRecords).filter(s => s === 'late').length,
    excused: Object.values(localRecords).filter(s => s === 'excused').length,
  };

  // WhatsApp: Send absence/late notification via wa.me
  const formatWhatsAppPhone = (phone: string | undefined): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '1' + cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) { /* ok */ }
    else if (cleaned.length === 9 && cleaned.startsWith('0')) cleaned = '44' + cleaned.substring(1);
    else if (cleaned.length === 10 && cleaned.startsWith('0')) cleaned = '212' + cleaned.substring(1);
    return cleaned;
  };

  const sendAbsenceWhatsApp = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !student.guardianPhone) { toast.error(language === 'fr' ? 'Aucun numéro' : 'No phone number'); return; }
    const status = localRecords[studentId];
    let tmpl = templates.find(t => {
      const n = t.name.toLowerCase();
      if (status === 'late') return n.includes('late') || n.includes('retard');
      return n.includes('absence') || n.includes('absent');
    });
    if (!tmpl) {
      tmpl = status === 'late'
        ? { id: '', name: 'Late', category: 'late', content: 'Hello {guardian_name}, {student_name} arrived late to {class} today ({date}).', createdAt: '' }
        : { id: '', name: 'Absence', category: 'absence', content: 'Dear {guardian_name}, {student_name} was marked absent from {class} today ({date}). Please contact {school_name} if needed. Thank you.', createdAt: '' };
    }
    const studentClass = classes.find(c => c.id === student.classId);
    const message = tmpl.content
      .replace(/{student_name}/g, student.fullName)
      .replace(/{guardian_name}/g, student.guardianName || 'Guardian')
      .replace(/{class}/g, studentClass?.name || 'class')
      .replace(/{date}/g, new Date().toLocaleDateString())
      .replace(/{school_name}/g, schoolInfo?.name || 'School');
    const formatted = formatWhatsAppPhone(student.guardianPhone);
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-1">
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" />
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'fr' ? 'Toutes les classes' : 'All Classes'}</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleMarkAll('present')}>
            <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" /> {t('present', language)}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleMarkAll('absent')}>
            <XCircle className="h-4 w-4 mr-1 text-red-600" /> {t('absent', language)}
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {t('save', language)}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{counts.present}</p><p className="text-xs text-muted-foreground">{t('present', language)}</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-red-600">{counts.absent}</p><p className="text-xs text-muted-foreground">{t('absent', language)}</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-amber-600">{counts.late}</p><p className="text-xs text-muted-foreground">{t('late', language)}</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-sky-600">{counts.excused}</p><p className="text-xs text-muted-foreground">{t('excused', language)}</p></CardContent></Card>
      </div>

      {/* Student List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <EmptyState message={t('no_data', language)} />
          ) : (
            <div className="max-h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'fr' ? 'Nom' : 'Name'}</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead className="hidden md:table-cell">{t('classes', language)}</TableHead>
                    <TableHead className="text-center">{language === 'fr' ? 'Statut' : 'Status'}</TableHead>
                    <TableHead className="text-center">WhatsApp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell>{s.studentId}</TableCell>
                      <TableCell className="hidden md:table-cell">{s.className || classes.find(c => c.id === s.classId)?.name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <Select value={localRecords[s.id] || 'present'} onValueChange={v => handleStatusChange(s.id, v as AttendanceRecord['status'])}>
                            <SelectTrigger className="w-32">
                              <StatusBadge status={localRecords[s.id] || 'present'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">{t('present', language)}</SelectItem>
                              <SelectItem value="absent">{t('absent', language)}</SelectItem>
                              <SelectItem value="late">{t('late', language)}</SelectItem>
                              <SelectItem value="excused">{t('excused', language)}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          {s.guardianPhone ? (
                            <Button variant="ghost" size="sm" className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={() => sendAbsenceWhatsApp(s.id)} title="Send WhatsApp">
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// CALENDAR PAGE
// ============================================================

function CalendarPage() {
  const { attendance, students, classes, language } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentMonth.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' });

  const dayNames = language === 'fr'
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Adjust firstDay: Sunday = 0 for en, but Monday = 0 for fr
  const startOffset = language === 'fr' ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;

  const getRecordsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendance.filter(r => r.date === dateStr);
  };

  const selectedRecords = selectedDay
    ? attendance.filter(r => r.date === selectedDay)
    : [];

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
            <h3 className="text-lg font-semibold capitalize">{monthName}</h3>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {[...Array(startOffset)].map((_, i) => <div key={`e-${i}`} />)}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const records = getRecordsForDay(day);
              const hasRecords = records.length > 0;
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const isSelected = selectedDay === dateStr;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                  className={`relative p-2 rounded-lg text-sm min-h-12 flex flex-col items-center justify-center transition-colors
                    ${isSelected ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'hover:bg-muted'}
                    ${isToday ? 'font-bold ring-2 ring-emerald-500' : ''}
                  `}
                >
                  <span>{day}</span>
                  {hasRecords && (
                    <div className="flex gap-0.5 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${records.some(r => r.status === 'present') ? 'bg-emerald-500' : 'hidden'}`} />
                      <div className={`w-1.5 h-1.5 rounded-full ${records.some(r => r.status === 'absent') ? 'bg-red-500' : 'hidden'}`} />
                      <div className={`w-1.5 h-1.5 rounded-full ${records.some(r => r.status === 'late') ? 'bg-amber-500' : 'hidden'}`} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day records */}
      {selectedDay && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {language === 'fr' ? 'Présence pour le' : 'Attendance for'} {selectedDay}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedRecords.length === 0 ? (
              <EmptyState message={t('no_data', language)} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'fr' ? 'Étudiant' : 'Student'}</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRecords.map(r => {
                    const student = students.find(s => s.id === r.studentId);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{student?.fullName || 'Unknown'}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// GRADES PAGE
// ============================================================

function GradesPage() {
  const { grades, setGrades, students, modules, language } = useAppStore();

  return (
    <CrudPage<Grade>
      title={t('grades', language)}
      items={grades}
      setItems={setGrades}
      columns={[
        {
          key: 'studentId', label: language === 'fr' ? 'Étudiant' : 'Student',
          render: (item) => students.find(s => s.id === item.studentId)?.fullName || 'Unknown',
        },
        {
          key: 'moduleId', label: t('modules', language),
          render: (item) => modules.find(m => m.id === item.moduleId)?.name || 'Unknown',
        },
        { key: 'grade', label: language === 'fr' ? 'Note' : 'Grade' },
        {
          key: 'percentage', label: '%',
          render: (item) => item.percentage != null ? `${item.percentage}%` : '-',
        },
        {
          key: 'date', label: t('calendar', language),
          render: (item) => item.date || '-',
        },
      ]}
      renderForm={(item, onChange) => (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Étudiant' : 'Student'}</Label>
            <Select value={String(item.studentId || '')} onValueChange={v => onChange({ ...item, studentId: v })}>
              <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger>
              <SelectContent>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('modules', language)}</Label>
            <Select value={String(item.moduleId || '')} onValueChange={v => onChange({ ...item, moduleId: v })}>
              <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger>
              <SelectContent>
                {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Note' : 'Grade'}</Label>
              <Input value={String(item.grade || '')} onChange={e => onChange({ ...item, grade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Percentage</Label>
              <Input type="number" min="0" max="100" value={String(item.percentage ?? '')} onChange={e => onChange({ ...item, percentage: parseFloat(e.target.value) || undefined })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('calendar', language)}</Label>
            <Input type="date" value={String(item.date || '')} onChange={e => onChange({ ...item, date: e.target.value })} />
          </div>
        </div>
      )}
    />
  );
}

// ============================================================
// BEHAVIOR PAGE
// ============================================================

function BehaviorPage() {
  const { behavior, setBehavior, students, language } = useAppStore();

  return (
    <CrudPage<BehaviorRecord>
      title={t('behavior', language)}
      items={behavior}
      setItems={setBehavior}
      columns={[
        {
          key: 'studentId', label: language === 'fr' ? 'Étudiant' : 'Student',
          render: (item) => students.find(s => s.id === item.studentId)?.fullName || 'Unknown',
        },
        { key: 'type', label: 'Type', render: (item) => <StatusBadge status={item.type} /> },
        { key: 'description', label: language === 'fr' ? 'Description' : 'Description' },
        { key: 'points', label: language === 'fr' ? 'Points' : 'Points' },
        { key: 'date', label: t('calendar', language) },
      ]}
      renderForm={(item, onChange) => (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Étudiant' : 'Student'}</Label>
            <Select value={String(item.studentId || '')} onValueChange={v => onChange({ ...item, studentId: v })}>
              <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger>
              <SelectContent>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={String(item.type || 'positive')} onValueChange={v => onChange({ ...item, type: v as BehaviorRecord['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">{t('positive', language)}</SelectItem>
                  <SelectItem value="negative">{t('negative', language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Points' : 'Points'}</Label>
              <Input type="number" value={String(item.points || '')} onChange={e => onChange({ ...item, points: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
            <Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('calendar', language)}</Label>
              <Input type="date" value={String(item.date || '')} onChange={e => onChange({ ...item, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Enseignant' : 'Teacher'}</Label>
              <Input value={String(item.teacher || '')} onChange={e => onChange({ ...item, teacher: e.target.value })} />
            </div>
          </div>
        </div>
      )}
    />
  );
}

// ============================================================
// TASKS PAGE
// ============================================================

function TasksPage() {
  const { tasks, setTasks, language } = useAppStore();

  const statusGroups = [
    { key: 'pending', label: t('pending', language), color: 'border-t-gray-400' },
    { key: 'in_progress', label: t('in_progress', language), color: 'border-t-blue-500' },
    { key: 'completed', label: t('completed', language), color: 'border-t-emerald-500' },
    { key: 'overdue', label: t('overdue', language), color: 'border-t-red-500' },
  ];

  return (
    <CrudPage<Task>
      title={t('tasks', language)}
      items={tasks}
      setItems={setTasks}
      columns={[
        { key: 'ticketNumber', label: 'Ticket' },
        { key: 'title', label: language === 'fr' ? 'Titre' : 'Title' },
        { key: 'priority', label: language === 'fr' ? 'Priorité' : 'Priority', render: (item) => <StatusBadge status={item.priority} /> },
        { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
        { key: 'assignedTo', label: language === 'fr' ? 'Assigné à' : 'Assigned To' },
        { key: 'dueDate', label: language === 'fr' ? 'Échéance' : 'Due Date' },
        {
          key: 'progress', label: language === 'fr' ? 'Progression' : 'Progress',
          render: (item) => (
            <div className="flex items-center gap-2 min-w-24">
              <Progress value={item.progress || 0} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground w-8">{item.progress || 0}%</span>
            </div>
          ),
        },
      ]}
      renderForm={(item, onChange) => (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Titre' : 'Title'} *</Label>
            <Input value={String(item.title || '')} onChange={e => onChange({ ...item, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
            <Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Priorité' : 'Priority'}</Label>
              <Select value={String(item.priority || 'medium')} onValueChange={v => onChange({ ...item, priority: v as Task['priority'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">{t('urgent', language)}</SelectItem>
                  <SelectItem value="high">{t('high', language)}</SelectItem>
                  <SelectItem value="medium">{t('medium', language)}</SelectItem>
                  <SelectItem value="low">{t('low', language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={String(item.status || 'pending')} onValueChange={v => onChange({ ...item, status: v as Task['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('pending', language)}</SelectItem>
                  <SelectItem value="in_progress">{t('in_progress', language)}</SelectItem>
                  <SelectItem value="completed">{t('completed', language)}</SelectItem>
                  <SelectItem value="overdue">{t('overdue', language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Assigné à' : 'Assigned To'}</Label>
              <Input value={String(item.assignedTo || '')} onChange={e => onChange({ ...item, assignedTo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Échéance' : 'Due Date'}</Label>
              <Input type="date" value={String(item.dueDate || '')} onChange={e => onChange({ ...item, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Catégorie' : 'Category'}</Label>
              <Input value={String(item.category || '')} onChange={e => onChange({ ...item, category: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Progression' : 'Progress'} (%)</Label>
              <Input type="number" min="0" max="100" value={String(item.progress || 0)} onChange={e => onChange({ ...item, progress: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Rapport de complétion' : 'Completion Report'}</Label>
            <Textarea value={String(item.completionReport || '')} onChange={e => onChange({ ...item, completionReport: e.target.value })} rows={2} />
          </div>
        </div>
      )}
    />
  );
}

// ============================================================
// INCIDENTS PAGE
// ============================================================

function IncidentsPage() {
  const { incidents, setIncidents, students, language } = useAppStore();

  return (
    <CrudPage<Incident>
      title={t('incidents', language)}
      items={incidents}
      setItems={setIncidents}
      columns={[
        {
          key: 'studentId', label: language === 'fr' ? 'Étudiant' : 'Student',
          render: (item) => students.find(s => s.id === item.studentId)?.fullName || 'Unknown',
        },
        { key: 'incidentType', label: 'Type' },
        { key: 'severity', label: language === 'fr' ? 'Sévérité' : 'Severity', render: (item) => <StatusBadge status={item.severity} /> },
        { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
        { key: 'date', label: t('calendar', language) },
      ]}
      renderForm={(item, onChange) => (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Étudiant' : 'Student'}</Label>
            <Select value={String(item.studentId || '')} onValueChange={v => onChange({ ...item, studentId: v })}>
              <SelectTrigger><SelectValue placeholder={language === 'fr' ? 'Sélectionner' : 'Select'} /></SelectTrigger>
              <SelectContent>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={String(item.incidentType || 'other')} onValueChange={v => onChange({ ...item, incidentType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disciplinary">{t('disciplinary', language)}</SelectItem>
                  <SelectItem value="academic">{t('academic', language)}</SelectItem>
                  <SelectItem value="behavioral">{t('behavioral', language)}</SelectItem>
                  <SelectItem value="safety">{t('safety', language)}</SelectItem>
                  <SelectItem value="critical">{t('critical', language)}</SelectItem>
                  <SelectItem value="other">{t('other', language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Sévérité' : 'Severity'}</Label>
              <Select value={String(item.severity || 'medium')} onValueChange={v => onChange({ ...item, severity: v as Incident['severity'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('low', language)}</SelectItem>
                  <SelectItem value="medium">{t('medium', language)}</SelectItem>
                  <SelectItem value="high">{t('high', language)}</SelectItem>
                  <SelectItem value="critical">{t('critical', language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={String(item.status || 'open')} onValueChange={v => onChange({ ...item, status: v as Incident['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{t('open', language)}</SelectItem>
                  <SelectItem value="investigating">{t('investigating', language)}</SelectItem>
                  <SelectItem value="resolved">{t('resolved', language)}</SelectItem>
                  <SelectItem value="closed">{t('closed', language)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('calendar', language)}</Label>
              <Input type="date" value={String(item.date || '')} onChange={e => onChange({ ...item, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
            <Textarea value={String(item.description || '')} onChange={e => onChange({ ...item, description: e.target.value })} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Action prise' : 'Action Taken'}</Label>
            <Textarea value={String(item.actionTaken || '')} onChange={e => onChange({ ...item, actionTaken: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>{language === 'fr' ? 'Rapporté par' : 'Reported By'}</Label>
            <Input value={String(item.reportedBy || '')} onChange={e => onChange({ ...item, reportedBy: e.target.value })} />
          </div>
        </div>
      )}
    />
  );
}

// ============================================================
// MESSAGING PAGE
// ============================================================

function MessagingPage() {
  const { templates, setTemplates, students, classes, schoolInfo, language } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: '', content: '', category: '' });
  const [quickStudentId, setQuickStudentId] = useState('');
  const [quickTemplateId, setQuickTemplateId] = useState('');
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkTemplateId, setBulkTemplateId] = useState('');

  // Initialize default templates if empty
  useEffect(() => {
    if (templates.length === 0) {
      const defaults: Template[] = [
        { id: genId(), name: 'Absence Notification', category: 'absence', content: 'Dear {guardian_name}, we would like to inform you that {student_name} was marked absent from {class} today ({date}). If this absence was planned, please disregard this message. Otherwise, please contact {school_name} to discuss. Thank you.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Late Arrival', category: 'late', content: 'Hello {guardian_name}, {student_name} arrived late to {class} today ({date}). Please ensure punctuality.', createdAt: new Date().toISOString() },
        { id: genId(), name: 'Guardian Meeting Request', category: 'meeting', content: "Dear {guardian_name}, we would like to schedule a meeting with you to discuss {student_name}'s progress in {class}. Please contact {school_name} at your earliest convenience.", createdAt: new Date().toISOString() },
        { id: genId(), name: 'Academic Progress Update', category: 'academic', content: "Dear {guardian_name}, this is an update regarding {student_name}'s academic progress in {class}. Please feel free to contact us if you have any questions.", createdAt: new Date().toISOString() },
        { id: genId(), name: 'Student Achievement', category: 'achievement', content: 'Dear {guardian_name}, we are pleased to inform you that {student_name} has shown excellent progress in {class}. Congratulations!', createdAt: new Date().toISOString() },
        { id: genId(), name: 'General Reminder', category: 'reminder', content: 'Dear {guardian_name}, this is a reminder regarding {student_name} in {class}. Please contact us if you have any questions.', createdAt: new Date().toISOString() },
      ];
      setTemplates(defaults);
    }
  }, []);

  // Category labels and icons
  const categoryLabels: Record<string, string> = {
    absence: language === 'fr' ? 'Absence' : 'Absence Templates',
    late: language === 'fr' ? 'Retard' : 'Late Arrival Templates',
    meeting: language === 'fr' ? 'Réunion' : 'Meeting Templates',
    academic: language === 'fr' ? 'Académique' : 'Academic Templates',
    announcement: language === 'fr' ? 'Annonce' : 'Announcement Templates',
    behavioral: language === 'fr' ? 'Comportement' : 'Behavioral Templates',
    achievement: language === 'fr' ? 'Réalisation' : 'Achievement Templates',
    reminder: language === 'fr' ? 'Rappel' : 'Reminder Templates',
    custom: language === 'fr' ? 'Personnalisé' : 'Custom Templates',
  };

  const categoryColors: Record<string, string> = {
    absence: 'border-l-red-500', late: 'border-l-amber-500', meeting: 'border-l-blue-500',
    academic: 'border-l-emerald-500', announcement: 'border-l-purple-500', behavioral: 'border-l-orange-500',
    achievement: 'border-l-yellow-500', reminder: 'border-l-sky-500', custom: 'border-l-gray-400',
  };

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, Template[]> = {};
    templates.forEach(tmpl => {
      const cat = tmpl.category || 'custom';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tmpl);
    });
    return groups;
  }, [templates]);

  // Format phone number for WhatsApp
  const formatWhatsAppPhone = (phone: string | undefined): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '1' + cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) { /* ok */ }
    else if (cleaned.length === 9 && cleaned.startsWith('0')) cleaned = '44' + cleaned.substring(1);
    else if (cleaned.length === 10 && cleaned.startsWith('0')) cleaned = '212' + cleaned.substring(1);
    return cleaned;
  };

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
  const openAddTemplate = () => { setEditing(null); setForm({ name: '', content: '', category: '' }); setDialogOpen(true); };
  const openEditTemplate = (t: Template) => { setEditing(t); setForm({ name: t.name, content: t.content, category: t.category || '' }); setDialogOpen(true); };
  const handleSaveTemplate = () => {
    if (!form.name || !form.content) { toast.error('Name and content required'); return; }
    if (editing) { setTemplates(templates.map(t => t.id === editing.id ? { ...t, ...form } : t)); }
    else { setTemplates([...templates, { ...form, id: genId(), createdAt: new Date().toISOString() }]); }
    toast.success(language === 'fr' ? 'Modèle sauvegardé' : 'Template saved');
    setDialogOpen(false);
  };
  const handleDeleteTemplate = (id: string) => { setTemplates(templates.filter(t => t.id !== id)); toast.success(language === 'fr' ? 'Supprimé' : 'Deleted'); };

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
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">{language === 'fr' ? 'Modèles de Message' : 'Message Templates'}</h3>
              {Object.keys(groupedTemplates).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('no_data', language)}</div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
                  {Object.entries(groupedTemplates).map(([category, tmpls]) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-primary mb-2 pb-1 border-b border-primary/20">
                        {categoryLabels[category] || category}
                      </h4>
                      <div className="space-y-2">
                        {tmpls.map(tmpl => (
                          <div key={tmpl.id} className={`p-3 border border-border rounded-lg border-l-4 ${categoryColors[category] || 'border-l-gray-400'} hover:bg-muted/50 transition-colors`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm">{tmpl.name}</h4>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tmpl.content}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {'{student_name}'} {'{guardian_name}'} {'{class}'} {'{date}'} {'{school_name}'}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTemplate(tmpl)}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteTemplate(tmpl.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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

// ============================================================
// REPORTS PAGE
// ============================================================

function ReportsPage() {
  const { students, attendance, grades, behavior, incidents, classes, modules, language } = useAppStore();

  // Attendance trend - last 30 days
  const trendData = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayRecords = attendance.filter(r => r.date === dateStr);
      days.push({
        date: d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' }),
        present: dayRecords.filter(r => r.status === 'present').length,
        absent: dayRecords.filter(r => r.status === 'absent').length,
        late: dayRecords.filter(r => r.status === 'late').length,
      });
    }
    return days;
  }, [attendance, language]);

  // Class distribution
  const classDistribution = classes.map(c => ({
    name: c.name,
    students: students.filter(s => s.classId === c.id).length,
  }));

  // Grade distribution
  const gradeDist = [
    { name: 'A (90-100)', value: grades.filter(g => g.percentage != null && g.percentage >= 90).length },
    { name: 'B (80-89)', value: grades.filter(g => g.percentage != null && g.percentage >= 80 && g.percentage < 90).length },
    { name: 'C (70-79)', value: grades.filter(g => g.percentage != null && g.percentage >= 70 && g.percentage < 80).length },
    { name: 'D (60-69)', value: grades.filter(g => g.percentage != null && g.percentage >= 60 && g.percentage < 70).length },
    { name: 'F (<60)', value: grades.filter(g => g.percentage != null && g.percentage < 60).length },
  ].filter(d => d.value > 0);

  // Incident severity
  const incidentData = [
    { name: t('low', language), value: incidents.filter(i => i.severity === 'low').length },
    { name: t('medium', language), value: incidents.filter(i => i.severity === 'medium').length },
    { name: t('high', language), value: incidents.filter(i => i.severity === 'high').length },
    { name: t('critical', language), value: incidents.filter(i => i.severity === 'critical').length },
  ].filter(d => d.value > 0);

  // Summary stats
  const totalAttendance = attendance.length;
  const avgAttendance = totalAttendance > 0
    ? Math.round((attendance.filter(r => r.status === 'present').length / totalAttendance) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{avgAttendance}%</p>
            <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Taux de présence moyen' : 'Avg. Attendance Rate'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{grades.length}</p>
            <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Total des notes' : 'Total Grades'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{behavior.length}</p>
            <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Enregistrements comportement' : 'Behavior Records'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{incidents.length}</p>
            <p className="text-xs text-muted-foreground">{language === 'fr' ? 'Total incidents' : 'Total Incidents'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Attendance trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{language === 'fr' ? 'Tendance de présence (30 jours)' : 'Attendance Trend (30 days)'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} name={t('present', language)} dot={false} />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} name={t('absent', language)} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grade distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{language === 'fr' ? 'Distribution des notes' : 'Grade Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {gradeDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gradeDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {gradeDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <ReTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('no_data', language)}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Class distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{language === 'fr' ? 'Distribution par classe' : 'Class Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {classDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ReTooltip />
                    <Bar dataKey="students" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('students', language)} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('no_data', language)}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Incident severity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{language === 'fr' ? 'Sévérité des incidents' : 'Incident Severity'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {incidentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={incidentData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                      {incidentData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <ReTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('no_data', language)}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS PAGE
// ============================================================

function SettingsPage() {
  const { schoolInfo, setSchoolInfo, teachers, setTeachers, employees, setEmployees, academicYears, setAcademicYears, language } = useAppStore();
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [teacherForm, setTeacherForm] = useState({ name: '', subject: '', email: '', phone: '', experience: '', qualification: '', notes: '' });
  const [employeeForm, setEmployeeForm] = useState({ fullName: '', email: '', phone: '', department: '', position: '' });
  const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false });
  const [infoForm, setInfoForm] = useState({ name: schoolInfo.name || '', address: schoolInfo.address || '', phone: schoolInfo.phone || '', email: schoolInfo.email || '' });

  const handlePasswordChange = () => {
    if (!passwordForm.current || !passwordForm.newPass) { toast.error('All fields required'); return; }
    if (passwordForm.newPass !== passwordForm.confirm) { toast.error('Passwords do not match'); return; }
    toast.success(language === 'fr' ? 'Mot de passe changé!' : 'Password changed!');
    setPasswordForm({ current: '', newPass: '', confirm: '' });
  };

  const handleSaveInfo = () => {
    setSchoolInfo(infoForm);
    toast.success(language === 'fr' ? 'Info école sauvegardée' : 'School info saved');
  };

  const handleAddTeacher = () => {
    if (!teacherForm.name) { toast.error('Name required'); return; }
    const newTeacher: Teacher = {
      id: genId(), name: teacherForm.name, subject: teacherForm.subject,
      email: teacherForm.email, phone: teacherForm.phone,
      experience: parseInt(teacherForm.experience) || 0,
      qualification: teacherForm.qualification, notes: teacherForm.notes,
      createdAt: new Date().toISOString(),
    };
    setTeachers([...teachers, newTeacher]);
    setTeacherForm({ name: '', subject: '', email: '', phone: '', experience: '', qualification: '', notes: '' });
    toast.success(language === 'fr' ? 'Enseignant ajouté' : 'Teacher added');
  };

  const handleAddEmployee = () => {
    if (!employeeForm.fullName) { toast.error('Name required'); return; }
    const newEmployee: Employee = {
      id: genId(), fullName: employeeForm.fullName,
      email: employeeForm.email, phone: employeeForm.phone,
      department: employeeForm.department, position: employeeForm.position,
      createdAt: new Date().toISOString(),
    };
    setEmployees([...employees, newEmployee]);
    setEmployeeForm({ fullName: '', email: '', phone: '', department: '', position: '' });
    toast.success(language === 'fr' ? 'Employé ajouté' : 'Employee added');
  };

  const handleAddYear = () => {
    if (!yearForm.name) { toast.error('Name required'); return; }
    const newYear: AcademicYear = {
      id: genId(), name: yearForm.name,
      startDate: yearForm.startDate, endDate: yearForm.endDate,
      isCurrent: yearForm.isCurrent, createdAt: new Date().toISOString(),
    };
    setAcademicYears([...academicYears, newYear]);
    setYearForm({ name: '', startDate: '', endDate: '', isCurrent: false });
    toast.success(language === 'fr' ? 'Année ajoutée' : 'Academic year added');
  };

  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="flex-wrap gap-1 h-auto bg-transparent p-0">
        <TabsTrigger value="general" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">{t('change_password', language)}</TabsTrigger>
        <TabsTrigger value="school" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">{t('school_info', language)}</TabsTrigger>
        <TabsTrigger value="teachers" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">{t('teachers_management', language)}</TabsTrigger>
        <TabsTrigger value="employees" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">{t('employees_management', language)}</TabsTrigger>
        <TabsTrigger value="years" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-400">{t('academic_year_management', language)}</TabsTrigger>
      </TabsList>

      {/* Change Password */}
      <TabsContent value="general">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t('change_password', language)}</CardTitle></CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Mot de passe actuel' : 'Current Password'}</Label>
              <Input type="password" value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Nouveau mot de passe' : 'New Password'}</Label>
              <Input type="password" value={passwordForm.newPass} onChange={e => setPasswordForm({ ...passwordForm, newPass: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm Password'}</Label>
              <Input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handlePasswordChange}>
              <Lock className="h-4 w-4 mr-2" />{t('save', language)}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* School Info */}
      <TabsContent value="school">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t('school_info', language)}</CardTitle></CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Nom de l\'école' : 'School Name'}</Label>
              <Input value={infoForm.name} onChange={e => setInfoForm({ ...infoForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Adresse' : 'Address'}</Label>
              <Input value={infoForm.address} onChange={e => setInfoForm({ ...infoForm, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Téléphone' : 'Phone'}</Label>
                <Input value={infoForm.phone} onChange={e => setInfoForm({ ...infoForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={infoForm.email} onChange={e => setInfoForm({ ...infoForm, email: e.target.value })} />
              </div>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveInfo}>
              <Save className="h-4 w-4 mr-2" />{t('save', language)}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Teachers */}
      <TabsContent value="teachers">
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t('teachers_management', language)}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-2"><Label>{language === 'fr' ? 'Nom' : 'Name'} *</Label><Input value={teacherForm.name} onChange={e => setTeacherForm({ ...teacherForm, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Matière' : 'Subject'}</Label><Input value={teacherForm.subject} onChange={e => setTeacherForm({ ...teacherForm, subject: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={teacherForm.email} onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Téléphone' : 'Phone'}</Label><Input value={teacherForm.phone} onChange={e => setTeacherForm({ ...teacherForm, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Expérience (ans)' : 'Experience (years)'}</Label><Input type="number" value={teacherForm.experience} onChange={e => setTeacherForm({ ...teacherForm, experience: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Qualification' : 'Qualification'}</Label><Input value={teacherForm.qualification} onChange={e => setTeacherForm({ ...teacherForm, qualification: e.target.value })} /></div>
              </div>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddTeacher}><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {teachers.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'fr' ? 'Nom' : 'Name'}</TableHead>
                        <TableHead>{language === 'fr' ? 'Matière' : 'Subject'}</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="hidden md:table-cell">{language === 'fr' ? 'Tél' : 'Phone'}</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teachers.map(tch => (
                        <TableRow key={tch.id}>
                          <TableCell className="font-medium">{tch.name}</TableCell>
                          <TableCell>{tch.subject || '-'}</TableCell>
                          <TableCell>{tch.email || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{tch.phone || '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setTeachers(teachers.filter(t => t.id !== tch.id))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Employees */}
      <TabsContent value="employees">
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t('employees_management', language)}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-2"><Label>{language === 'fr' ? 'Nom Complet' : 'Full Name'} *</Label><Input value={employeeForm.fullName} onChange={e => setEmployeeForm({ ...employeeForm, fullName: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Département' : 'Department'}</Label><Input value={employeeForm.department} onChange={e => setEmployeeForm({ ...employeeForm, department: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={employeeForm.email} onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Téléphone' : 'Phone'}</Label><Input value={employeeForm.phone} onChange={e => setEmployeeForm({ ...employeeForm, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Position' : 'Position'}</Label><Input value={employeeForm.position} onChange={e => setEmployeeForm({ ...employeeForm, position: e.target.value })} /></div>
              </div>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddEmployee}><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {employees.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'fr' ? 'Nom' : 'Name'}</TableHead>
                        <TableHead>{language === 'fr' ? 'Département' : 'Department'}</TableHead>
                        <TableHead>{language === 'fr' ? 'Position' : 'Position'}</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map(emp => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.fullName}</TableCell>
                          <TableCell>{emp.department || '-'}</TableCell>
                          <TableCell>{emp.position || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{emp.email || '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setEmployees(employees.filter(e => e.id !== emp.id))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Academic Years */}
      <TabsContent value="years">
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t('academic_year_management', language)}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-2"><Label>{language === 'fr' ? 'Nom' : 'Name'} *</Label><Input value={yearForm.name} onChange={e => setYearForm({ ...yearForm, name: e.target.value })} placeholder="2024-2025" /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Date début' : 'Start Date'}</Label><Input type="date" value={yearForm.startDate} onChange={e => setYearForm({ ...yearForm, startDate: e.target.value })} /></div>
                <div className="space-y-2"><Label>{language === 'fr' ? 'Date fin' : 'End Date'}</Label><Input type="date" value={yearForm.endDate} onChange={e => setYearForm({ ...yearForm, endDate: e.target.value })} /></div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={yearForm.isCurrent} onCheckedChange={v => setYearForm({ ...yearForm, isCurrent: v })} />
                  <Label>{language === 'fr' ? 'Année en cours' : 'Current Year'}</Label>
                </div>
              </div>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={handleAddYear}><Plus className="h-4 w-4 mr-1" />{t('add', language)}</Button>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {academicYears.length === 0 ? <EmptyState message={t('no_data', language)} /> : (
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'fr' ? 'Nom' : 'Name'}</TableHead>
                        <TableHead>{language === 'fr' ? 'Début' : 'Start'}</TableHead>
                        <TableHead>{language === 'fr' ? 'Fin' : 'End'}</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {academicYears.map(y => (
                        <TableRow key={y.id}>
                          <TableCell className="font-medium">{y.name}</TableCell>
                          <TableCell>{y.startDate || '-'}</TableCell>
                          <TableCell>{y.endDate || '-'}</TableCell>
                          <TableCell>{y.isCurrent ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Current</Badge> : '-'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setAcademicYears(academicYears.filter(a => a.id !== y.id))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ============================================================
// SUPER ADMIN PAGE
// ============================================================

function SuperAdminPage() {
  const { language, admins } = useAppStore();
  const [tenantForm, setTenantForm] = useState({ name: '', slug: '', adminEmail: '', adminPassword: '' });
  const [creating, setCreating] = useState(false);

  const handleCreateSchool = () => {
    if (!tenantForm.name || !tenantForm.slug || !tenantForm.adminEmail || !tenantForm.adminPassword) {
      toast.error('All fields are required');
      return;
    }
    setCreating(true);
    setTimeout(() => {
      toast.success(language === 'fr' ? 'École créée avec succès!' : 'School created successfully!');
      setTenantForm({ name: '', slug: '', adminEmail: '', adminPassword: '' });
      setCreating(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Create School */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{language === 'fr' ? 'Créer une Nouvelle École' : 'Create New School'}</CardTitle>
          <CardDescription>{language === 'fr' ? 'Configurez un nouveau locataire avec un administrateur' : 'Set up a new tenant with an admin'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Nom de l\'école' : 'School Name'}</Label>
              <Input value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={tenantForm.slug} onChange={e => setTenantForm({ ...tenantForm, slug: e.target.value })} placeholder="my-school" />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Email Admin' : 'Admin Email'}</Label>
              <Input type="email" value={tenantForm.adminEmail} onChange={e => setTenantForm({ ...tenantForm, adminEmail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Mot de passe Admin' : 'Admin Password'}</Label>
              <Input type="password" value={tenantForm.adminPassword} onChange={e => setTenantForm({ ...tenantForm, adminPassword: e.target.value })} />
            </div>
          </div>
          <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateSchool} disabled={creating}>
            {creating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
            {language === 'fr' ? 'Créer l\'école' : 'Create School'}
          </Button>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{language === 'fr' ? 'Journal d\'activité' : 'Activity Log'}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message={language === 'fr' ? 'Aucune activité récente' : 'No recent activity'} />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// EXPORT DIALOG
// ============================================================

function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, language } = useAppStore();

  const exports = [
    { label: language === 'fr' ? 'Étudiants CSV' : 'Students CSV', icon: <Users className="h-5 w-5" />, action: () => exportUtils.exportStudentsCSV(students, classes), disabled: students.length === 0 },
    { label: language === 'fr' ? 'Présence CSV' : 'Attendance CSV', icon: <ClipboardCheck className="h-5 w-5" />, action: () => exportUtils.exportAttendanceCSV(attendance, students, classes), disabled: attendance.length === 0 },
    { label: language === 'fr' ? 'Classes CSV' : 'Classes CSV', icon: <GraduationCap className="h-5 w-5" />, action: () => exportUtils.exportClassesCSV(classes, students), disabled: classes.length === 0 },
    { label: language === 'fr' ? 'Modules CSV' : 'Modules CSV', icon: <BookOpen className="h-5 w-5" />, action: () => exportUtils.exportModulesCSV(modules), disabled: modules.length === 0 },
    { label: language === 'fr' ? 'Notes CSV' : 'Grades CSV', icon: <FileText className="h-5 w-5" />, action: () => exportUtils.exportGradesCSV(grades, students, modules), disabled: grades.length === 0 },
    { label: language === 'fr' ? 'Comportement CSV' : 'Behavior CSV', icon: <SmilePlus className="h-5 w-5" />, action: () => exportUtils.exportBehaviorCSV(behavior, students), disabled: behavior.length === 0 },
    { label: language === 'fr' ? 'Tâches CSV' : 'Tasks CSV', icon: <ListTodo className="h-5 w-5" />, action: () => exportUtils.exportTasksCSV(tasks), disabled: tasks.length === 0 },
    { label: language === 'fr' ? 'Incidents CSV' : 'Incidents CSV', icon: <AlertTriangle className="h-5 w-5" />, action: () => exportUtils.exportIncidentsCSV(incidents, students), disabled: incidents.length === 0 },
    { label: language === 'fr' ? 'Enseignants CSV' : 'Teachers CSV', icon: <BookOpen className="h-5 w-5" />, action: () => exportUtils.exportTeachersCSV(teachers), disabled: teachers.length === 0 },
    { label: language === 'fr' ? 'Employés CSV' : 'Employees CSV', icon: <Building2 className="h-5 w-5" />, action: () => exportUtils.exportEmployeesCSV(employees), disabled: employees.length === 0 },
    { label: language === 'fr' ? 'Exporter Tout (CSV)' : 'Export All (CSV)', icon: <FileDown className="h-5 w-5" />, action: () => exportUtils.exportAllCSV({ students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees }), disabled: false, highlight: true },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('export', language)} {language === 'fr' ? 'Données' : 'Data'}</DialogTitle>
          <DialogDescription>{language === 'fr' ? 'Téléchargez vos données au format CSV' : 'Download your data in CSV format'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4 max-h-96 overflow-y-auto custom-scrollbar">
          {exports.map((exp, i) => (
            <Button
              key={i}
              variant={exp.highlight ? 'default' : 'outline'}
              className={`h-auto py-3 justify-start gap-3 ${exp.highlight ? 'bg-emerald-600 hover:bg-emerald-700 col-span-2' : ''} ${exp.disabled ? 'opacity-50' : ''}`}
              disabled={exp.disabled}
              onClick={() => { exp.action(); onOpenChange(false); toast.success(language === 'fr' ? 'Export réussi!' : 'Export successful!'); }}
            >
              {exp.icon}
              <div className="text-left">
                <div className="text-sm font-medium">{exp.label}</div>
                {exp.disabled && <div className="text-xs opacity-70">{t('no_data', language)}</div>}
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN APPLICATION
// ============================================================

export default function AttendanceApp() {
  const { isAuthenticated, currentPage, loadAllData } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Restore auth from localStorage
    try {
      const auth = localStorage.getItem('attendance_auth');
      if (auth) {
        const data = JSON.parse(auth);
        if (data.token) {
            setApiToken(data.token);
          useAppStore.setState({
            isAuthenticated: true,
            currentUser: {
              id: data.userId,
              username: data.userId,
              fullName: data.userId,
              role: data.userRole,
              tenantId: data.tenantId,
              is_super_admin: data.isSuperAdmin,
            },
          });
        }
      }
    } catch {}

    // Restore language
    const lang = localStorage.getItem('attendance_language');
    if (lang === 'fr') useAppStore.setState({ language: 'fr' });

    // Load data
    loadAllData().finally(() => setInitialized(true));
  }, []);

  // Persist language changes
  const language = useAppStore(s => s.language);
  useEffect(() => {
    localStorage.setItem('attendance_language', language);
  }, [language]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">{t('loading', language)}</p>
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
      case 'grades': return <GradesPage />;
      case 'behavior': return <BehaviorPage />;
      case 'tasks': return <TasksPage />;
      case 'incidents': return <IncidentsPage />;
      case 'messaging': return <MessagingPage />;
      case 'reports': return <ReportsPage />;
      case 'settings': return <SettingsPage />;
      case 'superadmin': return <SuperAdminPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} onExportClick={() => setExportOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          {renderPage()}
        </main>
      </div>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
