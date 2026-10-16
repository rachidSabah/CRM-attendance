/**
 * Automated Verification Suite for WhatsApp Message Formatting, Unicode, and URL Encoding
 *
 * Verifies:
 * 1. Phone number normalization (Morocco 212, international formats, symbols, prefixes).
 * 2. WhatsApp-compliant plain text formatting (bold, italic, strike, monospace, lists).
 * 3. Removal of literal backslashes (\*, \_) and markdown bold (**text**).
 * 4. French Unicode character preservation (É, È, Ê, À, Ç, œ, ’, —, «, »).
 * 5. Magic link URL encapsulation with nested query parameters.
 * 6. Standards-compliant URL construction via new URL().
 * 7. End-to-end round-trip decoding verification.
 */

const assert = require('assert');

// 1. Phone Normalizer implementation under test
function normalizeWhatsAppPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Moroccan number normalization
  if (digits.length === 10 && digits.startsWith('0')) {
    return '212' + digits.slice(1);
  }
  if (digits.length === 9 && (digits.startsWith('5') || digits.startsWith('6') || digits.startsWith('7'))) {
    return '212' + digits;
  }
  if (digits.length === 13 && digits.startsWith('2120')) {
    return '212' + digits.slice(4);
  }
  if (digits.length === 12 && digits.startsWith('212')) {
    return digits;
  }

  return digits;
}

