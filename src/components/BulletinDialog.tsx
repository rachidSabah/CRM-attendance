'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Award, FileDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import * as pdfUtils from '@/lib/pdf';

interface BulletinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStudentId?: string;
  initialClassId?: string;
}

export function BulletinDialog({ open, onOpenChange, initialStudentId, initialClassId }: BulletinDialogProps) {
  const { students, classes, modules, grades, attendance, schoolInfo, language } = useAppStore();
  const isFr = language === 'fr';

  const defaultStudentId = useMemo(() => {
    if (initialStudentId) return initialStudentId;
    if (initialClassId) {
      const match = students.find(s => s.classId === initialClassId);
      if (match) return match.id;
    }
    return students[0]?.id || '';
  }, [initialStudentId, initialClassId, students]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(defaultStudentId);
  const [selectedSemester, setSelectedSemester] = useState('Semestre 1');

  const student = students.find(s => s.id === selectedStudentId);
  const studentClass = student ? classes.find(c => c.id === student.classId) : undefined;

  // Calculate live preview metrics
  const previewData = useMemo(() => {
    if (!student) return null;

    let totalWeightedScore = 0;
    let totalCoefficients = 0;

    for (const m of modules) {
      const studentGrades = grades.filter(g => g.studentId === student.id && g.moduleId === m.id);
      const coef = Number(m.coef) > 0 ? Number(m.coef) : 1;

      let avgGrade = 0;
      if (studentGrades.length > 0) {
        const validScores = studentGrades
          .map(g => Number(g.percentage != null ? g.percentage / 5 : (parseFloat(String(g.grade)) || 0)))
          .filter(n => !isNaN(n));
        if (validScores.length > 0) {
          avgGrade = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        }
      }

      const noteSur20 = Math.min(20, Math.max(0, avgGrade));
      const points = noteSur20 * coef;

      totalWeightedScore += points;
      totalCoefficients += coef;
    }

    const generalAverage = totalCoefficients > 0 ? totalWeightedScore / totalCoefficients : 0;
    const isPassed = generalAverage >= 10;

    let mention = isFr ? 'Non Noté' : 'Not Graded';
    if (totalWeightedScore > 0) {
      if (generalAverage >= 16) mention = isFr ? 'Très Bien' : 'High Honors';
      else if (generalAverage >= 14) mention = isFr ? 'Bien' : 'Honors';
      else if (generalAverage >= 12) mention = isFr ? 'Assez Bien' : 'Satisfactory';
      else if (generalAverage >= 10) mention = isFr ? 'Passable' : 'Pass';
      else mention = isFr ? 'Ajourné(e)' : 'Fail';
    }

    const studentAtt = attendance.filter(r => r.studentId === student.id);
    const absCount = studentAtt.filter(r => r.status === 'absent').length;

    return {
      generalAverage,
      totalWeightedScore,
      totalCoefficients,
      isPassed,
      mention,
      absCount,
    };
  }, [student, modules, grades, attendance, isFr]);

  const handleDownloadSingle = () => {
    if (!student) return;
    pdfUtils.exportBulletinSemestrielPDF(
      student,
      studentClass,
      modules,
      grades,
      attendance,
      schoolInfo,
      language,
      { semester: selectedSemester, academicYear: student.academicYear }
    );
    toast.success(
      isFr
        ? `Bulletin semestriel généré pour ${student.fullName}`
        : `Semester report card generated for ${student.fullName}`
    );
  };

  const handleDownloadClassBatch = () => {
    if (!studentClass) return;
    const classStudents = students.filter(s => s.classId === studentClass.id && s.status === 'active');
    if (classStudents.length === 0) {
      toast.error(isFr ? 'Aucun étudiant actif dans cette classe' : 'No active students in this class');
      return;
    }

    classStudents.forEach((st, idx) => {
      setTimeout(() => {
        pdfUtils.exportBulletinSemestrielPDF(
          st,
          studentClass,
          modules,
          grades,
          attendance,
          schoolInfo,
          language,
          { semester: selectedSemester, academicYear: st.academicYear }
        );
      }, idx * 600);
    });

    toast.success(
      isFr
        ? `Génération de ${classStudents.length} bulletins pour la classe ${studentClass.name}`
        : `Generating ${classStudents.length} report cards for class ${studentClass.name}`
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[96vw] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isFr ? 'Générateur de Bulletin Semestriel' : 'Semester Report Card Generator'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isFr
                  ? 'Calcul pondéré des coefficients, mentions, rang et relevé officiel PDF'
                  : 'Weighted coefficient calculations, honors, ranking, and official PDF transcript'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Configuration Controls */}
        <div className="grid grid-cols-2 gap-3 my-2 text-xs">
          <div className="space-y-1">
            <Label>{isFr ? 'Sélectionner l\'Étudiant' : 'Select Student'}</Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName} ({s.studentId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>{isFr ? 'Période / Semestre' : 'Period / Semester'}</Label>
            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semestre 1">{isFr ? 'Semestre 1' : 'Semester 1'}</SelectItem>
                <SelectItem value="Semestre 2">{isFr ? 'Semestre 2' : 'Semester 2'}</SelectItem>
                <SelectItem value="Bilan Annuel">{isFr ? 'Bilan Annuel' : 'Annual Recap'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Live Preview Card */}
        {student && previewData && (
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{student.fullName}</h4>
                <p className="text-xs text-muted-foreground">
                  ID: <span className="font-mono">{student.studentId}</span> &bull; {studentClass?.name || student.className || 'Classe'}
                </p>
              </div>
              <Badge variant="outline" className={previewData.isPassed ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-red-100 text-red-800 border-red-300'}>
                {previewData.isPassed ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" />{isFr ? 'Admis(e)' : 'Passed'}</>
                ) : (
                  <><AlertCircle className="h-3 w-3 mr-1" />{isFr ? 'Ajourné(e)' : 'Failed'}</>
                )}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border">
                <p className="text-[10px] text-muted-foreground uppercase">{isFr ? 'Moyenne' : 'Average'}</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {previewData.generalAverage.toFixed(2)} / 20
                </p>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border">
                <p className="text-[10px] text-muted-foreground uppercase">{isFr ? 'Mention' : 'Honors'}</p>
                <p className="text-xs font-semibold mt-1 text-slate-800 dark:text-slate-200">
                  {previewData.mention}
                </p>
              </div>
              <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border">
                <p className="text-[10px] text-muted-foreground uppercase">{isFr ? 'Absences' : 'Absences'}</p>
                <p className="text-sm font-bold mt-0.5 text-red-600">
                  {previewData.absCount} {isFr ? 'non justifiées' : 'unexcused'}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground flex justify-between pt-1">
              <span>{isFr ? 'Total Coef.' : 'Total Coef.'}: {previewData.totalCoefficients}</span>
              <span>{isFr ? 'Points Pondérés' : 'Weighted Points'}: {previewData.totalWeightedScore.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleDownloadSingle}>
            <FileDown className="h-4 w-4 mr-2" />
            {isFr ? 'Télécharger le Bulletin Officiel (PDF)' : 'Download Official Report Card (PDF)'}
          </Button>

          {studentClass && (
            <Button variant="outline" className="w-full text-xs" onClick={handleDownloadClassBatch}>
              {isFr
                ? `Télécharger tous les bulletins de la classe (${studentClass.name})`
                : `Download all report cards for class (${studentClass.name})`}
            </Button>
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
