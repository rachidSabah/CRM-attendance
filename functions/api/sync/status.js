/**
 * GET /api/sync/status?tenant_id=default
 * Return sync status, last sync time, entity counts
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const tenantId = url.searchParams.get('tenant_id') || 'default';
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
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('[sync/status] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message, connected: false }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
    },
  });
}
