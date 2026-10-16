'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import {
  DocumentType,
  DocumentDesignPreset,
  DocumentCustomizationSettings,
  AVAILABLE_FONTS,
  DEFAULT_DOCUMENT_PRESETS,
  isValidHexColor,
  toOpenXmlHexColor,
} from '@/lib/documentDesignTypes';
import { generateCertificateDocx, buildInitialCertificateData } from '@/lib/docxGenerator';
import { generateCertificatePdf } from '@/lib/certificatePdf';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Palette, FileText, Download, RotateCcw, Save, Upload, Trash2, Check,
  Lock, Unlock, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Eye, Sparkles, Building, ShieldCheck, FileCheck, RefreshCw, Copy, Plus
} from 'lucide-react';
import jsPDF from 'jspdf';

export function DocumentCustomizationPanel() {
  const { documentDesign, setDocumentDesign, language, students, academicYears } = useAppStore();

  const [activeDocType, setActiveDocType] = useState<DocumentType>('certificate');
  const [presets, setPresets] = useState<DocumentDesignPreset[]>(
    documentDesign?.presets || DEFAULT_DOCUMENT_PRESETS
  );
  const [activePresetId, setActivePresetId] = useState<string>(
    documentDesign?.activePresetIdByDocType?.[activeDocType] || 'preset_infohas_official_cert'
  );

  // Active preset being edited
  const currentPreset = useMemo(() => {
    return presets.find(p => p.id === activePresetId) || presets[0] || DEFAULT_DOCUMENT_PRESETS[0];
  }, [presets, activePresetId]);

  // Working copy state for form edits
  const [workingPreset, setWorkingPreset] = useState<DocumentDesignPreset>(currentPreset);
  const [isTextUnlocked, setIsTextUnlocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync working copy when preset selection changes
  useEffect(() => {
    setWorkingPreset(JSON.parse(JSON.stringify(currentPreset)));
    setIsTextUnlocked(!currentPreset.heading.isTextLocked);
  }, [currentPreset]);

  // When switching document type, select the default preset for that type
  const handleDocTypeChange = (docType: DocumentType) => {
    setActiveDocType(docType);
    const presetForType = presets.find(p => p.documentType === docType && p.isDefault) ||
      presets.find(p => p.documentType === docType) ||
      presets[0];
    if (presetForType) {
      setActivePresetId(presetForType.id);
    }
  };

  // Color change handlers
  const handleHeadingColorChange = (hex: string) => {
    setWorkingPreset(prev => ({
      ...prev,
      heading: { ...prev.heading, textColor: hex, borderColor: hex }
    }));
  };

  const handleFooterColorChange = (hex: string) => {
    setWorkingPreset(prev => ({
      ...prev,
      footer: { ...prev.footer, textColor: hex }
    }));
  };

  const handleSeparatorColorChange = (hex: string) => {
    setWorkingPreset(prev => ({
      ...prev,
      footer: { ...prev.footer, separatorColor: hex }
    }));
  };

  // Logo upload handler with validation
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Format non supporté. Veuillez sélectionner un fichier PNG ou JPEG.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Fichier trop volumineux. La taille maximale est de 2 Mo.');
      return;
    }

    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        setWorkingPreset(prev => ({
          ...prev,
          logo: {
            ...prev.logo,
            selectedLogo: 'custom',
            customLogoUrl: dataUrl,
            customLogoFilename: file.name,
          }
        }));

        // Send to API endpoint if online
        try {
          await fetch('/api/doc-design/upload-logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64: dataUrl, filename: file.name, mimeType: file.type })
          });
        } catch {}

        toast.success(`Logo "${file.name}" chargé avec succès`);
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Erreur lors du chargement de l’image: ' + err.message);
      setUploadingLogo(false);
    }
  };

  // Restore default preset
  const handleRestoreDefaults = () => {
    const defaultTemplate = DEFAULT_DOCUMENT_PRESETS.find(p => p.documentType === activeDocType) || DEFAULT_DOCUMENT_PRESETS[0];
    setWorkingPreset(JSON.parse(JSON.stringify(defaultTemplate)));
    toast.info('Modèle réinitialisé aux valeurs institutionnelles par défaut.');
  };

  // Save current preset
  const handleSaveSettings = async () => {
    // Validate colors
    if (!isValidHexColor(workingPreset.heading.textColor)) {
      toast.error(`Couleur d'en-tête invalide (${workingPreset.heading.textColor}). Utilisez un code hexadécimal valide comme #17365D.`);
      return;
    }
    if (!isValidHexColor(workingPreset.footer.textColor)) {
      toast.error(`Couleur de pied de page invalide (${workingPreset.footer.textColor}).`);
      return;
    }

    setIsSaving(true);
    try {
      const updatedPresets = presets.map(p => p.id === workingPreset.id ? {
        ...workingPreset,
        updatedAt: new Date().toISOString()
      } : p);

      // If this preset was not in list, add it
      if (!updatedPresets.some(p => p.id === workingPreset.id)) {
        updatedPresets.push({ ...workingPreset, updatedAt: new Date().toISOString() });
      }

      const activeMap = {
        ...(documentDesign?.activePresetIdByDocType || {}),
        [activeDocType]: workingPreset.id
      };

      const newSettings: DocumentCustomizationSettings = {
        presets: updatedPresets,
        activePresetIdByDocType: activeMap,
        updatedAt: new Date().toISOString()
      };

      setPresets(updatedPresets);
      if (setDocumentDesign) {
        setDocumentDesign(newSettings);
      }

      // Persist in localStorage cache
      localStorage.setItem('crm_cache_documentDesign', JSON.stringify(newSettings));

      // Persist in D1 via API
      try {
        const res = await fetch('/api/doc-design/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presets: updatedPresets, activePresetIdByDocType: activeMap })
        });
        const d = await res.json();
        if (d.success) {
          toast.success('Paramètres de design enregistrés en base de données et prêts pour l’export.');
        } else {
          toast.warning('Paramètres enregistrés localement.');
        }
      } catch {
        toast.success('Paramètres enregistrés localement (mode hors-ligne).');
      }
    } catch (err: any) {
      toast.error('Erreur lors de l’enregistrement: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate current preset
  const handleDuplicatePreset = () => {
    const newId = `preset_custom_${Date.now()}`;
    const newPreset: DocumentDesignPreset = {
      ...workingPreset,
      id: newId,
      name: `${workingPreset.name} (Copie)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    setActivePresetId(newId);
    setWorkingPreset(newPreset);
    toast.success(`Nouveau préréglage créé : "${newPreset.name}"`);
  };

  // Generate and Download Test DOCX
  const handleDownloadTestDocx = async () => {
    setIsGeneratingTest(true);
    try {
      const sampleStudent = students[0] || {
        id: 'test_std_1',
        fullName: 'ZINEB SAD',
        studentId: 'F01/26',
        className: 'Group Dubai 1ère Année',
        status: 'active'
      };

      const certData = buildInitialCertificateData(sampleStudent as any, academicYears);
      certData.nom = 'SAD';
      certData.prenom = 'ZINEB';
      certData.anneeScolaire = '2025-2026';

      const { docxBuffer, filename } = await generateCertificateDocx(
        certData,
        undefined,
        undefined,
        workingPreset
      );

      const blob = new Blob([docxBuffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TEST_DESIGN_${workingPreset.name.replace(/\s+/g, '_')}_${filename}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Document Word test généré et vérifié : ${filename}`);
    } catch (err: any) {
      toast.error('Erreur de génération DOCX: ' + err.message);
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // Generate and Download Test PDF matching full vector layout and official design
  const handleDownloadTestPdf = async () => {
    setIsGeneratingTest(true);
    try {
      const sampleStudent = students[0] || {
        id: 'test_std_1',
        fullName: 'ZINEB SAD',
        studentId: 'F01/26',
        className: 'Group Dubai 1ère Année',
        status: 'active'
      };

      const certData = buildInitialCertificateData(sampleStudent as any, academicYears);
      certData.nom = 'SAD';
      certData.prenom = 'ZINEB';
      certData.anneeScolaire = '2025-2026';

      const { pdfBlob, filename, doc } = await generateCertificatePdf(certData, workingPreset);
      const downloadFilename = `TEST_DESIGN_${workingPreset.name.replace(/\s+/g, '_')}_${filename}`;
      doc.save(downloadFilename);

      toast.success(`Document PDF test généré et vérifié : ${downloadFilename}`);
    } catch (err: any) {
      console.error('Erreur de génération PDF:', err);
      toast.error('Erreur de génération PDF: ' + err.message);
    } finally {
      setIsGeneratingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              <Palette className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Personnalisation des documents & Design</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configurez l’apparence visuelle des attestations, certificats et rapports DOCX/PDF sans modifier le code.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestoreDefaults}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurer par défaut
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicatePreset}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Dupliquer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTestPdf}
            className="gap-2"
          >
            <Download className="h-4 w-4 text-red-500" />
            Test PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTestDocx}
            disabled={isGeneratingTest}
            className="gap-2"
          >
            <Download className="h-4 w-4 text-blue-500" />
            {isGeneratingTest ? 'Génération...' : 'Test Word DOCX'}
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </Button>
        </div>
      </div>

      {/* Main Grid: Customization Controls (Left 6 cols) + Real-time Live Preview (Right 6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-6 space-y-6">
          {/* Document Type & Preset Selector Card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>1. Type de document & Préréglage</span>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                  {workingPreset.name}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Type de Document</Label>
                  <Select value={activeDocType} onValueChange={(v: DocumentType) => handleDocTypeChange(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="certificate">Certificat de scolarité</SelectItem>
                      <SelectItem value="attendance_report">Rapport d'assiduité</SelectItem>
                      <SelectItem value="administrative_doc">Document administratif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Préréglage Actif</Label>
                  <Select value={activePresetId} onValueChange={(v) => setActivePresetId(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.isDefault ? '(Par défaut)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nom du préréglage</Label>
                <Input
                  value={workingPreset.name}
                  onChange={e => setWorkingPreset({ ...workingPreset, name: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Detailed Customization Tabs */}
          <Tabs defaultValue="heading" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="heading">En-tête (Header)</TabsTrigger>
              <TabsTrigger value="footer">Pied de page (Footer)</TabsTrigger>
              <TabsTrigger value="logo">Logo & Dimensions</TabsTrigger>
            </TabsList>

            {/* TAB 1: HEADING */}
            <TabsContent value="heading" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Personnalisation de l’En-tête</span>
                    {activeDocType === 'certificate' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsTextUnlocked(!isTextUnlocked)}
                        className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                      >
                        {isTextUnlocked ? <Unlock className="h-3.5 w-3.5 text-amber-600" /> : <Lock className="h-3.5 w-3.5" />}
                        {isTextUnlocked ? 'Texte déverrouillé' : 'Wording officiel protégé'}
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configurez le libellé, la couleur (#HEX), la police et l’alignement de l’en-tête du document.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Heading Text */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center justify-between text-xs">
                      <span>Titre de l’en-tête</span>
                      {!isTextUnlocked && activeDocType === 'certificate' && (
                        <span className="text-[10px] text-amber-600 font-medium">
                          Conformité légale ministère préservée
                        </span>
                      )}
                    </Label>
                    <Input
                      value={workingPreset.heading.text}
                      disabled={!isTextUnlocked && activeDocType === 'certificate'}
                      onChange={e => setWorkingPreset({
                        ...workingPreset,
                        heading: { ...workingPreset.heading, text: e.target.value }
                      })}
                      className={!isTextUnlocked && activeDocType === 'certificate' ? 'bg-muted/50 cursor-not-allowed font-semibold' : ''}
                    />
                  </div>

                  {/* Colors: Text & Border */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Couleur du Titre</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={workingPreset.heading.textColor.startsWith('#') ? workingPreset.heading.textColor : '#17365D'}
                          onChange={e => handleHeadingColorChange(e.target.value)}
                          className="w-10 h-10 rounded border cursor-pointer p-0.5"
                        />
                        <Input
                          value={workingPreset.heading.textColor}
                          onChange={e => handleHeadingColorChange(e.target.value)}
                          placeholder="#17365D"
                          className="font-mono text-sm uppercase"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Police de Caractères</Label>
                      <Select
                        value={workingPreset.heading.fontFamily}
                        onValueChange={v => setWorkingPreset({
                          ...workingPreset,
                          heading: { ...workingPreset.heading, fontFamily: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_FONTS.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Formatting: Size, Bold, Italic, Alignment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Taille de Police ({workingPreset.heading.fontSize} pt)</Label>
                      <input
                        type="range"
                        min="12"
                        max="26"
                        step="1"
                        value={workingPreset.heading.fontSize}
                        onChange={e => setWorkingPreset({
                          ...workingPreset,
                          heading: { ...workingPreset.heading, fontSize: Number(e.target.value) }
                        })}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Alignement du Texte</Label>
                      <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
                        <Button
                          type="button"
                          variant={workingPreset.heading.alignment === 'left' ? 'default' : 'ghost'}
                          size="sm"
                          className="flex-1 h-8 px-2"
                          onClick={() => setWorkingPreset({
                            ...workingPreset,
                            heading: { ...workingPreset.heading, alignment: 'left' }
                          })}
                        >
                          <AlignLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant={workingPreset.heading.alignment === 'center' ? 'default' : 'ghost'}
                          size="sm"
                          className="flex-1 h-8 px-2"
                          onClick={() => setWorkingPreset({
                            ...workingPreset,
                            heading: { ...workingPreset.heading, alignment: 'center' }
                          })}
                        >
                          <AlignCenter className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant={workingPreset.heading.alignment === 'right' ? 'default' : 'ghost'}
                          size="sm"
                          className="flex-1 h-8 px-2"
                          onClick={() => setWorkingPreset({
                            ...workingPreset,
                            heading: { ...workingPreset.heading, alignment: 'right' }
                          })}
                        >
                          <AlignRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Style Toggles */}
                  <div className="flex items-center gap-4 pt-2">
                    <Button
                      type="button"
                      variant={workingPreset.heading.bold ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setWorkingPreset({
                        ...workingPreset,
                        heading: { ...workingPreset.heading, bold: !workingPreset.heading.bold }
                      })}
                      className="gap-1.5"
                    >
                      <Bold className="h-4 w-4" />
                      Gras
                    </Button>

                    <Button
                      type="button"
                      variant={workingPreset.heading.italic ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setWorkingPreset({
                        ...workingPreset,
                        heading: { ...workingPreset.heading, italic: !workingPreset.heading.italic }
                      })}
                      className="gap-1.5"
                    >
                      <Italic className="h-4 w-4" />
                      Italique
                    </Button>

                    <Button
                      type="button"
                      variant={workingPreset.heading.showBottomBorder ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setWorkingPreset({
                        ...workingPreset,
                        heading: { ...workingPreset.heading, showBottomBorder: !workingPreset.heading.showBottomBorder }
                      })}
                      className="gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      Ligne de séparation
                    </Button>
                  </div>

                  <Separator className="my-2" />

                  {/* Institutional Header Configuration (Lines & Accreditation) */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        En-tête officiel bilingue de l’institution (3 lignes)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={workingPreset.heading.showInstitutionalHeading !== false ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setWorkingPreset({
                            ...workingPreset,
                            heading: {
                              ...workingPreset.heading,
                              showInstitutionalHeading: !(workingPreset.heading.showInstitutionalHeading !== false)
                            }
                          })}
                        >
                          {workingPreset.heading.showInstitutionalHeading !== false ? 'Affiché' : 'Masqué'}
                        </Button>
                      </div>
                    </div>

                    {workingPreset.heading.showInstitutionalHeading !== false && (
                      <div className="space-y-2.5 bg-muted/30 p-3 rounded-lg border border-border">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Ligne 1 (Français institutionnel)</Label>
                          <Input
                            value={workingPreset.heading.institutionalName || 'INSTITUT PRIVE DE FORMATION'}
                            onChange={e => setWorkingPreset({
                              ...workingPreset,
                              heading: { ...workingPreset.heading, institutionalName: e.target.value }
                            })}
                            className="h-8 text-xs font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Ligne 2 (Spécialité)</Label>
                          <Input
                            value={workingPreset.heading.institutionalSubline1 || 'D’HOTESSES DE L’AIR ET STEWARDS'}
                            onChange={e => setWorkingPreset({
                              ...workingPreset,
                              heading: { ...workingPreset.heading, institutionalSubline1: e.target.value }
                            })}
                            className="h-8 text-xs font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Ligne 3 (Anglais officiel)</Label>
                          <Input
                            value={workingPreset.heading.institutionalSubline2 || 'CABIN CREW TRAINING INSTITUTE'}
                            onChange={e => setWorkingPreset({
                              ...workingPreset,
                              heading: { ...workingPreset.heading, institutionalSubline2: e.target.value }
                            })}
                            className="h-8 text-xs font-medium"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-xs font-medium">Sceau d’accréditation officiel (Droite)</div>
                        <div className="text-[11px] text-muted-foreground">Affiche le cachet d'accréditation du ministère à droite de l'en-tête</div>
                      </div>
                      <Button
                        type="button"
                        variant={workingPreset.heading.showSecondaryLogo !== false ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setWorkingPreset({
                          ...workingPreset,
                          heading: {
                            ...workingPreset.heading,
                            showSecondaryLogo: !(workingPreset.heading.showSecondaryLogo !== false)
                          }
                        })}
                      >
                        {workingPreset.heading.showSecondaryLogo !== false ? 'Activé' : 'Désactivé'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: FOOTER */}
            <TabsContent value="footer" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Personnalisation du Pied de Page</CardTitle>
                  <CardDescription className="text-xs">
                    Supporte le texte multi-lignes, les accents français et la numérotation des pages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Texte du Pied de Page (Multi-lignes)</Label>
                    <Textarea
                      rows={3}
                      value={workingPreset.footer.text}
                      onChange={e => setWorkingPreset({
                        ...workingPreset,
                        footer: { ...workingPreset.footer, text: e.target.value }
                      })}
                      className="font-sans text-xs leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Couleur du Texte</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={workingPreset.footer.textColor.startsWith('#') ? workingPreset.footer.textColor : '#64748B'}
                          onChange={e => handleFooterColorChange(e.target.value)}
                          className="w-10 h-10 rounded border cursor-pointer p-0.5"
                        />
                        <Input
                          value={workingPreset.footer.textColor}
                          onChange={e => handleFooterColorChange(e.target.value)}
                          placeholder="#64748B"
                          className="font-mono text-sm uppercase"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Couleur du Séparateur</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={workingPreset.footer.separatorColor.startsWith('#') ? workingPreset.footer.separatorColor : '#CBD5E1'}
                          onChange={e => handleSeparatorColorChange(e.target.value)}
                          className="w-10 h-10 rounded border cursor-pointer p-0.5"
                        />
                        <Input
                          value={workingPreset.footer.separatorColor}
                          onChange={e => handleSeparatorColorChange(e.target.value)}
                          placeholder="#CBD5E1"
                          className="font-mono text-sm uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Taille de Police ({workingPreset.footer.fontSize} pt)</Label>
                      <input
                        type="range"
                        min="7"
                        max="12"
                        step="0.5"
                        value={workingPreset.footer.fontSize}
                        onChange={e => setWorkingPreset({
                          ...workingPreset,
                          footer: { ...workingPreset.footer, fontSize: Number(e.target.value) }
                        })}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Numérotation & Séparateur</Label>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant={workingPreset.footer.showSeparatorLine ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => setWorkingPreset({
                            ...workingPreset,
                            footer: { ...workingPreset.footer, showSeparatorLine: !workingPreset.footer.showSeparatorLine }
                          })}
                        >
                          Ligne de séparation
                        </Button>
                        <Button
                          type="button"
                          variant={workingPreset.footer.showPageNumber ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => setWorkingPreset({
                            ...workingPreset,
                            footer: { ...workingPreset.footer, showPageNumber: !workingPreset.footer.showPageNumber }
                          })}
                        >
                          Numéro de page (P. X/Y)
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: LOGO & DIMENSIONS */}
            <TabsContent value="logo" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Gestion du Logo Institutionnel</CardTitle>
                  <CardDescription className="text-xs">
                    Le logo officiel INFOHAS est conservé par défaut. Vous pouvez téléverser un logo personnalisé (PNG, JPEG max 2 Mo).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo Source Selection */}
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant={workingPreset.logo.selectedLogo === 'infohas' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setWorkingPreset({
                        ...workingPreset,
                        logo: { ...workingPreset.logo, selectedLogo: 'infohas' }
                      })}
                      className="gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Logo officiel INFOHAS (Par défaut)
                    </Button>

                    <Button
                      type="button"
                      variant={workingPreset.logo.selectedLogo === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setWorkingPreset({
                        ...workingPreset,
                        logo: { ...workingPreset.logo, selectedLogo: 'custom' }
                      })}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Logo Personnalisé
                    </Button>
                  </div>

                  {/* Logo Upload Box */}
                  {workingPreset.logo.selectedLogo === 'custom' && (
                    <div className="p-4 border-2 border-dashed rounded-lg bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded border bg-white flex items-center justify-center overflow-hidden">
                          {workingPreset.logo.customLogoUrl ? (
                            <img
                              src={workingPreset.logo.customLogoUrl}
                              alt="Custom Logo"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Upload className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {workingPreset.logo.customLogoFilename || 'Aucun fichier sélectionné'}
                          </p>
                          <p className="text-xs text-muted-foreground">PNG ou JPEG (Max 2 Mo)</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('doc-logo-upload')?.click()}
                          disabled={uploadingLogo}
                          className="gap-1.5"
                        >
                          <Upload className="h-4 w-4" />
                          {uploadingLogo ? 'Chargement...' : 'Téléverser'}
                        </Button>
                        {workingPreset.logo.customLogoUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setWorkingPreset({
                              ...workingPreset,
                              logo: { ...workingPreset.logo, customLogoUrl: null, customLogoFilename: '' }
                            })}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <input
                          id="doc-logo-upload"
                          type="file"
                          accept="image/png, image/jpeg"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </div>
                    </div>
                  )}

                  {/* Logo Dimensions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Largeur du Logo ({workingPreset.logo.width} px)</Label>
                      <input
                        type="range"
                        min="50"
                        max="160"
                        step="5"
                        value={workingPreset.logo.width}
                        onChange={e => {
                          const w = Number(e.target.value);
                          setWorkingPreset({
                            ...workingPreset,
                            logo: {
                              ...workingPreset.logo,
                              width: w,
                              height: workingPreset.logo.preserveAspectRatio ? w : workingPreset.logo.height
                            }
                          });
                        }}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Hauteur du Logo ({workingPreset.logo.height} px)</Label>
                      <input
                        type="range"
                        min="50"
                        max="160"
                        step="5"
                        value={workingPreset.logo.height}
                        disabled={workingPreset.logo.preserveAspectRatio}
                        onChange={e => setWorkingPreset({
                          ...workingPreset,
                          logo: { ...workingPreset.logo, height: Number(e.target.value) }
                        })}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant={workingPreset.logo.preserveAspectRatio ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setWorkingPreset({
                        ...workingPreset,
                        logo: { ...workingPreset.logo, preserveAspectRatio: !workingPreset.logo.preserveAspectRatio }
                      })}
                      className="text-xs"
                    >
                      {workingPreset.logo.preserveAspectRatio ? 'Aspect ratio verrouillé (1:1)' : 'Dimensions libres'}
                    </Button>

                    <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
                      <Button
                        type="button"
                        variant={workingPreset.logo.alignment === 'left' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setWorkingPreset({
                          ...workingPreset,
                          logo: { ...workingPreset.logo, alignment: 'left' }
                        })}
                      >
                        <AlignLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant={workingPreset.logo.alignment === 'center' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setWorkingPreset({
                          ...workingPreset,
                          logo: { ...workingPreset.logo, alignment: 'center' }
                        })}
                      >
                        <AlignCenter className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant={workingPreset.logo.alignment === 'right' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setWorkingPreset({
                          ...workingPreset,
                          logo: { ...workingPreset.logo, alignment: 'right' }
                        })}
                      >
                        <AlignRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live Preview Column (Right 6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-600" />
                  <span>Aperçu Réel du Document (Mise en page A4)</span>
                </CardTitle>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Synchronisé en temps réel
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Cet aperçu reflète fidèlement la mise en page, les couleurs hexadécimales et la police appliquées dans les fichiers Word (.docx) et PDF finaux.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Paper Canvas (A4 simulation) */}
              <div
                className="bg-white text-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-md p-6 sm:p-8 min-h-[580px] flex flex-col justify-between text-xs select-none"
                style={{
                  fontFamily: workingPreset.heading.fontFamily || 'Times New Roman',
                }}
              >
                {/* Header Section: Left Logo + 3 Institutional lines + Right Accreditation Seal */}
                <div
                  className="flex items-start justify-between border-b-2 pb-4 mb-4"
                  style={{ borderColor: workingPreset.heading.borderColor || '#17365D' }}
                >
                  {/* Left: Logo and 3 Institutional Lines */}
                  <div
                    className="flex flex-col max-w-[65%]"
                    style={{
                      alignItems: workingPreset.logo.alignment === 'center' ? 'center' : workingPreset.logo.alignment === 'right' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <img
                      src={workingPreset.logo.selectedLogo === 'custom' && workingPreset.logo.customLogoUrl ? workingPreset.logo.customLogoUrl : '/infohas-logo.png'}
                      alt="Logo"
                      style={{
                        width: `${workingPreset.logo.width}px`,
                        height: `${workingPreset.logo.height}px`,
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    {workingPreset.heading.showInstitutionalHeading !== false && (
                      <div className="mt-2 text-left font-serif leading-tight">
                        <div className="font-bold text-[10px] text-zinc-900 tracking-wide uppercase">
                          {workingPreset.heading.institutionalName || 'INSTITUT PRIVE DE FORMATION'}
                        </div>
                        <div className="font-bold text-[9px] text-zinc-800 tracking-wide uppercase">
                          {workingPreset.heading.institutionalSubline1 || 'D’HOTESSES DE L’AIR ET STEWARDS'}
                        </div>
                        <div className="font-bold text-[9px] text-zinc-800 tracking-wide uppercase">
                          {workingPreset.heading.institutionalSubline2 || 'CABIN CREW TRAINING INSTITUTE'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Accreditation Seal */}
                  {workingPreset.heading.showSecondaryLogo !== false && (
                    <div className="flex flex-col items-end shrink-0">
                      <img
                        src="/accreditation-seal.jpg"
                        alt="Accréditation"
                        className="w-16 h-16 object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Certificate Body Begins */}
                {/* Upper-right Date immediately before title */}
                <div className="text-right font-sans text-[11px] mb-2">
                  <span className="font-bold text-zinc-800">DATE : </span>
                  <span className="font-bold text-zinc-800 underline decoration-dotted">16/10/2026</span>
                </div>

                {/* Heading Title */}
                <div
                  className="my-3"
                  style={{ textAlign: workingPreset.heading.alignment || 'center' }}
                >
                  <h1
                    style={{
                      color: workingPreset.heading.textColor || '#17365D',
                      fontSize: `${workingPreset.heading.fontSize}px`,
                      fontWeight: workingPreset.heading.bold ? 'bold' : 'normal',
                      fontStyle: workingPreset.heading.italic ? 'italic' : 'normal',
                      fontFamily: workingPreset.heading.fontFamily || 'Times New Roman',
                    }}
                    className={`inline-block uppercase tracking-wider ${workingPreset.heading.showBottomBorder ? 'border-b-2 pb-0.5' : ''}`}
                  >
                    {workingPreset.heading.text || 'ATTESTATION DE SCOLARITE'}
                  </h1>
                </div>

                {/* Body Content Simulation */}
                <div className="space-y-3 text-justify my-auto font-serif text-[11px] leading-relaxed">
                  <p className="font-bold">
                    JE SOUSSIGNÉE Mme M’ZIOUAD IMANE DIRECTRICE DE INFOHAS :
                  </p>
                  <p className="text-[10px] text-zinc-600 leading-snug">
                    ÉTABLISSEMENT DE FORMATION PROFESSIONNELLE PRIVÉ AUTORISÉ PAR LE MINISTÈRE DE LA FORMATION PROFESSIONNELLE SOUS LE N° 4/07/1997. ACCRÉDITATION N° 25/K0183/DFPP/45.
                  </p>
                  <p className="font-bold pt-1">
                    CERTIFIE QUE L’ÉLÈVE (OU STAGIAIRE) :
                  </p>

                  {/* Student Table */}
                  <div className="border border-zinc-300 rounded bg-zinc-50/50 p-2.5 space-y-1.5 text-[10px]">
                    <div className="flex justify-between border-b pb-1">
                      <span className="font-bold">Nom : <span className="font-semibold text-zinc-800">SAD</span></span>
                      <span className="font-bold">Prénom : <span className="font-semibold text-zinc-800">ZINEB</span></span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Né(e) le : 00/00/0000</span>
                      <span>À : RABAT</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>Nationalité : MAROCAINE</span>
                      <span>C.I.N : LG55372</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="font-bold">Année scolaire : 2025-2026</span>
                      <span className="font-bold">Année d'étude : 1ère Année</span>
                    </div>
                  </div>

                  <p className="text-[10px] pt-1">
                    En classe de : ATAM (Accueil dans les transports aériens et maritimes : Option hôtesse de l’air/steward)
                  </p>
                  <p className="text-[10px]">
                    La présente attestation lui est délivrée pour usage : ADMINISTRATIF
                  </p>

                  <div className="text-right pt-2 font-sans text-[10px]">
                    <p className="font-bold">Directrice de l’établissement</p>
                    <p className="text-zinc-700 font-semibold">Mme M’Ziouad Imane</p>
                    <div className="h-14 flex items-center justify-end pt-1">
                      <img
                        src="/signature-cachet.png"
                        alt="Cachet et Signature"
                        className="h-14 w-auto object-contain opacity-90"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Section */}
                <div className="pt-3 mt-4">
                  {workingPreset.footer.showSeparatorLine && (
                    <div
                      className="border-t mb-2"
                      style={{ borderColor: workingPreset.footer.separatorColor || '#CBD5E1' }}
                    />
                  )}
                  <div
                    className="text-[9px] leading-snug whitespace-pre-line"
                    style={{
                      color: workingPreset.footer.textColor || '#64748B',
                      textAlign: workingPreset.footer.alignment || 'center',
                      fontFamily: workingPreset.footer.fontFamily || 'Calibri',
                    }}
                  >
                    {workingPreset.footer.text}
                  </div>
                  {workingPreset.footer.showPageNumber && (
                    <div className="text-right text-[8px] text-zinc-400 mt-1">
                      Page 1 / 1
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
