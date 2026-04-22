/**
 * PUT /api/change-password
 * Change password — validates current password against D1 first,
 * then falls back to external API. Updates D1 and syncs to external API.
 */

import { getCorsHeaders } from '../_lib/cors.js';

const EXTERNAL_API = 'https://infohas-attendance-api.rachidelsabah.workers.dev/api';

function jsonResponse(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
  });
}

async function handleChangePassword(context) {
  // No middleware token validation — this endpoint authenticates via currentPassword
  // The middleware ([[path]].js) may block the request if the token is invalid,
  // so we also add /api/change-password handling there.

  try {
    const body = await context.request.json();
    const { currentPassword, newPassword, username, tenant_id } = body;

    if (!newPassword || newPassword.length < 4) {
      return jsonResponse({ success: false, error: 'Password must be at least 4 characters' }, 400, context.request);
    }

    if (!currentPassword) {
      return jsonResponse({ success: false, error: 'Current password is required' }, 400, context.request);
    }

    const uname = username || 'admin';
    const tid = tenant_id || 'default';
    const db = context.env.DB;
    const authKey = `auth_${uname}_${tid}`;

    // Step 1: Validate current password against D1
    let d1User = null;
    let d1PasswordValid = false;
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

    if (d1User && d1User.password === currentPassword) {
      d1PasswordValid = true;
    }

    // Step 2: If D1 password doesn't match, try external API
    let extPasswordValid = false;
    let extLoginData = null;
    if (!d1PasswordValid) {
      try {
        const loginRes = await fetch(`${EXTERNAL_API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: uname, password: currentPassword }),
        });
        if (loginRes.ok) {
          const data = await loginRes.json();
          if (data.success) {
            extPasswordValid = true;
            extLoginData = data;
          }
        }
      } catch {}
    }

    // Step 3: If NEITHER D1 nor external API confirms the current password → reject
    if (!d1PasswordValid && !extPasswordValid) {
      return jsonResponse({ success: false, error: 'Current password is incorrect' }, 401, context.request);
    }

    // Step 4: Update password in D1 — preserve all existing profile fields
    if (db) {
      try {
        // Read existing user data to preserve all fields
        const existing = await db.prepare(
          'SELECT data FROM school_settings WHERE tenant_id = ? AND key = ?'
        ).bind(tid, authKey).first();

        let userData = {};
        if (existing && existing.data) {
          try { userData = JSON.parse(existing.data); } catch {}
        }

        // If external API returned profile data and D1 has nothing, use it
        if (!userData.username && extLoginData && extLoginData.user) {
          const extUser = extLoginData.user;
          userData.id = extUser.id || uname;
          userData.username = uname;
          userData.fullName = extUser.fullName || extUser.full_name || uname;
          userData.email = extUser.email || '';
          userData.role = extUser.role || 'user';
          userData.is_super_admin = Boolean(extUser.is_super_admin);
        }

        // Update only the password
        userData.password = newPassword;
        userData.username = uname;
        userData.tenantId = tid;
        if (extLoginData && extLoginData.token) {
          userData.token = extLoginData.token;
        }
        userData.updatedAt = new Date().toISOString();

        await db.prepare(
          "INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime('now')"
        ).bind(authKey, tid, authKey, JSON.stringify(userData)).run();
      } catch (dbErr) {
        console.warn('[change-password] D1 update failed:', dbErr.message);
      }
    }

    // Step 5: Try to change password on external API (best-effort)
    if (extLoginData && extLoginData.token) {
      try {
        await fetch(`${EXTERNAL_API}/auth/change-password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${extLoginData.token}` },
          body: JSON.stringify({ currentPassword, newPassword, tenant_id: tid, username: uname }),
        });
      } catch {}
    }

    return jsonResponse({ success: true, message: 'Password changed successfully' }, 200, context.request);
  } catch (err) {
    console.error('[change-password] Error:', err);
    return jsonResponse({ success: false, error: String(err?.message || err) }, 500, context.request);
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { headers: getCorsHeaders(context.request) });
}

export async function onRequest(context) {
  return handleChangePassword(context);
}

export async function onRequestPut(context) {
  return handleChangePassword(context);
}
