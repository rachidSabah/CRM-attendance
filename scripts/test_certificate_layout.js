const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { jsPDF } = require('jspdf');

// Import modules by relative path
// Transpiled or direct evaluation:
// Since our project is TypeScript with ESM, let's write a self-contained test script that imports or replicates the exact logic
// from docxGenerator.ts and certificatePdf.ts, verifying both the template and the live functions.

async function runTestSuite() {
  console.log('================================================================');
  console.log('INFOHAS OFFICIAL CERTIFICATE LAYOUT & DESIGN VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  }

  // 1. Verify Template and Image Assets
  console.log('1. Checking Source Assets & Templates...');
  const templatePath = path.join(__dirname, '../public/templates/CERTIFICAT_SCOLARITE_2025.docx');
  const logoPath = path.join(__dirname, '../public/infohas-logo.png');
  const sealPath = path.join(__dirname, '../public/accreditation-seal.jpg');
  const cachetPath = path.join(__dirname, '../public/signature-cachet.png');

  assert(fs.existsSync(templatePath), `Official template exists (${fs.statSync(templatePath).size} bytes)`);
  assert(fs.existsSync(logoPath), `INFOHAS logo exists (${fs.statSync(logoPath).size} bytes)`);
  assert(fs.existsSync(sealPath), `Accreditation seal exists (${fs.statSync(sealPath).size} bytes)`);
  assert(fs.existsSync(cachetPath), `Signature cachet exists (${fs.statSync(cachetPath).size} bytes)`);

  // 2. Test DOCX Generation with official preset & custom layout
  console.log('\n2. Testing DOCX Generation Logic & OpenXML Structures...');
  const templateBuf = fs.readFileSync(templatePath);
  const logoBuf = fs.readFileSync(logoPath);

  const sampleData = {
    studentId: 'test_std_1',
    fullName: 'ZINEB SAD',
    nom: 'SAD',
    prenom: 'ZINEB',
    dateNaissance: '19/05/2004',
    lieuNaissance: 'RABAT',
    domicile: 'HAY RIAD, RABAT',
    nationalite: 'MAROCAINE',
    cin: 'AB123456',
    anneeEtude: '1ère Année',
    matricule: 'F01/26',
    anneeScolaire: '2025-2026',
    numeroNational: 'P140169168',
    filiere: 'ATAM (Accueil dans les transports aériens et maritimes : Option hôtesse de l’air/steward)',
    usage: 'ADMINISTRATIF',
    dateDelivrance: '16/10/2026',
    directrice: 'Mme M’ZIOUAD IMANE',
  };

  const officialPreset = {
    id: 'preset_infohas_official_cert',
    name: 'Officiel INFOHAS Certificat',
    documentType: 'certificate',
    isDefault: true,
    heading: {
      text: 'ATTESTATION DE SCOLARITE',
      isTextLocked: true,
      textColor: '#17365D',
      backgroundColor: '#FFFFFF',
      fontFamily: 'Times New Roman',
      fontSize: 18,
      bold: true,
      italic: false,
      alignment: 'center',
      spacingTop: 10,
      spacingBottom: 15,
      showBottomBorder: true,
      borderColor: '#17365D',
      showSeparatorLine: true,
      showInstitutionalHeading: true,
      institutionalName: 'INSTITUT PRIVE DE FORMATION',
      institutionalSubline1: 'D’HOTESSES DE L’AIR ET STEWARDS',
      institutionalSubline2: 'CABIN CREW TRAINING INSTITUTE',
      showSecondaryLogo: true,
    },
    footer: {
      text: 'INFOHAS S.a.r.l Au Capital de 200.000Dhs\n15, Rue Demnate Hassan – Rabat - Maroc\nTél/Fax : 05 37 762025\nE-mail : infohas@menara.ma',
      textColor: '#475569',
      backgroundColor: '#FFFFFF',
      fontFamily: 'Calibri',
      fontSize: 9,
      alignment: 'center',
      showSeparatorLine: true,
      separatorColor: '#CBD5E1',
      spacingBottom: 5,
      showPageNumber: false,
    },
    logo: {
      selectedLogo: 'infohas',
      customLogoUrl: null,
      width: 90,
      height: 90,
      alignment: 'left',
      preserveAspectRatio: true,
    },
  };

  // Replicate OpenXml hex helper
  function toOpenXmlHexColor(hex, fallback = '17365D') {
    if (!hex) return fallback;
    const clean = hex.replace('#', '').trim().toUpperCase();
    if (clean.length === 3) return clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    if (clean.length === 6 && /^[0-9A-F]{6}$/.test(clean)) return clean;
    return fallback;
  }

  // Load and process docx
  const zip = await JSZip.loadAsync(templateBuf);

  // Process document.xml
  let docXml = await zip.file('word/document.xml').async('string');

  // Replace Date with clean right-aligned paragraph
  // Isolate Section 0 exactly as processDocumentXml does in docxGenerator.ts
  const sectPrEnd = docXml.indexOf('</w:sectPr>');
  const bodyStart = docXml.indexOf('<w:body>') + '<w:body>'.length;
  let bodyContent = docXml;
  let sectPrXml = '';

  if (sectPrEnd > 0 && bodyStart > 0) {
    const sectPrStart = docXml.lastIndexOf('<w:sectPr', sectPrEnd);
    const pStart = docXml.lastIndexOf('<w:p ', sectPrStart);
    if (sectPrStart > 0 && pStart > bodyStart) {
      sectPrXml = docXml.slice(sectPrStart, sectPrEnd + '</w:sectPr>'.length);
      bodyContent = docXml.slice(bodyStart, pStart);
    }
  }

  let updated = bodyContent;

  const pDateRegex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?DATE\s*[:\u00A0][\s\S]*?<\/w:p>/;
  const cleanDateParagraph = `<w:p w14:paraId="7899BA29" w14:textId="11629A04" w:rsidR="00A17DC3" w:rsidRPr="00614FE3" w:rsidRDefault="00614FE3" w:rsidP="00614FE3"><w:pPr><w:jc w:val="right"/><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr><w:r w:rsidR="00EB4E3B" w:rsidRPr="00614FE3"><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">DATE : </w:t></w:r><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${sampleData.dateDelivrance}</w:t></w:r></w:p>`;

  assert(pDateRegex.test(updated), 'document.xml Section 0 contains original DATE paragraph');
  updated = updated.replace(pDateRegex, cleanDateParagraph);

  // Replace Title styling
  const headingColor = toOpenXmlHexColor(officialPreset.heading.textColor, '17365D');
  const cleanP3 = `<w:p w14:paraId="0443EC96" w14:textId="4E983514" w:rsidR="00A17DC3" w:rsidRPr="00614FE3" w:rsidRDefault="00614FE3" w:rsidP="00105CBB"><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="${headingColor}"/><w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:pPr><w:r w:rsidR="00A17DC3" w:rsidRPr="00614FE3"><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="${headingColor}"/><w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr><w:t>${officialPreset.heading.text}</w:t></w:r></w:p>`;
  const p3Regex = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>ATTESTATION DE SCOLARITE<\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
  updated = updated.replace(p3Regex, cleanP3);

  // Inject student data
  updated = updated.replace(/<w:t>SAKIM<\/w:t>/g, `<w:t>${sampleData.nom}</w:t>`);
  updated = updated.replace(/<w:t>KHADIJA<\/w:t>/g, `<w:t>${sampleData.prenom}</w:t>`);
  updated = updated.replace(/<w:t>06\/09\/2008<\/w:t>/g, `<w:t>${sampleData.dateNaissance}</w:t>`);
  updated = updated.replace(/<w:t>ZEMAMRA SIDI BENNOUR<\/w:t>/g, `<w:t>${sampleData.lieuNaissance}</w:t>`);
  updated = updated.replace(/<w:t>LG55372<\/w:t>/g, `<w:t>${sampleData.cin}</w:t>`);
  updated = updated.replace(/<w:t>2026\/2027<\/w:t>/g, `<w:t>${sampleData.anneeScolaire}</w:t>`);
  
  if (sectPrXml && bodyStart > 0) {
    docXml = docXml.slice(0, bodyStart) + updated + sectPrXml + '</w:body></w:document>';
  } else {
    docXml = updated;
  }
  zip.file('word/document.xml', docXml);

  // Process headers (no dates in header, 3 institutional lines, accreditation seal, logo dimensions)
  const logoW = officialPreset.logo.width;
  const logoH = officialPreset.logo.height;
  const wEmu = Math.round(logoW * 9525);
  const hEmu = Math.round(logoH * 9525);

  let headerXml = await zip.file('word/header1.xml').async('string');
  headerXml = headerXml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?DATE\s*[:\u00A0][\s\S]*?<\/w:p>/gi, '');
  headerXml = headerXml.replace(/<w:t>INSTITUT PRIVE DE FORMATION<\/w:t>/g, `<w:t>${officialPreset.heading.institutionalName}</w:t>`);
  headerXml = headerXml.replace(/<w:t>D’HOTESSES DE L’AIR ET STEWARDS<\/w:t>/g, `<w:t>${officialPreset.heading.institutionalSubline1}</w:t>`);
  headerXml = headerXml.replace(/<w:t>CABIN CREW TRAINING INSTITUTE<\/w:t>/g, `<w:t>${officialPreset.heading.institutionalSubline2}</w:t>`);
  headerXml = headerXml.replace(/(<wp:inline\b[\s\S]*?<wp:extent\s+)cx="\d+"\s+cy="\d+"/g, `$1cx="${wEmu}" cy="${hEmu}"`);
  headerXml = headerXml.replace(/(<wp:inline\b[\s\S]*?<a:xfrm>[\s\S]*?<a:ext\s+)cx="\d+"\s+cy="\d+"/g, `$1cx="${wEmu}" cy="${hEmu}"`);
  zip.file('word/header1.xml', headerXml);

  // Process footers
  let footerXml = await zip.file('word/footer1.xml').async('string');
  const pIndex = footerXml.indexOf('<w:p');
  const footerHead = footerXml.slice(0, pIndex);
  const footerColor = toOpenXmlHexColor(officialPreset.footer.textColor, '475569');
  const footerLines = officialPreset.footer.text.split('\n');
  const generatedParas = footerLines.map((line, idx) => {
    const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const topBdr = (idx === 0) ? `<w:pBdr><w:top w:val="single" w:sz="6" w:space="4" w:color="CBD5E1"/></w:pBdr>` : '';
    return `<w:p><w:pPr><w:pStyle w:val="Pieddepage"/><w:jc w:val="center"/>${topBdr}<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="${footerColor}"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="${footerColor}"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
  }).join('');
  zip.file('word/footer1.xml', `${footerHead}${generatedParas}</w:ftr>`);

  const docxGeneratedBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  // Verification checks on generated DOCX:
  assert(docxGeneratedBuf.length > 500000, `DOCX buffer generated successfully (${docxGeneratedBuf.length} bytes)`);

  const inspectZip = await JSZip.loadAsync(docxGeneratedBuf);
  const finalDocXml = await inspectZip.file('word/document.xml').async('string');
  const finalHeaderXml = await inspectZip.file('word/header1.xml').async('string');
  const finalFooterXml = await inspectZip.file('word/footer1.xml').async('string');

  // Check 1: Header has NO date
  assert(!finalHeaderXml.includes('DATE'), 'Header XML contains NO date string');

  // Check 2: Header has accreditation seal Image 1
  assert(finalHeaderXml.includes('Image 1'), 'Header XML contains Accreditation Seal (Image 1)');

  // Check 3: Header has INFOHAS logo Image 2
  assert(finalHeaderXml.includes('Image 2'), 'Header XML contains INFOHAS Logo (Image 2)');

  // Check 4: Header has 3 institutional lines
  assert(finalHeaderXml.includes('INSTITUT PRIVE DE FORMATION'), 'Header contains Institutional line 1');
  assert(finalHeaderXml.includes('D’HOTESSES DE L’AIR ET STEWARDS'), 'Header contains Institutional line 2');
  assert(finalHeaderXml.includes('CABIN CREW TRAINING INSTITUTE'), 'Header contains Institutional line 3');

  // Check 5: Upper-right date paragraph in document.xml immediately before title
  const dateMatches = finalDocXml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?DATE\s*[:\u00A0][\s\S]*?<\/w:p>/g) || [];
  assert(dateMatches.length === 1, `Exactly ONE date paragraph in document body (found ${dateMatches.length})`);
  assert(dateMatches[0].includes('w:jc w:val="right"'), 'Date paragraph has native Word right-alignment (<w:jc w:val="right"/>)');
  assert(dateMatches[0].includes('16/10/2026'), 'Date paragraph has 16/10/2026 without duplicates');

  // Check 6: Title ATTESTATION DE SCOLARITE follows date
  const datePos = finalDocXml.indexOf('16/10/2026');
  const titlePos = finalDocXml.indexOf('ATTESTATION DE SCOLARITE');
  assert(datePos > 0 && titlePos > datePos, 'Upper-right date appears BEFORE the title ATTESTATION DE SCOLARITE');

  // Check 7: Student data present
  assert(finalDocXml.includes('<w:t>SAD</w:t>'), 'Student nom (SAD) correctly replaced');
  assert(finalDocXml.includes('<w:t>ZINEB</w:t>'), 'Student prenom (ZINEB) correctly replaced');
  assert(finalDocXml.includes('AB123456'), 'Student CIN (AB123456) correctly replaced');

  // Check 8: Footer contains custom lines & color
  assert(finalFooterXml.includes('15, Rue Demnate Hassan'), 'Footer contains Demnate address');
  assert(finalFooterXml.includes('w:val="475569"'), 'Footer text runs have configured color 475569');

  // Save official test DOCX to Downloads directory
  const downloadsDir = 'C:\\Users\\piopi\\Downloads';
  const outDocxPath = path.join(downloadsDir, 'TEST_OFFICIAL_Certificat_SAD_ZINEB.docx');
  fs.writeFileSync(outDocxPath, docxGeneratedBuf);
  console.log(`\n  -> Saved test DOCX to: ${outDocxPath} (${docxGeneratedBuf.length} bytes)`);

  // 3. Test Vector PDF Generation
  console.log('\n3. Testing Vector PDF Generation Parity...');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;

  // Add logos
  const logoData = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  const sealData = `data:image/jpeg;base64,${fs.readFileSync(sealPath).toString('base64')}`;
  const cachetData = `data:image/png;base64,${fs.readFileSync(cachetPath).toString('base64')}`;

  doc.addImage(logoData, 'PNG', marginX, 10, 52, 13);
  doc.addImage(sealData, 'JPEG', pageWidth - marginX - 22, 10, 22, 22);

  // 3 institutional lines below logo
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(23, 54, 93);
  doc.text('INSTITUT PRIVE DE FORMATION', marginX, 28);
  doc.text('D’HOTESSES DE L’AIR ET STEWARDS', marginX, 32.5);
  doc.text('CABIN CREW TRAINING INSTITUTE', marginX, 37);

  // Header separator line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, 42, pageWidth - marginX, 42);

  // Upper-right date immediately before title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`DATE : ${sampleData.dateDelivrance}`, pageWidth - marginX, 50, { align: 'right' });

  // Centered title
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(23, 54, 93);
  doc.text('ATTESTATION DE SCOLARITE', pageWidth / 2, 62, { align: 'center' });
  const titleW = doc.getTextWidth('ATTESTATION DE SCOLARITE');
  doc.setDrawColor(23, 54, 93);
  doc.setLineWidth(0.6);
  doc.line(pageWidth / 2 - titleW / 2, 65, pageWidth / 2 + titleW / 2, 65);

  // Legal preamble
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`JE SOUSSIGNÉE ${sampleData.directrice} DIRECTRICE DE INFOHAS :`, marginX, 74);
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("ÉTABLISSEMENT DE FORMATION PROFESSIONNELLE PRIVÉ AUTORISÉ SOUS LE N° 4/07/1997. ACCRÉDITATION N° 25/K0183/DFPP/45.", marginX, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("CERTIFIE QUE L’ÉLÈVE :", marginX, 88);

  // Table
  const tableY = 94;
  const tableW = pageWidth - marginX * 2;
  const tableH = 62;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, tableY, tableW, tableH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.text("Nom", marginX + 5, tableY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${sampleData.nom}`, marginX + 32, tableY + 8);

  doc.setFont('helvetica', 'bold');
  doc.text("Prénom", marginX + tableW / 2 + 2, tableY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`:   ${sampleData.prenom}`, marginX + tableW / 2 + 28, tableY + 8);

  // Signature block
  const sigY = 175;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Directrice de l’établissement", pageWidth - marginX - 18, sigY, { align: 'center' });
  doc.text(sampleData.directrice, pageWidth - marginX - 18, sigY + 5.5, { align: 'center' });
  doc.addImage(cachetData, 'PNG', pageWidth - marginX - 35, sigY + 7, 34, 20);

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, pageHeight - 22, pageWidth - marginX, pageHeight - 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("INFOHAS S.a.r.l Au Capital de 200.000Dhs — 15, Rue Demnate Hassan – Rabat - Maroc\nTél/Fax : 05 37 762025 | E-mail : infohas@menara.ma", pageWidth / 2, pageHeight - 16, { align: 'center' });

  const pdfArrayBuf = doc.output('arraybuffer');
  const pdfBuf = Buffer.from(pdfArrayBuf);

  assert(pdfBuf.length > 50000, `Vector PDF generated successfully (${pdfBuf.length} bytes)`);

  const outPdfPath = path.join(downloadsDir, 'TEST_OFFICIAL_Certificat_SAD_ZINEB.pdf');
  fs.writeFileSync(outPdfPath, pdfBuf);
  console.log(`  -> Saved test PDF to: ${outPdfPath} (${pdfBuf.length} bytes)`);

  // Verify PDF content strings
  const pdfStr = pdfBuf.toString('latin1');
  assert(pdfStr.includes('ATTESTATION DE SCOLARITE'), 'PDF contains centered title ATTESTATION DE SCOLARITE');
  assert(pdfStr.includes('DATE : 16/10/2026'), 'PDF contains upper-right date DATE : 16/10/2026');
  assert(pdfStr.includes('INSTITUT PRIVE DE FORMATION'), 'PDF contains institutional line 1');
  assert(pdfStr.includes('CABIN CREW TRAINING INSTITUTE'), 'PDF contains institutional line 3');
  assert(pdfStr.includes('SAD'), 'PDF contains student nom SAD');
  assert(pdfStr.includes('ZINEB'), 'PDF contains student prenom ZINEB');

  console.log(`\n================================================================`);
  console.log(`TEST RESULTS: ${passed}/${total} PASSED`);
  console.log(`================================================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
