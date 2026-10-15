'use client';

import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, AlertTriangle, FileDown, MessageCircle, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import * as pdfUtils from '@/lib/pdf';

interface EscalationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EscalationsDialog({ open, onOpenChange }: EscalationsDialogProps) {
  const { students, classes, attendance, schoolInfo, language } = useAppStore();
  const isFr = language === 'fr';

  const warning1Thresh = schoolInfo?.absenceThresholds?.warning1 || 3;
  const warning2Thresh = schoolInfo?.absenceThresholds?.warning2 || 5;
  const councilThresh = schoolInfo?.absenceThresholds?.council || 8;

  // Compute unexcused absences per active student
  const escalatedStudents = useMemo(() => {
    const absencesMap = new Map<string, string[]>();
    for (const r of attendance) {
      if (r.status === 'absent') {
        const dates = absencesMap.get(r.studentId) || [];
        dates.push(r.date);
        absencesMap.set(r.studentId, dates);
      }
    }

    const list: Array<{
      student: (typeof students)[0];
      cls: (typeof classes)[0] | undefined;
      unexcusedDates: string[];
      count: number;
      level: 'warning_1' | 'warning_2' | 'discipline_council';
      examLocked: boolean;
    }> = [];

    for (const s of students) {
      if (s.status !== 'active') continue;
      const dates = absencesMap.get(s.id) || [];
      const count = dates.length;
      if (count >= warning1Thresh) {
        let level: 'warning_1' | 'warning_2' | 'discipline_council' = 'warning_1';
        let examLocked = false;
        if (count >= councilThresh) {
          level = 'discipline_council';
          examLocked = true;
        } else if (count >= warning2Thresh) {
          level = 'warning_2';
        }

        list.push({
          student: s,
          cls: classes.find(c => c.id === s.classId),
          unexcusedDates: dates.sort(),
          count,
          level,
          examLocked,
        });
      }
    }

    return list.sort((a, b) => b.count - a.count);
  }, [students, classes, attendance, warning1Thresh, warning2Thresh, councilThresh]);

  const handleDownloadLetter = (item: (typeof escalatedStudents)[0]) => {
    pdfUtils.exportAbsenceWarningLetterPDF(
      item.student,
      item.cls,
      item.unexcusedDates,
      schoolInfo,
      language,
      item.level
    );
    toast.success(
      isFr
        ? `Lettre d'avertissement générée pour ${item.student.fullName}`
        : `Warning letter generated for ${item.student.fullName}`
    );
  };

