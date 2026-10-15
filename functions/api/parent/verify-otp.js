/**
 * POST /api/parent/verify-otp
 * Parent WhatsApp Access Portal - Verify OTP & Issue Session Token
 * Unauthenticated (Public)
 */
import { getCorsHeaders } from '../../_lib/cors.js';

function normalizePhoneSuffix(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
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

    const { phone, otp } = body;
    if (!phone || !otp) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Le numéro de téléphone et le code OTP sont obligatoires.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const targetSuffix = normalizePhoneSuffix(phone);
    const key = `parent_otp_${targetSuffix}`;

    const row = await db.prepare(
      "SELECT data FROM school_settings WHERE key = ? LIMIT 1"
    ).bind(key).first();

    if (!row || !row.data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Aucune demande de code en attente ou le code a expiré. Veuillez redemander un code.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const record = JSON.parse(row.data);

    // Check expiration
    if (Date.now() > record.expiresAt) {
      await db.prepare("DELETE FROM school_settings WHERE key = ?").bind(key).run();
      return new Response(JSON.stringify({
        success: false,
        error: 'Le code OTP a expiré (validité 10 minutes). Veuillez redemander un nouveau code.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Verify OTP code
    if (String(record.code).trim() !== String(otp).trim()) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= 5) {
        await db.prepare("DELETE FROM school_settings WHERE key = ?").bind(key).run();
        return new Response(JSON.stringify({
          success: false,
          error: 'Nombre maximal de tentatives dépassé. Veuillez redemander un nouveau code.',
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }

      await db.prepare(
        "UPDATE school_settings SET data = ?, updated_at = datetime('now') WHERE key = ?"
      ).bind(JSON.stringify(record), key).run();

      return new Response(JSON.stringify({
        success: false,
        error: `Code de sécurité incorrect. Tentatives restantes : ${5 - record.attempts}`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // OTP Valid! Create parent session token (24 hours)
    const sessionToken = `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const sessionKey = `parent_session_${sessionToken}`;
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    const sessionPayload = {
      token: sessionToken,
      phone: record.phone,
      suffix: targetSuffix,
      studentIds: record.studentIds || [],
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    await db.prepare(
      `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
       VALUES (?, 'default', ?, ?, datetime('now'))`
    ).bind(sessionKey, sessionKey, JSON.stringify(sessionPayload)).run();

    // Remove used OTP
    await db.prepare("DELETE FROM school_settings WHERE key = ?").bind(key).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Authentification parent réussie',
      token: sessionToken,
      studentIds: record.studentIds || [],
      expiresAt,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    console.error('[parent/verify-otp] Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Erreur lors de la validation du code',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
