/**
 * Cloudflare Pages Function — Parent Excuse Justification Submission
 *
 * Route: POST /api/justifications/submit
 *
 * Allows parents or staff to submit absence justifications with reasons and attachments.
 */
import { getCorsHeaders } from '../../_lib/cors.js';

export async function onRequestPost(context) {
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

    const {
      studentId,
      studentName,
      className,
      date,
      reason,
      attachment,
      tenantId = 'default',
    } = body;

    if (!studentId || !date || !reason) {
      return new Response(
        JSON.stringify({ success: false, error: 'Les champs studentId, date et motif (reason) sont obligatoires.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    const db = context.env.DB;
    const justificationId = `just_${studentId}_${date}_${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();

    const justificationRecord = {
      id: justificationId,
      studentId,
      studentName: studentName || '',
      className: className || '',
      date,
      reason,
      attachment: attachment || '',
      status: 'pending',
      createdAt: nowIso,
    };

    // Store in entities table under 'justifications'
    await db.prepare(
      `INSERT INTO entities (id, tenant_id, entity_type, data, updated_at)
       VALUES (?, ?, 'justifications', ?, datetime('now'))
       ON CONFLICT(tenant_id, entity_type, id) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at`
    ).bind(
      justificationId,
      tenantId,
      JSON.stringify(justificationRecord)
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        justification: justificationRecord,
        message: 'Justification enregistrée avec succès. Elle sera examinée par la direction.',
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
