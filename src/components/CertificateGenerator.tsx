'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import type { Student, AcademicYear } from '@/lib/types';
import {
  CertificateData,
  buildInitialCertificateData,
  generateCertificateDocx,
  sanitizeFilename,
} from '@/lib/docxGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  FileText, Download, Printer, RotateCcw, Save, Search, UserCheck,
  Building, CheckCircle2, ShieldCheck, Sparkles, GraduationCap, Palette
} from 'lucide-react';

export function CertificateGenerator() {
  const { students, classes, academicYears, schoolInfo, documentDesign, setCurrentPage } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // Filter students by name, matricule or class
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return students.filter(s =>
      s.fullName?.toLowerCase().includes(q) ||
      s.studentId?.toLowerCase().includes(q) ||
      s.className?.toLowerCase().includes(q) ||
      s.group?.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [students, searchQuery]);

  // Select initial student if none selected
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      const first = students[0];
      setSelectedStudentId(first.id);
      setCertData(buildInitialCertificateData(first, academicYears));
    }
  }, [students, selectedStudentId, academicYears]);

  // When selected student changes
  const handleSelectStudent = (student: Student) => {
    setSelectedStudentId(student.id);
    const initial = buildInitialCertificateData(student, academicYears);
    // If student has address or phone, prefill
    if (student.address) initial.domicile = student.address;
    setCertData(initial);
    toast.info(`Étudiant sélectionné: ${student.fullName}`);
  };

  const handleChange = (field: keyof CertificateData, value: string) => {
    if (!certData) return;
    setCertData({ ...certData, [field]: value });
  };

  // Download DOCX
  const handleDownloadDocx = async () => {
    if (!certData) return;
    setIsGenerating(true);
    try {
      const activePresetId = documentDesign?.activePresetIdByDocType?.['certificate'];
      const activePreset = documentDesign?.presets?.find(p => p.id === activePresetId) || documentDesign?.presets?.[0];
      const { docxBuffer, filename } = await generateCertificateDocx(certData, undefined, undefined, activePreset);
      
      // Create blob and download in browser
      const blob = new Blob([docxBuffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Certificat téléchargé avec succès : ${filename}`);
    } catch (err: any) {
      console.error('Erreur génération certificat:', err);
      toast.error(`Échec de la génération du document: ${err.message || 'Erreur inconnue'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save draft metadata locally
  const handleSaveDraft = () => {
    if (!certData) return;
    setIsSaving(true);
    try {
      localStorage.setItem(`cert_draft_${certData.studentId}`, JSON.stringify(certData));
      toast.success('Brouillon du certificat sauvegardé avec succès.');
    } catch (e: any) {
      toast.error('Erreur lors de la sauvegarde du brouillon.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form
  const handleReset = () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (student) {
      setCertData(buildInitialCertificateData(student, academicYears));
      toast.info('Champs réinitialisés aux valeurs par défaut.');
    }
  };

  // Print preview
  const handlePrint = () => {
    window.print();
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <FileText className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Documents administratifs — Certificat de scolarité</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Génération conforme au modèle officiel INFOHAS avec remplacement automatique du logo, métadonnées académiques et export Word DOCX natif.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage('settings')}
            className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/40"
          >
            <Palette className="h-4 w-4" />
            Personnaliser le Design
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!certData || isGenerating}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={!certData || isSaving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Sauvegarder Brouillon
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={!certData}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          <Button
            onClick={handleDownloadDocx}
            disabled={!certData || isGenerating}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Download className="h-4 w-4" />
            {isGenerating ? 'Génération en cours...' : 'Télécharger DOCX'}
          </Button>
        </div>
      </div>

      {/* Main Grid: Student Selector + Edit Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Student Selector Card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>1. Sélectionner l’Étudiant</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {students.length} inscrits
                </Badge>
              </CardTitle>
              <CardDescription>
                Recherchez par nom, matricule ou classe pour pré-remplir la fiche
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un stagiaire..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredStudents.map(s => {
                  const isSelected = s.id === selectedStudentId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStudent(s)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{s.fullName}</div>
                        <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>N°: {s.studentId || 'N/A'}</span>
                          <span>•</span>
                          <span className="truncate">{s.className || s.group || 'Sans classe'}</span>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Form Fields Card */}
          {certData && (
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2. Informations administratives</CardTitle>
                <CardDescription>
                  Ces champs seront injectés dans le document Word officiel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Identité */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Identité du Stagiaire
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nom de Famille</Label>
                      <Input
                        value={certData.nom}
                        onChange={e => handleChange('nom', e.target.value.toUpperCase())}
                        className="h-8 text-xs font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Prénom</Label>
                      <Input
                        value={certData.prenom}
                        onChange={e => handleChange('prenom', e.target.value.toUpperCase())}
                        className="h-8 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Né(e) le</Label>
                      <Input
                        value={certData.dateNaissance}
                        onChange={e => handleChange('dateNaissance', e.target.value)}
                        placeholder="JJ/MM/AAAA"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">À (Lieu de naissance)</Label>
                      <Input
                        value={certData.lieuNaissance}
                        onChange={e => handleChange('lieuNaissance', e.target.value.toUpperCase())}
                        placeholder="RABAT"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nationalité</Label>
                      <Input
                        value={certData.nationalite}
                        onChange={e => handleChange('nationalite', e.target.value.toUpperCase())}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">N° C.I.N</Label>
                      <Input
                        value={certData.cin}
                        onChange={e => handleChange('cin', e.target.value.toUpperCase())}
                        placeholder="LG123456"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Domicile (Adresse)</Label>
                    <Input
                      value={certData.domicile}
                      onChange={e => handleChange('domicile', e.target.value)}
                      placeholder="Adresse complète du stagiaire"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <Separator />

                {/* Scolarité */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Scolarité & Inscription
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Année d'étude</Label>
                      <Select
                        value={certData.anneeEtude}
                        onValueChange={val => handleChange('anneeEtude', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1ère Année">1ère Année</SelectItem>
                          <SelectItem value="2ème Année">2ème Année</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">N° Matricule / Registre</Label>
                      <Input
                        value={certData.matricule}
                        onChange={e => handleChange('matricule', e.target.value)}
                        placeholder="F57/27"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Année Scolaire</Label>
                      <Input
                        value={certData.anneeScolaire}
                        onChange={e => handleChange('anneeScolaire', e.target.value)}
                        placeholder="2026/2027"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Numéro National (CNE/Massar)</Label>
                      <Input
                        value={certData.numeroNational}
                        onChange={e => handleChange('numeroNational', e.target.value)}
                        placeholder="P140169168"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Filière / En classe de</Label>
                    <Input
                      value={certData.filiere}
                      onChange={e => handleChange('filiere', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Délivrée pour usage</Label>
                      <Input
                        value={certData.usage}
                        onChange={e => handleChange('usage', e.target.value.toUpperCase())}
                        placeholder="ADMINISTRATIF"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Date de délivrance</Label>
                      <Input
                        value={certData.dateDelivrance}
                        onChange={e => handleChange('dateDelivrance', e.target.value)}
                        placeholder="JJ/MM/AAAA"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Nom de la Directrice</Label>
                    <Input
                      value={certData.directrice}
                      onChange={e => handleChange('directrice', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Live Document Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="font-medium flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Aperçu en temps réel — Modèle Officiel INFOHAS
            </span>
            <span>Format A4 standard (210 × 297 mm)</span>
          </div>

          {/* Certificate Paper Container */}
          <div
            ref={previewRef}
            className="bg-white text-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg p-8 sm:p-12 relative min-h-[750px] font-serif leading-relaxed text-sm select-none"
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              backgroundImage: 'radial-gradient(#f1f5f9 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {/* Header Logos & Accreditation */}
            <div className="flex items-start justify-between border-b-2 border-zinc-900/10 pb-6 mb-6">
              {/* INFOHAS Official Logo */}
              <div className="w-44 flex flex-col items-start">
                <img
                  src="/infohas-logo.png"
                  alt="INFOHAS Logo"
                  className="h-16 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to text if image fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="text-[10px] tracking-tighter text-zinc-600 font-sans mt-1 uppercase font-semibold">
                  Institut de Formation Professionnelle
                </span>
              </div>

              {/* Date Box */}
              <div className="text-right font-sans text-xs space-y-1">
                <div className="font-bold text-zinc-800">
                  DATE : <span className="underline decoration-dotted">{certData?.dateDelivrance || '15/10/2026'}</span>
                </div>
                <div className="text-[10px] text-zinc-500">Rabat, Maroc</div>
              </div>
            </div>

            {/* Title */}
            <div className="text-center my-6 space-y-1">
              <h1 className="text-2xl font-black tracking-wider uppercase border-b-2 border-zinc-800 inline-block px-4 pb-1">
                Attestation de Scolarité
              </h1>
            </div>

            {/* Legal preamble */}
            <div className="text-xs space-y-2 text-justify mb-6">
              <p className="font-bold tracking-tight">
                JE SOUSSIGNÉE {certData?.directrice || 'Mme M’ZIOUAD IMANE'} DIRECTRICE DE INFOHAS :
              </p>
              <p className="text-[11px] text-zinc-700 leading-snug">
                ÉTABLISSEMENT DE FORMATION PROFESSIONNELLE PRIVÉ AUTORISÉ PAR LE MINISTÈRE DE LA FORMATION PROFESSIONNELLE SOUS LE N° 4/07/1997. ACCRÉDITATION N° 25/K0183/DFPP/45.
              </p>
              <p className="font-bold pt-2">
                CERTIFIE QUE L’ÉLÈVE (OU STAGIAIRE) :
              </p>
            </div>

            {/* Student Data Table / Grid */}
            <div className="border border-zinc-400 rounded-sm mb-6 text-xs bg-zinc-50/50">
              <div className="grid grid-cols-2 divide-x divide-zinc-300 border-b border-zinc-300">
                <div className="p-2.5 flex items-center">
                  <span className="font-bold w-24">Nom :</span>
                  <span className="font-semibold text-zinc-900 tracking-wide">
                    {certData?.nom || 'SAKIM'}
                  </span>
                </div>
                <div className="p-2.5 flex items-center">
                  <span className="font-bold w-24">Prénom :</span>
                  <span className="font-semibold text-zinc-900 tracking-wide">
                    {certData?.prenom || 'KHADIJA'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-zinc-300 border-b border-zinc-300">
                <div className="p-2.5 flex items-center">
                  <span className="font-bold w-24">Né(e) le :</span>
                  <span>{certData?.dateNaissance || '06/09/2008'}</span>
                </div>
                <div className="p-2.5 flex items-center">
                  <span className="font-bold w-24">À :</span>
                  <span>{certData?.lieuNaissance || 'ZEMAMRA SIDI BENNOUR'}</span>
                </div>
              </div>

              <div className="p-2.5 border-b border-zinc-300 flex items-center">
                <span className="font-bold w-24 shrink-0">Domicile :</span>
                <span className="truncate">{certData?.domicile || 'HAY KALAA AV MOUATAMID IBN ABBAD PSG 02 NR 02 M’DIQ'}</span>
              </div>

              <div className="grid grid-cols-2 divide-x divide-zinc-300 border-b border-zinc-300">
                <div className="p-2.5 flex items-center">
                  <span className="font-bold w-24">Nationalité :</span>
                  <span>{certData?.nationalite || 'MAROCAINE'}</span>
                </div>
                <div className="p-2.5 flex items-center">
                  <span className="font-bold w-24">C.I.N N° :</span>
                  <span className="font-mono font-semibold">{certData?.cin || 'LG55372'}</span>
                </div>
              </div>

              {/* Registration line with highlighted box */}
              <div className="p-3 bg-zinc-100/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    A été inscrite au registre des contrôles de cet établissement en{' '}
                    <span className="font-bold underline">{certData?.anneeEtude || '1ère Année'}</span> sous N°{' '}
                    <span className="font-bold font-mono text-emerald-800">{certData?.matricule || 'F57/27'}</span>
                  </div>
                  <div className="border border-zinc-700 px-3 py-1 bg-white font-bold text-center text-xs shadow-xs">
                    {certData?.anneeScolaire || '2026/2027'}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-bold">NUMÉRO NATIONAL : </span>
                    <span className="font-mono font-semibold">{certData?.numeroNational || 'P140169168'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* En classe de / filiere */}
            <div className="text-xs space-y-3 mb-8">
              <p>
                <span className="font-bold">En classe de : </span>
                <span>{certData?.filiere || 'ATAM (Accueil dans les transports aériens et maritimes : Option hôtesse de l’air/steward)'}</span>
              </p>
              <p>
                La présente attestation lui est délivrée pour usage :{' '}
                <span className="font-bold underline decoration-1 underline-offset-2">
                  {certData?.usage || 'ADMINISTRATIF'}
                </span>
              </p>
            </div>

            {/* Signature Block */}
            <div className="mt-12 flex justify-end">
              <div className="text-center w-64 space-y-1">
                <div className="text-xs font-bold uppercase text-zinc-700">
                  Directrice de l’établissement
                </div>
                <div className="text-sm font-semibold text-zinc-900 pt-1">
                  {certData?.directrice || 'Mme M’ZIOUAD IMANE'}
                </div>
                <div className="h-16 flex items-center justify-center text-[10px] text-zinc-400 italic">
                  [Cachet et Signature Officielle]
                </div>
              </div>
            </div>

            {/* Official Footer Note */}
            <div className="absolute bottom-4 left-8 right-8 text-[9px] text-zinc-400 text-center border-t border-zinc-200 pt-2 font-sans">
              INFOHAS INSTITUT — Document officiel délivré par le système de gestion académique
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
