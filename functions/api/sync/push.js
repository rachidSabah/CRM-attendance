/**
 * POST /api/sync/push
 * Push all entity data from frontend to D1 (upsert)
 * Body: { tenant_id, students, classes, modules, attendance, grades, behavior, tasks, incidents, teachers, employees, templates, academicYears, schedules, exams, examGrades, curriculum, schoolInfo }
 */

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
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handlePush(context) {
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

      for (const record of data) {
        const id = String(record.id || '');
        if (!id) continue;
        const dataStr = JSON.stringify(record);

        await db.prepare(
          `INSERT INTO entities (id, tenant_id, entity_type, data, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(id, tenant_id) DO UPDATE SET data = excluded.data, entity_type = excluded.entity_type, updated_at = excluded.updated_at`
        ).bind(id, tenantId, entityType, dataStr).run();
        totalUpserted++;
      }
    }

    // Sync admin users to school_settings so login endpoint can authenticate them
    // Key format: auth_{username}_{tenantId} — matches what /api/auth/login expects
    if (Array.isArray(body.admins)) {
      // First, clean up any stale auth_ entries that no longer exist in the admins list
      try {
        const existingAuths = await db.prepare(
          `SELECT key FROM school_settings WHERE tenant_id = ? AND key LIKE 'auth_%'`
        ).bind(tenantId).all();
        if (existingAuths && existingAuths.results) {
          const currentAdminUsernames = new Set(
            body.admins.map(a => `auth_${String(a.username || '').trim()}_${tenantId}`)
          );
          for (const row of existingAuths.results) {
            if (!currentAdminUsernames.has(row.key)) {
              await db.prepare(
                `DELETE FROM school_settings WHERE tenant_id = ? AND key = ?`
              ).bind(tenantId, row.key).run();
              totalUpserted++;
            }
          }
        }
      } catch {}

      for (const admin of body.admins) {
        const username = String(admin.username || '').trim();
        if (!username) continue;
        const authKey = `auth_${username}_${tenantId}`;
        // Build the user record in the same format the login endpoint reads
        const authData = {
          id: admin.id || username,
          username: username,
          password: admin.password || '',
          fullName: admin.fullName || admin.name || username,
          email: admin.email || '',
          role: admin.role || 'admin',
          department: admin.department || '',
          tenantId: admin.tenantId || tenantId,
          is_super_admin: admin.role === 'super_admin' ? true : false,
          updatedAt: new Date().toISOString(),
        };
        // Only write if there's a password (skip entries without credentials)
        if (authData.password) {
          await db.prepare(
            `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
          ).bind(authKey, tenantId, authKey, JSON.stringify(authData)).run();
          totalUpserted++;
        }
      }
    }

    // Log sync
    await db.prepare(
      `INSERT INTO sync_log (tenant_id, operation, record_count, status, details) VALUES (?, 'push', ?, 'success', ?)`
    ).bind(tenantId, totalUpserted, `Pushed ${totalUpserted} records`).run();

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('[sync/push] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequest(context) {
  return handlePush(context);
}

export async function onRequestPost(context) {
  return handlePush(context);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
    },
  });
}
