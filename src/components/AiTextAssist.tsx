'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, Copy, RefreshCw, Wand2, ArrowRight } from 'lucide-react';
import { getApiToken } from '@/lib/api';
import { toast } from 'sonner';

export interface AiTextAssistProps {
  value: string;
  onApply: (newText: string) => void;
  contextPrompt?: string;
  placeholder?: string;
  buttonClassName?: string;
  size?: 'default' | 'sm' | 'icon';
  label?: string;
}

export function AiTextAssist({
  value,
  onApply,
  contextPrompt = 'Champ de saisie textuelle administratif',
  placeholder,
  buttonClassName = '',
  size = 'sm',
  label = 'Assistant IA',
}: AiTextAssistProps) {
  const [open, setOpen] = useState(false);
  const [currentInput, setCurrentInput] = useState(value || '');
  const [instruction, setInstruction] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);

  const presets = [
    { label: '🪄 Améliorer le style', prompt: 'Reformule ce texte de manière professionnelle, fluide et élégante pour un établissement d’enseignement supérieur.' },
    { label: '🏫 Format officiel INFOHAS', prompt: 'Adapte ce texte au style administratif formel, strict et conforme au règlement intérieur de l’Institut INFOHAS.' },
    { label: '✍️ Corriger orthographe', prompt: 'Corrige toutes les fautes d’orthographe, de grammaire et de ponctuation tout en préservant le sens exact.' },
    { label: '💬 Message WhatsApp courtois', prompt: 'Rédige sous forme de message WhatsApp poli, clair et direct à destination d’un parent ou étudiant.' },
    { label: '📋 Résumer', prompt: 'Résume ce texte en 1 ou 2 phrases concises et percutantes.' },
    { label: '🇲🇦 Traduire en Arabe', prompt: 'Traduis fidèlement ce texte en Arabe littéraire soigné.' },
  ];

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setCurrentInput(value || '');
      setGeneratedText('');
      setInstruction('');
    }
  };

  const handleGenerate = async (customInstruction?: string) => {
    const finalInstruction = customInstruction || instruction || 'Améliore ce texte de façon professionnelle';
    setLoading(true);
    setGeneratedText('');

    const token = getApiToken() || '';
    const fullPrompt = `Tu es l'Assistant IA Pédagogique de l'Institut Supérieur INFOHAS.
Contexte d'utilisation : ${contextPrompt}.

Texte source :
"""
${currentInput.trim() || '(Aucun texte fourni, génère directement une formulation adaptée)'}
"""

Consigne spécifique :
${finalInstruction}

Réponds DIRECTEMENT avec le texte final prêt à être inséré, sans commentaires d'introduction ni guillemets.`;

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          task: 'custom',
          prompt: fullPrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la génération IA');
      }

      setGeneratedText(data.result);
      toast.success('Texte généré par l\'Autopilot !');
    } catch (err: any) {
      toast.error(err.message || 'Échec de génération');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedText) return;
    onApply(generatedText);
    toast.success('Texte appliqué au champ !');
    setOpen(false);
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    toast.success('Copié dans le presse-papiers.');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {size === 'icon' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 ${buttonClassName}`}
            title="Assistant IA Autopilot (Rédaction & Reformulation)"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`gap-1.5 text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-900/60 dark:hover:bg-blue-950/40 ${buttonClassName}`}
          >
            <Sparkles className="h-3 w-3" />
            <span>{label}</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <span className="p-1 rounded bg-blue-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            Assistant IA Autopilot — Rédaction & Aide à la saisie
          </DialogTitle>
          <DialogDescription className="text-xs">
            Générez, reformulez ou traduisez instantanément vos notes, observations et messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Quick presets */}
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">Actions rapides :</div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleGenerate(p.prompt)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-muted hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-blue-950 dark:hover:text-blue-300 border border-border transition-colors disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Source Text */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Texte de base / brouillon :</label>
            <Textarea
              value={currentInput}
              onChange={e => setCurrentInput(e.target.value)}
              placeholder={placeholder || 'Saisissez vos mots-clés ou le texte à améliorer...'}
              className="text-xs min-h-[60px]"
            />
          </div>

          {/* Custom Instruction */}
          <div className="flex gap-2 items-center">
            <Input
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="Ou consigne personnalisée (ex: 'Rendre plus courtois', 'Mentionner le certificat')..."
              className="text-xs h-8"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => handleGenerate()}
              disabled={loading}
              className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0"
            >
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Générer
            </Button>
          </div>

          {/* Generated Result Box */}
          {generatedText && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Proposition de l'IA :
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 text-[10px] gap-1 text-muted-foreground"
                >
                  <Copy className="h-3 w-3" /> Copier
                </Button>
              </div>
              <div className="p-3 bg-muted/60 rounded-md border border-border text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                {generatedText}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Fermer
          </Button>
          {generatedText && (
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              Remplacer dans le champ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