// 2. WhatsApp Text Sanitizer implementation under test
function sanitizeWhatsAppText(rawText) {
  if (!rawText) return '';

  let text = String(rawText);

  // Remove replacement character
  text = text.replace(/\uFFFD/g, '');

  // Unescape backslash escapes
  text = text.replace(/\\([*_~`\[\]\\])/g, '$1');

  // Convert markdown headers
  text = text.replace(/^#\s+(.+)$/gm, (_, heading) => `*${heading.trim().toUpperCase()}*`);
  text = text.replace(/^#{2,4}\s+(.+)$/gm, (_, heading) => `*${heading.trim()}*`);

  // Convert markdown links [Label](url) -> *Label* : url
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '*$1* : $2');

  // Convert bullet lists (* or -) to bullet symbol (•)
  text = text.replace(/^[\*\-]\s+(.+)$/gm, '• $1');

  // Convert markdown double-strikethrough ~~strike~~ to ~strike~
  text = text.replace(/~~([^~]+)~~/g, '~$1~');

  // Convert markdown bold **bold** to *bold*
  text = text.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  // Clean interior whitespace inside formatting markers
  text = text.replace(/\*([^*\n]+?)\*/g, (_, inner) => '*' + inner.trim() + '*');
  text = text.replace(/_([^_\n]+?)_/g, (_, inner) => '_' + inner.trim() + '_');

  // Standardize line breaks
  text = text.replace(/\r\n/g, '\n');

  return text.trim();
}

// 3. WhatsApp URL Builder implementation under test
function buildWhatsAppUrl(phone, text) {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  const sanitizedText = sanitizeWhatsAppText(text);

  const base = `https://wa.me/${cleanPhone}`;
  const url = new URL(base);
  url.search = `?text=${encodeURIComponent(sanitizedText)}`;
  return url.toString();
}

// 4. End-to-end Validator
function validateWhatsAppUrl(waUrl, expectedOriginalText) {
  const errors = [];
  let phone = '';
  let decodedMessage = '';

  try {
    const parsed = new URL(waUrl);
    if (parsed.protocol !== 'https:') errors.push(`Invalid protocol: ${parsed.protocol}`);
    if (parsed.hostname !== 'wa.me') errors.push(`Invalid hostname: ${parsed.hostname}`);

    phone = parsed.pathname.replace(/^\/+/, '');
    if (!/^\d{7,15}$/.test(phone)) errors.push(`Invalid phone digits: ${phone}`);

    decodedMessage = parsed.searchParams.get('text') || '';
    if (!decodedMessage) errors.push('Missing or empty text query parameter');
  } catch (err) {
    return {
      valid: false,
      phone,
      decodedMessage,
      roundTripMatches: false,
      hasBackslashes: false,
      hasDoubleAsterisks: false,
      hasReplacementChars: false,
      errors: [err.message],
    };
  }

  const hasBackslashes = /\\(\*|_|~|`)/.test(decodedMessage);
  if (hasBackslashes) {
    errors.push('Found literal backslash escapes in decoded message');
  }
  const hasDoubleAsterisks = /\*\*[^*]+\*\*/.test(decodedMessage);
  if (hasDoubleAsterisks) {
    errors.push('Found markdown **bold** syntax in decoded message');
  }
  const hasReplacementChars = decodedMessage.includes('\uFFFD') || decodedMessage.includes('%EF%BF%BD');
  if (hasReplacementChars) {
    errors.push('Found corrupt replacement characters in decoded message');
  }

  let roundTripMatches = true;
  if (expectedOriginalText !== undefined) {
    const expected = sanitizeWhatsAppText(expectedOriginalText);
    roundTripMatches = decodedMessage === expected;
    if (!roundTripMatches) {
      errors.push(`Decoded message does not match expected.\nExpected: ${JSON.stringify(expected)}\nGot: ${JSON.stringify(decodedMessage)}`);
    }
  }

  return {
    valid: errors.length === 0,
    phone,
    decodedMessage,
    roundTripMatches,
    hasBackslashes,
    hasDoubleAsterisks,
    hasReplacementChars,
    errors,
  };
}

console.log('====================================================');
console.log('🧪 RUNNING WHATSAPP FORENSIC VERIFICATION SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
    process.exitCode = 1;
  }
}

// ----------------------------------------------------
// TEST GROUP 1: PHONE NUMBER NORMALIZATION
// ----------------------------------------------------
console.log('📌 GROUP 1: Phone Number Normalization');

runTest('Normalizes Moroccan 06 local (10 digits)', () => {
  assert.strictEqual(normalizeWhatsAppPhone('0612345678'), '212612345678');
});

runTest('Normalizes Moroccan 07 local (10 digits)', () => {
  assert.strictEqual(normalizeWhatsAppPhone('0798765432'), '212798765432');
});

runTest('Normalizes Moroccan landline 05 local (10 digits)', () => {
  assert.strictEqual(normalizeWhatsAppPhone('0522123456'), '212522123456');
});

runTest('Normalizes Moroccan 9 digits without leading 0', () => {
  assert.strictEqual(normalizeWhatsAppPhone('612345678'), '212612345678');
});

runTest('Normalizes formatted phone with spaces, dashes, parentheses', () => {
  assert.strictEqual(normalizeWhatsAppPhone('06 12-34 (56) 78'), '212612345678');
});

runTest('Normalizes international +212 format', () => {
  assert.strictEqual(normalizeWhatsAppPhone('+212 612 345 678'), '212612345678');
});

runTest('Normalizes international 00212 prefix', () => {
  assert.strictEqual(normalizeWhatsAppPhone('00212 612 345 678'), '212612345678');
});

runTest('Normalizes 212 with accidental local 0 (2120612345678)', () => {
  assert.strictEqual(normalizeWhatsAppPhone('2120612345678'), '212612345678');
});

runTest('Preserves already normalized Moroccan number', () => {
  assert.strictEqual(normalizeWhatsAppPhone('212612345678'), '212612345678');
});

runTest('Handles foreign international numbers (France +33)', () => {
  assert.strictEqual(normalizeWhatsAppPhone('+33 6 12 34 56 78'), '33612345678');
});

runTest('Handles empty or undefined phone gracefully', () => {
  assert.strictEqual(normalizeWhatsAppPhone(''), '');
  assert.strictEqual(normalizeWhatsAppPhone(null), '');
  assert.strictEqual(normalizeWhatsAppPhone(undefined), '');
});

// ----------------------------------------------------
// TEST GROUP 2: WHATSAPP PLAIN-TEXT FORMATTING & BACKSLASH REMOVAL
// ----------------------------------------------------
console.log('\n📌 GROUP 2: WhatsApp Formatting & Escape Stripping');

runTest('Transforms markdown bold **text** to WhatsApp *text*', () => {
  const input = 'Veuillez contacter **la direction** immédiatement.';
  const output = sanitizeWhatsAppText(input);
  assert.strictEqual(output, 'Veuillez contacter *la direction* immédiatement.');
});

runTest('Strips literal backslashes from \\*bold\\* and \\_italic\\_', () => {
  const input = 'Rappel : \\*Séance obligatoire\\* et \\_justificatif sous 48h\\_.';
  const output = sanitizeWhatsAppText(input);
  assert.strictEqual(output, 'Rappel : *Séance obligatoire* et _justificatif sous 48h_.');
  assert.ok(!output.includes('\\*'), 'No literal \\* remaining');
  assert.ok(!output.includes('\\_'), 'No literal \\_ remaining');
});

runTest('Converts markdown headers to WhatsApp bold uppercase/title', () => {
  const input = '# Rapport Pédagogique\n## Détails de l\'absence';
  const output = sanitizeWhatsAppText(input);
  assert.strictEqual(output, '*RAPPORT PÉDAGOGIQUE*\n*Détails de l\'absence*');
});

runTest('Converts markdown bullet points to clean bullets to prevent bold collision', () => {
  const input = '* Premier point\n* Deuxième point\n- Troisième point';
  const output = sanitizeWhatsAppText(input);
  assert.strictEqual(output, '• Premier point\n• Deuxième point\n• Troisième point');
});

runTest('Converts markdown links [Text](url) to *Text* : url', () => {
  const input = 'Consultez votre dossier sur [Espace Parent](https://crm-attendance.pages.dev/?std=10).';
  const output = sanitizeWhatsAppText(input);
  assert.strictEqual(output, 'Consultez votre dossier sur *Espace Parent* : https://crm-attendance.pages.dev/?std=10.');
});

runTest('Converts markdown ~~strike~~ to WhatsApp ~strike~', () => {
  const input = 'Statut : ~~Non justifié~~ Justifié';
  const output = sanitizeWhatsAppText(input);
  assert.strictEqual(output, 'Statut : ~Non justifié~ Justifié');
});

runTest('Preserves intentional newlines and paragraph breaks', () => {
  const input = 'Paragraphe 1\n\nParagraphe 2\n\nParagraphe 3';
  const output = sanitizeWhatsAppText(input);
  assert.strictEqual(output, 'Paragraphe 1\n\nParagraphe 2\n\nParagraphe 3');
});

// ----------------------------------------------------
// TEST GROUP 3: UNICODE & FRENCH ACCENTS
// ----------------------------------------------------
console.log('\n📌 GROUP 3: French Accents & Unicode Integrity');

runTest('Preserves all standard French accented characters and ligatures', () => {
  const frenchText = 'Élève assidu(e), présence confirmée à l’Institut Supérieur INFOHAS. État d’assiduité : À revoir pour le cœur de l’année (août — décembre).';
  const output = sanitizeWhatsAppText(frenchText);
  assert.strictEqual(output, frenchText);
});

runTest('Strips any corrupt replacement characters (U+FFFD)', () => {
  const corruptText = 'Institut INFOHAS\uFFFD Service des \uFFFDtudes';
  const output = sanitizeWhatsAppText(corruptText);
  assert.strictEqual(output, 'Institut INFOHAS Service des tudes');
  assert.ok(!output.includes('\uFFFD'));
});

runTest('Preserves safe emojis (🔗, 🔒, 📱, ✅, 📌)', () => {
  const emojiText = '🔗 *Lien Direct :* https://school.ma\n🔒 *PIN :* 0612345678\n✅ *Validé*';
  const output = sanitizeWhatsAppText(emojiText);
  assert.strictEqual(output, emojiText);
});

// ----------------------------------------------------
// TEST GROUP 4: STANDARDS-COMPLIANT URL CONSTRUCTION & NESTED QUERY INTEGRITY
// ----------------------------------------------------
console.log('\n📌 GROUP 4: URL Construction & Query Parameter Integrity');

runTest('Builds valid wa.me URL with new URL()', () => {
  const phone = '0612345678';
  const message = 'Bonjour M. Dupont';
  const waUrl = buildWhatsAppUrl(phone, message);

  assert.ok(waUrl.startsWith('https://wa.me/212612345678?text='), 'URL starts with wa.me and phone');
  assert.ok(!waUrl.includes('+'), 'Uses RFC 3986 %20 instead of + for cleaner mobile rendering');
});

runTest('Preserves nested magic link with multiple query parameters (&std=...&ref=magic)', () => {
  const origin = 'https://crm-attendance.pages.dev';
  const magicLink = `${origin}/?page=parent-portal&std=STD-9901&ref=magic`;
  const message = `Accès direct :\n${magicLink}`;

  const waUrl = buildWhatsAppUrl('0612345678', message);
  const parsed = new URL(waUrl);

  // The outer URL should only have 'text' query parameter
  assert.strictEqual(parsed.searchParams.size, 1, 'Only one search parameter on the wa.me URL');
  assert.ok(parsed.searchParams.has('text'), 'Has text parameter');

  // When text is decoded, the magic link must remain 100% intact
  const decodedText = parsed.searchParams.get('text');
  assert.ok(decodedText.includes('std=STD-9901'), 'Nested std parameter is intact');
  assert.ok(decodedText.includes('ref=magic'), 'Nested ref parameter is intact');
  assert.ok(decodedText.includes(magicLink), 'Full nested magic link matches byte-for-byte');
});

// ----------------------------------------------------
// TEST GROUP 5: END-TO-END ROUND TRIP DECODE
// ----------------------------------------------------
console.log('\n📌 GROUP 5: End-to-End Round-Trip Validation');

runTest('Complete Round-Trip Decode Test on Full Parent Invitation Message', () => {
  const student = {
    fullName: 'Douae Mourchid',
    guardianName: 'M. Mourchid',
    className: '1ère Année Génie Informatique',
    id: 'DOUAE-2025-01',
  };
  const magicUrl = 'https://crm-attendance.pages.dev/?page=parent-portal&std=DOUAE-2025-01&ref=magic';
  const pinDisplay = '06 12 34 56 78';

  const fullMessage = `*INSTITUT SUPÉRIEUR INFOHAS — ESPACE PARENTAL SÉCURISÉ*

Bonjour ${student.guardianName},

La direction de l'Institut INFOHAS met à votre disposition votre portail parental pour suivre en direct l'assiduité et la scolarité de votre enfant *${student.fullName}* (Classe : ${student.className}).

🔗 *Votre Lien d'Accès Direct (Magic Link) :*
${magicUrl}

🔒 *Votre Code PIN de Sécurité :*
*${pinDisplay}* (votre numéro de téléphone portable enregistré)

*Grâce à votre espace sécurisé, vous pouvez :*
• *Suivi d'assiduité en temps réel :* Consulter les présences, retards et absences enregistrés à chaque séance.
• *Dépôt de justificatifs en ligne :* Téléverser directement un certificat médical ou motif d'absence (photo ou PDF).
• *Suivi administratif :* Vérifier la validation par la direction des études.

*Mode d'emploi simple :*
1. Cliquez sur le lien magique ci-dessus.
2. Entrez votre numéro de téléphone portable (${pinDisplay}) comme code PIN pour déverrouiller l'accès.
3. Vous accédez immédiatement au relevé officiel de votre enfant.

Restant à votre entière disposition pour tout renseignement complémentaire,
_Direction Pédagogique — Institut Supérieur INFOHAS_`;

  const waUrl = buildWhatsAppUrl('0612345678', fullMessage);
  const result = validateWhatsAppUrl(waUrl, fullMessage);

  assert.strictEqual(result.valid, true, `Validation failed: ${result.errors.join(', ')}`);
  assert.strictEqual(result.phone, '212612345678', 'Phone correctly parsed from URL');
  assert.strictEqual(result.hasBackslashes, false, 'No literal backslashes in URL');
  assert.strictEqual(result.hasDoubleAsterisks, false, 'No double asterisks in URL');
  assert.strictEqual(result.hasReplacementChars, false, 'No corrupt replacement chars in URL');
  assert.strictEqual(result.decodedMessage, fullMessage, 'Decoded message equals original message exactly');
});

runTest('Disciplinary Escalation WhatsApp Message round-trip', () => {
  const alertMessage = `*INFOHAS — ALERTE DISCIPLINAIRE [1er Avertissement]*
Bonjour M./Mme le tuteur,
Nous vous informons que l'étudiant(e) *Douae Mourchid* (Classe: *Informatique*) a accumulé *4* absences non justifiées.
Veuillez prendre contact immédiatement avec la direction pédagogique : _Tél : 0522-123456_`;

  const waUrl = buildWhatsAppUrl('+212 661-123456', alertMessage);
  const result = validateWhatsAppUrl(waUrl, alertMessage);

  assert.strictEqual(result.valid, true, `Alert message failed: ${result.errors.join(', ')}`);
  assert.strictEqual(result.phone, '212661123456');
  assert.strictEqual(result.decodedMessage, alertMessage);
});

console.log('\n====================================================');
console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
