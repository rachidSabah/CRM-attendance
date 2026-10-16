/**
 * INFOHAS Attendance — Unified WhatsApp Utility & Protocol Engine
 *
 * Handles:
 * 1. International Phone Number Normalization (Morocco 212 default, international support).
 * 2. WhatsApp-compliant plain text formatting (Bold: *text*, Italic: _text_, Strikethrough: ~text~, Monospace: ```text```).
 * 3. Removal of literal backslashes (\*, \_) and accidental markdown escapes (**text** -> *text*).
 * 4. Pristine UTF-8 Unicode preservation for French accents (É, È, Ê, À, Ç, œ, —, ’, «, ») and safe emojis.
 * 5. Standards-compliant URL construction via `new URL()` with single-encoding query parameters.
 * 6. Interactive rich preview parsing for WhatsApp-styled UI rendering.
 */

import type { Student } from './types';

/**
 * Normalizes any user-entered phone number into standard international digits for WhatsApp.
 * - Removes non-digit characters (+, -, ., spaces, parentheses).
 * - Strips leading double-zeros '00'.
 * - Morocco local numbers:
 *   - '06XXXXXXXX', '07XXXXXXXX', '05XXXXXXXX' (10 digits starting with 0) -> '212' + 9 digits.
 *   - '6XXXXXXXX', '7XXXXXXXX', '5XXXXXXXX' (9 digits) -> '212' + 9 digits.
 *   - '00212XXXXXXXXX' -> '212XXXXXXXXX'.
 *   - '+212XXXXXXXXX' -> '212XXXXXXXXX'.
 * - International numbers:
 *   - Preserves country code without '+' or '00'.
 */
export function normalizeWhatsAppPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // Strip leading 00 (international prefix)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Moroccan number normalization
  // Case A: 10 digits starting with 0 (e.g., 0612345678, 0712345678, 0522123456)
  if (digits.length === 10 && digits.startsWith('0')) {
    return '212' + digits.slice(1);
  }

  // Case B: 9 digits starting with 5, 6, or 7 (e.g., 612345678)
  if (digits.length === 9 && (digits.startsWith('5') || digits.startsWith('6') || digits.startsWith('7'))) {
    return '212' + digits;
  }

  // Case C: 12 digits starting with 212 and local starting with 0 (e.g., 2120612345678)
  if (digits.length === 13 && digits.startsWith('2120')) {
    return '212' + digits.slice(4);
  }

  // Case D: Already 12 digits starting with 212 (e.g., 212612345678)
  if (digits.length === 12 && digits.startsWith('212')) {
    return digits;
  }

  // Case E: French number with leading 0 (e.g., 0612345678 in France context if 10 digits)
  // If not Moroccan, return digits as-is (e.g. US 1XXXXXXXXXX, UK 44XXXXXXXXXX)
  return digits;
}

/**
 * Formats a phone number for user-facing UI display (e.g. +212 6 12 34 56 78).
 */
export function formatPhoneDisplay(phone: string | undefined | null): string {
  if (!phone) return 'Numéro non renseigné';
  const norm = normalizeWhatsAppPhone(phone);
  if (!norm) return String(phone);

  if (norm.startsWith('212') && norm.length === 12) {
    const p1 = norm.slice(0, 3);
    const p2 = norm.slice(3, 4);
    const p3 = norm.slice(4, 6);
    const p4 = norm.slice(6, 8);
    const p5 = norm.slice(8, 10);
    const p6 = norm.slice(10, 12);
    return `+${p1} ${p2} ${p3} ${p4} ${p5} ${p6}`;
  }

  if (norm.startsWith('33') && norm.length === 11) {
    return `+33 ${norm.slice(2, 3)} ${norm.slice(3, 5)} ${norm.slice(5, 7)} ${norm.slice(7, 9)} ${norm.slice(9, 11)}`;
  }

  return `+${norm}`;
}

/**
 * Sanitizes and formats text specifically for WhatsApp plain-text rendering.
 *
 * WhatsApp formatting rules:
 * - *bold*
 * - _italic_
 * - ~strikethrough~
 * - ```monospace```
 *
 * Enforces:
 * - Converts markdown double asterisks `**bold**` -> `*bold*`
 * - Removes unintended backslash escapes: `\*` -> `*`, `\_` -> `_`, `\~` -> `~`
 * - Converts markdown strikethrough `~~strike~~` -> `~strike~`
 * - Converts markdown headers `# Title` -> `*TITLE*`
 * - Converts markdown links `[Label](url)` -> `*Label* : url`
 * - Converts markdown list markers `* item` or `- item` -> `• item` (prevents unclosed asterisk collisions)
 * - Removes any corrupted replacement character (U+FFFD)
 * - Preserves line breaks and paragraph spacing.
 */
