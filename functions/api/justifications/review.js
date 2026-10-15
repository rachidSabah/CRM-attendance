/**
 * Cloudflare Pages Function — Admin Excuse Justification Review
 *
 * Route: POST /api/justifications/review
 *
 * Allows admins to approve or reject absence justifications.
 * When approved, automatically updates the matching attendance record to 'excused'.
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

export async function onRequestPost(context) {
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  try {
    let body = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    const { id, status, reviewNotes = '' } = body;
    if (!id || !['approved', 'rejected'].includes(status)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid id and status ("approved" or "rejected") are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    const db = context.env.DB;
    const tenantId = auth.user?.tenantId || 'default';
    const nowIso = new Date().toISOString();

    // 1. Fetch current justification
    const row = await db.prepare(
      `SELECT data FROM entities WHERE tenant_id = ? AND entity_type = 'justifications' AND id = ?`
    ).bind(tenantId, id).first();

    if (!row) {
      return new Response(
        JSON.stringify({ success: false, error: 'Justification introuvable' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    let justificationData = {};
    try { justificationData = JSON.parse(row.data); } catch {}

    justificationData.status = status;
    justificationData.reviewedAt = nowIso;
    justificationData.reviewedBy = auth.user?.fullName || auth.user?.username || 'Direction';
    justificationData.reviewNotes = reviewNotes;

    await db.prepare(
      `UPDATE entities SET data = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND entity_type = 'justifications' AND id = ?`
    ).bind(JSON.stringify(justificationData), tenantId, id).run();

    // 2. If approved, automatically update attendance status in D1 to 'excused'
    let attendanceUpdated = false;
    if (status === 'approved' && justificationData.studentId && justificationData.date) {
      const attId = `att_${justificationData.studentId}_${justificationData.date}`;
      const existingAtt = await db.prepare(
        `SELECT data FROM entities WHERE tenant_id = ? AND entity_type = 'attendance_records' AND id = ?`
      ).bind(tenantId, attId).first();

      if (existingAtt) {
        let attData = {};
        try { attData = JSON.parse(existingAtt.data); } catch {}
        attData.status = 'excused';
        attData.justificationId = id;
        attData.justificationReason = justificationData.reason;
        attData.notes = (attData.notes ? `${attData.notes} | ` : '') + `[Justifié: ${justificationData.reason}]`;
        attData.updatedAt = nowIso;

        await db.prepare(
          `UPDATE entities SET data = ?, updated_at = datetime('now')
           WHERE tenant_id = ? AND entity_type = 'attendance_records' AND id = ?`
        ).bind(JSON.stringify(attData), tenantId, attId).run();
        attendanceUpdated = true;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        justification: justificationData,
        attendanceUpdated,
        message: status === 'approved'
          ? 'Justification validée et statut de présence mis à jour en "Excusé".'
          : 'Justification marquée comme rejetée.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur interne' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}
