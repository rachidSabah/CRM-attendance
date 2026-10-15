/**
 * POST /api/sync/push
 * Push entity data from frontend to D1 using high-performance batched transactions.
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
  savedSchedules: 'saved_schedules',
  justifications: 'justifications',
};

// Batch execution helper in chunks to stay well within D1 limits (up to 100 statements per batch)
async function executeBatch(db, statements, chunkSize = 100) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await db.batch(chunk);
    }
  }
}

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
    const tenantId = body.tenant_id || auth.user?.tenantId || 'default';
    const db = context.env.DB;
    let totalUpserted = 0;

    // 1. Sync school settings if provided
    if (body.schoolInfo && typeof body.schoolInfo === 'object') {
      await db.prepare(
        `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
         VALUES (?, ?, 'school_info', ?, datetime('now'))
         ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      ).bind('school_info_' + tenantId, tenantId, JSON.stringify(body.schoolInfo)).run();
      totalUpserted++;
    }

    // 2. Sync each entity type with batched statements
    for (const [bodyKey, entityType] of Object.entries(ENTITY_TYPES)) {
      const data = body[bodyKey];
      if (!Array.isArray(data)) continue;

      const upsertStatements = [];
      const pushedIds = new Set();

      for (const record of data) {
        let id = String(record.id || '');
        if (entityType === 'attendance_records' && record.studentId && record.date) {
          id = `att_${record.studentId}_${record.date}`;
          record.id = id;
        }
        if (!id) continue;
        pushedIds.add(id);
        const dataStr = JSON.stringify(record);

        upsertStatements.push(
          db.prepare(
            `INSERT INTO entities (id, tenant_id, entity_type, data, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(id, tenant_id) DO UPDATE SET data = excluded.data, entity_type = excluded.entity_type, updated_at = excluded.updated_at`
          ).bind(id, tenantId, entityType, dataStr)
        );
      }

      // For attendance records, clean up any legacy rows that had random IDs for the same student & date
      if (entityType === 'attendance_records' && data.length > 0) {
        for (const record of data) {
          if (record.studentId && record.date) {
            const canonicalId = `att_${record.studentId}_${record.date}`;
            upsertStatements.push(
              db.prepare(
                `DELETE FROM entities WHERE tenant_id = ? AND entity_type = 'attendance_records' AND id != ? AND json_extract(data, '$.studentId') = ? AND json_extract(data, '$.date') = ?`
              ).bind(tenantId, canonicalId, record.studentId, record.date)
            );
          }
        }
      }

      if (upsertStatements.length > 0) {
        await executeBatch(db, upsertStatements, 100);
        totalUpserted += upsertStatements.length;
      }

      // Cleanup removed records:
      // SAFETY RULES:
      // - If pushedIds is empty, DO NOT delete anything (guards against blank state wiping cloud data)
      // - Never delete attendance records from different dates during incremental pushes
      if (pushedIds.size > 0 && entityType !== 'attendance_records') {
        try {
          const existing = await db.prepare(
            `SELECT id FROM entities WHERE tenant_id = ? AND entity_type = ?`
          ).bind(tenantId, entityType).all();

          if (existing && existing.results && existing.results.length > 0) {
            const deleteStatements = [];
            for (const row of existing.results) {
              if (!pushedIds.has(String(row.id))) {
                deleteStatements.push(
                  db.prepare(
                    `DELETE FROM entities WHERE tenant_id = ? AND entity_type = ? AND id = ?`
                  ).bind(tenantId, entityType, row.id)
                );
              }
            }

            if (deleteStatements.length > 0) {
              await executeBatch(db, deleteStatements, 100);
              totalUpserted += deleteStatements.length;
            }
          }
        } catch (cleanupErr) {
          console.warn(`[sync/push] Cleanup failed for ${entityType}:`, cleanupErr.message);
        }
      }
    }

    // 3. Sync admin users if provided
    if (Array.isArray(body.admins) && body.admins.length > 0) {
      const adminStatements = [];
      for (const admin of body.admins) {
        const username = String(admin.username || '').trim();
        if (!username) continue;
        const authKey = `auth_${username}_${tenantId}`;

        let existingData = {};
        try {
          const existing = await db.prepare(
            `SELECT data FROM school_settings WHERE tenant_id = ? AND key = ?`
          ).bind(tenantId, authKey).first();
          if (existing && existing.data) {
            try { existingData = JSON.parse(existing.data); } catch {}
          }
        } catch {}

        const authData = {
          id: admin.id || existingData.id || username,
          username: username,
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

        adminStatements.push(
          db.prepare(
            `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
          ).bind(authKey, tenantId, authKey, JSON.stringify(authData))
        );
      }

      if (adminStatements.length > 0) {
        await executeBatch(db, adminStatements, 100);
        totalUpserted += adminStatements.length;
      }
    }

    // 4. Log sync
    try {
      await db.prepare(
        `INSERT INTO sync_log (tenant_id, operation, record_count, status, details) VALUES (?, 'push', ?, 'success', ?)`
      ).bind(tenantId, totalUpserted, `Pushed ${totalUpserted} records`).run();
    } catch {}

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (err) {
    console.error('[sync/push] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
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
