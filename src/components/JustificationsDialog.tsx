'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck, CheckCircle2, XCircle, Clock, Plus, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';
import type { ExcuseJustification } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { AiTextAssist } from '@/components/AiTextAssist';

interface JustificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JustificationsDialog({ open, onOpenChange }: JustificationsDialogProps) {
  const { justifications, students, classes, reviewJustification, addJustification, language } = useAppStore();
  const isFr = language === 'fr';

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // New justification form state
  const [formStudentId, setFormStudentId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReason, setFormReason] = useState(isFr ? 'Certificat Médical' : 'Medical Certificate');
  const [formNotes, setFormNotes] = useState('');
  const [formAttachment, setFormAttachment] = useState('');

  const filtered = (justifications || []).filter(j => {
    const matchesStatus = filterStatus === 'all' || j.status === filterStatus;
    const sName = j.studentName || students.find(s => s.id === j.studentId)?.fullName || '';
    const sid = students.find(s => s.id === j.studentId)?.studentId || '';
    const matchesSearch = sName.toLowerCase().includes(search.toLowerCase()) ||
      sid.toLowerCase().includes(search.toLowerCase()) ||
      (j.reason || '').toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    const ok = await reviewJustification(id, status);
    if (ok) {
      toast.success(
        status === 'approved'
          ? (isFr ? 'Justification validée et statut de présence mis à jour en "Excusé"' : 'Excuse approved and attendance marked as excused')
          : (isFr ? 'Justification rejetée' : 'Excuse rejected')
      );
    }
  };

  const handleCreate = () => {
    if (!formStudentId) {
      toast.error(isFr ? 'Veuillez sélectionner un étudiant' : 'Please select a student');
      return;
    }
    const targetStudent = students.find(s => s.id === formStudentId);
    const targetClass = targetStudent ? classes.find(c => c.id === targetStudent.classId) : undefined;
    const nowIso = new Date().toISOString();

    const newJust: ExcuseJustification = {
      id: `just_${formStudentId}_${formDate}_${Date.now().toString(36)}`,
      studentId: formStudentId,
      studentName: targetStudent?.fullName || '',
      className: targetClass?.name || targetStudent?.className || '',
      date: formDate,
      reason: formNotes ? `${formReason}: ${formNotes}` : formReason,
      attachment: formAttachment || undefined,
      status: 'pending',
      createdAt: nowIso,
    };

    addJustification(newJust);
    toast.success(isFr ? 'Nouvelle justification enregistrée' : 'New justification recorded');
    setAddDialogOpen(false);
    setFormNotes('');
    setFormAttachment('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {isFr ? "Justifications d'Absence & Certificats" : 'Absence Excuses & Medical Proofs'}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {isFr
                      ? 'Examinez les motifs d\'absence et validez pour régulariser automatiquement les présences'
                      : 'Review absence justifications and approve to automatically regularize attendance'}
                  </DialogDescription>
                </div>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {isFr ? 'Nouvelle Justification' : 'New Excuse'}
              </Button>
            </div>
          </DialogHeader>

          {/* Filter Bar */}
          <div className="flex flex-wrap gap-2 py-2 border-b">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isFr ? 'Rechercher un étudiant, matricule ou motif...' : 'Search student, ID or reason...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isFr ? 'Tous les statuts' : 'All Statuses'}</SelectItem>
                <SelectItem value="pending">{isFr ? 'En attente' : 'Pending'}</SelectItem>
                <SelectItem value="approved">{isFr ? 'Validés' : 'Approved'}</SelectItem>
                <SelectItem value="rejected">{isFr ? 'Rejetés' : 'Rejected'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Justifications Table */}
          <div className="flex-1 overflow-y-auto custom-scrollbar my-2 border rounded-lg">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40 text-amber-500" />
                {isFr ? 'Aucune justification trouvée.' : 'No justifications found.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-xs">
                    <TableHead>{isFr ? 'Étudiant' : 'Student'}</TableHead>
                    <TableHead>{isFr ? 'Classe' : 'Class'}</TableHead>
                    <TableHead>{isFr ? 'Date Absence' : 'Absence Date'}</TableHead>
                    <TableHead>{isFr ? 'Motif & Détails' : 'Reason & Details'}</TableHead>
                    <TableHead>{isFr ? 'Statut' : 'Status'}</TableHead>
                    <TableHead className="text-right">{isFr ? 'Actions' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(j => {
                    const st = students.find(s => s.id === j.studentId);
                    return (
                      <TableRow key={j.id} className="text-xs">
                        <TableCell>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {j.studentName || st?.fullName || '-'}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {st?.studentId || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{j.className || st?.className || '-'}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{j.date}</TableCell>
                        <TableCell>
                          <div className="max-w-xs">{j.reason}</div>
                          {j.reviewedBy && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {isFr ? 'Examiné par' : 'Reviewed by'}: {j.reviewedBy}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {j.status === 'pending' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                              <Clock className="h-3 w-3 mr-1" />
                              {isFr ? 'En attente' : 'Pending'}
                            </Badge>
                          )}
                          {j.status === 'approved' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {isFr ? 'Validé' : 'Approved'}
                            </Badge>
                          )}
                          {j.status === 'rejected' && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                              <XCircle className="h-3 w-3 mr-1" />
                              {isFr ? 'Rejeté' : 'Rejected'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {j.status === 'pending' ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => handleReview(j.id, 'approved')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                {isFr ? 'Valider' : 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => handleReview(j.id, 'rejected')}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                {isFr ? 'Rejeter' : 'Reject'}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {isFr ? 'Fermer' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Add Justification Modal */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {isFr ? 'Enregistrer une Justification d\'Absence' : 'Record Absence Justification'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>{isFr ? 'Étudiant' : 'Student'} *</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder={isFr ? 'Sélectionner un étudiant...' : 'Select student...'} />
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
              <Label>{isFr ? 'Date de l\'Absence' : 'Absence Date'} *</Label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>{isFr ? 'Type de Justification' : 'Justification Type'} *</Label>
              <Select value={formReason} onValueChange={setFormReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={isFr ? 'Certificat Médical' : 'Medical Certificate'}>
                    {isFr ? 'Certificat Médical (Maladie / Hospitalisation)' : 'Medical Certificate'}
                  </SelectItem>
                  <SelectItem value={isFr ? 'Urgence Familiale' : 'Family Emergency'}>
                    {isFr ? 'Cas d\'Urgence Familiale Majeure' : 'Family Emergency'}
                  </SelectItem>
                  <SelectItem value={isFr ? 'Convocation Officielle' : 'Official Summons'}>
                    {isFr ? 'Convocation Administrative ou Légale' : 'Official Summons'}
                  </SelectItem>
                  <SelectItem value={isFr ? 'Dispense Exceptionnelle' : 'Special Exemption'}>
                    {isFr ? 'Autorisation Pédagogique Préalable' : 'Special Exemption'}
                  </SelectItem>
                  <SelectItem value={isFr ? 'Autre' : 'Other'}>
                    {isFr ? 'Autre Motif' : 'Other'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>{isFr ? 'Détails ou Références (Dr, N° de certificat)' : 'Details or Certificate Ref.'}</Label>
                <AiTextAssist
                  value={formNotes}
                  onApply={setFormNotes}
                  contextPrompt="Détails administratifs du justificatif d'absence ou référence médicale"
                  size="sm"
                />
              </div>
              <Textarea
                rows={2}
                placeholder={isFr ? 'Ex: Certificat Dr. Bennani du 14/10 pour repos de 48h...' : 'Doctor name, reference number...'}
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleCreate}>
              {isFr ? 'Enregistrer' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
