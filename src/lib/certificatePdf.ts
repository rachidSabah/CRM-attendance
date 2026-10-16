/**
 * INFOHAS Attendance — Official Certificate PDF Generator
 *
 * Implements high-fidelity vector PDF generation matching:
 * 1. Reference PDF: `C:\Users\piopi\Downloads\TEST_DESIGN_Certificat_Officiel_INFOHAS.pdf`
 * 2. Reference DOCX: `C:\Users\piopi\Downloads\TEST_DESIGN_Certificat_Officiel_INFOHAS_Certificat_Scolarite_SAD_ZINEB_2025-2026 (1).docx`
 *
 * Sequence:
 * 1. Institutional Heading with configured logos (Left: INFOHAS/Custom, Right: Accreditation Seal)
 *    and bilingual official text:
 *    INSTITUT PRIVE DE FORMATION
 *    D’HOTESSES DE L’AIR ET STEWARDS
 *    CABIN CREW TRAINING INSTITUTE
 * 2. Certificate body begins.
 * 3. Issue Date aligned to upper-right side (immediately before title).
 * 4. ATTESTATION DE SCOLARITÉ title centered with configured colors, fonts, and underline.
 * 5. Legal preamble and official student data table.
 * 6. Delivery usage and Directrice signature block with cachet.
 * 7. Configured institutional footer with separator line.
 */

import jsPDF from 'jspdf';
import type { CertificateData } from './docxGenerator';
import type { DocumentDesignPreset } from './documentDesignTypes';
import { sanitizeFilename } from './docxGenerator';

export interface CertificatePdfAssets {
  logoDataUrl?: string | null;
  sealDataUrl?: string | null;
  signatureDataUrl?: string | null;
}

/**
 * Converts a hex color string (#17365D) to RGB numbers [23, 54, 93].
 */
export function hexToRgb(hex: string, fallback: [number, number, number] = [23, 54, 93]): [number, number, number] {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? fallback : [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? fallback : [r, g, b];
  }
  return fallback;
}

/**
 * Loads image as Base64 Data URL (supports both browser fetch and Node.js fs).
 */
