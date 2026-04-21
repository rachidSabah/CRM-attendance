/**
 * PUT /api/change-password
 * Change password — updates D1 and optionally tries the external API.
 * Reads existing D1 user data first, only updates the password field,
 * and preserves all other profile data (role, fullName, email, etc.).
 */

const EXTERNAL_API = 'https://infohas-attendance-api.rachidelsabah.workers.dev/api';

async function handleChangePassword(context) {
  try {
    const body = await context.request.json();
    const { currentPassword, newPassword, username, tenant_id } = body;

    if (!newPassword || newPassword.length < 4) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 4 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!currentPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Current password is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const uname = username || 'admin';
    const tid = tenant_id || 'default';

    // Step 1: Update password in D1 — READ existing data first to preserve profile
    const db = context.env.DB;
    let d1Updated = false;
    if (db) {
      const authKey = `auth_${uname}_${tid}`;

      try {
        // Read existing user data from D1 to preserve profile fields
        const existing = await db.prepare(
          'SELECT data FROM school_settings WHERE tenant_id = ? AND key = ?'
        ).bind(tid, authKey).first();

        let userData = {};
        if (existing && existing.data) {
          try { userData = JSON.parse(existing.data); } catch {}
        }

        // Only update the password field, preserve everything else
        userData.password = newPassword;
        userData.username = uname;
        userData.tenantId = tid;
        userData.updatedAt = new Date().toISOString();

        await db.prepare(
          'INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')'
        ).bind(authKey, tid, authKey, JSON.stringify(userData)).run();
        d1Updated = true;
      } catch (dbErr) {
        console.warn('[change-password] D1 update failed:', dbErr.message);
      }
    }

    // Step 2: Try external API login to get full user profile and sync to D1
    try {
      const loginRes = await fetch(`${EXTERNAL_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, password: currentPassword }),
      });

      if (loginRes.ok) {
        const loginData = await loginRes.json();
        if (loginData.success && loginData.user && db) {
          // External API login worked — sync full profile to D1 (with NEW password)
          const extUser = loginData.user;
          const authKey = `auth_${uname}_${tid}`;
          const fullUserData = {
            password: newPassword, // Use the NEW password
            username: uname,
            tenantId: tid,
            id: extUser.id || uname,
            fullName: extUser.fullName || extUser.full_name || extUser.username || uname,
            email: extUser.email || '',
            role: extUser.role || 'user',
            is_super_admin: extUser.is_super_admin || false,
            token: loginData.token,
            updatedAt: new Date().toISOString(),
          };

          try {
            await db.prepare(
              'INSERT INTO school_settings (id, tenant_id, key, data, updated_at) VALUES (?1, ?2, ?3, ?4, datetime(\'now\')) ON CONFLICT(tenant_id, key) DO UPDATE SET data = ?4, updated_at = datetime(\'now\')'
            ).bind(authKey, tid, authKey, JSON.stringify(fullUserData)).run();
          } catch {}

          // Try external API password change — best-effort
          if (loginData.token) {
            await fetch(`${EXTERNAL_API}/auth/change-password`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginData.token}` },
              body: JSON.stringify({ currentPassword, newPassword, tenant_id: tid, username: uname }),
            }).catch(() => {});
          }
        }
      }
    } catch {
      // External API not reachable — D1 already has the updated password + preserved profile
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password changed successfully', d1Updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[change-password] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequest(context) {
  return handleChangePassword(context);
}

export async function onRequestPut(context) {
  return handleChangePassword(context);
}

