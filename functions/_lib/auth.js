/**
 * Token validation for API endpoints.
 *
 * Flow:
 *   1. Read Authorization: Bearer <token> from request
 *   2. Search D1 school_settings for any auth_* entry containing that token
 *   3. If found → request is authenticated, return user data
 *   4. If not found → return 401
 *
 * The login endpoint saves the token into the user's auth record,
 * so we can verify it on every subsequent request.
 */

// Endpoints that do NOT require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
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

  try {
    // Search all tenants for a user record containing this token
    // This is efficient because there are very few auth_* rows
    const result = await db.prepare(
      `SELECT key, data, tenant_id FROM school_settings WHERE key LIKE 'auth_%'`
    ).all();

    if (!result || !result.results) {
      return { authenticated: false, error: 'Invalid token' };
    }

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

    return { authenticated: false, error: 'Invalid or expired token' };
  } catch (err) {
    return { authenticated: false, error: 'Auth validation failed' };
  }
}
