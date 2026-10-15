'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, X, Filter, Users, GraduationCap, Phone, Mail, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, pushToD1Now, saveCache } from '@/lib/store';
import { parseStudentsSpreadsheet, type ParsedStudentRow, type ParseResult } from '@/lib/excelParser';
import type { Student, Class } from '@/lib/types';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const { students, classes, setStudents, setClasses, addAuditLog, language } = useAppStore();
  const isFr = language === 'fr';

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [stagedRows, setStagedRows] = useState<ParsedStudentRow[]>([]);

  // Filtering & controls
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'DUPLICATE'>('ALL');
  const [duplicateAction, setDuplicateAction] = useState<'update' | 'skip' | 'add_all'>('update');
  const [autoCreateClasses, setAutoCreateClasses] = useState(true);
  const [defaultAcademicYear, setDefaultAcademicYear] = useState('2026-2028');
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const result = parseStudentsSpreadsheet(buffer, students, classes);
      setParseResult(result);
      setStagedRows(result.students);

      if (result.totalCount === 0) {
        toast.warning(isFr ? 'Aucun stagiaire trouvé dans le fichier' : 'No students found in file');
      } else {
        toast.success(
          isFr
            ? `${result.totalCount} stagiaires analysés (${result.groups.length} groupes détectés)`
            : `${result.totalCount} students parsed (${result.groups.length} groups detected)`
        );
      }
    } catch (err: unknown) {
      console.error('Error parsing file:', err);
      toast.error(isFr ? 'Erreur lors de la lecture du fichier Excel' : 'Failed to parse Excel file');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setStagedRows([]);
    setSearchTerm('');
    setGroupFilter('ALL');
    setStatusFilter('ALL');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleSelectRow = (tempId: string) => {
    setStagedRows(prev =>
      prev.map(r => (r.tempId === tempId ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setStagedRows(prev => prev.map(r => ({ ...r, selected: checked })));
  };

  // Filtered rows for preview table
  const displayedRows = useMemo(() => {
    return stagedRows.filter(r => {
      const matchesSearch =
        !searchTerm ||
        r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.guardianName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.phone.includes(searchTerm);

      const matchesGroup = groupFilter === 'ALL' || r.group === groupFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'NEW' && !r.isDuplicate) ||
        (statusFilter === 'DUPLICATE' && r.isDuplicate);

      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [stagedRows, searchTerm, groupFilter, statusFilter]);

  const selectedCount = stagedRows.filter(r => r.selected).length;

  const handleConfirmImport = async () => {
    const toImport = stagedRows.filter(r => r.selected);
    if (toImport.length === 0) {
      toast.warning(isFr ? 'Aucun stagiaire sélectionné' : 'No students selected');
      return;
    }

    setIsImporting(true);
    try {
      // 1. Resolve / Create Classes
      const updatedClasses = [...classes];
      const classMapByName = new Map<string, Class>();
      for (const c of updatedClasses) {
        classMapByName.set(c.name.trim().toLowerCase(), c);
      }

      let createdClassesCount = 0;
      if (autoCreateClasses && parseResult?.groups) {
        for (const grpName of parseResult.groups) {
          const key = grpName.trim().toLowerCase();
          if (!classMapByName.has(key)) {
            const newClass: Class = {
              id: genId(),
              name: grpName.trim(),
              academicYear: defaultAcademicYear,
              description: `Groupe importé automatiquement (${grpName})`,
              room: '',
              teacher: '',
              capacity: 35,
              createdAt: new Date().toISOString(),
            };
            updatedClasses.push(newClass);
            classMapByName.set(key, newClass);
            createdClassesCount++;
          }
        }
      }

      // 2. Process Students
      const currentStudentsMap = new Map<string, Student>();
      for (const s of students) {
        currentStudentsMap.set(s.id, s);
      }

      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const row of toImport) {
        const targetClass = classMapByName.get(row.group.trim().toLowerCase());
        const classId = targetClass?.id || '';
        const className = targetClass?.name || row.group;

        if (row.isDuplicate && row.existingStudent) {
          if (duplicateAction === 'skip') {
            skippedCount++;
            continue;
          }
          if (duplicateAction === 'update') {
            const ex = row.existingStudent;
            const updatedStudent: Student = {
              ...ex,
              fullName: row.fullName || ex.fullName,
              studentId: row.studentId || ex.studentId,
              classId: classId || ex.classId,
              className: className || ex.className,
              group: row.group || ex.group,
              phone: row.phone || ex.phone,
              email: row.email || ex.email,
              guardianName: row.guardianName || ex.guardianName,
              guardianPhone: row.guardianPhone || ex.guardianPhone,
              notes: row.notes ? (ex.notes ? `${ex.notes} | ${row.notes}` : row.notes) : ex.notes,
              academicYear: defaultAcademicYear || ex.academicYear,
            };
            currentStudentsMap.set(ex.id, updatedStudent);
            updatedCount++;
            continue;
          }
        }

        // Add as new student
        const newStudent: Student = {
          id: genId(),
          fullName: row.fullName,
          studentId: row.studentId,
          classId,
          className,
          group: row.group,
          phone: row.phone,
          email: row.email,
          guardianName: row.guardianName,
          guardianPhone: row.guardianPhone,
          notes: row.notes,
          status: 'active',
          academicYear: defaultAcademicYear,
          disciplinaryStatus: 'normal',
          createdAt: new Date().toISOString(),
        };
        currentStudentsMap.set(newStudent.id, newStudent);
        addedCount++;
      }

      const finalClassesList = updatedClasses;
      const finalStudentsList = Array.from(currentStudentsMap.values());

      // Update store and local cache
      setClasses(finalClassesList);
      setStudents(finalStudentsList);
      saveCache('classes', finalClassesList);
      saveCache('students', finalStudentsList);

      // Push to Cloudflare D1
      await pushToD1Now({
        classes: finalClassesList,
        students: finalStudentsList,
      });

      addAuditLog(
        'IMPORT_DATA',
        'students',
        '',
        `${addedCount} ajoutés, ${updatedCount} mis à jour`,
        `Import Excel: ${addedCount} créés, ${updatedCount} actualisés, ${createdClassesCount} classes créées`
      );

      toast.success(
        isFr
          ? `Importation réussie ! ${addedCount} stagiaires ajoutés, ${updatedCount} mis à jour${createdClassesCount > 0 ? `, ${createdClassesCount} nouvelles classes créées` : ''}.`
          : `Import completed! ${addedCount} students added, ${updatedCount} updated${createdClassesCount > 0 ? `, ${createdClassesCount} new classes created` : ''}.`
      );

      onOpenChange(false);
      handleReset();
    } catch (err: unknown) {
      console.error('Import confirmation error:', err);
      toast.error(isFr ? "Erreur pendant l'enregistrement des données" : 'Failed to save imported students');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {isFr ? 'Importation Groupée de Stagiaires (Excel / CSV)' : 'Bulk Student Import (Excel / CSV)'}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {isFr
                  ? 'Compatible avec les classeurs multi-groupes (ex: LONDON 2027, OTTAWA 2027, BARCELONA 2027) et les tableaux standards.'
                  : 'Supports multi-group sheets (e.g. LONDON 2027, OTTAWA 2027, BARCELONA 2027) and standard tables.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 custom-scrollbar">
          {/* File Upload Dropzone */}
          {!parseResult && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-emerald-300 dark:border-emerald-800 rounded-xl p-8 text-center bg-emerald-50/50 dark:bg-emerald-950/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                }}
              />
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center mb-3">
                {isParsing ? <RefreshCw className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
              </div>
              <h3 className="font-semibold text-base mb-1">
                {isParsing
                  ? (isFr ? 'Analyse du fichier en cours...' : 'Parsing spreadsheet...')
                  : (isFr ? 'Glissez-déposez votre fichier Excel ici ou cliquez pour parcourir' : 'Drag and drop your Excel file here or click to browse')}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Formats acceptés : <span className="font-medium text-foreground">.xlsx, .xls, .csv</span> (ex: <code className="bg-muted px-1.5 py-0.5 rounded">GROUP CONTACT 26-28.xlsx</code>)
              </p>
              <Button type="button" variant="outline" size="sm" className="bg-white dark:bg-slate-900 pointer-events-none">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                {isFr ? 'Choisir un fichier' : 'Select File'}
              </Button>
            </div>
          )}

          {/* Parsed Summary & Controls */}
          {parseResult && (
            <div className="space-y-4">
              {/* Top Banner Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span>{file?.name}</span>
                      <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                        {parseResult.totalCount} {isFr ? 'stagiaires' : 'students'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{isFr ? 'Onglet :' : 'Sheet:'} {parseResult.sheetName}</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-medium">{parseResult.newCount} {isFr ? 'nouveaux' : 'new'}</span>
                      {parseResult.duplicateCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-600 font-medium">{parseResult.duplicateCount} {isFr ? 'existants' : 'existing'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5 mr-1" />
                    {isFr ? 'Changer de fichier' : 'Change file'}
                  </Button>
                </div>
              </div>

              {/* Group Badges List */}
              {parseResult.groups.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                    {isFr ? 'Groupes détectés :' : 'Detected groups:'}
                  </span>
                  {parseResult.groups.map(grp => {
                    const count = stagedRows.filter(r => r.group === grp).length;
                    const isSelected = groupFilter === grp;
                    return (
                      <Button
                        key={grp}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 text-xs rounded-full ${isSelected ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                        onClick={() => setGroupFilter(isSelected ? 'ALL' : grp)}
                      >
                        {grp} <span className="ml-1 opacity-75 font-mono">({count})</span>
                      </Button>
                    );
                  })}
                  {groupFilter !== 'ALL' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGroupFilter('ALL')}>
                      {isFr ? 'Voir tous' : 'Show all'}
                    </Button>
                  )}
                </div>
              )}

              {/* Import Settings & Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                {/* Search */}
                <div>
                  <Label className="text-xs mb-1 block">{isFr ? 'Recherche' : 'Search'}</Label>
                  <Input
                    placeholder={isFr ? 'Nom, matricule, tel...' : 'Name, ID, phone...'}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Status filter */}
                <div>
                  <Label className="text-xs mb-1 block">{isFr ? 'Filtrer statut' : 'Filter status'}</Label>
                  <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{isFr ? 'Tous les statuts' : 'All statuses'}</SelectItem>
                      <SelectItem value="NEW">{isFr ? 'Nouveaux uniquement' : 'New only'}</SelectItem>
                      <SelectItem value="DUPLICATE">{isFr ? 'Doublons / Existants' : 'Duplicates / Existing'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Duplicate strategy */}
                <div>
                  <Label className="text-xs mb-1 block">{isFr ? 'Gestion doublons' : 'Duplicates policy'}</Label>
                  <Select value={duplicateAction} onValueChange={v => setDuplicateAction(v as typeof duplicateAction)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="update">{isFr ? 'Mettre à jour les données' : 'Update existing'}</SelectItem>
                      <SelectItem value="skip">{isFr ? 'Ignorer les doublons' : 'Skip duplicates'}</SelectItem>
                      <SelectItem value="add_all">{isFr ? 'Ajouter en double' : 'Always add as new'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Academic Year */}
                <div>
                  <Label className="text-xs mb-1 block">{isFr ? 'Année Scolaire' : 'Academic Year'}</Label>
                  <Input
                    value={defaultAcademicYear}
                    onChange={e => setDefaultAcademicYear(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="2026-2028"
                  />
                </div>
              </div>

              {/* Auto Create Classes toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="autoCreateClasses"
                  checked={autoCreateClasses}
                  onCheckedChange={c => setAutoCreateClasses(Boolean(c))}
                />
                <label htmlFor="autoCreateClasses" className="text-xs font-medium cursor-pointer">
                  {isFr
                    ? 'Créer automatiquement les classes absentes dans le CRM (ex: LONDON 2027, OTTAWA 2027, BARCELONA 2027)'
                    : 'Automatically create missing classes in CRM (e.g. LONDON 2027, OTTAWA 2027, BARCELONA 2027)'}
                </label>
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="p-2.5 bg-muted/60 flex items-center justify-between text-xs font-medium border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedCount === stagedRows.length && stagedRows.length > 0}
                      onCheckedChange={c => toggleSelectAll(Boolean(c))}
                    />
                    <span>
                      {selectedCount} / {stagedRows.length} {isFr ? 'stagiaires sélectionnés' : 'students selected'}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {displayedRows.length} {isFr ? 'affichés' : 'displayed'}
                  </span>
                </div>

                <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>{isFr ? 'Groupe / Classe' : 'Group / Class'}</TableHead>
                        <TableHead>{isFr ? 'Matricule' : 'Student ID'}</TableHead>
                        <TableHead>{isFr ? 'Nom Complet' : 'Full Name'}</TableHead>
                        <TableHead>{isFr ? 'Téléphone' : 'Phone'}</TableHead>
                        <TableHead>{isFr ? 'Email' : 'Email'}</TableHead>
                        <TableHead>{isFr ? 'Tuteur Principal' : 'Primary Guardian'}</TableHead>
                        <TableHead>{isFr ? 'Contacts Secondaires' : 'Other Contacts'}</TableHead>
                        <TableHead className="w-24 text-center">{isFr ? 'Statut' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            {isFr ? 'Aucun stagiaire ne correspond aux filtres' : 'No students matching filter'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedRows.map(row => (
                          <TableRow key={row.tempId} className={row.selected ? '' : 'opacity-40'}>
                            <TableCell>
                              <Checkbox
                                checked={row.selected}
                                onCheckedChange={() => toggleSelectRow(row.tempId)}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border-purple-200">
                                {row.group}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono font-medium">{row.studentId || '-'}</TableCell>
                            <TableCell className="font-medium text-foreground">{row.fullName}</TableCell>
                            <TableCell className="whitespace-nowrap font-mono">{row.phone || '-'}</TableCell>
                            <TableCell className="text-muted-foreground truncate max-w-[150px]">{row.email || '-'}</TableCell>
                            <TableCell>
                              {row.guardianName || row.guardianPhone ? (
                                <div className="leading-tight">
                                  <div className="font-medium">{row.guardianName || 'Parent'}</div>
                                  <div className="text-[11px] text-muted-foreground font-mono">{row.guardianPhone}</div>
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground max-w-[200px] truncate" title={row.notes}>
                              {row.notes || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.isDuplicate ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300">
                                  {isFr ? 'Existant' : 'Existing'}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300">
                                  {isFr ? 'Nouveau' : 'New'}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            {parseResult && (
              <span>
                {selectedCount} {isFr ? 'stagiaires prêts à être importés dans D1' : 'students ready to import to D1'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isImporting}>
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            {parseResult && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow"
                onClick={handleConfirmImport}
                disabled={isImporting || selectedCount === 0}
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {isFr ? 'Importation en cours...' : 'Importing...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isFr ? `Confirmer l'import (${selectedCount})` : `Confirm Import (${selectedCount})`}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
