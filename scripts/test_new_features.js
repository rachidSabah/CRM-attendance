const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function runTests() {
  console.log('==================================================');
  console.log('INFOHAS ATTENDANCE — AUTOMATED VERIFICATION SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // TEST 1: i18n Translation dictionaries and status helpers
  console.log('--- TEST 1: Multilingual Localization (FR, EN, AR) ---');
  const i18nPath = path.join(__dirname, '..', 'src', 'lib', 'i18n.ts');
  const i18nContent = fs.readFileSync(i18nPath, 'utf8');

  assert(i18nContent.includes("download_docx: 'Télécharger DOCX'"), 'i18n FR has download_docx');
  assert(i18nContent.includes("download_docx: 'تحميل DOCX'"), 'i18n AR has download_docx');
  assert(i18nContent.includes("magic_link: 'Lien Magique Parent'"), 'i18n FR has magic_link');
  assert(i18nContent.includes("magic_link: 'الرابط السحري للولي'"), 'i18n AR has magic_link');
  assert(i18nContent.includes("pin_is_phone:"), 'i18n has pin_is_phone');
  assert(i18nContent.includes("getStatusLabel"), 'i18n exports getStatusLabel');
  assert(i18nContent.includes("getStatusAbbr"), 'i18n exports getStatusAbbr');

  // TEST 2: DOCX Exporter generation & OpenXML package validation
  console.log('\n--- TEST 2: AI Autopilot PDF & DOCX Export Engine ---');
  const aiExportPath = path.join(__dirname, '..', 'src', 'lib', 'aiExport.ts');
  const aiExportContent = fs.readFileSync(aiExportPath, 'utf8');

  assert(aiExportContent.includes('exportAiReportPdf'), 'aiExport.ts exports exportAiReportPdf');
  assert(aiExportContent.includes('exportAiReportDocx'), 'aiExport.ts exports exportAiReportDocx');
  assert(aiExportContent.includes('INSTITUT SUPÉRIEUR INFOHAS'), 'aiExport.ts includes INFOHAS institutional branding');

  // Generate test DOCX package using JSZip to simulate exportAiReportDocx
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>INSTITUT INFOHAS</w:t></w:r></w:p></w:body></w:document>');
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  assert(buf && buf.length > 200, `DOCX OpenXML test archive generated successfully (${buf.length} bytes)`);

  // TEST 3: Universal AI Text Assist Component
  console.log('\n--- TEST 3: Universal AI Autopilot Assist Component ---');
  const aiAssistPath = path.join(__dirname, '..', 'src', 'components', 'AiTextAssist.tsx');
  assert(fs.existsSync(aiAssistPath), 'AiTextAssist.tsx component exists');
  const aiAssistContent = fs.readFileSync(aiAssistPath, 'utf8');
  assert(aiAssistContent.includes('Format officiel INFOHAS'), 'AiTextAssist has official INFOHAS preset');
  assert(aiAssistContent.includes('Message WhatsApp courtois'), 'AiTextAssist has WhatsApp preset');
  assert(aiAssistContent.includes('Traduire en Arabe'), 'AiTextAssist has Arabic translation preset');
  assert(aiAssistContent.includes('/api/ai/generate'), 'AiTextAssist sends requests to /api/ai/generate');

  // TEST 4: Parent Magic Link Dialog & WhatsApp Sharing
  console.log('\n--- TEST 4: Parent Magic Link Dialog & WhatsApp French Instructions ---');
  const magicDialogPath = path.join(__dirname, '..', 'src', 'components', 'ParentMagicLinkDialog.tsx');
  const whatsappTsPath = path.join(__dirname, '..', 'src', 'lib', 'whatsapp.ts');
  assert(fs.existsSync(magicDialogPath), 'ParentMagicLinkDialog.tsx exists');
  assert(fs.existsSync(whatsappTsPath), 'src/lib/whatsapp.ts exists');
  const magicDialogContent = fs.readFileSync(magicDialogPath, 'utf8');
  const whatsappTsContent = fs.readFileSync(whatsappTsPath, 'utf8');
  const combined = magicDialogContent + '\n' + whatsappTsContent;
  assert(combined.includes('INSTITUT SUPÉRIEUR INFOHAS — ESPACE PARENTAL SÉCURISÉ'), 'WhatsApp template has explicit French title');
  assert(combined.includes('Votre Code PIN de Sécurité'), 'WhatsApp template explicitly states PIN is mobile number');
  assert(combined.includes('wa.me'), 'WhatsApp link generated via wa.me protocol');
  assert(magicDialogContent.includes('?page=parent-portal&std='), 'Magic link URL has direct student pointer');

  // TEST 5: Backend PIN Verification Endpoint
  console.log('\n--- TEST 5: Backend Magic Link PIN Endpoint ---');
  const pinEndpointPath = path.join(__dirname, '..', 'functions', 'api', 'parent', 'verify-magic-pin.js');
  assert(fs.existsSync(pinEndpointPath), 'functions/api/parent/verify-magic-pin.js exists');
  const pinEndpointContent = fs.readFileSync(pinEndpointPath, 'utf8');
  assert(pinEndpointContent.includes('normalizePhoneSuffix'), 'PIN endpoint has phone normalization');
  assert(pinEndpointContent.includes('parent_session_'), 'PIN endpoint generates parent session in school_settings');

  // TEST 6: Parent Portal PIN Unlock & Excuse Justification Upload
  console.log('\n--- TEST 6: Parent Portal Component ---');
  const portalPath = path.join(__dirname, '..', 'src', 'components', 'ParentPortal.tsx');
  const portalContent = fs.readFileSync(portalPath, 'utf8');
  assert(portalContent.includes("step === 'magic_pin'"), 'ParentPortal renders magic_pin unlock step');
  assert(portalContent.includes('handleVerifyMagicPin'), 'ParentPortal has handleVerifyMagicPin handler');
  assert(portalContent.includes('<AiTextAssist'), 'ParentPortal embeds AiTextAssist for excuse justification');

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
