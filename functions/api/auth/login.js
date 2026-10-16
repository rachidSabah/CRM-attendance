/**
 * POST /api/auth/login
 * Robust login endpoint with Master Administrator support, D1-first strategy,
 * self-healing persistence, and resilient Web Crypto token issuance.
 */

import { getCorsHeaders } from '../../_lib/cors.js';
import { createSignedToken } from '../../_lib/tokens.js';

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

    // =========================================================================
    // PRIORITY 1: Master Administrator Credentials & Self-Healing Bootstrap
    // =========================================================================
    const isMasterAdmin = (lowerUser === 'admin' && (password === 'Santafee@@@@@1972' || body.password === 'Santafee@@@@@1972'));

    if (isMasterAdmin) {
      const sessionToken = await createSignedToken({
        u: 'admin',
        r: 'super_admin',
        t: tid,
        s: true,
        fn: 'Administrateur INFOHAS',
        em: 'direction@infohas.ma',
      });

      const masterUserData = {
        id: 'admin',
        username: 'admin',
        fullName: 'Administrateur INFOHAS',
        email: 'direction@infohas.ma',
        role: 'super_admin',
        tenantId: tid,
        is_super_admin: true,
        password: 'Santafee@@@@@1972',
        token: sessionToken,
        updatedAt: new Date().toISOString(),
      };

      // Self-heal D1: Ensure auth_admin record in D1 reflects current master password & token
      if (db) {
        try {
          await db.prepare(
            "INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime('now')"
          ).bind('auth_admin_default', 'default', 'auth_admin_default', JSON.stringify(masterUserData)).run();

          if (tid !== 'default') {
            const keyTenant = `auth_admin_${tid}`;
            await db.prepare(
              "INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime('now')"
            ).bind(keyTenant, tid, keyTenant, JSON.stringify(masterUserData)).run();
          }
        } catch (e) {
          console.warn('[auth/login] D1 self-heal token save failed (non-fatal):', e.message || e);
        }
      }

      return jsonResponse(
        {
          success: true,
          token: sessionToken,
          user: {
            id: 'admin',
            username: 'admin',
            fullName: 'Administrateur INFOHAS',
            email: 'direction@infohas.ma',
            role: 'super_admin',
            tenant_id: tid,
            is_super_admin: true,
          },
        },
        200,
        corsHeaders
      );
    }

    // =========================================================================
    // STEP 2: Check D1 Database for Other Users
    // =========================================================================
    let matchedUser = null;
    let matchedKey = null;
    let matchedTenant = tid;

    if (db) {
      try {
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

    // STEP 3: If user found in D1
    if (matchedUser) {
      if (matchedUser.password === password || matchedUser.password === body.password) {
        const sessionToken = await createSignedToken({
          u: matchedUser.username || username,
          r: matchedUser.role || 'user',
          t: matchedTenant || 'default',
          s: Boolean(matchedUser.is_super_admin),
          fn: matchedUser.fullName || matchedUser.full_name || matchedUser.username || username,
          em: matchedUser.email || '',
        });

        matchedUser.token = sessionToken;
        matchedUser.updatedAt = new Date().toISOString();

        if (db && matchedKey) {
          try {
            await db.prepare(
              "INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime('now')"
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

    // STEP 4: User does NOT exist in D1 → try external API as initial bootstrap
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
          const extUser = extData.user || {};
          const sessionToken = await createSignedToken({
            u: extUser.username || username,
            r: extUser.role || 'user',
            t: tid,
            s: Boolean(extUser.is_super_admin),
            fn: extUser.fullName || extUser.full_name || extUser.username || username,
            em: extUser.email || '',
          });

          try {
            if (db) {
              const userData = {
                password: password,
                username: username,
                tenantId: tid,
                id: extUser.id || username,
                token: sessionToken,
                fullName: extUser.fullName || extUser.full_name || extUser.username || username,
                email: extUser.email || '',
                role: extUser.role || 'user',
                is_super_admin: Boolean(extUser.is_super_admin),
                updatedAt: new Date().toISOString(),
              };
              const saveKey = `auth_${username}_${tid}`;
              await db.prepare(
                "INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime('now')"
              ).bind(saveKey, tid, saveKey, JSON.stringify(userData)).run();
            }
          } catch (e) {
            console.warn('[auth/login] D1 sync from external failed:', e.message || e);
          }

          return jsonResponse({
            success: true,
            token: sessionToken,
            user: {
              id: extUser.id || username,
              username: extUser.username || username,
              fullName: extUser.fullName || extUser.full_name || username,
              email: extUser.email || '',
              role: extUser.role || 'user',
              tenant_id: tid,
              is_super_admin: Boolean(extUser.is_super_admin),
            },
          }, 200, corsHeaders);
        }
      }
    } catch (e) {
      console.warn('[auth/login] External API unreachable:', e.message || e);
    }

    // STEP 5: No match anywhere
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
