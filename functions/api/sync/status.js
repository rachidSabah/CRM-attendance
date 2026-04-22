/**
 * GET /api/sync/status?tenant_id=default
 * Return sync status, last sync time, entity counts
 * REQUIRES AUTHENTICATION
 */

import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

async function handleStatus(context) {
  // Auth check — status requires authentication
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  try {
    const url = new URL(context.request.url);
    const tenantId = url.searchParams.get('tenant_id') || auth.user?.tenantId || 'default';
    const db = context.env.DB;

    // Entity counts
    const counts = await db.prepare(
      `SELECT entity_type, COUNT(*) as count FROM entities WHERE tenant_id = ? GROUP BY entity_type`
    ).bind(tenantId).all();

    const entityCounts = {};
    let totalRecords = 0;
    if (counts.results) {
      for (const row of counts.results) {
        entityCounts[row.entity_type] = row.count;
        totalRecords += row.count;
      }
    }

    // Last sync operations
    const recentSyncs = await db.prepare(
      `SELECT operation, entity_type, record_count, status, details, created_at
       FROM sync_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10`
    ).bind(tenantId).all();

    // Last successful push/pull timestamps
    const lastPush = await db.prepare(
      `SELECT created_at FROM sync_log WHERE tenant_id = ? AND operation = 'push' AND status = 'success' ORDER BY created_at DESC LIMIT 1`
    ).bind(tenantId).first();

    const lastPull = await db.prepare(
      `SELECT created_at FROM sync_log WHERE tenant_id = ? AND operation = 'pull' AND status = 'success' ORDER BY created_at DESC LIMIT 1`
    ).bind(tenantId).first();

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: tenantId,
        connected: true,
        total_records: totalRecords,
        entity_counts: entityCounts,
        last_push: lastPush?.created_at || null,
        last_pull: lastPull?.created_at || null,
        recent_syncs: recentSyncs.results || [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (err) {
    console.error('[sync/status] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', connected: false }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  return handleStatus(context);
}
