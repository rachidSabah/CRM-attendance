/**
 * POST /api/auth/login
 * Robust login endpoint with D1-first strategy and CORS support:
 *   1. Check D1 for matching user credentials (case-insensitive username, flexible tenant fallback)
 *   2. If user exists in D1 and password matches → generate session token and return user profile
 *   3. If user NOT in D1 → attempt fallback bootstrap against external API
 */

import { getCorsHeaders } from '../../_lib/cors.js';

const EXTERNAL_API = 'https://infohas-attendance-api.rachidelsabah.workers.dev/api';

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

async function handleLogin(context) {
  const corsHeaders = getCorsHeaders(context.request);
  try {
    const body = await context.request.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

    if (!username || !password) {
      return jsonResponse(
        { success: false, error: 'Username and password are required' },
        400,
        corsHeaders
      );
    }

    const tid = slug || 'default';
    const db = context.env.DB;
    const lowerUser = username.toLowerCase();

    // Step 1: Check D1 database
    let matchedUser = null;
    let matchedKey = null;
    let matchedTenant = tid;

    if (db) {
      try {
        // Candidate keys in order of preference
        const candidateKeys = [
          `auth_${username}_${tid}`,
          `auth_${lowerUser}_${tid}`,
          `auth_${lowerUser}_default`,
          `auth_${username}_default`,
        ];

        for (const cKey of candidateKeys) {
          const row = await db.prepare(
            'SELECT tenant_id, key, data FROM school_settings WHERE key = ?'
          ).bind(cKey).first();
          if (row && row.data) {
            try {
              const parsed = JSON.parse(row.data);
              if (parsed && (parsed.password === password || parsed.password === body.password)) {
                matchedUser = parsed;
                matchedKey = row.key;
                matchedTenant = row.tenant_id || tid;
                break;
              } else if (!matchedUser && parsed) {
                // Keep candidate in case no exact password match found yet
                matchedUser = parsed;
                matchedKey = row.key;
                matchedTenant = row.tenant_id || tid;
              }
            } catch (e) {
              console.warn('[auth/login] Parse failed for key:', cKey, e);
            }
          }
        }

        // If not found by candidate keys, check all auth keys for matching username & password
        if (!matchedUser || (matchedUser.password !== password && matchedUser.password !== body.password)) {
          const allAuthRows = await db.prepare(
            'SELECT tenant_id, key, data FROM school_settings WHERE key LIKE "auth_%"'
          ).all();
          if (allAuthRows && allAuthRows.results) {
            for (const r of allAuthRows.results) {
              try {
                const parsed = JSON.parse(r.data);
                if (
                  parsed &&
                  String(parsed.username || '').toLowerCase() === lowerUser &&
                  (parsed.password === password || parsed.password === body.password)
                ) {
                  matchedUser = parsed;
                  matchedKey = r.key;
                  matchedTenant = r.tenant_id || 'default';
                  break;
                }
              } catch (_) {}
            }
          }
        }
      } catch (e) {
        console.warn('[auth/login] D1 lookup failed:', e.message || e);
      }
    }

    // Step 2: If user found in D1
    if (matchedUser) {
      if (matchedUser.password === password || matchedUser.password === body.password) {
        // D1 login successful — generate session token
        const bytes = crypto.getRandomValues(new Uint8Array(24));
        const sessionToken = 'd1_' + Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('');
        matchedUser.token = sessionToken;
        matchedUser.updatedAt = new Date().toISOString();

        if (db && matchedKey) {
          try {
            await db.prepare(
              'INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')'
            ).bind(matchedKey, matchedTenant, matchedKey, JSON.stringify(matchedUser)).run();
          } catch (e) {
            console.warn('[auth/login] Token save failed:', e.message || e);
          }
        }

        return jsonResponse(
          {
            success: true,
            token: sessionToken,
            user: {
              id: matchedUser.id || username,
              username: matchedUser.username || username,
              fullName: matchedUser.fullName || matchedUser.full_name || username,
              email: matchedUser.email || '',
              role: matchedUser.role || 'user',
              tenant_id: matchedUser.tenantId || matchedTenant || 'default',
              is_super_admin: Boolean(matchedUser.is_super_admin),
            },
          },
          200,
          corsHeaders
        );
      }

      // Password didn't match and user exists in D1
      return jsonResponse(
        { success: false, error: 'Invalid credentials' },
        401,
        corsHeaders
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
              const saveKey = `auth_${username}_${tid}`;
              await db.prepare(
                'INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')'
              ).bind(saveKey, tid, saveKey, JSON.stringify(userData)).run();
            }
          } catch (e) {
            console.warn('[auth/login] D1 sync from external failed:', e.message || e);
          }

          return jsonResponse(extData, 200, corsHeaders);
        }
      }
    } catch (e) {
      console.warn('[auth/login] External API unreachable:', e.message || e);
    }

    // Step 4: No match anywhere
    return jsonResponse(
      { success: false, error: 'Invalid credentials' },
      401,
      corsHeaders
    );
  } catch (err) {
    console.error('[auth/login] Error:', err);
    return jsonResponse(
      { success: false, error: 'Internal server error' },
      500,
      corsHeaders
    );
  }
}

export async function onRequest(context) {
  return handleLogin(context);
}

export async function onRequestPost(context) {
  return handleLogin(context);
}
