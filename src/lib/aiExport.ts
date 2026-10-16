import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import type { DocumentDesignPreset } from './documentDesignTypes';
import { toOpenXmlHexColor } from './documentDesignTypes';

export interface AiExportMetadata {
  model?: string;
  category?: 'anomaly' | 'summary' | 'parent_notice' | 'custom' | string;
  date?: string;
  targetName?: string;
  className?: string;
  author?: string;
}

/**
 * Clean markdown symbols for clean PDF rendering
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

/**
 * Export AI Autopilot report to a professional PDF document
 */
export function exportAiReportPdf(
  title: string,
  content: string,
  meta: AiExportMetadata = {},
  designPreset?: DocumentDesignPreset
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header Banner Background (Dynamic from design preset or emerald default)
  const bannerHex = designPreset?.heading?.textColor || '#059669';
  const br = parseInt(bannerHex.slice(1, 3), 16) || 5;
  const bg = parseInt(bannerHex.slice(3, 5), 16) || 150;
  const bb = parseInt(bannerHex.slice(5, 7), 16) || 105;

  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // School Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('INSTITUT SUPÉRIEUR INFOHAS', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text("Direction des Études & Suivi Pédagogique d'Assiduité", margin, 18);

  doc.setFontSize(8);
  doc.text(
    `Copilote IA : ${meta.model || 'Gemini 2.5'} • Émis le : ${meta.date || new Date().toLocaleDateString('fr-FR')}`,
    margin,
    23
  );

  y = 38;

  // Report Title
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 2;

  // Subtitle / Notice badge
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Rapport généré par intelligence artificielle — Validation administrative obligatoire avant transmission.',
    margin,
    y
  );
  y += 5;

  // Separator line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Body Content formatting
  const rawLines = content.split('\n');
  doc.setTextColor(30, 41, 59);

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trimEnd();
    if (!rawLine.trim()) {
      y += 3.5;
      continue;
    }

    // Check page overflow
    if (y > pageHeight - 20) {
      doc.addPage();
      y = margin + 5;
    }

    if (rawLine.startsWith('# ')) {
      // Heading 1
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      const h1Text = stripMarkdown(rawLine.replace(/^#\s+/, ''));
      const lines = doc.splitTextToSize(h1Text, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 5.5 + 2;
    } else if (rawLine.startsWith('## ')) {
      // Heading 2
      y += 2.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 58, 138); // Blue-900
      const h2Text = stripMarkdown(rawLine.replace(/^##\s+/, ''));
      const lines = doc.splitTextToSize(h2Text, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 1.5;
    } else if (rawLine.startsWith('### ')) {
      // Heading 3
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const h3Text = stripMarkdown(rawLine.replace(/^###\s+/, ''));
      const lines = doc.splitTextToSize(h3Text, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 1;
    } else if (rawLine.startsWith('- ') || rawLine.startsWith('* ')) {
      // Bullet point
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const bulletText = stripMarkdown(rawLine.replace(/^[-*]\s+/, ''));
      const lines = doc.splitTextToSize(`• ${bulletText}`, contentWidth - 4);
      doc.text(lines, margin + 4, y);
      y += lines.length * 4.2 + 1;
    } else if (/^\d+\.\s+/.test(rawLine)) {
      // Numbered list
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const numText = stripMarkdown(rawLine);
      const lines = doc.splitTextToSize(numText, contentWidth - 4);
      doc.text(lines, margin + 4, y);
      y += lines.length * 4.2 + 1;
    } else {
      // Regular Paragraph
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const cleanPara = stripMarkdown(rawLine);
      const lines = doc.splitTextToSize(cleanPara, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 4.2 + 1;
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(
      `Page ${p} / ${totalPages} — INFOHAS Attendance Autopilot • Confidentiel`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Fait le ${new Date().toLocaleDateString('fr-FR')}`,
      pageWidth - margin - 30,
      pageHeight - 8
    );
  }

  const cleanFilename = `${title.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_').slice(0, 40)}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(cleanFilename);
}

/**
 * Escape XML characters
 */
function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export AI Autopilot report to a professional OpenXML DOCX document
 */
export async function exportAiReportDocx(
  title: string,
  content: string,
  meta: AiExportMetadata = {},
  designPreset?: DocumentDesignPreset
): Promise<void> {
  const zip = new JSZip();

  const lines = content.split('\n');
  let paragraphsXml = '';

  const headerColor = toOpenXmlHexColor(designPreset?.heading?.textColor || '#059669', '059669');

  // 1. Institution Header
  paragraphsXml += `
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Normal"/>
        <w:jc w:val="center"/>
        <w:spacing w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
          <w:b/>
          <w:color w:val="${headerColor}"/>
          <w:sz w:val="28"/>
        </w:rPr>
        <w:t>INSTITUT SUPÉRIEUR INFOHAS</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="160"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
          <w:color w:val="475569"/>
          <w:sz w:val="18"/>
        </w:rPr>
        <w:t>Direction Pédagogique — Suivi &amp; Assiduité des Promotions</w:t>
      </w:r>
    </w:p>
  `;

  // 2. Report Title
  paragraphsXml += `
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="100"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
          <w:b/>
          <w:color w:val="0F172A"/>
          <w:sz w:val="26"/>
        </w:rPr>
        <w:t>${escapeXml(title)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
          <w:i/>
          <w:color w:val="64748B"/>
          <w:sz w:val="18"/>
        </w:rPr>
        <w:t>Modèle IA : ${escapeXml(meta.model || 'Gemini 2.5')} • Date : ${escapeXml(meta.date || new Date().toLocaleDateString('fr-FR'))} • Validation humaine requise</w:t>
      </w:r>
    </w:p>
  `;

  // 3. Body paragraphs
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      paragraphsXml += `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>`;
      continue;
    }

    if (line.startsWith('# ')) {
      const heading = escapeXml(stripMarkdown(line.replace(/^#\s+/, '')));
      paragraphsXml += `
        <w:p>
          <w:pPr>
            <w:spacing w:before="240" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
              <w:b/>
              <w:color w:val="0F172A"/>
              <w:sz w:val="24"/>
            </w:rPr>
            <w:t>${heading}</w:t>
          </w:r>
        </w:p>`;
    } else if (line.startsWith('## ')) {
      const heading = escapeXml(stripMarkdown(line.replace(/^##\s+/, '')));
      paragraphsXml += `
        <w:p>
          <w:pPr>
            <w:spacing w:before="200" w:after="100"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
              <w:b/>
              <w:color w:val="1E3A8A"/>
              <w:sz w:val="22"/>
            </w:rPr>
            <w:t>${heading}</w:t>
          </w:r>
        </w:p>`;
    } else if (line.startsWith('### ')) {
      const heading = escapeXml(stripMarkdown(line.replace(/^###\s+/, '')));
      paragraphsXml += `
        <w:p>
          <w:pPr>
            <w:spacing w:before="160" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
              <w:b/>
              <w:color w:val="334155"/>
              <w:sz w:val="20"/>
            </w:rPr>
            <w:t>${heading}</w:t>
          </w:r>
        </w:p>`;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const item = escapeXml(stripMarkdown(line.replace(/^[-*]\s+/, '')));
      paragraphsXml += `
        <w:p>
          <w:pPr>
            <w:ind w:left="400"/>
            <w:spacing w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
              <w:b/>
              <w:color w:val="059669"/>
            </w:rPr>
            <w:t>• </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
              <w:sz w:val="21"/>
              <w:color w:val="1E293B"/>
            </w:rPr>
            <w:t>${item}</w:t>
          </w:r>
        </w:p>`;
    } else {
      const para = escapeXml(stripMarkdown(line));
      paragraphsXml += `
        <w:p>
          <w:pPr>
            <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
              <w:sz w:val="21"/>
              <w:color w:val="334155"/>
            </w:rPr>
            <w:t xml:space="preserve">${para}</w:t>
          </w:r>
        </w:p>`;
    }
  }

  // Complete Word Document XML
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', documentXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const cleanFilename = `${title.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_').slice(0, 40)}_${new Date().toISOString().split('T')[0]}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
