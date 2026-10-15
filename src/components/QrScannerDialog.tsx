'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, QrCode, AlertCircle, Volume2, Camera, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import type { Student, Class, AttendanceRecord } from '@/lib/types';
import { useAppStore, saveAttendanceDirectly } from '@/lib/store';

function playSuccessBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15); // A6 note
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: string;
  targetDate?: string;
  onStudentScanned?: (student: Student, record: AttendanceRecord) => void;
}

export function QrScannerDialog({ open, onOpenChange, selectedDate, targetDate, onStudentScanned }: QrScannerDialogProps) {
  const { students, classes, attendance, language } = useAppStore();
  const isFr = language === 'fr';
  const effectiveDate = targetDate || selectedDate || new Date().toISOString().split('T')[0];

  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [scanTimestamp, setScanTimestamp] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(false);

  const scannerRef = useRef<unknown>(null);
  const cooldownRef = useRef(false);

  const handleScanSuccess = async (decodedText: string) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    try {
      let targetCode = decodedText.trim();
      // Try parsing JSON payload if badge encoded JSON
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.sid) targetCode = String(parsed.sid).trim();
        else if (parsed.id) targetCode = String(parsed.id).trim();
      } catch {}

      const found = students.find(s =>
        s.studentId?.toLowerCase() === targetCode.toLowerCase() ||
        s.id === targetCode ||
        (s.fullName && s.fullName.toLowerCase() === targetCode.toLowerCase())
      );

      if (!found) {
        toast.error(isFr ? `Badge non reconnu: "${targetCode}"` : `Unrecognized badge: "${targetCode}"`);
        setTimeout(() => { cooldownRef.current = false; }, 1500);
        return;
      }

      playSuccessBeep();
      const nowIso = new Date().toISOString();
      const arrival = new Date().toLocaleTimeString();
      setScannedStudent(found);
      setScanTimestamp(arrival);

      // Record attendance immediately
      const canonicalId = `att_${found.id}_${effectiveDate}`;
      const existing = attendance.find(a => a.studentId === found.id && a.date === effectiveDate);
      const newRec: AttendanceRecord = {
        ...(existing || { id: canonicalId, studentId: found.id, date: effectiveDate, createdAt: nowIso }),
        id: canonicalId,
        status: 'present',
        arrivalTime: arrival,
        notes: (existing?.notes ? `${existing.notes} | ` : '') + `[Scanner QR: ${arrival}]`,
      };

      const otherRecs = attendance.filter(a => !(a.studentId === found.id && a.date === effectiveDate));
      await saveAttendanceDirectly([...otherRecs, newRec]);

      if (onStudentScanned) {
        onStudentScanned(found, newRec);
      }

      toast.success(
        isFr
          ? `✅ ${found.fullName} (${found.studentId}) marqué(e) Présent(e) à ${arrival}`
          : `✅ ${found.fullName} (${found.studentId}) marked Present at ${arrival}`
      );
    } catch (e) {
      console.error('Scan handling error:', e);
    } finally {
      setTimeout(() => { cooldownRef.current = false; }, 2000);
    }
  };

  // Lifecycle: initialize and stop html5-qrcode
  useEffect(() => {
    if (!open) {
      if (scannerRef.current) {
        try {
          // @ts-expect-error dynamic cleanup
          scannerRef.current.clear?.().catch?.(() => {});
        } catch {}
        scannerRef.current = null;
      }
      setIsScanningActive(false);
      setScannedStudent(null);
      setCameraError(null);
      return;
    }

    let isMounted = true;

    async function initCamera() {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        if (!isMounted) return;

        const scanner = new Html5QrcodeScanner(
          'qr-video-reader',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
          },
          /* verbose= */ false
        );

        scannerRef.current = scanner;
        scanner.render(
          (text) => handleScanSuccess(text),
          () => {
            // Frame error (silently ignore until code is in frame)
          }
        );
        setIsScanningActive(true);
      } catch (err) {
        if (!isMounted) return;
        console.warn('Camera scanner initialization notice:', err);
        setCameraError(
          isFr
            ? 'Caméra inaccessible ou permission refusée. Vous pouvez utiliser le lecteur code-barres / saisie manuelle ci-dessous.'
            : 'Camera unavailable or permission denied. You can use manual entry or barcode scanner gun below.'
        );
      }
    }

    const timer = setTimeout(() => { initCamera(); }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          // @ts-expect-error dynamic cleanup
          scannerRef.current.clear?.().catch?.(() => {});
        } catch {}
        scannerRef.current = null;
      }
    };
  }, [open]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScanSuccess(manualCode);
    setManualCode('');
  };

  const studentClass = scannedStudent ? classes.find(c => c.id === scannedStudent.classId) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[96vw] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isFr ? 'Scanner de Présence (QR Code / Badge)' : 'Attendance QR Badge Scanner'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isFr
                  ? `Session du ${effectiveDate} — Passez les badges d'étudiants devant la caméra`
                  : `Session of ${effectiveDate} — Hold student badges in front of the camera`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Live Feedback Card */}
        {scannedStudent && (
          <div className="p-3.5 rounded-xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-emerald-600 flex items-center justify-center text-white text-base font-bold shrink-0">
              {scannedStudent.photo ? (
                <img src={scannedStudent.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                scannedStudent.fullName.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-emerald-900 dark:text-emerald-300 truncate">
                  {scannedStudent.fullName}
                </span>
                <Badge variant="outline" className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                  {scannedStudent.studentId}
                </Badge>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {studentClass?.name || scannedStudent.className || 'Classe'} &bull;{' '}
                <span className="font-semibold">{isFr ? 'Heure d\'arrivée' : 'Arrival'}: {scanTimestamp}</span>
              </p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
          </div>
        )}

        {/* Video Scanner Container */}
        <div className="relative rounded-xl overflow-hidden border bg-black/5 dark:bg-black/40 min-h-[260px] flex flex-col items-center justify-center">
          <div id="qr-video-reader" className="w-full" />
          {cameraError && (
            <div className="p-4 text-center text-xs text-amber-700 dark:text-amber-400 flex flex-col items-center gap-1.5">
              <AlertCircle className="h-5 w-5" />
              <p>{cameraError}</p>
            </div>
          )}
        </div>

        {/* Manual Input / Barcode Scanner Gun Fallback */}
        <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Keyboard className="h-3.5 w-3.5" />
              {isFr ? 'Lecteur code-barre USB ou saisie manuelle' : 'USB Barcode gun or manual typing'}
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <Volume2 className="h-3 w-3 text-emerald-600" />
              {isFr ? 'Bip sonore actif' : 'Audio chime enabled'}
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder={isFr ? "Entrez le matricule (ex: F01/26)..." : "Enter student ID (e.g. F01/26)..."}
              className="text-sm"
              autoFocus
            />
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
              {isFr ? 'Valider' : 'Submit'}
            </Button>
          </div>
        </form>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isFr ? 'Fermer' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
