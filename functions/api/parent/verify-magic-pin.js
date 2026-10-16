/**
 * POST /api/parent/verify-magic-pin
 * Parent Magic Link PIN Authentication
 * Verifies that the entered PIN matches the student's registered mobile phone number.
 * Issues a valid parent session token for /api/parent/attendance.
 */
import { getCorsHeaders } from '../../_lib/cors.js';

function normalizePhoneSuffix(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

export async function onRequestPost(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  try {
    let body = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Corps JSON invalide' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const { studentId, pin } = body;
    if (!studentId || !pin) {
      return new Response(JSON.stringify({
        success: false,
        error: 'L’identifiant étudiant et le code PIN (numéro de mobile) sont requis.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const cleanPin = normalizePhoneSuffix(pin);
    if (!cleanPin || cleanPin.length < 6) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Veuillez saisir un numéro de téléphone portable valide.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Look up student in entities
    const row = await db.prepare(
      "SELECT id, data FROM entities WHERE entity_type = 'students' AND id = ? LIMIT 1"
    ).bind(studentId).first();

    if (!row || !row.data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dossier étudiant introuvable ou lien expiré.',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    let student = {};
    try {
      student = JSON.parse(row.data);
    } catch {
      student = {};
    }

    const guardianPhone = student.guardian_phone || student.guardianPhone || '';
    const studentPhone = student.phone || student.student_phone || '';

    const suffixGuardian = normalizePhoneSuffix(guardianPhone);
    const suffixStudent = normalizePhoneSuffix(studentPhone);

    const matches = (suffixGuardian && suffixGuardian === cleanPin) ||
                    (suffixStudent && suffixStudent === cleanPin);

    if (!matches) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Code PIN incorrect. Le code PIN doit correspondre au numéro de téléphone portable du parent enregistré auprès de l’INFOHAS.',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // PIN is valid! Create parent session token (48 hours validity)
    const sessionToken = `pt_magic_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const sessionKey = `parent_session_${sessionToken}`;
    const expiresAt = Date.now() + 48 * 60 * 60 * 1000;

    const sessionPayload = {
      token: sessionToken,
      phone: guardianPhone || studentPhone,
      suffix: cleanPin,
      studentIds: [studentId],
      isMagicLink: true,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    await db.prepare(
      `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
       VALUES (?, 'default', ?, ?, datetime('now'))`
    ).bind(sessionKey, sessionKey, JSON.stringify(sessionPayload)).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Authentification réussie par Magic Link PIN',
      token: sessionToken,
      studentId: studentId,
      studentName: student.fullName || student.name || 'Étudiant',
      expiresAt,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    console.error('[parent/verify-magic-pin] Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Erreur lors de la validation du code PIN',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
