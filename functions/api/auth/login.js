/**
 * POST /api/auth/login
 * Login endpoint with D1-first strategy:
 *   1. If user exists in D1 → D1 is the authority (password changed here takes effect immediately)
 *   2. If user NOT in D1 → try external API, then sync profile to D1 for future use
 */

const EXTERNAL_API = 'https://infohas-attendance-api.rachidelsabah.workers.dev/api';

async function handleLogin(context) {
  try {
    const body = await context.request.json();
    const { username, password, slug } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tid = slug || 'default';
    const db = context.env.DB;
    const authKey = `auth_${username}_${tid}`;

    // Step 1: Check if user exists in D1
    let d1User = null;
    if (db) {
      try {
        const row = await db.prepare(
          'SELECT data FROM school_settings WHERE tenant_id = ? AND key = ?'
        ).bind(tid, authKey).first();
        if (row && row.data) {
          try { d1User = JSON.parse(row.data); } catch {}
        }
      } catch {}
    }

    // Step 2: If user exists in D1 → D1 is the authority
    if (d1User) {
      if (d1User.password === password) {
        // D1 login successful — generate session token
        const sessionToken = 'd1_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15);
        d1User.token = sessionToken;
        d1User.updatedAt = new Date().toISOString();

        try {
          await db.prepare(
            'INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')'
          ).bind(authKey, tid, authKey, JSON.stringify(d1User)).run();
        } catch {}

        return new Response(
          JSON.stringify({
            success: true,
            token: sessionToken,
            user: {
              id: d1User.id || username,
              username: d1User.username || username,
              fullName: d1User.fullName || d1User.full_name || username,
              email: d1User.email || '',
              role: d1User.role || 'user',
              tenant_id: d1User.tenantId || tid,
              is_super_admin: Boolean(d1User.is_super_admin),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        // Password wrong in D1 — reject immediately (D1 is authority)
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid credentials' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 3: User NOT in D1 → try external API and sync to D1
    try {
      const loginData = { username, password };
      if (slug) loginData.slug = slug;
      const extRes = await fetch(`${EXTERNAL_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });
      if (extRes.ok) {
        const extData = await extRes.json();
        if (extData.success) {
          // Sync full profile from external API to D1 for future D1-first logins
          try {
            if (db && extData.token) {
              const extUser = extData.user || {};
              const userData = {
                password: password,
                username: username,
                tenantId: tid,
                id: extUser.id || username,
                token: extData.token,
                fullName: extUser.fullName || extUser.full_name || extUser.username || username,
                email: extUser.email || '',
                role: extUser.role || 'user',
                is_super_admin: Boolean(extUser.is_super_admin),
                updatedAt: new Date().toISOString(),
              };
              await db.prepare(
                'INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')'
              ).bind(authKey, tid, authKey, JSON.stringify(userData)).run();
            }
          } catch {}

          return new Response(
            JSON.stringify(extData),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch {
      // External API unreachable
    }

    // Step 4: No match anywhere
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid credentials' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[auth/login] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequest(context) {
  return handleLogin(context);
}

export async function onRequestPost(context) {
  return handleLogin(context);
}

