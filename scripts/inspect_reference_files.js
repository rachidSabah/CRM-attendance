const fs = require('fs');
const JSZip = require('jszip');

async function inspect() {
  const docxPath = 'C:\\Users\\piopi\\Downloads\\TEST_DESIGN_Certificat_Officiel_INFOHAS_Certificat_Scolarite_SAD_ZINEB_2025-2026 (1).docx';
  const pdfPath = 'C:\\Users\\piopi\\Downloads\\TEST_DESIGN_Certificat_Officiel_INFOHAS.pdf';

  console.log('=== INSPECTING REFERENCE DOCX ===');
  const data = fs.readFileSync(docxPath);
  const zip = await JSZip.loadAsync(data);

  console.log('Files in DOCX:');
  Object.keys(zip.files).forEach(f => console.log(' -', f));

  for (const name of ['word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml', 'word/footer2.xml']) {
    if (zip.file(name)) {
      const xml = await zip.file(name).async('text');
      console.log(`\n--- ${name} ---`);
      const texts = (xml.match(/<w:t[\s>].*?<\/w:t>/g) || []).map(t => t.replace(/<.*?>/g, '')).join(' ');
      console.log('Text:', texts);
      console.log('XML snippet:', xml.slice(0, 500));
    }
  }

  if (zip.file('word/document.xml')) {
    const docXml = await zip.file('word/document.xml').async('text');
    console.log('\n--- word/document.xml (Paragraphs & Tables) ---');

    const tblMatches = docXml.match(/<w:tbl[\s>].*?<\/w:tbl>/gs) || [];
    console.log('Total tables in document.xml:', tblMatches.length);
    tblMatches.forEach((tbl, idx) => {
      console.log(`\n=== Table ${idx + 1} (Length: ${tbl.length}) ===`);
      console.log(tbl.slice(0, 1500));
    });

    const paragraphs = docXml.match(/<w:p[\s>].*?<\/w:p>/gs) || [];
    console.log(`\nTotal paragraphs in document.xml: ${paragraphs.length}`);
    for (let i = 0; i < Math.min(8, paragraphs.length); i++) {
      console.log(`\n=== P${i + 1} ===\n`, paragraphs[i]);
    }
  }

  console.log('\n=== INSPECTING REFERENCE PDF ===');
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfStr = pdfBytes.toString('binary');
  console.log('PDF byte size:', pdfBytes.length);
  // Extract text from raw pdf streams if uncompressed or inspect text markers
  const matches = pdfStr.match(/\((.*?)\)\s*Tj/g) || [];
  console.log('PDF string matches (Tj):', matches.slice(0, 30));

  // Also check if pdfjs-dist can parse it
  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    console.log('PDF Pages count:', doc.numPages);
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      console.log(`\n--- PDF Page ${i} text items (x, y, font, text) ---`);
      content.items.forEach(item => {
        if (item.str && item.str.trim()) {
          console.log(`[x=${item.transform[4].toFixed(1)}, y=${item.transform[5].toFixed(1)}] sz=${item.height.toFixed(1)} font=${item.fontName} text="${item.str}"`);
        }
      });
    }
  } catch (e) {
    console.log('pdfjs error (will fallback):', e.message);
  }
}

inspect().catch(err => console.error('Error:', err));
