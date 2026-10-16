'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link2, Copy, Check, MessageCircle, Shield, Smartphone, ArrowRight, UserCheck } from 'lucide-react';
import type { Student } from '@/lib/types';

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

  if (!student) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://crm-attendance.pages.dev';
  const magicUrl = `${origin}/?page=parent-portal&std=${encodeURIComponent(student.id)}&ref=magic`;
  const rawPhone = student.guardianPhone || student.phone || '';
  const digitsOnly = rawPhone.replace(/\D/g, '');
  const cleanPhone = digitsOnly.startsWith('0') ? '212' + digitsOnly.slice(1) : digitsOnly;
  const pinDisplay = rawPhone || 'Numéro de mobile non renseigné';

  const frenchWhatsAppMessage = `*INSTITUT SUPÉRIEUR INFOHAS — ESPACE PARENTAL SÉCURISÉ*

Bonjour ${student.guardianName || 'Madame, Monsieur'},

La direction de l'Institut INFOHAS met à votre disposition votre portail parental pour suivre en direct l'assiduité et la scolarité de votre enfant *${student.fullName}* (Classe : ${student.className || student.group || 'Non assignée'}).

🔗 *Votre Lien d'Accès Direct (Magic Link) :*
${magicUrl}

🔒 *Votre Code PIN de Sécurité :*
*${pinDisplay}* (votre numéro de téléphone portable enregistré)

*Grâce à votre espace sécurisé, vous pouvez :*
1️⃣ *Suivi d'assiduité en temps réel :* Consulter les présences, retards et absences enregistrés à chaque séance.
2️⃣ *Dépôt de justificatifs en ligne :* Téléverser directement un certificat médical ou motif d'absence (photo ou PDF).
3️⃣ *Suivi administratif :* Vérifier la validation par la direction des études.

*Mode d'emploi simple :*
1. Cliquez sur le lien magique ci-dessus.
2. Entrez votre numéro de téléphone portable (${pinDisplay}) comme code PIN pour déverrouiller l'accès.
3. Vous accédez immédiatement au relevé officiel de votre enfant.

Restant à votre entière disposition pour tout renseignement complémentaire,
_Direction Pédagogique — Institut Supérieur INFOHAS_`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(magicUrl);
    setCopiedLink(true);
    toast.success('Lien magique copié dans le presse-papiers !');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(frenchWhatsAppMessage);
    setCopiedMsg(true);
    toast.success('Message explicatif complet copié !');
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!digitsOnly) {
      toast.error('Aucun numéro de téléphone enregistré pour ce dossier.');
      return;
    }
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(frenchWhatsAppMessage)}`;
    window.open(waUrl, '_blank');
    toast.success('Redirection vers WhatsApp en cours...');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
              <Link2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base">Magic Link Parent — Accès Sécurisé</DialogTitle>
              <DialogDescription className="text-xs">
                Génération de l'accès direct et instructions WhatsApp pour les tuteurs légaux.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Student Profile Card */}
          <div className="p-3 bg-muted/60 rounded-xl border border-border flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-foreground">{student.fullName}</div>
              <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px]">{student.className || 'Sans classe'}</Badge>
                <span>• Matricule : {student.studentId || 'N/A'}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">Tuteur :</div>
              <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                {student.guardianName || 'Parent / Tuteur'}
              </div>
            </div>
          </div>

          {/* Security PIN Display */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
              <Shield className="h-4 w-4 text-emerald-600" />
              Sécurisation par Code PIN (Numéro de Mobile)
            </div>
            <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
              Pour déverrouiller ce lien, le parent doit obligatoirement saisir son numéro de mobile enregistré comme code PIN :
            </p>
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" />
                {pinDisplay}
              </span>
              <Badge variant="secondary" className="text-[10px]">PIN Requis</Badge>
            </div>
          </div>

          {/* Magic URL Field */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Lien Magique Direct</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={magicUrl}
                className="text-xs font-mono bg-muted/30 select-all"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-1 shrink-0 h-9"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? 'Copié' : 'Copier'}
              </Button>
            </div>
          </div>

          {/* WhatsApp Message Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Message d'explication en Français (WhatsApp)</Label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
              >
                {copiedMsg ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                Copier le texte du message
              </button>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border border-border text-[11px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap font-sans text-muted-foreground">
              {frenchWhatsAppMessage}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenWhatsApp}
            disabled={!digitsOnly}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm font-medium"
          >
            <MessageCircle className="h-4 w-4" />
            Envoyer par WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
