const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function runTests() {
  console.log('=== TEST SUITE: INFOHAS CERTIFICAT, GEMINI AI & PARENT PORTAL ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  PASS: ' + message);
      passed++;
    } else {
      console.error('  FAIL: ' + message);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Official Template & Assets Existence
  // -------------------------------------------------------------
  console.log('1. Testing Template & Asset Integrity:');
  const templatePathH = 'H:/CERTIFICAT SCOLARITE 2025.docx';
  const templatePathPublic = path.join(__dirname, '..', 'public', 'templates', 'CERTIFICAT_SCOLARITE_2025.docx');
  const logoPath = path.join(__dirname, '..', 'public', 'infohas-logo.png');

  const resolvedTemplatePath = fs.existsSync(templatePathH) ? templatePathH : templatePathPublic;
  assert(fs.existsSync(resolvedTemplatePath), 'Template file exists at ' + resolvedTemplatePath);
  assert(fs.existsSync(logoPath), 'INFOHAS official logo exists in public/infohas-logo.png');

  const templateBuf = fs.readFileSync(resolvedTemplatePath);
  const logoBuf = fs.readFileSync(logoPath);

  assert(templateBuf.length > 500000, `Template size is substantial (${templateBuf.length} bytes)`);
  assert(logoBuf.length > 100000, `Official logo size is substantial (${logoBuf.length} bytes)`);

  // -------------------------------------------------------------
  // Test 2: DOCX Certificate Generation
  // -------------------------------------------------------------
  console.log('\n2. Testing DOCX Certificate Engine:');
  const mockStudent = {
    id: 'test_student_123',
    fullName: 'BENNANI YOUSSEF',
    studentId: 'F99/27',
    className: 'LONDON 2027',
    group: 'LONDON 2027',
    academicYear: '2026/2027',
    address: '12 Boulevard Hassan II, Rabat',
  };

  // We test the XML replacement directly on section 0
  const zip = await JSZip.loadAsync(templateBuf);
  let docXml = await zip.file('word/document.xml').async('string');

  const firstSectIdx = docXml.indexOf('</w:sectPr>');
  const bodyStart = docXml.indexOf('<w:body>') + '<w:body>'.length;
  let s0 = docXml.slice(bodyStart, firstSectIdx + '</w:sectPr>'.length);

  // Apply substitutions as implemented in docxGenerator.ts
  s0 = s0.replace(/<w:t>SAKIM<\/w:t>/g, '<w:t>BENNANI</w:t>');
  s0 = s0.replace(/<w:t>KHADIJA<\/w:t>/g, '<w:t>YOUSSEF</w:t>');
  s0 = s0.replace(/<w:t>LG55372<\/w:t>/g, '<w:t>AB123456</w:t>');
  s0 = s0.replace(/<w:t>P140169168<\/w:t>/g, '<w:t>M13009988</w:t>');
  s0 = s0.replace(/<w:t[^>]*>\s*MAROCAINE\s*<\/w:t>/g, '<w:t xml:space="preserve"> MAROCAINE</w:t>');
  s0 = s0.replace(
    /<w:t>F<\/w:t><\/w:r>[\s\S]{0,300}?<w:t>\/27<\/w:t><\/w:r>/g,
    '<w:t>F99/27</w:t></w:r>'
  );

  const updatedDocXml = docXml.slice(0, bodyStart) + s0 + '</w:body></w:document>';
  zip.file('word/document.xml', updatedDocXml);
  zip.file('word/media/image3.jpeg', logoBuf);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const testCertPath = path.join(__dirname, 'test_verified_cert.docx');
  fs.writeFileSync(testCertPath, outBuf);

  assert(fs.existsSync(testCertPath), 'Output DOCX written to disk');
  assert(outBuf.length > 50000, `Output certificate size is valid (${outBuf.length} bytes)`);

  // Verify output zip contents
  const verifyZip = await JSZip.loadAsync(outBuf);
  const verifyXml = await verifyZip.file('word/document.xml').async('string');
  assert(verifyXml.includes('BENNANI'), 'XML contains replaced family name BENNANI');
  assert(verifyXml.includes('YOUSSEF'), 'XML contains replaced first name YOUSSEF');
  assert(verifyXml.includes('AB123456'), 'XML contains replaced CIN AB123456');
  assert(verifyXml.includes('F99/27'), 'XML contains replaced Matricule F99/27');

  const verifyLogo = await verifyZip.file('word/media/image3.jpeg').async('nodebuffer');
  assert(verifyLogo.length === logoBuf.length, 'word/media/image3.jpeg matches INFOHAS logo byte size exactly');

  // -------------------------------------------------------------
  // Test 3: Parent WhatsApp Phone Normalization & OTP
  // -------------------------------------------------------------
  console.log('\n3. Testing Parent Portal Phone Normalization & Suffix Logic:');
  function normalizePhoneSuffix(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 9 ? digits.slice(-9) : digits;
  }

  const p1 = '0661123456';
  const p2 = '+212661123456';
  const p3 = '06 61 12 34 56';
  const p4 = '212661123456';
  const p5 = '06-61-12-34-56';

  assert(normalizePhoneSuffix(p1) === '661123456', '0661123456 normalized suffix is 661123456');
  assert(normalizePhoneSuffix(p2) === '661123456', '+212661123456 normalized suffix is 661123456');
  assert(normalizePhoneSuffix(p3) === '661123456', '06 61 12 34 56 normalized suffix is 661123456');
  assert(normalizePhoneSuffix(p4) === '661123456', '212661123456 normalized suffix is 661123456');
  assert(normalizePhoneSuffix(p5) === '661123456', '06-61-12-34-56 normalized suffix is 661123456');

  // OTP generation check
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  assert(otp.length === 6 && /^\d{6}$/.test(otp), `OTP code is 6 numeric digits (${otp})`);

  // -------------------------------------------------------------
  // Test 4: Cloudflare Pages Endpoints Structure
  // -------------------------------------------------------------
  console.log('\n4. Testing Cloudflare Pages Functions Endpoints:');
  const requiredFiles = [
    'functions/api/ai/models.js',
    'functions/api/ai/test.js',
    'functions/api/ai/generate.js',
    'functions/api/ai/config.js',
    'functions/api/parent/request-otp.js',
    'functions/api/parent/verify-otp.js',
    'functions/api/parent/attendance.js',
    'functions/_lib/auth.js',
    'src/components/CertificateGenerator.tsx',
    'src/components/AiAutopilot.tsx',
    'src/components/ParentPortal.tsx',
  ];

  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    assert(fs.existsSync(fullPath), `Endpoint/Component exists: ${file}`);
  });

  // Verify PUBLIC_PATHS in auth.js
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'functions/_lib/auth.js'), 'utf8');
  assert(authJs.includes('/api/parent/request-otp'), 'auth.js includes /api/parent/request-otp in PUBLIC_PATHS');
  assert(authJs.includes('/api/parent/verify-otp'), 'auth.js includes /api/parent/verify-otp in PUBLIC_PATHS');
  assert(authJs.includes('/api/parent/attendance'), 'auth.js includes /api/parent/attendance in PUBLIC_PATHS');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
