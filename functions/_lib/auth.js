/**
 * Token validation for API endpoints.
 *
 * Flow:
 *   1. Read Authorization: Bearer <token> from request
 *   2. Fast-Path: If token is a signed token (d1_s.*), verify HMAC-SHA256 signature
 *      → Authenticated immediately with zero D1 row reads (immune to D1 rate-limiting)
 *   3. Legacy-Path: Search D1 school_settings for any auth_* entry containing that token
 *   4. External API fallback for backward compatibility
 *   5. If neither confirms → return 401
 */

import { verifySignedToken } from './tokens.js';

const EXTERNAL_API = 'https://infohas-attendance-api.rachidelsabah.workers.dev/api';

// Endpoints that do NOT require admin authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/justifications/submit',
  '/api/parent/request-otp',
  '/api/parent/verify-otp',
  '/api/parent/attendance',
];

export async function validateRequest(request, db) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Public endpoints — no auth needed
  if (PUBLIC_PATHS.includes(path)) {
    return { authenticated: true, skipAuth: true };
  }

  // GET /api/doc-design/config is public (reading design config for document preview)
  if (path === '/api/doc-design/config' && request.method === 'GET') {
    return { authenticated: true, skipAuth: true };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return { authenticated: false, error: 'Missing authorization token' };
  }

  // =========================================================================
  // STEP 1: Fast-Path Signed Token Validation (Zero D1 reads, completely resilient)
  // =========================================================================
  if (token.startsWith('d1_s.')) {
    const verified = await verifySignedToken(token);
    if (verified.valid && verified.user) {
      return {
        authenticated: true,
        user: verified.user,
      };
    }
  }

  // =========================================================================
  // STEP 2: D1 Database Token Lookup (for legacy or direct tokens)
  // =========================================================================
  if (db) {
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
                  id: userData.id || userData.username,
                  username: userData.username,
                  fullName: userData.fullName || userData.full_name || userData.username,
                  email: userData.email || '',
                  role: userData.role || 'admin',
                  tenantId: row.tenant_id || 'default',
                  is_super_admin: Boolean(userData.is_super_admin),
                },
              };
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[auth] D1 lookup failed (non-fatal):', err.message);
    }
  }

  // =========================================================================
  // STEP 3: External API Fallback
  // =========================================================================
  try {
    const extRes = await fetch(`${EXTERNAL_API}/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (extRes.ok) {
      const extData = await extRes.json();
      if (extData && (extData.user || extData.success)) {
        const extUser = extData.user || {};
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

  // STEP 4: No match anywhere
  return { authenticated: false, error: 'Invalid or expired token' };
}