  const handleSendWhatsApp = async (item: (typeof escalatedStudents)[0]) => {
    if (!item.student.guardianPhone) {
      toast.error(isFr ? 'Numéro de tuteur non renseigné' : 'Guardian phone not set');
      return;
    }
    const cleanPhone = item.student.guardianPhone.replace(/\D/g, '');
    const formatted = cleanPhone.startsWith('0') && cleanPhone.length === 10 ? '212' + cleanPhone.substring(1) : cleanPhone;

    const levelText = item.level === 'discipline_council'
      ? (isFr ? 'CONSEIL DE DISCIPLINE' : 'DISCIPLINARY COUNCIL')
      : (item.level === 'warning_2' ? (isFr ? 'MISE EN DEMEURE (2ème Avertissement)' : 'FINAL WARNING') : (isFr ? '1er Avertissement' : '1st Warning'));

    const text = isFr
      ? `INFOHAS — ALERTE DISCIPLINAIRE [${levelText}]\nBonjour M./Mme ${item.student.guardianName || 'le tuteur'},\nNous vous informons que l'étudiant(e) ${item.student.fullName} (Classe: ${item.cls?.name || item.student.className}) a accumulé ${item.count} absences non justifiées. Veuillez prendre contact immédiatement avec la direction pédagogique.`
      : `INFOHAS — DISCIPLINARY ALERT [${levelText}]\nDear ${item.student.guardianName || 'Guardian'},\nStudent ${item.student.fullName} has accumulated ${item.count} unexcused absences. Please contact school administration immediately.`;

    // Try Baileys / Cloudflare dispatch first if configured
    if (schoolInfo?.whatsappDispatchMode === 'baileys' || schoolInfo?.whatsappDispatchMode === 'hybrid') {
      try {
        const res = await fetch('/api/whatsapp/dispatch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('api_token') || ''}`,
          },
          body: JSON.stringify({
            to: formatted,
            text,
            mode: schoolInfo.whatsappDispatchMode === 'baileys' ? 'baileys' : 'auto',
            gatewayUrl: schoolInfo.baileysGatewayUrl,
          }),
        });
        const data = await res.json();
        if (data.success && data.mode === 'baileys') {
          toast.success(isFr ? `WhatsApp envoyé via Baileys à ${item.student.guardianName || 'tuteur'}` : 'WhatsApp sent via Baileys');
          return;
        } else if (data.url) {
          window.open(data.url, '_blank');
          return;
        }
      } catch (e) {
        console.warn('Dispatch error:', e);
      }
    }

    // Fallback: wa.me desktop
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(text)}`, '_blank');
    toast.success(isFr ? 'WhatsApp ouvert' : 'WhatsApp opened');
  };

  const countTier1 = escalatedStudents.filter(s => s.level === 'warning_1').length;
  const countTier2 = escalatedStudents.filter(s => s.level === 'warning_2').length;
  const countTier3 = escalatedStudents.filter(s => s.level === 'discipline_council').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isFr ? 'Tableau d\'Escalade Disciplinaire & Alertes d\'Absence' : 'Disciplinary Escalation & Absence Alerts'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isFr
                  ? `Suivi automatisé des seuils légaux (${warning1Thresh} abs. = Avertissement 1 | ${warning2Thresh} abs. = Mise en demeure | ${councilThresh}+ abs. = Conseil de discipline)`
                  : `Automated threshold tracking (${warning1Thresh} abs. = Warning 1 | ${warning2Thresh} abs. = Formal Notice | ${councilThresh}+ abs. = Disciplinary Council)`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Executive Tier Cards */}
        <div className="grid grid-cols-3 gap-3 my-2">
          <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-center">
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{countTier1}</p>
            <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-300">
              {isFr ? 'Palier 1 : Avertissement 1' : 'Tier 1: Warning 1'}
            </p>
            <p className="text-[10px] text-muted-foreground">({warning1Thresh} à {warning2Thresh - 1} absences)</p>
          </div>
          <div className="p-3 rounded-xl border border-orange-400 bg-orange-50 dark:bg-orange-950/20 text-center">
            <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{countTier2}</p>
            <p className="text-[11px] font-semibold text-orange-900 dark:text-orange-300">
              {isFr ? 'Palier 2 : Mise en demeure' : 'Tier 2: Formal Notice'}
            </p>
            <p className="text-[10px] text-muted-foreground">({warning2Thresh} à {councilThresh - 1} absences)</p>
          </div>
          <div className="p-3 rounded-xl border border-red-500 bg-red-50 dark:bg-red-950/20 text-center">
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{countTier3}</p>
            <p className="text-[11px] font-semibold text-red-900 dark:text-red-300">
              {isFr ? 'Palier 3 : Conseil de Discipline' : 'Tier 3: Disciplinary Council'}
            </p>
            <p className="text-[10px] text-muted-foreground">({councilThresh}+ absences &bull; Examens bloqués)</p>
          </div>
        </div>

        {/* Student Escalation Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-lg">
          {escalatedStudents.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              {isFr
                ? 'Aucun étudiant n\'a dépassé le seuil d\'alerte d\'absence. Tout est en ordre !'
                : 'No students have exceeded absence alert thresholds. All clear!'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs">
                  <TableHead>{isFr ? 'Étudiant' : 'Student'}</TableHead>
                  <TableHead>{isFr ? 'Classe' : 'Class'}</TableHead>
                  <TableHead className="text-center">{isFr ? 'Absences' : 'Absences'}</TableHead>
                  <TableHead>{isFr ? 'Statut Disciplinaire' : 'Disciplinary Status'}</TableHead>
                  <TableHead className="text-right">{isFr ? 'Actions Administratives' : 'Administrative Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalatedStudents.map(item => (
                  <TableRow key={item.student.id} className="text-xs">
                    <TableCell>
                      <div className="font-semibold">{item.student.fullName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{item.student.studentId}</div>
                    </TableCell>
                    <TableCell>{item.cls?.name || item.student.className || '-'}</TableCell>
                    <TableCell className="text-center font-bold text-red-600">
                      {item.count}
                    </TableCell>
                    <TableCell>
                      {item.level === 'warning_1' && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                          {isFr ? 'Avertissement 1' : 'Warning 1'}
                        </Badge>
                      )}
                      {item.level === 'warning_2' && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-400">
                          {isFr ? 'Avertissement 2 (Mise en demeure)' : 'Warning 2 (Notice)'}
                        </Badge>
                      )}
                      {item.level === 'discipline_council' && (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-500">
                          <Lock className="h-3 w-3 mr-1" />
                          {isFr ? 'Conseil de Discipline (Bloqué)' : 'Disciplinary Council (Locked)'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => handleDownloadLetter(item)}
                          title={isFr ? 'Télécharger la lettre officielle signée' : 'Download official warning letter'}
                        >
                          <FileDown className="h-3.5 w-3.5 mr-1" />
                          {isFr ? 'Lettre PDF' : 'PDF Letter'}
                        </Button>
                        {item.student.guardianPhone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleSendWhatsApp(item)}
                            title={isFr ? 'Envoyer notification au tuteur via WhatsApp' : 'Send WhatsApp to guardian'}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {isFr ? 'Fermer' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
