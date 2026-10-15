'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Smartphone, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight,
  LogOut, Calendar, Clock, FileUp, Sparkles, User, RefreshCw, ChevronRight, X
} from 'lucide-react';

interface ParentStudent {
  id: string;
  fullName: string;
  studentId: string;
  className: string;
  group?: string;
  status: string;
}

interface ParentAttendance {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  justificationId?: string;
}

interface ParentJustification {
  id: string;
  studentId: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface AttendanceSummary {
  totalSessions: number;
  presentCount: number;
  absentExcusedCount: number;
  absentUnexcusedCount: number;
  lateCount: number;
  rate: number;
}

export function ParentPortal() {
  const [step, setStep] = useState<'phone' | 'otp' | 'dashboard'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string>('');
  const [testOtp, setTestOtp] = useState<string | null>(null);

  // Dashboard state
  const [students, setStudents] = useState<ParentStudent[]>([]);
  const [attendance, setAttendance] = useState<ParentAttendance[]>([]);
  const [justifications, setJustifications] = useState<ParentJustification[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Justification submission modal
  const [justModalOpen, setJustModalOpen] = useState(false);
  const [justDate, setJustDate] = useState('');
  const [justReason, setJustReason] = useState('');
  const [justFileBase64, setJustFileBase64] = useState<string>('');
  const [submittingJust, setSubmittingJust] = useState(false);

  // Check saved session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('parent_session_token');
    if (savedToken) {
      setToken(savedToken);
      fetchParentData(savedToken);
    }
  }, []);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone.trim()) {
      toast.error('Veuillez saisir votre numéro de téléphone.');
      return;
    }

    setLoading(true);
    setTestOtp(null);

    try {
      const res = await fetch('/api/parent/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la demande du code');
      }

      toast.success('Code de sécurité envoyé !');
      if (data.testOtp) {
        setTestOtp(data.testOtp);
      }
      setStep('otp');
    } catch (err: any) {
      toast.error(err.message || 'Échec de la demande');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp.trim()) {
      toast.error('Veuillez saisir le code reçu.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/parent/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Code de sécurité incorrect');
      }

      setToken(data.token);
      localStorage.setItem('parent_session_token', data.token);
      toast.success('Connexion réussie !');
      await fetchParentData(data.token);
    } catch (err: any) {
      toast.error(err.message || 'Échec de validation');
    } finally {
      setLoading(false);
    }
  };

  const fetchParentData = async (sessionToken: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/parent/attendance', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (!res.ok) {
        // Session invalid
        localStorage.removeItem('parent_session_token');
        setStep('phone');
        return;
      }

      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
        setAttendance(data.attendance || []);
        setJustifications(data.justifications || []);
        setSummary(data.summary || null);

        if (data.students && data.students.length > 0) {
          setSelectedStudentId(data.students[0].id);
        }
        setStep('dashboard');
      }
    } catch (err) {
      console.warn('Failed to load parent data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('parent_session_token');
    setToken('');
    setStep('phone');
    setPhone('');
    setOtp('');
    setStudents([]);
    setAttendance([]);
    toast.info('Session parent fermée.');
  };

  // Submit excuse justification
  const handleSubmitJustification = async () => {
    if (!justDate || !justReason.trim()) {
      toast.error('Veuillez indiquer la date et le motif de l’absence.');
      return;
    }

    const currentStudent = students.find(s => s.id === selectedStudentId);
    if (!currentStudent) return;

    setSubmittingJust(true);
    try {
      const res = await fetch('/api/justifications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentStudent.id,
          studentName: currentStudent.fullName,
          className: currentStudent.className,
          date: justDate,
          reason: justReason,
          attachment: justFileBase64 || '',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors du dépôt du justificatif');
      }

      toast.success('Justificatif transmis avec succès à l’administration.');
      setJustModalOpen(false);
      setJustReason('');
      setJustDate('');
      setJustFileBase64('');
      // Refresh data
      if (token) fetchParentData(token);
    } catch (err: any) {
      toast.error(err.message || 'Échec de transmission');
    } finally {
      setSubmittingJust(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Le fichier ne doit pas dépasser 3 Mo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setJustFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0];
  const studentAttendance = attendance.filter(a => a.studentId === activeStudent?.id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Brand Banner */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
            <img src="/infohas-logo.png" alt="INFOHAS" className="h-9 w-auto object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Espace Parents — Suivi d'Assiduité</h2>
            <p className="text-xs text-muted-foreground">
              Institut Supérieur INFOHAS • Consultation en temps réel des présences et justificatifs d'absence
            </p>
          </div>
        </div>

        {step === 'dashboard' && (
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 text-red-600 dark:text-red-400">
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        )}
      </div>

      {/* Step 1: Phone Input */}
      {step === 'phone' && (
        <Card className="max-w-md mx-auto border-border shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-2">
              <Smartphone className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Accès Sécurisé WhatsApp</CardTitle>
            <CardDescription className="text-xs">
              Saisissez le numéro de téléphone du tuteur enregistré auprès de l'INFOHAS pour recevoir un code d'authentification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Numéro de Téléphone (WhatsApp)</Label>
                <Input
                  type="tel"
                  placeholder="Ex: 0661234567 ou +212661234567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="h-10 text-sm font-medium"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Format marocain 06/07 ou international (+212).
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || !phone.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 h-10 shadow-sm"
              >
                {loading ? 'Recherche du dossier...' : 'Recevoir mon code par WhatsApp'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: OTP Verification */}
      {step === 'otp' && (
        <Card className="max-w-md mx-auto border-border shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mb-2">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Vérification de Sécurité</CardTitle>
            <CardDescription className="text-xs">
              Entrez le code à 6 chiffres envoyé au <strong className="text-foreground">{phone}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {testOtp && (
              <div
                onClick={() => setOtp(testOtp)}
                className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between cursor-pointer hover:bg-emerald-100 transition-colors"
              >
                <span>Code de confirmation reçu : <strong>{testOtp}</strong></span>
                <Badge variant="secondary" className="text-[10px]">Cliquer pour insérer</Badge>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Code de sécurité (6 chiffres)</Label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="h-11 text-center font-mono text-xl tracking-widest font-bold"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('phone')}
                  className="w-1/3 text-xs h-10"
                >
                  Retour
                </Button>
                <Button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-10 gap-2 shadow-sm"
                >
                  {loading ? 'Vérification...' : 'Valider le code'}
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Parent Dashboard */}
      {step === 'dashboard' && activeStudent && (
        <div className="space-y-6">
          {/* Child Selector Tabs (if multiple children) */}
          {students.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {students.map(s => (
                <Button
                  key={s.id}
                  variant={s.id === selectedStudentId ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedStudentId(s.id)}
                  className="gap-2 shrink-0"
                >
                  <User className="h-3.5 w-3.5" />
                  {s.fullName} ({s.className})
                </Button>
              ))}
            </div>
          )}

          {/* Child Profile & Quick Summary Card */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-lg border-2 border-emerald-500/20">
                {activeStudent.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold">{activeStudent.fullName}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Badge variant="outline">Classe : {activeStudent.className}</Badge>
                  <span>•</span>
                  <span>Matricule : {activeStudent.studentId || 'N/A'}</span>
                  <span>•</span>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Statut : Actif
                  </Badge>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                setJustDate(new Date().toISOString().split('T')[0]);
                setJustModalOpen(true);
              }}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <FileUp className="h-4 w-4" />
              Justifier une absence
            </Button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Taux d'assiduité</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {summary ? `${summary.rate}%` : '100%'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Assiduité globale</div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Présences</div>
                <div className="text-2xl font-black text-blue-600 mt-1">
                  {summary?.presentCount || 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Séances validées</div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Absences Non Justifiées</div>
                <div className={`text-2xl font-black mt-1 ${(summary?.absentUnexcusedCount || 0) >= 3 ? 'text-red-600' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {summary?.absentUnexcusedCount || 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {(summary?.absentUnexcusedCount || 0) >= 3 ? 'Avertissement requis' : 'Tolérance normale'}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Justifiées / Retards</div>
                <div className="text-2xl font-black text-amber-600 mt-1">
                  {summary?.absentExcusedCount || 0} <span className="text-xs text-muted-foreground font-normal">/ {summary?.lateCount || 0} ret.</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Certificats validés</div>
              </CardContent>
            </Card>
          </div>

          {/* Absence History Table */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Historique chronologique des séances & absences
              </CardTitle>
              <CardDescription className="text-xs">
                Registre officiel d'émargement de la promotion
              </CardDescription>
            </CardHeader>
            <CardContent>
              {studentAttendance.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  Aucune absence enregistrée pour ce dossier. L'élève est à jour.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                  {studentAttendance.map(item => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold flex items-center gap-2">
                          <span>{item.date}</span>
                          {item.notes && <span className="text-muted-foreground font-normal text-[11px]">• {item.notes}</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.status === 'present' ? 'Présent en cours' : item.status === 'late' ? 'Arrivée en retard' : item.status === 'excused' ? 'Absence justifiée par l’administration' : 'Absence non justifiée'}
                        </div>
                      </div>

                      <div>
                        {item.status === 'present' ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Présent
                          </Badge>
                        ) : item.status === 'late' ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Retard
                          </Badge>
                        ) : item.status === 'excused' || item.justificationId ? (
                          <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                            Justifiée
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            Non Justifiée
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Justification Dialog */}
      <Dialog open={justModalOpen} onOpenChange={setJustModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileUp className="h-5 w-5 text-emerald-600" />
              Déposer un justificatif d'absence
            </DialogTitle>
            <DialogDescription className="text-xs">
              Transmettez un certificat médical ou un motif d'absence directement à la direction de l'INFOHAS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Date de l'absence</Label>
              <Input
                type="date"
                value={justDate}
                onChange={e => setJustDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Motif de l'absence</Label>
              <Textarea
                placeholder="Ex: Maladie avec certificat médical du Dr..., Urgence familiale..."
                value={justReason}
                onChange={e => setJustReason(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Pièce jointe (Certificat médical / Document photo)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="text-xs file:text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Formats acceptés : JPG, PNG, PDF (max 3 Mo).</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJustModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmitJustification}
              disabled={submittingJust || !justReason.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submittingJust ? 'Envoi...' : 'Transmettre à l’administration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