async function loadImageDataUrl(urlOrPath: string): Promise<string | null> {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('data:')) return urlOrPath;

  // Browser environment
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(urlOrPath);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // Node.js environment fallback
  if (typeof window === 'undefined') {
    try {
      const nodeRequire = eval('require');
      const fs = nodeRequire('fs');
      const path = nodeRequire('path');
      let fullPath = urlOrPath;
      if (!path.isAbsolute(fullPath)) {
        fullPath = path.join(process.cwd(), urlOrPath.replace(/^\//, 'public/'));
      }
      if (fs.existsSync(fullPath)) {
        const ext = path.extname(fullPath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        const buf = fs.readFileSync(fullPath);
        return `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Generate official certificate PDF matching the customized design preset and official DOCX layout.
 */
export async function generateCertificatePdf(
  data: CertificateData,
  designConfig?: DocumentDesignPreset,
  customAssets?: CertificatePdfAssets
): Promise<{ pdfBlob: Blob; pdfBuffer: Uint8Array; filename: string; doc: jsPDF }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 18; // 18mm margins

  // Colors
  const headingRgb = hexToRgb(designConfig?.heading?.textColor || '#17365D', [23, 54, 93]);
  const footerRgb = hexToRgb(designConfig?.footer?.textColor || '#475569', [71, 85, 105]);

  // Fonts mapping for jsPDF
  const requestedFont = (designConfig?.heading?.fontFamily || 'Times New Roman').toLowerCase();
  let titleFont = 'times';
  if (requestedFont.includes('arial') || requestedFont.includes('calibri') || requestedFont.includes('montserrat')) {
    titleFont = 'helvetica';
  } else if (requestedFont.includes('times') || requestedFont.includes('georgia') || requestedFont.includes('garamond')) {
    titleFont = 'times';
  }

  // ----------------------------------------------------
  // 1. INSTITUTIONAL HEADER WITH LOGOS
  // ----------------------------------------------------
  // Load Left Logo (INFOHAS or Custom)
  let leftLogoData = customAssets?.logoDataUrl;
  if (!leftLogoData) {
    if (designConfig?.logo?.selectedLogo === 'custom' && designConfig.logo.customLogoUrl) {
      leftLogoData = designConfig.logo.customLogoUrl;
    } else {
      leftLogoData = await loadImageDataUrl('/infohas-logo.png');
    }
  }

  // Load Right Logo (Official Accreditation Seal)
  let rightSealData = customAssets?.sealDataUrl;
  if (!rightSealData && designConfig?.heading?.showSecondaryLogo !== false) {
    rightSealData = await loadImageDataUrl('/accreditation-seal.jpg');
  }

  // Render Left Logo (INFOHAS or custom)
  const logoWidthMm = Math.min(55, Math.max(20, (designConfig?.logo?.width || 85) * 0.264583));
  const logoHeightMm = Math.min(22, Math.max(10, (designConfig?.logo?.height || 85) * 0.264583));

  if (leftLogoData) {
    try {
      const format = leftLogoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(leftLogoData, format, marginX, 10, logoWidthMm, logoHeightMm);
    } catch (e) {
      console.warn('Failed to render left logo:', e);
    }
  }

  // Render Right Logo (Accreditation Seal)
  if (rightSealData && designConfig?.heading?.showSecondaryLogo !== false) {
    try {
      const format = rightSealData.includes('image/png') ? 'PNG' : 'JPEG';
      const sealW = 22;
      const sealH = 22;
      doc.addImage(rightSealData, format, pageWidth - marginX - sealW, 10, sealW, sealH);
    } catch (e) {
      console.warn('Failed to render right seal:', e);
    }
  }

  // Render Institutional Text (Left side, directly below logo matching official Word layout)
  if (designConfig?.heading?.showInstitutionalHeading !== false) {
    const instLine1 = designConfig?.heading?.institutionalName || 'INSTITUT PRIVE DE FORMATION';
    const instLine2 = designConfig?.heading?.institutionalSubline1 || 'D’HOTESSES DE L’AIR ET STEWARDS';
    const instLine3 = designConfig?.heading?.institutionalSubline2 || 'CABIN CREW TRAINING INSTITUTE';

    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(headingRgb[0], headingRgb[1], headingRgb[2]);

    const instStartY = 10 + logoHeightMm + 4;
    doc.text(instLine1, marginX, instStartY);
    doc.text(instLine2, marginX, instStartY + 4.5);
    doc.text(instLine3, marginX, instStartY + 9);
  }

  // Optional Header Separator line
  if (designConfig?.heading?.showSeparatorLine !== false) {
    doc.setDrawColor(203, 213, 225); // #CBD5E1
    doc.setLineWidth(0.4);
    doc.line(marginX, 42, pageWidth - marginX, 42);
  }

  // ----------------------------------------------------
  // 2. CERTIFICATE BODY: UPPER-RIGHT ISSUE DATE
  // ----------------------------------------------------
  // Requirement 4: The issue date must NOT appear in the heading beside the logo.
  // Move date out of header and place it at the upper-right of certificate body,
  // immediately before ATTESTATION DE SCOLARITÉ.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59); // Slate-800
  const dateText = `DATE : ${data.dateDelivrance || '16/10/2026'}`;
  doc.text(dateText, pageWidth - marginX, 50, { align: 'right' });

  // ----------------------------------------------------
  // 3. CERTIFICATE TITLE (ATTESTATION DE SCOLARITÉ)
  // ----------------------------------------------------
  const headingText = (!designConfig?.heading?.isTextLocked && designConfig?.heading?.text)
    ? designConfig.heading.text
    : 'ATTESTATION DE SCOLARITE';

  const titleSz = designConfig?.heading?.fontSize || 18;
  const isBold = designConfig?.heading?.bold !== false;
  const isItalic = !!designConfig?.heading?.italic;
  let fontStyle = 'normal';
  if (isBold && isItalic) fontStyle = 'bolditalic';
  else if (isBold) fontStyle = 'bold';
  else if (isItalic) fontStyle = 'italic';

  doc.setFont(titleFont, fontStyle);
  doc.setFontSize(titleSz);
  doc.setTextColor(headingRgb[0], headingRgb[1], headingRgb[2]);

  const titleAlign = designConfig?.heading?.alignment || 'center';
  let titleX = pageWidth / 2;
  if (titleAlign === 'left') titleX = marginX;
  else if (titleAlign === 'right') titleX = pageWidth - marginX;

  doc.text(headingText, titleX, 62, { align: titleAlign });

  // Title underline
  if (designConfig?.heading?.showBottomBorder !== false) {
    const textWidth = doc.getTextWidth(headingText);
    const startU = titleAlign === 'center' ? titleX - textWidth / 2 : (titleAlign === 'left' ? titleX : titleX - textWidth);
    doc.setDrawColor(headingRgb[0], headingRgb[1], headingRgb[2]);
    doc.setLineWidth(0.6);
    doc.line(startU, 65, startU + textWidth, 65);
  }

  // ----------------------------------------------------
  // 4. OFFICIAL LEGAL PREAMBLE
  // ----------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`JE SOUSSIGNÉE ${data.directrice || 'Mme M’ZIOUAD IMANE'} DIRECTRICE DE INFOHAS :`, marginX, 74);

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // Slate-600
  const legalText = "ÉTABLISSEMENT DE FORMATION PROFESSIONNELLE PRIVÉ AUTORISÉ PAR LE MINISTÈRE DE LA FORMATION PROFESSIONNELLE SOUS LE N° 4/07/1997. ACCRÉDITATION N° 25/K0183/DFPP/45.";
  const legalLines = doc.splitTextToSize(legalText, pageWidth - marginX * 2);
  doc.text(legalLines, marginX, 80);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("CERTIFIE QUE L’ÉLÈVE :", marginX, 90);
  doc.setLineWidth(0.3);
  doc.line(marginX, 91.5, marginX + 44, 91.5);

  // ----------------------------------------------------
  // 5. OFFICIAL STUDENT DATA TABLE / BOX
  // ----------------------------------------------------
  const tableY = 96;
  const tableW = pageWidth - marginX * 2;
  const tableH = 64;

  doc.setDrawColor(203, 213, 225); // #CBD5E1
  doc.setFillColor(248, 250, 252); // #F8FAFC
  doc.setLineWidth(0.4);
  doc.rect(marginX, tableY, tableW, tableH, 'FD');

  // Rows inside table
  const col1X = marginX + 5;
  const col2X = marginX + (tableW / 2) + 2;

  // Row 1: Nom & Prénom
  let currY = tableY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Nom", col1X, currY);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${data.nom}`, col1X + 26, currY);

  doc.setFont('helvetica', 'bold');
  doc.text("Prénom", col2X, currY);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${data.prenom}`, col2X + 26, currY);

  // Row 2: Date de naissance & Lieu
  currY += 10;
  doc.setFont('helvetica', 'bold');
  doc.text("Né (e) le", col1X, currY);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${data.dateNaissance || '00/00/0000'}`, col1X + 26, currY);

  doc.setFont('helvetica', 'bold');
  doc.text("À", col2X, currY);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${data.lieuNaissance || 'RABAT'}`, col2X + 26, currY);

  // Row 3: Domicile
  currY += 10;
  doc.setFont('helvetica', 'bold');
  doc.text("Domicile", col1X, currY);
  doc.setFont('helvetica', 'normal');
  const domLines = doc.splitTextToSize(`:   ${data.domicile || 'RABAT'}`, tableW - 35);
  doc.text(domLines, col1X + 26, currY);

  // Row 4: Nationalité & CIN
  currY += 10;
  doc.setFont('helvetica', 'bold');
  doc.text("Nationalité", col1X, currY);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${data.nationalite || 'MAROCAINE'}`, col1X + 26, currY);

  doc.setFont('helvetica', 'bold');
  doc.text("CIN", col2X, currY);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${data.cin || '-'}`, col2X + 26, currY);

  // Row 5: Année scolaire & Numéro National
  currY += 10;
  doc.setFont('helvetica', 'bold');
  doc.text("Année", col1X, currY);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${data.anneeScolaire || '2025-2026'}`, col1X + 26, currY);

  doc.setFont('helvetica', 'bold');
  doc.text("N° National", col2X, currY);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${data.numeroNational || data.matricule || '-'}`, col2X + 26, currY);

  // Row 6: Classe / Filière
  currY += 10;
  doc.setFont('helvetica', 'bold');
  doc.text("En classe de", col1X, currY);
  doc.setFont('helvetica', 'normal');
  const filiereText = `:   ${data.filiere || 'ATAM (Accueil dans les transports aériens et maritimes : Option hôtesse de l’air/steward)'}`;
  const filiereLines = doc.splitTextToSize(filiereText, tableW - 32);
  doc.text(filiereLines, col1X + 26, currY);

  // ----------------------------------------------------
  // 6. DELIVERY USAGE & SIGNATURE
  // ----------------------------------------------------
  const usageY = tableY + tableH + 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("La présente attestation lui est délivrée pour usage :", marginX, usageY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.usage || 'ADMINISTRATIF'}`, marginX + 80, usageY);

  // Directrice Signature Block
  const sigY = usageY + 16;
  const sigX = pageWidth - marginX - 55;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Directrice de l’établissement", sigX, sigY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.directrice || "Mme M’Ziouad Imane", sigX, sigY + 5.5);

  // Signature cachet stamp image
  let sigImg = customAssets?.signatureDataUrl;
  if (!sigImg) {
    sigImg = await loadImageDataUrl('/signature-cachet.png');
  }
  if (sigImg) {
    try {
      const format = sigImg.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(sigImg, format, sigX - 10, sigY + 8, 48, 28);
    } catch (e) {
      console.warn('Failed to render signature stamp:', e);
    }
  }

  // ----------------------------------------------------
  // 7. INSTITUTIONAL FOOTER
  // ----------------------------------------------------
  if (designConfig?.footer?.showSeparatorLine !== false) {
    doc.setDrawColor(226, 232, 240); // #E2E8F0
    doc.setLineWidth(0.4);
    doc.line(marginX, pageHeight - 22, pageWidth - marginX, pageHeight - 22);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(designConfig?.footer?.fontSize || 8);
  doc.setTextColor(footerRgb[0], footerRgb[1], footerRgb[2]);

  const footerRaw = designConfig?.footer?.text ||
    "INFOHAS — Institut de Formation Professionnelle Privé | Autorisation N° 4/07/1997 | Accréditation N° 25/K0183/DFPP/45\n15 Rue Demnate, Hassan, Rabat — Tél: +212 537 76 20 25 | www.infohas.ma";

  const footerLines = doc.splitTextToSize(footerRaw, pageWidth - marginX * 2);
  const footerAlign = designConfig?.footer?.alignment || 'center';
  const footerX = footerAlign === 'center' ? pageWidth / 2 : (footerAlign === 'left' ? marginX : pageWidth - marginX);
  doc.text(footerLines, footerX, pageHeight - 16, { align: footerAlign });

  // ----------------------------------------------------
  // 8. OUTPUT BLOB & BUFFER
  // ----------------------------------------------------
  const cleanNom = sanitizeFilename(data.nom || 'ETUDIANT');
  const cleanPrenom = sanitizeFilename(data.prenom || 'Stagiaire');
  const cleanYear = sanitizeFilename(data.anneeScolaire || '2025-2026');
  const filename = `Certificat_Scolarite_${cleanNom}_${cleanPrenom}_${cleanYear}.pdf`;

  const pdfBuffer = new Uint8Array(doc.output('arraybuffer'));
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

  return { pdfBlob, pdfBuffer, filename, doc };
}
