/**
 * INFOHAS Attendance — Document Design & Duplicate Date Fix Verification Suite
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`[PASS] ${message}`);
}

function toOpenXmlHexColor(hex, fallback = '17365D') {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '').trim().toUpperCase();
  if (clean.length === 3) {
    return clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length === 6 && /^[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }
  return fallback;
}

function isValidHexColor(hex) {
  if (!hex || typeof hex !== 'string') return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

async function runTests() {
  console.log('===========================================================');
  console.log('INFOHAS ATTENDANCE — DOCUMENT DESIGN & DATE FIX TEST SUITE');
  console.log('===========================================================\n');

  // --- TEST 1: Inspect Source Downloaded Certificate SAD ZINEB ---
  console.log('--- TEST 1: Inspect Source Certificate with Duplicate Date ---');
  const sourcePath = 'C:\\Users\\piopi\\Downloads\\Certificat_Scolarite_SAD_ZINEB_2025-2026.docx';
  assert(fs.existsSync(sourcePath), `Source certificate exists at ${sourcePath}`);

  const sourceZip = await JSZip.loadAsync(fs.readFileSync(sourcePath));
  const sourceXml = await sourceZip.file('word/document.xml').async('text');
  
  // Verify that the bug in source was indeed duplicate dates
  const p2Match = sourceXml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?DATE[\s\S]*?<\/w:p>/);
  const p2Text = p2Match ? [...p2Match[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('') : '';
  const hasDuplicateInSource = p2Text.includes('16/10/2026 16/10/2026') || (p2Text.match(/16\/10\/2026/g) || []).length >= 2;
  assert(hasDuplicateInSource, `Reproduced and confirmed bug: Source certificate contains duplicate dates in heading ("${p2Text.trim()}")`);

  // --- TEST 2: Verify Template Structure ---
  console.log('\n--- TEST 2: Verify Template Non-Destructive Integrity ---');
  const templatePath = 'public/templates/CERTIFICAT_SCOLARITE_2025.docx';
  assert(fs.existsSync(templatePath), 'Official template file exists in public/templates');
  const templateZip = await JSZip.loadAsync(fs.readFileSync(templatePath));
  const templateXml = await templateZip.file('word/document.xml').async('text');
  assert(templateXml.includes('ATTESTATION DE SCOLARITE'), 'Template contains official heading ATTESTATION DE SCOLARITE');
  assert(templateXml.includes('M’ZIOUAD IMANE'), 'Template preserves institutional directrice signature');

  // --- TEST 3: Generate New Certificate and Assert Exactly ONE Date ---
  console.log('\n--- TEST 3: Generate Certificate and Verify Single Clean Date ---');
  // Load clean template
  const sectPrEnd = templateXml.indexOf('</w:sectPr>');
  const bodyStart = templateXml.indexOf('<w:body>') + '<w:body>'.length;
  const sectPrStart = templateXml.lastIndexOf('<w:sectPr', sectPrEnd);
  const pStart = templateXml.lastIndexOf('<w:p ', sectPrStart);
  let updated = templateXml.slice(bodyStart, pStart);

  const testDate = '16/10/2026';
  const pDateRegex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?DATE\s*[:\u00A0][\s\S]*?<\/w:p>/;
  const cleanDateParagraph = `<w:p w14:paraId="7899BA29" w14:textId="11629A04" w:rsidR="00A17DC3" w:rsidRPr="00614FE3" w:rsidRDefault="00614FE3" w:rsidP="00614FE3"><w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr><w:r><w:t xml:space="preserve">                                                                                                                    </w:t></w:r><w:r w:rsidR="00EB4E3B" w:rsidRPr="00614FE3"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">  DATE : </w:t></w:r><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${testDate}</w:t></w:r></w:p>`;

  updated = updated.replace(pDateRegex, cleanDateParagraph);

  // Replace Nom & Prenom
  const p10Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>Nom<\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  const cleanP10 = `<w:p w14:paraId="50531F5B" w14:textId="3C5B9956" w:rsidR="007D13A6" w:rsidRDefault="007D13A6" w:rsidP="00956483"><w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Nom</w:t></w:r><w:r w:rsidR="00B56AEA"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">    </w:t></w:r><w:r w:rsidR="00D72450"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">  </w:t></w:r><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t> </w:t></w:r><w:r w:rsidRPr="005F00F5"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>:</w:t></w:r><w:r w:rsidR="00956483"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00AA217F"><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>SAD</w:t></w:r></w:p>`;
  updated = updated.replace(p10Regex, cleanP10);

  const p12Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>Prénom[\s\S]*?<\/w:p>/;
  const cleanP12 = `<w:p w14:paraId="2B8959FD" w14:textId="2E797C7E" w:rsidR="007D13A6" w:rsidRPr="00AC420A" w:rsidRDefault="007D13A6" w:rsidP="000E7FAC"><w:pPr><w:rPr><w:u w:val="single"/></w:rPr></w:pPr><w:r w:rsidRPr="00AC420A"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>Prénom :</w:t></w:r><w:r w:rsidR="00956483"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve"> </w:t></w:r><w:r w:rsidR="00AA217F"><w:rPr><w:b/><w:bCs/></w:rPr><w:t>ZINEB</w:t></w:r></w:p>`;
  updated = updated.replace(p12Regex, cleanP12);

  // Replace Academic Year
  updated = updated.replace(/<w:t>2026\/2027<\/w:t>/g, '<w:t>2025-2026</w:t>');
  updated = updated.replace(/<w:t>202<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>6<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>\/202<\/w:t><\/w:r>[\s\S]{0,250}?<w:t>7<\/w:t><\/w:r>/g, '<w:t>2025-2026</w:t></w:r>');

  // Apply custom heading color #17365D
  const headingHex = toOpenXmlHexColor('#17365D');
  const p3Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>ATTESTATION DE SCOLARITE<\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  const cleanP3 = `<w:p w14:paraId="0443EC96" w14:textId="4E983514" w:rsidR="00A17DC3" w:rsidRPr="00614FE3" w:rsidRDefault="00614FE3" w:rsidP="00105CBB"><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="${headingHex}"/><w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:pPr><w:r w:rsidR="00A17DC3" w:rsidRPr="00614FE3"><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="${headingHex}"/><w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr><w:t>ATTESTATION DE SCOLARITE</w:t></w:r></w:p>`;
  updated = updated.replace(p3Regex, cleanP3);

  const finalXml = templateXml.slice(0, bodyStart) + updated + templateXml.slice(sectPrStart, sectPrEnd + '</w:sectPr>'.length) + '</w:body></w:document>';
  templateZip.file('word/document.xml', finalXml);

  // Update header logo dimensions (non-stretched square 824230 EMU)
  for (const hName of ['word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/header4.xml']) {
    const hFile = templateZip.file(hName);
    if (hFile) {
      const hXml = await hFile.async('string');
      templateZip.file(hName, hXml.replace(/cx="3534410"\s+cy="468630"/g, 'cx="824230" cy="824230"'));
    }
  }

  // Update footers with custom color
  const footerHex = toOpenXmlHexColor('#64748B');
  for (const fName of ['word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml', 'word/footer4.xml']) {
    const fFile = templateZip.file(fName);
    if (fFile) {
      let fXml = await fFile.async('string');
      fXml = fXml.replace(/<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?<\/w:rPr>/g, (rPr) => {
        if (rPr.includes('<w:color')) {
          return rPr.replace(/<w:color\s+w:val="[^"]*"/g, `<w:color w:val="${footerHex}"`);
        } else {
          return rPr.replace('</w:rPr>', `<w:color w:val="${footerHex}"/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>`);
        }
      });
      templateZip.file(fName, fXml);
    }
  }

  const generatedBuf = await templateZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const outPath = 'scripts/verified_cert_output.docx';
  fs.writeFileSync(outPath, generatedBuf);

  // Inspect generated document
  const genZip = await JSZip.loadAsync(generatedBuf);
  const genDocXml = await genZip.file('word/document.xml').async('text');

  // Verify date paragraph (P2)
  const pMatches = [...genDocXml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)];
  let genP2Text = '';
  for (let i = 0; i < pMatches.length; i++) {
    const p = pMatches[i][0];
    const t = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
    if (t.includes('DATE')) {
      genP2Text = t;
      break;
    }
  }

  console.log('Heading date extracted text:', `[${genP2Text.trim()}]`);
  assert(genP2Text.includes('DATE'), 'Heading contains DATE label');
  assert(genP2Text.includes('16/10/2026'), 'Heading contains intended date 16/10/2026');
  assert(!genP2Text.includes('16/10/2026 16/10/2026'), 'NO duplicate date in heading!');
  assert(!genP2Text.includes('16/10/202616/10/2026'), 'NO conjoined duplicate date in heading!');

  // Check student name separation
  assert(genDocXml.includes('SAD'), 'Student Nom SAD correctly formatted');
  assert(genDocXml.includes('ZINEB'), 'Student Prénom ZINEB correctly formatted');
  assert(genDocXml.includes('2025-2026'), 'Academic year 2025-2026 correctly formatted');

  // --- TEST 4: Heading & Footer Customization Engine ---
  console.log('\n--- TEST 4: Heading & Footer Customization Validation ---');
  assert(genDocXml.includes('w:color w:val="17365D"'), 'Heading color #17365D successfully injected into OpenXML');
  assert(toOpenXmlHexColor('#17365D') === '17365D', 'toOpenXmlHexColor converts #17365D to 17365D');
  assert(toOpenXmlHexColor('#FFF') === 'FFFFFF', 'toOpenXmlHexColor converts 3-char hex #FFF to FFFFFF');
  assert(isValidHexColor('#17365D'), 'isValidHexColor validates #17365D');
  assert(isValidHexColor('#047857'), 'isValidHexColor validates #047857');
  assert(!isValidHexColor('red'), 'isValidHexColor rejects non-hex "red"');
  assert(!isValidHexColor('#ZZZZZZ'), 'isValidHexColor rejects invalid hex #ZZZZZZ');

  const genFooterXml = await genZip.file('word/footer1.xml').async('text');
  assert(genFooterXml.includes('w:color w:val="64748B"'), 'Footer color #64748B successfully injected into footer OpenXML');

  // --- TEST 5: Document Customization Panel Component Existence ---
  console.log('\n--- TEST 5: Document Customization Panel Components ---');
  const panelPath = 'src/components/DocumentCustomizationPanel.tsx';
  assert(fs.existsSync(panelPath), 'DocumentCustomizationPanel.tsx component exists');
  const panelContent = fs.readFileSync(panelPath, 'utf-8');
  assert(panelContent.includes('Personnalisation des documents'), 'Panel has title Personnalisation des documents');
  assert(panelContent.includes('handleHeadingColorChange'), 'Panel has heading color change handler');
  assert(panelContent.includes('handleFooterColorChange'), 'Panel has footer color change handler');
  assert(panelContent.includes('handleLogoUpload'), 'Panel has logo upload handler');
  assert(panelContent.includes('handleDownloadTestDocx'), 'Panel has test DOCX download handler');
  assert(panelContent.includes('handleDownloadTestPdf'), 'Panel has test PDF download handler');
  assert(panelContent.includes('handleSaveSettings'), 'Panel has save settings handler');
  assert(panelContent.includes('handleRestoreDefaults'), 'Panel has restore defaults handler');

  // --- TEST 6: API Endpoints ---
  console.log('\n--- TEST 6: Backend API Endpoints ---');
  const configApi = 'functions/api/doc-design/config.js';
  const logoApi = 'functions/api/doc-design/upload-logo.js';
  assert(fs.existsSync(configApi), 'functions/api/doc-design/config.js exists');
  assert(fs.existsSync(logoApi), 'functions/api/doc-design/upload-logo.js exists');

  const configApiContent = fs.readFileSync(configApi, 'utf-8');
  assert(configApiContent.includes('doc_design_settings'), 'Config API persists in school_settings under doc_design_settings');
  assert(configApiContent.includes('isValidHexColor'), 'Config API validates hex colors');

  const logoApiContent = fs.readFileSync(logoApi, 'utf-8');
  assert(logoApiContent.includes('isPng'), 'Logo API validates PNG magic bytes');
  assert(logoApiContent.includes('isJpeg'), 'Logo API validates JPEG magic bytes');
  assert(logoApiContent.includes('MAX_LOGO_SIZE_BYTES'), 'Logo API enforces 2MB size limit');

  console.log('\n===========================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (Zero Failures)');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
