'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Link2,
  Copy,
  Check,
  MessageCircle,
  Shield,
  Smartphone,
  ExternalLink,
  Eye,
  FileText,
  UserCheck,
  CheckCheck,
} from 'lucide-react';
import type { Student } from '@/lib/types';
import {
  normalizeWhatsAppPhone,
  formatPhoneDisplay,
  buildWhatsAppUrl,
  buildParentMagicLinkMessage,
  parseWhatsAppForPreview,
  validateWhatsAppUrl,
} from '@/lib/whatsapp';

export interface ParentMagicLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
}

export function ParentMagicLinkDialog({
  open,
  onOpenChange,
  student,
}: ParentMagicLinkDialogProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [phoneOverride, setPhoneOverride] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'realistic' | 'raw'>('realistic');

  // Sync phone on student change
  const initialPhone = student?.guardianPhone || student?.phone || '';
  const currentPhone = phoneOverride || initialPhone;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://crm-attendance.pages.dev';
  const magicUrl = student ? `${origin}/?page=parent-portal&std=${encodeURIComponent(student.id)}&ref=magic` : '';

  const pinDisplay = currentPhone || 'Numéro de mobile non renseigné';
  const cleanPhone = normalizeWhatsAppPhone(currentPhone);
  const isPhoneValid = cleanPhone.length >= 9;

  const whatsappMessage = useMemo(() => {
    if (!student) return '';
    return buildParentMagicLinkMessage({
      student,
      magicUrl,
      pinDisplay,
      schoolName: 'Institut Supérieur INFOHAS',
    });
  }, [student, magicUrl, pinDisplay]);

  const waUrl = useMemo(() => {
    if (!cleanPhone || !whatsappMessage) return '';
    return buildWhatsAppUrl(cleanPhone, whatsappMessage);
  }, [cleanPhone, whatsappMessage]);

  const validation = useMemo(() => {
    if (!waUrl || !whatsappMessage) return { valid: false, errors: [] };
    return validateWhatsAppUrl(waUrl, whatsappMessage);
  }, [waUrl, whatsappMessage]);

  const previewSegments = useMemo(() => {
    return parseWhatsAppForPreview(whatsappMessage);
  }, [whatsappMessage]);

  if (!student) return null;

  const handleCopyLink = () => {
    if (!magicUrl) return;
    navigator.clipboard.writeText(magicUrl);
    setCopiedLink(true);
    toast.success('Lien magique copié dans le presse-papiers !');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    if (!whatsappMessage) return;
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedMsg(true);
    toast.success('Message WhatsApp formaté copié (prêt à coller) !');
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!isPhoneValid) {
      toast.error('Veuillez renseigner un numéro de téléphone valide avant d\'ouvrir WhatsApp.');
      return;
    }
    if (!waUrl) return;

    window.open(waUrl, '_blank');
    toast.success('Ouverture de WhatsApp Web / Mobile en cours...');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
              <Link2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                Magic Link Parent — Espace Sécurisé
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                  PIN Mobile
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Génération de l'accès direct et invitation WhatsApp officielle pour les tuteurs légaux.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-xs overflow-y-auto pr-1">
          {/* Student Profile Card */}
          <div className="p-3 bg-muted/50 rounded-xl border border-border flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-2">
                {student.fullName}
                <Badge variant="outline" className="text-[10px] font-normal">
                  {student.className || student.group || 'Sans classe'}
                </Badge>
              </div>
              <div className="text-muted-foreground text-[11px] mt-0.5">
                Matricule : <span className="font-mono font-medium">{student.studentId || student.id}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Tuteur / Destinataire</div>
              <div className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
                {student.guardianName || 'Parent / Tuteur'}
              </div>
            </div>
          </div>

          {/* Phone Number Verification & PIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                  Numéro Tuteur (WhatsApp & PIN)
                </Label>
                {isPhoneValid ? (
                  <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4">
                    +{cleanPhone}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                    Invalide
                  </Badge>
                )}
              </div>
              <Input
                value={currentPhone}
                onChange={(e) => setPhoneOverride(e.target.value)}
                placeholder="Ex: 06 12 34 56 78 ou 212612345678"
                className="h-8 text-xs bg-white dark:bg-zinc-900 font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Affichage normalisé : <span className="font-semibold">{formatPhoneDisplay(currentPhone)}</span>
              </p>
            </div>

            <div className="p-2.5 bg-muted/60 border border-border rounded-xl space-y-1 flex flex-col justify-between">
              <div>
                <Label className="text-[11px] font-semibold flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" />
                  Code PIN de Sécurité Requis
                </Label>
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                  Le tuteur doit saisir ce numéro exact pour déverrouiller l'accès à son espace.
                </p>
              </div>
              <div className="font-mono font-bold text-xs bg-background px-2.5 py-1 rounded border border-border text-foreground flex items-center justify-between">
                <span>{pinDisplay}</span>
                <span className="text-[10px] text-emerald-600 font-sans font-medium">Protection active</span>
              </div>
            </div>
          </div>

          {/* Magic Direct URL with Copy Button */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Lien Magique Direct (Paramètres intégrés)</Label>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                {copiedLink ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copiedLink ? 'Lien copié !' : 'Copier le lien'}
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                readOnly
                value={magicUrl}
                className="text-xs font-mono bg-muted/30 select-all h-8 text-muted-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-1 shrink-0 h-8 text-xs"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? 'Copié' : 'Copier'}
              </Button>
            </div>
          </div>

          {/* WhatsApp Message Preview with Live Realistic Rendering */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Aperçu du Message WhatsApp
                </Label>
                {validation.valid && (
                  <Badge variant="outline" className="text-[9px] text-emerald-700 bg-emerald-50 border-emerald-300">
                    Format 100% WhatsApp • UTF-8 intact
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
                <Button
                  type="button"
                  variant={previewMode === 'realistic' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-[10px] px-2 py-0"
                  onClick={() => setPreviewMode('realistic')}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Rendu Réel
                </Button>
                <Button
                  type="button"
                  variant={previewMode === 'raw' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-[10px] px-2 py-0"
                  onClick={() => setPreviewMode('raw')}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Texte Brut
                </Button>
              </div>
            </div>

            {previewMode === 'realistic' ? (
              /* Realistic WhatsApp Chat Bubble Container */
              <div className="rounded-xl border border-border overflow-hidden bg-zinc-100 dark:bg-zinc-950 shadow-inner">
                {/* Chat Top Bar */}
                <div className="bg-[#075E54] dark:bg-[#1F2C34] text-white px-3 py-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/30 flex items-center justify-center font-bold text-[10px]">
                      {student.guardianName ? student.guardianName[0] : 'P'}
                    </div>
                    <div>
                      <div className="font-semibold text-[11px] leading-tight">
                        {student.guardianName || 'Parent / Tuteur légal'}
                      </div>
                      <div className="text-[9px] text-emerald-200/90 leading-tight">
                        {formatPhoneDisplay(currentPhone)}
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-emerald-700/60 text-white text-[9px] font-normal border-0">
                    WhatsApp Web / Mobile
                  </Badge>
                </div>

                {/* Message Bubble Body */}
                <div className="p-3 bg-[#EFEAE2] dark:bg-[#0B141A] max-h-56 overflow-y-auto">
                  <div className="bg-[#FFFFFF] dark:bg-[#005C4B] rounded-lg p-3 text-[11px] leading-relaxed shadow-sm text-foreground max-w-[95%] relative border border-emerald-950/5">
                    <div className="whitespace-pre-wrap font-sans">
                      {previewSegments.map((seg, idx) => {
                        if (seg.type === 'bold') {
                          return (
                            <strong key={idx} className="font-bold text-foreground">
                              {seg.content}
                            </strong>
                          );
                        }
                        if (seg.type === 'italic') {
                          return (
                            <em key={idx} className="italic text-foreground/90">
                              {seg.content}
                            </em>
                          );
                        }
                        if (seg.type === 'strike') {
                          return (
                            <del key={idx} className="line-through text-muted-foreground">
                              {seg.content}
                            </del>
                          );
                        }
                        if (seg.type === 'link') {
                          return (
                            <a
                              key={idx}
                              href={seg.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-300 underline font-medium hover:text-blue-800 break-all inline-flex items-center gap-0.5"
                            >
                              {seg.content}
                              <ExternalLink className="h-2.5 w-2.5 inline shrink-0" />
                            </a>
                          );
                        }
                        if (seg.type === 'code') {
                          return (
                            <code key={idx} className="font-mono bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                              {seg.content}
                            </code>
                          );
                        }
                        return <span key={idx}>{seg.content}</span>;
                      })}
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-muted-foreground">
                      <span>{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCheck className="h-3 w-3 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Raw Plain Text Mode */
              <div className="p-3 bg-muted/40 rounded-xl border border-border text-[11px] leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap font-mono text-foreground">
                {whatsappMessage}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border mt-1">
          <div className="flex items-center gap-2 mr-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyMessage}
              className="gap-1.5 text-xs h-9"
            >
              {copiedMsg ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedMsg ? 'Texte copié !' : 'Copier le message'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 text-xs"
            >
              Fermer
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenWhatsApp}
              disabled={!isPhoneValid}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm font-semibold h-9 px-4"
            >
              <MessageCircle className="h-4 w-4" />
              Ouvrir dans WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
