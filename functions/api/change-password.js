/**
 * PUT /api/change-password
 * Change password stored in D1
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestPut(context) {
  try {
    const body = await context.request.json();
    const { currentPassword, newPassword, username, tenant_id } = body;

    if (!newPassword || newPassword.length < 4) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 4 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const db = context.env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const tid = tenant_id || 'default';
    const uname = username || 'admin';
    const authKey = `auth_${uname}_${tid}`;

    // Check existing password
    const existing = await db.prepare('SELECT data FROM school_settings WHERE tenant_id = ?1 AND key = ?2').bind(tid, authKey).first();

    if (existing && existing.data) {
      const userData = JSON.parse(existing.data);
      if (currentPassword && userData.password && userData.password !== currentPassword) {
        return new Response(
          JSON.stringify({ success: false, error: 'Current password is incorrect' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      userData.password = newPassword;
      userData.updatedAt = new Date().toISOString();
      await db.prepare('INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')').bind(authKey, tid, authKey, JSON.stringify(userData)).run();
    } else {
      const userData = JSON.stringify({
        password: newPassword,
        username: uname,
        tenantId: tid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await db.prepare('INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')').bind(authKey, tid, authKey, userData).run();
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password changed successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('[change-password] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' },
  });
}
