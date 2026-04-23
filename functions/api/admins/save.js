/**
 * POST /api/admins/save
 * Write admin users DIRECTLY to D1 so they can login immediately.
 * No sync dependency — the user is in D1 the instant they are created.
 *
 * Body: {
 *   action: 'create' | 'update' | 'delete',
 *   tenant_id: string,
 *   admin: { id, username, password, fullName, email, role, department, tenantId }
 * }
 *
 * On create/update: UPSERT into school_settings with key auth_{username}_{tenantId}
 * On delete: REMOVE the auth_{username}_{tenantId} entry
 */

import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

async function handleSave(context) {
  // Auth check
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  // RBAC check: only super_admins can manage admin users
  if (!auth.user?.is_super_admin) {
    return new Response(
      JSON.stringify({ success: false, error: 'Super admin access required' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  try {
    const body = await context.request.json();
    const { action, tenant_id, admin } = body;

    if (!action || !admin || !admin.username) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing action, admin data, or username' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    const tid = tenant_id || 'default';
    const db = context.env.DB;

    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    const username = String(admin.username).trim();
    const authKey = `auth_${username}_${tid}`;

    if (action === 'delete') {
      // Prevent self-deletion — admin would lock themselves out
      if (auth.user?.username && username === auth.user.username) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot delete your own account' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
        );
      }
      // Remove the auth entry so deleted user can no longer login
      try {
        await db.prepare(
          `DELETE FROM school_settings WHERE tenant_id = ? AND key = ?`
        ).bind(tid, authKey).run();
      } catch (e) { console.warn('[admins/save] Delete failed:', e.message || e); }

      return new Response(
        JSON.stringify({ success: true, message: `User "${username}" removed from auth` }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    // create or update
    if (action === 'create' || action === 'update') {
      if (action === 'create' && !admin.password) {
        return new Response(
          JSON.stringify({ success: false, error: 'Password is required for new users' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
        );
      }

      // Read existing data first (for updates that don't include a new password)
      let existingData = {};
      if (action === 'update') {
        try {
          const row = await db.prepare(
            `SELECT data FROM school_settings WHERE tenant_id = ? AND key = ?`
          ).bind(tid, authKey).first();
          if (row && row.data) {
            try { existingData = JSON.parse(row.data); } catch (e) { console.warn('[admins/save] Existing data parse failed:', e.message || e); }
          }
        } catch (e) { console.warn('[admins/save] Existing data lookup failed:', e.message || e); }
      }

      const authData = {
        id: admin.id || username,
        username: username,
        // On update without new password, keep the existing one
        password: admin.password || existingData.password || '',
        fullName: admin.fullName || admin.name || existingData.fullName || username,
        email: admin.email || existingData.email || '',
        role: admin.role || existingData.role || 'admin',
        department: admin.department || existingData.department || '',
        tenantId: admin.tenantId || tid,
        is_super_admin: admin.role === 'super_admin',
        updatedAt: new Date().toISOString(),
      };

      await db.prepare(
        `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      ).bind(authKey, tid, authKey, JSON.stringify(authData)).run();

      return new Response(
        JSON.stringify({ success: true, message: `User "${username}" saved to D1 auth` }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use create, update, or delete.' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { headers: getCorsHeaders(context.request) });
}

export async function onRequest(context) {
  return handleSave(context);
}

export async function onRequestPost(context) {
  return handleSave(context);
}

