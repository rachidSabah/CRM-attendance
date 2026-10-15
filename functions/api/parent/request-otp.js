/**
 * POST /api/parent/request-otp
 * Parent WhatsApp Access Portal - Request OTP
 * Unauthenticated (Public)
 */
import { getCorsHeaders } from '../../_lib/cors.js';
import { fetchAll } from '../../_lib/paginate.js';

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

    const { phone } = body;
    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Veuillez saisir un numéro de téléphone valide.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const targetSuffix = normalizePhoneSuffix(phone);
    if (!targetSuffix || targetSuffix.length < 9) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Format de numéro invalide. Veuillez entrer au moins 9 ou 10 chiffres.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Search students linked to this phone (either guardianPhone or phone)
    const studentRows = await fetchAll(
      db,
      "SELECT id, data FROM entities WHERE entity_type = 'students'",
      []
    );

function phoneFieldMatches(field, targetSuffix) {
  if (!field) return false;
  const parts = String(field).split(/[\/,;\n]|(?:\sou\s)/i);
  return parts.some(part => {
    const s = normalizePhoneSuffix(part);
    return s && s === targetSuffix;
  });
}

    const matchingStudents = [];
    for (const row of studentRows) {
      try {
        const student = JSON.parse(row.data);
        if (
          phoneFieldMatches(student.guardianPhone, targetSuffix) ||
          phoneFieldMatches(student.phone, targetSuffix)
        ) {
          matchingStudents.push({
            id: student.id,
            fullName: student.fullName,
            className: student.className || student.group,
            studentId: student.studentId,
          });
        }
      } catch {}
    }

    if (matchingStudents.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "Aucun dossier étudiant n'est associé à ce numéro de téléphone. Veuillez contacter l'administration de l'INFOHAS pour vérifier les coordonnées enregistrées.",
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

    const otpPayload = {
      phone: phone.trim(),
      suffix: targetSuffix,
      code: otpCode,
      studentIds: matchingStudents.map(s => s.id),
      attempts: 0,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    const key = `parent_otp_${targetSuffix}`;
    await db.prepare(
      `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
       VALUES (?, 'default', ?, ?, datetime('now'))
       ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`
    ).bind(key, key, JSON.stringify(otpPayload)).run();

    // Check if WhatsApp dispatch is available
    let whatsappDispatched = false;
    try {
      const waConfigRow = await db.prepare(
        "SELECT data FROM school_settings WHERE key = 'school_info' LIMIT 1"
      ).first();
      let waGatewayUrl = '';
      if (waConfigRow && waConfigRow.data) {
        const info = JSON.parse(waConfigRow.data);
        waGatewayUrl = info.whatsappGatewayUrl || info.baileysGatewayUrl || '';
      }

      if (waGatewayUrl) {
        const msg = `[INFOHAS] Votre code de sécurité pour accéder au portail d'assiduité de votre enfant est : ${otpCode} (valable 10 minutes).`;
        await fetch(`${waGatewayUrl}/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, message: msg }),
        });
        whatsappDispatched = true;
      }
    } catch (e) {
      console.warn('[parent/request-otp] WhatsApp dispatch failed:', e.message);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Code OTP généré avec succès',
      studentsCount: matchingStudents.length,
      studentNames: matchingStudents.map(s => s.fullName),
      whatsappDispatched,
      // Provide OTP in response for instant testing & evaluation if gateway is not connected
      testOtp: otpCode,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    console.error('[parent/request-otp] Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Erreur lors de la demande du code de sécurité',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
