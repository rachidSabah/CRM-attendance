/**
 * POST /api/sync/push
 * Push all entity data from frontend to D1 (upsert)
 * Body: { tenant_id, students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, templates, academicYears, schedules, exams, examGrades, curriculum, schoolInfo }
 */

import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

const ENTITY_TYPES = {
  students: 'students',
  classes: 'classes',
  modules: 'modules',
  attendance: 'attendance_records',
  grades: 'grades',
  behavior: 'behavior_records',
  tasks: 'tasks',
  incidents: 'incidents',
  teachers: 'teachers',
  employees: 'employees',
  templates: 'templates',
  academicYears: 'academic_years',
  schedules: 'schedules',
  exams: 'exams',
  examGrades: 'exam_grades',
  curriculum: 'curriculum_items',
  calendarEvents: 'calendar_events',
};

async function handlePush(context) {
  // Auth check
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  try {
    const body = await context.request.json();
    const tenantId = body.tenant_id || 'default';
    const db = context.env.DB;

    let totalUpserted = 0;

    // Sync school settings separately
    if (body.schoolInfo) {
      await db.prepare(
        `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
         VALUES (?, ?, 'school_info', ?, datetime('now'))
         ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      ).bind('school_info_' + tenantId, tenantId, JSON.stringify(body.schoolInfo)).run();
      totalUpserted++;
    }

    // Sync each entity type
    for (const [bodyKey, entityType] of Object.entries(ENTITY_TYPES)) {
      const data = body[bodyKey];
      if (!Array.isArray(data)) continue;

      // Collect pushed IDs for later cleanup of removed records
      const pushedIds = new Set();

      for (const record of data) {
        const id = String(record.id || '');
        if (!id) continue;
        pushedIds.add(id);
        const dataStr = JSON.stringify(record);

        await db.prepare(
          `INSERT INTO entities (id, tenant_id, entity_type, data, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(id, tenant_id) DO UPDATE SET data = excluded.data, entity_type = excluded.entity_type, updated_at = excluded.updated_at`
        ).bind(id, tenantId, entityType, dataStr).run();
        totalUpserted++;
      }

      // CRITICAL: Delete records that were removed from the frontend
      // Without this, deleted items (students, grades, etc.) persist in D1
      // and reappear on next pull/login.
      try {
        const existing = await db.prepare(
          `SELECT id FROM entities WHERE tenant_id = ? AND entity_type = ?`
        ).bind(tenantId, entityType).all();
        if (existing.results) {
          for (const row of existing.results) {
            if (!pushedIds.has(String(row.id))) {
              await db.prepare(
                `DELETE FROM entities WHERE tenant_id = ? AND entity_type = ? AND id = ?`
              ).bind(tenantId, entityType, row.id).run();
              totalUpserted++;
            }
          }
        }
      } catch (cleanupErr) {
        console.warn(`[sync/push] Cleanup failed for ${entityType}:`, cleanupErr.message);
      }
    }

    // Sync admin users to school_settings so login endpoint can authenticate them
    // Key format: auth_{username}_{tenantId} — matches what /api/auth/login expects
    if (Array.isArray(body.admins)) {
      // CRITICAL: Never delete the currently authenticated user's auth record.
      // If admins array is empty (e.g., fresh browser/incognito), skip cleanup entirely.
      const safeToDelete = body.admins.length > 0 && auth.user?.username;

      // First, clean up any stale auth_ entries that no longer exist in the admins list
      // (only when admins array is non-empty and the authenticated user is known)
      if (safeToDelete) {
        try {
          const existingAuths = await db.prepare(
            `SELECT key FROM school_settings WHERE tenant_id = ? AND key LIKE 'auth_%'`
          ).bind(tenantId).all();
          if (existingAuths && existingAuths.results) {
            const currentAdminUsernames = new Set(
              body.admins.map(a => `auth_${String(a.username || '').trim()}_${tenantId}`)
            );
            // Always protect the currently authenticated user's entry
            const protectedKey = `auth_${auth.user.username}_${auth.user.tenantId || tenantId}`;
            for (const row of existingAuths.results) {
              if (!currentAdminUsernames.has(row.key) && row.key !== protectedKey) {
                await db.prepare(
                  `DELETE FROM school_settings WHERE tenant_id = ? AND key = ?`
                ).bind(tenantId, row.key).run();
                totalUpserted++;
              }
            }
          }
        } catch {}
      }

      for (const admin of body.admins) {
        const username = String(admin.username || '').trim();
        if (!username) continue;
        const authKey = `auth_${username}_${tenantId}`;

        // Read existing D1 record to preserve token and password
        let existingData = {};
        try {
          const existing = await db.prepare(
            `SELECT data FROM school_settings WHERE tenant_id = ? AND key = ?`
          ).bind(tenantId, authKey).first();
          if (existing && existing.data) {
            try { existingData = JSON.parse(existing.data); } catch {}
          }
        } catch {}

        // Build the user record — preserve existing token/password
        const authData = {
          id: admin.id || existingData.id || username,
          username: username,
          // Preserve existing password/token if admin body doesn't have them
          password: admin.password || existingData.password || '',
          token: existingData.token || '',
          fullName: admin.fullName || admin.name || existingData.fullName || username,
          email: admin.email || existingData.email || '',
          role: admin.role || existingData.role || 'admin',
          department: admin.department || existingData.department || '',
          tenantId: admin.tenantId || existingData.tenantId || tenantId,
          is_super_admin: admin.role === 'super_admin' ? true : Boolean(existingData.is_super_admin),
          updatedAt: new Date().toISOString(),
        };

        await db.prepare(
          `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        ).bind(authKey, tenantId, authKey, JSON.stringify(authData)).run();
        totalUpserted++;
      }
    }

    // Log sync
    await db.prepare(
      `INSERT INTO sync_log (tenant_id, operation, record_count, status, details) VALUES (?, 'push', ?, 'success', ?)`
    ).bind(tenantId, totalUpserted, `Pushed ${totalUpserted} records`).run();

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (err) {
    console.error('[sync/push] Error:', err);
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
  return handlePush(context);
}

export async function onRequestPost(context) {
  return handlePush(context);
}

