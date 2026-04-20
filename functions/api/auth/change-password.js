/**
 * PUT /api/auth/change-password
 * Change password stored in D1 (or localStorage fallback)
 * 
 * Body: { currentPassword, newPassword, tenant_id?, username? }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestPut(context) {
  try {
    const body = await context.request.json();
    const { currentPassword, newPassword, tenant_id, username } = body;

    if (!newPassword || newPassword.length < 4) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 4 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const db = context.env.DB;
    const tid = tenant_id || 'default';

    // Get current user credentials from D1
    const authKey = `auth_${username || 'admin'}_${tid}`;
    const stored = await db.prepare(
      `SELECT data FROM school_settings WHERE tenant_id = ? AND key = ?`
    ).bind(tid, authKey).first();

    if (stored) {
      try {
        const userData = JSON.parse(stored.data);
        // Verify current password (plain text comparison — same as the existing login flow)
        if (currentPassword && userData.password && userData.password !== currentPassword) {
          return new Response(
            JSON.stringify({ success: false, error: 'Current password is incorrect' }),
            { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        // Update password
        userData.password = newPassword;
        userData.updatedAt = new Date().toISOString();
        await db.prepare(
          `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        ).bind(authKey, tid, JSON.stringify(userData)).run();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to parse stored credentials' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    } else {
      // No stored user in D1 — store a new entry with the new password
      // First verify: if there's a currentPassword, we can't verify without stored data
      // so we'll just set it
      const userData = {
        password: newPassword,
        username: username || 'admin',
        tenantId: tid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.prepare(
        `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      ).bind(authKey, tid, JSON.stringify(userData)).run();
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password changed successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('[change-password] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
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
