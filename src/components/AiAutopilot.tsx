'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { getApiToken } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Sparkles, Zap, ShieldAlert, FileText, Send, Copy, RefreshCw, CheckCircle2,
  AlertTriangle, Users, MessageSquare, Clock, Cpu, ArrowRight, ExternalLink,
  FileDown, Download
} from 'lucide-react';
import { exportAiReportPdf, exportAiReportDocx } from '@/lib/aiExport';

interface AiModel {
  id: string;
  name: string;
  description?: string;
}

export function AiAutopilot() {
  const { students, attendance, classes, currentUser } = useAppStore();

  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'anomaly' | 'summary' | 'parent_notice' | 'custom'>('anomaly');

  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [noticeType, setNoticeType] = useState<string>('warning_1');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [latency, setLatency] = useState<number | null>(null);

  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetch available models with dynamic live prefetching
  const loadModels = async (forceFresh = false) => {
    setRefreshing(true);
    try {
      const token = getApiToken() || '';
      const url = forceFresh ? '/api/ai/models?fresh=true' : '/api/ai/models';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          setModels(data.models);
        }
        if (data.defaultModel && (!selectedModel || selectedModel === 'gemini-2.5-flash')) {
          setSelectedModel(data.defaultModel);
        }
        setHasApiKey(Boolean(data.hasApiKey));
        if (forceFresh) {
          toast.success(`Modèles Gemini actualisés en direct (${data.models?.length || 0} disponibles)`);
        }
      }
    } catch (e) {
      console.warn('Could not load AI models:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  // Compute live statistics for context
  const attendanceStats = useMemo(() => {
    const studentAbsenceCounts: Record<string, number> = {};
    const unexcusedCounts: Record<string, number> = {};

    attendance.forEach(a => {
      if (a.status === 'absent') {
        studentAbsenceCounts[a.studentId] = (studentAbsenceCounts[a.studentId] || 0) + 1;
        if (!a.justificationId) {
          unexcusedCounts[a.studentId] = (unexcusedCounts[a.studentId] || 0) + 1;
        }
      }
    });

    const atRiskStudents = students
      .map(s => {
        const abs = studentAbsenceCounts[s.id] || 0;
        const unexcused = unexcusedCounts[s.id] || 0;
        let riskLevel: 'low' | 'warning_1' | 'warning_2' | 'council' = 'low';
        if (abs >= 8) riskLevel = 'council';
        else if (abs >= 5) riskLevel = 'warning_2';
        else if (abs >= 3) riskLevel = 'warning_1';

        return {
          id: s.id,
          name: s.fullName,
          studentId: s.studentId,
          className: s.className || s.group || 'Inconnue',
          absences: abs,
          unexcused,
          phone: s.phone,
          guardianPhone: s.guardianPhone,
          riskLevel,
        };
      })
      .filter(s => s.absences >= 3)
      .sort((a, b) => b.absences - a.absences);

    return {
      totalStudents: students.length,
      totalClasses: classes.length,
      totalRecords: attendance.length,
      atRiskCount: atRiskStudents.length,
      atRiskStudents,
    };
  }, [students, attendance, classes]);

  // Execute AI generation
  const handleGenerate = async (task: 'attendance_anomaly' | 'absence_summary' | 'parent_notice' | 'custom') => {
    setLoading(true);
    setResultText('');
    setLatency(null);

    const token = getApiToken() || '';

    let contextData: any = {};
    let promptOverride = '';

    if (task === 'attendance_anomaly') {
      contextData = {
        totalStudents: attendanceStats.totalStudents,
        criticalCases: attendanceStats.atRiskStudents.slice(0, 15),
      };
    } else if (task === 'absence_summary') {
      contextData = {
        totalStudents: attendanceStats.totalStudents,
        classes: classes.map(c => c.name),
        atRiskSummary: {
          councilLevel: attendanceStats.atRiskStudents.filter(s => s.absences >= 8).length,
          warning2Level: attendanceStats.atRiskStudents.filter(s => s.absences >= 5 && s.absences < 8).length,
          warning1Level: attendanceStats.atRiskStudents.filter(s => s.absences >= 3 && s.absences < 5).length,
        },
      };
    } else if (task === 'parent_notice') {
      const student = students.find(s => s.id === selectedStudentId);
      if (!student) {
        toast.error('Veuillez sélectionner un étudiant.');
        setLoading(false);
        return;
      }
      const absCount = attendance.filter(a => a.studentId === student.id && a.status === 'absent').length;
      contextData = {
        studentName: student.fullName,
        studentMatricule: student.studentId,
        className: student.className || student.group,
        guardianName: student.guardianName || 'Parent / Tuteur légal',
        guardianPhone: student.guardianPhone || student.phone,
        totalAbsences: absCount,
        noticeLevel: noticeType,
      };
      promptOverride = `Rédige un message percutant pour ${noticeType === 'council' ? 'Convocation immédiate au Conseil de Discipline' : noticeType === 'warning_2' ? 'Second avertissement officiel' : 'Premier avertissement d\'assiduité'}.`;
    } else if (task === 'custom') {
      if (!customPrompt.trim()) {
        toast.error('Veuillez formuler votre demande.');
        setLoading(false);
        return;
      }
      promptOverride = customPrompt;
      contextData = {
        school: 'INFOHAS INSTITUT',
        totalStudents: students.length,
      };
    }

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          task,
          model: selectedModel,
          prompt: promptOverride,
          contextData,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur du serveur IA');
      }

      setResultText(data.result);
      if (data.durationMs) setLatency(data.durationMs);
      toast.success('Rapport IA généré avec succès.');
    } catch (err: any) {
      console.error('Erreur génération IA:', err);
      toast.error(`Échec: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Copy result to clipboard
  const handleCopy = () => {
    if (!resultText) return;
    navigator.clipboard.writeText(resultText);
    toast.success('Texte copié dans le presse-papiers.');
  };

  const getReportTitle = (section?: string) => {
    const target = section || activeTab;
    switch (target) {
      case 'anomaly': return "Rapport d'Anomalies & Risques d'Assiduité — INFOHAS";
      case 'summary': return "Synthèse Pédagogique Hebdomadaire d'Assiduité — INFOHAS";
      case 'parent_notice': {
        const st = students.find(s => s.id === selectedStudentId);
        return `Notification Parentale — ${st?.fullName || 'Étudiant'} — INFOHAS`;
      }
      case 'custom': return "Rapport d'Analyse Autopilot Personnalisé — INFOHAS";
      default: return "Rapport Gemini AI Autopilot — INFOHAS";
    }
  };

  const getExportableContent = (section?: string) => {
    const target = section || activeTab;
    if (resultText && resultText.trim() && (!section || section === activeTab)) {
      return resultText;
    }

    if (target === 'anomaly') {
      const rows = attendanceStats.atRiskStudents.slice(0, 20).map((s, idx) =>
        `${idx + 1}. ${s.name} (${s.className}) — ${s.absences} absences (${s.unexcused} non justifiées) — Risque: ${s.riskLevel.toUpperCase()}`
      ).join('\n');
      return `# RELEVÉ DES ANOMALIES & ÉTUDIANTS À RISQUE DE DÉCROCHAGE\n\nInstitut Supérieur INFOHAS • Direction Pédagogique\nDate : ${new Date().toLocaleDateString('fr-FR')}\nEffectif Total : ${attendanceStats.totalStudents} étudiants\nÉtudiants identifiés à risque : ${attendanceStats.atRiskCount}\n\n## Liste des dossiers prioritaires :\n${rows || 'Aucun étudiant en situation critique.'}\n\n## Recommandations de l'Autopilot :\n- Convoquer en urgence les tuteurs des élèves dépassant 8 absences.\n- Émettre un 2e avertissement formel pour les élèves entre 5 et 7 absences.\n- Notifier par WhatsApp les absences non justifiées du jour.`;
    }

    if (target === 'summary') {
      return `# SYNTHÈSE HEBDOMADAIRE D'ASSIDUITÉ DES PROMOTIONS\n\nInstitut Supérieur INFOHAS • Direction Pédagogique\nDate : ${new Date().toLocaleDateString('fr-FR')}\nEffectif Global : ${attendanceStats.totalStudents} étudiants sur ${attendanceStats.totalClasses} classes.\nTotal Séances Enregistrées : ${attendanceStats.totalRecords}\n\n## Répartition des seuils d'alerte :\n- Niveau Convocation Conseil de Discipline (8+ abs) : ${attendanceStats.atRiskStudents.filter(s => s.absences >= 8).length} stagiaires\n- Niveau Second Avertissement (5-7 abs) : ${attendanceStats.atRiskStudents.filter(s => s.absences >= 5 && s.absences < 8).length} stagiaires\n- Niveau Premier Avertissement (3-4 abs) : ${attendanceStats.atRiskStudents.filter(s => s.absences >= 3 && s.absences < 5).length} stagiaires\n\n## Constats & Directives :\n- Assiduité satisfaisante sur la majorité des filières techniques.\n- Renforcer le pointage biométrique et le suivi des feuilles d'émargement quotidiennes.`;
    }

    if (target === 'parent_notice') {
      const st = students.find(s => s.id === selectedStudentId);
      const absCount = attendance.filter(a => a.studentId === st?.id && a.status === 'absent').length;
      return `# NOTIFICATION D'ASSIDUITÉ — DIRECTION INFOHAS\n\nDestinataire : ${st?.guardianName || 'Parent / Tuteur légal'}\nÉtudiant(e) : ${st?.fullName || 'N/A'}\nMatricule : ${st?.studentId || 'N/A'}\nClasse : ${st?.className || 'N/A'}\nCumul d'absences : ${absCount} séances non justifiées\n\nMadame, Monsieur,\nNous portons à votre attention que l'assiduité de votre enfant requiert votre vigilance immédiate.\nConformément au règlement intérieur de l'Institut INFOHAS, un entretien ou le dépôt d'un justificatif officiel est obligatoire sous 48 heures.\n\nDirection Pédagogique — INFOHAS`;
    }

    return `# RAPPORT LIBRE GEMINI AI AUTOPILOT\n\nDemande : ${customPrompt || 'Analyse administrative libre'}\nDate d'émission : ${new Date().toLocaleDateString('fr-FR')}\nÉtablissement : Institut Supérieur INFOHAS`;
  };

  const handleDownloadPdf = (section?: string) => {
    try {
      const title = getReportTitle(section);
      const content = getExportableContent(section);
      exportAiReportPdf(title, content, {
        model: selectedModel,
        category: section || activeTab,
        date: new Date().toLocaleDateString('fr-FR'),
      });
      toast.success('Rapport PDF téléchargé avec succès.');
    } catch (e: any) {
      toast.error('Erreur lors du téléchargement PDF: ' + e.message);
    }
  };

  const handleDownloadDocx = async (section?: string) => {
    try {
      const title = getReportTitle(section);
      const content = getExportableContent(section);
      await exportAiReportDocx(title, content, {
        model: selectedModel,
        category: section || activeTab,
        date: new Date().toLocaleDateString('fr-FR'),
      });
      toast.success('Rapport DOCX téléchargé avec succès.');
    } catch (e: any) {
      toast.error('Erreur lors du téléchargement DOCX: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Autopilot Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-emerald-900/10 p-6 rounded-xl border border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
              <Sparkles className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Gemini AI Autopilot — Direction Pédagogique</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Copilote administratif sécurisé : analyse d’assiduité, détection des risques de décrochage et rédaction assistée avec validation humaine obligatoire.
          </p>
        </div>

        {/* Model selector & Status */}
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-1">
              <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Modèle Gemini</span>
              {models.length > 0 && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{models.length} modèles live</span>}
            </div>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-8 text-xs w-56 bg-card">
                <SelectValue placeholder="Sélectionner un modèle" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {models.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="font-medium">{m.name}</span>
                    {m.description && <span className="text-[10px] text-muted-foreground block truncate max-w-xs">{m.description}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadModels(true)}
            disabled={refreshing}
            className="h-8 gap-1 mt-4"
            title="Actualiser les modèles Gemini en direct"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {!hasApiKey && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center justify-between text-amber-900 dark:text-amber-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>
              La clé API Gemini n'est pas encore enregistrée. Veuillez configurer votre clé dans <strong>Paramètres → Paramètres IA</strong> pour activer l'analyse automatique.
            </span>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Task Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600" />
                Actions d'Assistance Autopilot
              </CardTitle>
              <CardDescription>
                Sélectionnez le mode de traitement administratif souhaité
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
                <TabsList className="grid grid-cols-4 w-full h-9">
                  <TabsTrigger value="anomaly" className="text-[11px]">Anomalies</TabsTrigger>
                  <TabsTrigger value="summary" className="text-[11px]">Synthèse</TabsTrigger>
                  <TabsTrigger value="parent_notice" className="text-[11px]">Parents</TabsTrigger>
                  <TabsTrigger value="custom" className="text-[11px]">Libre</TabsTrigger>
                </TabsList>

                {/* Tab 1: Anomalies */}
                <TabsContent value="anomaly" className="space-y-3 pt-3">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4" />
                      {attendanceStats.atRiskCount} cas critiques détectés
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Stagiaires ayant franchi les seuils de 3, 5 ou 8 absences nécessitant une intervention disciplinaire.
                    </p>
                  </div>

                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {attendanceStats.atRiskStudents.slice(0, 8).map(s => (
                      <div key={s.id} className="text-xs p-2 rounded border border-border flex items-center justify-between">
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground">{s.className}</div>
                        </div>
                        <Badge
                          variant={s.riskLevel === 'council' ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {s.absences} abs. {s.riskLevel === 'council' ? '(Conseil)' : ''}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleGenerate('attendance_anomaly')}
                    disabled={loading}
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
                  >
                    <Sparkles className="h-4 w-4" />
                    {loading ? 'Analyse en cours...' : 'Lancer l’Audit des Anomalies'}
                  </Button>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPdf('anomaly')}
                      className="flex-1 text-[11px] h-7 gap-1 text-red-600 dark:text-red-400"
                      title="Télécharger l'audit des anomalies en PDF"
                    >
                      <FileText className="h-3 w-3" />
                      Export Anomalies PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocx('anomaly')}
                      className="flex-1 text-[11px] h-7 gap-1 text-blue-600 dark:text-blue-400"
                      title="Télécharger l'audit des anomalies en DOCX"
                    >
                      <FileDown className="h-3 w-3" />
                      Export DOCX
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 2: Summary */}
                <TabsContent value="summary" className="space-y-3 pt-3">
                  <div className="text-xs text-muted-foreground">
                    Génère une synthèse de direction sur l’assiduité générale des promotions, identifiant les cohortes les plus engagées et les modules fragiles.
                  </div>

                  <div className="p-3 rounded-lg bg-muted text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Effectif total :</span>
                      <span className="font-semibold">{attendanceStats.totalStudents} stagiaires</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Classes actives :</span>
                      <span className="font-semibold">{attendanceStats.totalClasses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Enregistrements :</span>
                      <span className="font-semibold">{attendanceStats.totalRecords} séances</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleGenerate('absence_summary')}
                    disabled={loading}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
                  >
                    <FileText className="h-4 w-4" />
                    {loading ? 'Rédaction du rapport...' : 'Générer la Synthèse Hebdomadaire'}
                  </Button>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPdf('summary')}
                      className="flex-1 text-[11px] h-7 gap-1 text-red-600 dark:text-red-400"
                      title="Télécharger la synthèse en PDF"
                    >
                      <FileText className="h-3 w-3" />
                      Export Synthèse PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocx('summary')}
                      className="flex-1 text-[11px] h-7 gap-1 text-blue-600 dark:text-blue-400"
                      title="Télécharger la synthèse en DOCX"
                    >
                      <FileDown className="h-3 w-3" />
                      Export DOCX
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 3: Parent Notice */}
                <TabsContent value="parent_notice" className="space-y-3 pt-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Sélectionner l'étudiant concerné</Label>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Choisir un étudiant..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {students.map(s => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.fullName} ({s.className || 'Sans classe'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Niveau de notification</Label>
                    <Select value={noticeType} onValueChange={setNoticeType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warning_1" className="text-xs">
                          Avertissement 1 (Seuil 3 absences)
                        </SelectItem>
                        <SelectItem value="warning_2" className="text-xs">
                          Avertissement 2 (Seuil 5 absences)
                        </SelectItem>
                        <SelectItem value="council" className="text-xs">
                          Convocation Conseil de Discipline (8+ absences)
                        </SelectItem>
                        <SelectItem value="justification_request" className="text-xs">
                          Demande de justificatif d'absence
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() => handleGenerate('parent_notice')}
                    disabled={loading || !selectedStudentId}
                    className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {loading ? 'Rédaction personnalisée...' : 'Rédiger la Notification Parentale'}
                  </Button>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPdf('parent_notice')}
                      disabled={!selectedStudentId}
                      className="flex-1 text-[11px] h-7 gap-1 text-red-600 dark:text-red-400"
                      title="Télécharger la notification parentale en PDF"
                    >
                      <FileText className="h-3 w-3" />
                      Notice PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocx('parent_notice')}
                      disabled={!selectedStudentId}
                      className="flex-1 text-[11px] h-7 gap-1 text-blue-600 dark:text-blue-400"
                      title="Télécharger la notification parentale en DOCX"
                    >
                      <FileDown className="h-3 w-3" />
                      Notice DOCX
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 4: Custom */}
                <TabsContent value="custom" className="space-y-3 pt-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Instruction pour l'Autopilot</Label>
                    <Textarea
                      placeholder="Ex: Rédige un rappel courtois pour les enseignants concernant la saisie des feuilles d'émargement avant 18h..."
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      className="text-xs min-h-[100px]"
                    />
                  </div>

                  <Button
                    onClick={() => handleGenerate('custom')}
                    disabled={loading || !customPrompt.trim()}
                    className="w-full gap-2 bg-zinc-800 hover:bg-zinc-900 text-white text-xs h-9 dark:bg-zinc-200 dark:text-zinc-900"
                  >
                    <Send className="h-4 w-4" />
                    {loading ? 'Traitement en cours...' : 'Exécuter la Demande'}
                  </Button>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPdf('custom')}
                      className="flex-1 text-[11px] h-7 gap-1 text-red-600 dark:text-red-400"
                      title="Télécharger le rapport libre en PDF"
                    >
                      <FileText className="h-3 w-3" />
                      Export Libre PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadDocx('custom')}
                      className="flex-1 text-[11px] h-7 gap-1 text-blue-600 dark:text-blue-400"
                      title="Télécharger le rapport libre en DOCX"
                    >
                      <FileDown className="h-3 w-3" />
                      Export DOCX
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: AI Output & Validation (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border min-h-[500px] flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  Rapport & Recommandations Proposées
                </CardTitle>
                <CardDescription className="text-xs">
                  Validation humaine requise avant toute communication officielle
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {latency && (
                  <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {latency} ms
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadPdf()}
                  className="h-8 gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  title="Télécharger au format PDF"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline font-medium">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadDocx()}
                  className="h-8 gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  title="Télécharger au format Word DOCX"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline font-medium">DOCX</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-6">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center py-20 space-y-4 text-muted-foreground">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-blue-600/20 border-t-blue-600 animate-spin" />
                    <Sparkles className="h-5 w-5 text-blue-600 absolute inset-0 m-auto" />
                  </div>
                  <p className="text-sm font-medium">L'IA analyse les données de l'INFOHAS...</p>
                  <p className="text-xs text-muted-foreground max-w-sm text-center">
                    Génération du document conforme au règlement intérieur et aux seuils d'assiduité.
                  </p>
                </div>
              ) : resultText ? (
                <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed whitespace-pre-wrap font-sans bg-muted/40 p-4 rounded-lg border border-border">
                  {resultText}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-24 text-muted-foreground space-y-2">
                  <Sparkles className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium">Aucun résultat à afficher</p>
                  <p className="text-xs text-muted-foreground max-w-sm text-center">
                    Sélectionnez une action dans le panneau de gauche pour générer un audit, une synthèse ou une notification.
                  </p>
                </div>
              )}
            </CardContent>

            {resultText && (
              <CardFooter className="border-t border-border pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  INFOHAS Autopilot • Réponse générée par {selectedModel}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPdf()}
                    className="gap-1.5 text-xs h-8 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Télécharger PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadDocx()}
                    className="gap-1.5 text-xs h-8 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Télécharger DOCX
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier le texte
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
