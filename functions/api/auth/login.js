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
          try { d1User = JSON.parse(row.data); } catch (e) { console.warn('[auth/login] D1 user parse failed:', e.message || e); }
        }
      } catch (e) { console.warn('[auth/login] D1 lookup failed:', e.message || e); }
    }

    // Step 2: If user exists in D1 → D1 is the SOLE authority for password
    // Once a user is synced to D1, password changes made here must be permanent.
    // We NEVER fall through to the external API to overwrite a D1 user's password.
    if (d1User) {
      if (d1User.password === password) {
        // D1 login successful — generate session token
        const bytes = crypto.getRandomValues(new Uint8Array(24));
        const sessionToken = 'd1_' + Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('');
        d1User.token = sessionToken;
        d1User.updatedAt = new Date().toISOString();

        try {
          await db.prepare(
            'INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')'
          ).bind(authKey, tid, authKey, JSON.stringify(d1User)).run();
        } catch (e) { console.warn('[auth/login] Token save failed:', e.message || e); }

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
      }
      // D1 password doesn't match and user EXISTS in D1 — reject immediately.
      // Do NOT fall through to external API, which would overwrite the user's
      // personalized D1 password with the external API's (possibly stale) one.
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: User does NOT exist in D1 → try external API as initial bootstrap
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
          // First-time sync: create D1 user from external API profile
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
          } catch (e) { console.warn('[auth/login] D1 sync from external failed:', e.message || e); }

          return new Response(
            JSON.stringify(extData),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (e) {
      console.warn('[auth/login] External API unreachable:', e.message || e);
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