export function sanitizeWhatsAppText(rawText: string): string {
  if (!rawText) return '';

  let text = String(rawText);

  // 1. Remove U+FFFD (replacement character) if encountered
  text = text.replace(/\uFFFD/g, '');

  // 2. Unescape escaped markdown characters (\*, \_, \~, \`, \[)
  text = text.replace(/\\([*_~`\[\]\\])/g, '$1');

  // 3. Convert markdown headers:
  // # Heading 1 -> *HEADING 1*
  // ## Heading 2 -> *Heading 2*
  // ### Heading 3 -> *Heading 3*
  text = text.replace(/^#\s+(.+)$/gm, (_, heading) => `*${heading.trim().toUpperCase()}*`);
  text = text.replace(/^#{2,4}\s+(.+)$/gm, (_, heading) => `*${heading.trim()}*`);

  // 4. Convert markdown links [Label](url) -> *Label* : url
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '*$1* : $2');

  // 5. Convert markdown bullet lists (* item or - item) to bullet symbol (• item)
  // This is crucial because a starting asterisk `* item` will otherwise conflict with WhatsApp bold pairing!
  text = text.replace(/^[\*\-]\s+(.+)$/gm, '• $1');

  // 6. Convert markdown double-strikethrough ~~strike~~ to WhatsApp single-tilde ~strike~
  text = text.replace(/~~([^~]+)~~/g, '~$1~');

  // 7. Convert markdown bold **bold** to WhatsApp *bold*
  text = text.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  // 8. Clean up interior whitespace inside bold/italic markers that breaks WhatsApp formatting
  // WhatsApp requires: *word* NOT * word *
  text = text.replace(/\*([^*\n]+?)\*/g, (_, inner) => '*' + inner.trim() + '*');
  text = text.replace(/_([^_\n]+?)_/g, (_, inner) => '_' + inner.trim() + '_');

  // 9. Standardize line breaks (\r\n -> \n)
  text = text.replace(/\r\n/g, '\n');

  return text.trim();
}

/**
 * Replaces placeholders in a template and formats for WhatsApp.
 */
export function formatWhatsAppText(
  template: string,
  variables: Record<string, string | number | undefined | null> = {}
): string {
  if (!template) return '';

  let result = template;
  for (const [key, val] of Object.entries(variables)) {
    const safeVal = val !== undefined && val !== null ? String(val) : '';
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, safeVal);
  }

  return sanitizeWhatsAppText(result);
}

/**
 * Safely constructs a 100% standards-compliant WhatsApp Web / Mobile URL.
 * - Uses native `URL` class.
 * - Single-encodes parameters via RFC 3986 percent-encoding (%20 for spaces).
 * - Guarantees that query parameters inside nested URLs (such as magic links) are safely encapsulated.
 */
export function buildWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  const sanitizedText = sanitizeWhatsAppText(text);

  const base = `https://wa.me/${cleanPhone}`;
  const url = new URL(base);

  // Use percent-encoding for text query parameter
  // encodeURIComponent produces RFC 3986 with %20 for spaces, optimal for WhatsApp Web & Mobile
  url.search = `?text=${encodeURIComponent(sanitizedText)}`;

  return url.toString();
}

/**
 * Generates the official parental portal invitation message in French.
 * Incorporates:
 * - Dynamic student, class, matricule, and guardian details.
 * - Direct Magic Link with preserved query parameters.
 * - Explicit instructions on using the mobile number as PIN.
 * - WhatsApp-compliant formatting (*bold*, _italic_, clean bullets).
 * - Pristine French accents and robust Unicode emojis.
 */
export function buildParentMagicLinkMessage(params: {
  student: Student;
  magicUrl: string;
  pinDisplay: string;
  schoolName?: string;
}): string {
  const { student, magicUrl, pinDisplay, schoolName = 'Institut Supérieur INFOHAS' } = params;
  const guardianGreeting = student.guardianName ? `Bonjour ${student.guardianName},` : 'Bonjour Madame, Monsieur,';
  const studentDisplay = student.fullName || 'votre enfant';
  const classDisplay = student.className || student.group || 'Promotion 2025-2026';

  const rawMessage = `*INSTITUT SUPÉRIEUR INFOHAS — ESPACE PARENTAL SÉCURISÉ*

${guardianGreeting}

La direction de l'${schoolName} met à votre disposition votre portail parental pour suivre en direct l'assiduité et la scolarité de votre enfant *${studentDisplay}* (Classe : ${classDisplay}).

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
_Direction Pédagogique — ${schoolName}_`;

  return sanitizeWhatsAppText(rawMessage);
}

/**
 * Validates a WhatsApp URL and performs an end-to-end round-trip decode verification.
 */
export function validateWhatsAppUrl(
  waUrl: string,
  expectedOriginalText?: string
): {
  valid: boolean;
  phone: string;
  decodedMessage: string;
  roundTripMatches: boolean;
  hasBackslashes: boolean;
  hasDoubleAsterisks: boolean;
  hasReplacementChars: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let phone = '';
  let decodedMessage = '';

  try {
    const parsed = new URL(waUrl);

    if (parsed.protocol !== 'https:') {
      errors.push(`Protocole invalide: ${parsed.protocol} (attendu: https:)`);
    }

    if (parsed.hostname !== 'wa.me' && parsed.hostname !== 'api.whatsapp.com') {
      errors.push(`Hôte invalide: ${parsed.hostname} (attendu: wa.me)`);
    }

    phone = parsed.pathname.replace(/^\/+/, '');
    if (!/^\d{7,15}$/.test(phone)) {
      errors.push(`Numéro de téléphone invalide dans le chemin d'accès: "${phone}"`);
    }

    decodedMessage = parsed.searchParams.get('text') || '';
    if (!decodedMessage) {
      errors.push('Paramètre de message "text" absent ou vide');
    }
  } catch (err: any) {
    errors.push(`URL invalide: ${err.message}`);
    return {
      valid: false,
      phone,
      decodedMessage,
      roundTripMatches: false,
      hasBackslashes: false,
      hasDoubleAsterisks: false,
      hasReplacementChars: false,
      errors,
    };
  }

  const hasBackslashes = /\\(\*|_|~|`)/.test(decodedMessage);
  if (hasBackslashes) {
    errors.push('Le message contient des barres obliques de protection littérales (\\*, \\_)');
  }

  const hasDoubleAsterisks = /\*\*[^*]+\*\*/.test(decodedMessage);
  if (hasDoubleAsterisks) {
    errors.push('Le message contient une syntaxe Markdown double astérisque (**text**) incompatible WhatsApp');
  }

  const hasReplacementChars = decodedMessage.includes('\uFFFD') || decodedMessage.includes('%EF%BF%BD');
  if (hasReplacementChars) {
    errors.push('Le message contient des caractères corrompus de remplacement (U+FFFD)');
  }

  let roundTripMatches = true;
  if (expectedOriginalText !== undefined) {
    const expectedSanitized = sanitizeWhatsAppText(expectedOriginalText);
    roundTripMatches = decodedMessage === expectedSanitized;
    if (!roundTripMatches) {
      errors.push('Le décodage aller-retour ne correspond pas exactement au texte source original');
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

/**
 * Segment definition for rendering formatted WhatsApp preview in UI.
 */
export interface WhatsAppPreviewSegment {
  type: 'text' | 'bold' | 'italic' | 'strike' | 'code' | 'link';
  content: string;
  url?: string;
}

/**
 * Parses WhatsApp formatting (*bold*, _italic_, ~strike~, ```code```, urls) into structured segments
 * for live visual preview in React components.
 */
export function parseWhatsAppForPreview(text: string): WhatsAppPreviewSegment[] {
  if (!text) return [];

  // Match:
  // 1. URLs
  // 2. Bold: *text* (no inner whitespace at edges)
  // 3. Italic: _text_ (no inner whitespace at edges)
  // 4. Strikethrough: ~text~
  // 5. Monospace: ```text``` or `text`
  const regex = /(https?:\/\/[^\s]+)|\*([^*\n]+?)\*|_([^_/\n]+?)_|~([^~\n]+?)~|```([^`]+?)```|`([^`\n]+?)`/g;

  const segments: WhatsAppPreviewSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    if (match[1]) {
      // URL
      segments.push({
        type: 'link',
        content: match[1],
        url: match[1],
      });
    } else if (match[2]) {
      // *bold*
      segments.push({
        type: 'bold',
        content: match[2],
      });
    } else if (match[3]) {
      // _italic_
      segments.push({
        type: 'italic',
        content: match[3],
      });
    } else if (match[4]) {
      // ~strike~
      segments.push({
        type: 'strike',
        content: match[4],
      });
    } else if (match[5] || match[6]) {
      // code
      segments.push({
        type: 'code',
        content: match[5] || match[6],
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
