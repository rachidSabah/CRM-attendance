/**
 * Token validation for API endpoints.
 *
 * Flow:
 *   1. Read Authorization: Bearer <token> from request
 *   2. Search D1 school_settings for any auth_* entry containing that token
 *   3. If found in D1 → request is authenticated, return user data
 *   4. If NOT found in D1 → try external API verification (fallback)
 *   5. If external API confirms → sync token to D1 for future requests, return user data
 *   6. If neither confirms → return 401
 */

const EXTERNAL_API = 'https://infohas-attendance-api.rachidelsabah.workers.dev/api';

// Endpoints that do NOT require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/change-password',  // Handler validates currentPassword itself
  '/api/sync/status',
  '/api/sync/pull',
];

export async function validateRequest(request, db) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Public endpoints — no auth needed
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return { authenticated: true, skipAuth: true };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return { authenticated: false, error: 'Missing authorization token' };
  }

  if (!db) {
    return { authenticated: false, error: 'Database not available' };
  }

  // Step 1: Try D1 token lookup
  try {
    const result = await db.prepare(
      `SELECT key, data, tenant_id FROM school_settings WHERE key LIKE 'auth_%'`
    ).all();

    if (result && result.results) {
      for (const row of result.results) {
        try {
          const userData = JSON.parse(row.data);
          if (userData.token === token) {
            return {
              authenticated: true,
              user: {
                id: userData.id,
                username: userData.username,
                fullName: userData.fullName,
                email: userData.email || '',
                role: userData.role || 'admin',
                tenantId: row.tenant_id,
                is_super_admin: Boolean(userData.is_super_admin),
              },
            };
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[auth] D1 lookup failed:', err.message);
  }

  // Step 2: D1 didn't have the token — try external API fallback
  // This handles cases where:
  //   - D1 sync failed during login
  //   - Token was overwritten by a login on another device
  //   - D1 was recently cleared/reset
  try {
    // Try to verify the token against the external API by calling a protected endpoint
    const extRes = await fetch(`${EXTERNAL_API}/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (extRes.ok) {
      const extData = await extRes.json();
      if (extData && (extData.user || extData.success)) {
        const extUser = extData.user || {};

        // Sync to D1 for future fast lookups
        try {
          const tid = extUser.tenant_id || 'default';
          const uname = extUser.username || 'admin';
          const authKey = `auth_${uname}_${tid}`;
          const syncData = {
            id: extUser.id || uname,
            username: uname,
            tenantId: tid,
            token: token,
            fullName: extUser.fullName || extUser.full_name || uname,
            email: extUser.email || '',
            role: extUser.role || 'user',
            is_super_admin: Boolean(extUser.is_super_admin),
            updatedAt: new Date().toISOString(),
          };
          await db.prepare(
            "INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime('now')"
          ).bind(authKey, tid, authKey, JSON.stringify(syncData)).run();
        } catch {}

        return {
          authenticated: true,
          user: {
            id: extUser.id || 'unknown',
            username: extUser.username || 'unknown',
            fullName: extUser.fullName || extUser.full_name || extUser.username || 'User',
            email: extUser.email || '',
            role: extUser.role || 'user',
            tenantId: extUser.tenant_id || 'default',
            is_super_admin: Boolean(extUser.is_super_admin),
          },
        };
      }
    }
  } catch (err) {
    console.warn('[auth] External API fallback failed:', err.message);
  }

  // Step 3: Neither D1 nor external API confirmed the token
  return { authenticated: false, error: 'Invalid or expired token' };
}
