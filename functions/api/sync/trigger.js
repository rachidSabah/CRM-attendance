/**
 * POST /api/sync/trigger
 * Manual sync endpoint with batched D1 execution.
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';
import { fetchAll } from '../../_lib/paginate.js';
import {
  SEED_CLASSES,
  SEED_STUDENTS,
  SEED_MODULES,
  SEED_SCHOOL_INFO,
  SEED_ACADEMIC_YEARS,
  SEED_ADMINS,
} from '../../_lib/seedData.js';

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
};

async function executeBatch(db, statements, chunkSize = 100) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await db.batch(chunk);
    }
  }
}

async function handleTrigger(context) {
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  try {
    const body = await context.request.json();
    const mode = body.mode || 'full';
    const tenantId = body.tenant_id || auth.user?.tenantId || 'default';
    const db = context.env.DB;
    const results = { success: true, mode, tenant_id: tenantId, operations: [] };

    if (mode === 'push' || mode === 'full') {
      let pushed = 0;
      for (const [bodyKey, entityType] of Object.entries(ENTITY_TYPES)) {
        const data = body[bodyKey];
        if (!Array.isArray(data)) continue;

        const upsertStatements = [];
        const pushedIds = new Set();
        for (const record of data) {
          const id = String(record.id || '');
          if (!id) continue;
          pushedIds.add(id);
          upsertStatements.push(
            db.prepare(
              `INSERT INTO entities (id, tenant_id, entity_type, data, updated_at)
               VALUES (?, ?, ?, ?, datetime('now'))
               ON CONFLICT(id, tenant_id) DO UPDATE SET data = excluded.data, entity_type = excluded.entity_type, updated_at = excluded.updated_at`
            ).bind(id, tenantId, entityType, JSON.stringify(record))
          );
        }

        if (upsertStatements.length > 0) {
          await executeBatch(db, upsertStatements, 100);
          pushed += upsertStatements.length;
        }

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
                pushed += deleteStatements.length;
              }
            }
          } catch (e) {
            console.warn('[sync/trigger] Entity cleanup failed:', e.message || e);
          }
        }
      }

      if (body.schoolInfo) {
        await db.prepare(
          `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
           VALUES (?, ?, 'school_info', ?, datetime('now'))
           ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        ).bind('school_info_' + tenantId, tenantId, JSON.stringify(body.schoolInfo)).run();
        pushed++;
      }

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
          pushed += adminStatements.length;
        }
      }

      await db.prepare(
        `INSERT INTO sync_log (tenant_id, operation, record_count, status, details) VALUES (?, 'push', ?, 'success', ?)`
      ).bind(tenantId, pushed, 'Manual trigger push').run();
      results.operations.push({ operation: 'push', count: pushed, status: 'success' });
    }

    if (mode === 'pull' || mode === 'full') {
      const ENTITY_TYPE_MAP = {
        students: 'students', classes: 'classes', modules: 'modules',
        attendance_records: 'attendance', grades: 'grades', behavior_records: 'behavior',
        tasks: 'tasks', incidents: 'incidents', teachers: 'teachers',
        employees: 'employees', templates: 'templates', academic_years: 'academicYears',
        schedules: 'schedules', exams: 'exams', exam_grades: 'examGrades',
        curriculum_items: 'curriculum', calendar_events: 'calendarEvents',
        saved_schedules: 'savedSchedules',
      };
      const data = {};
      const settings = await db.prepare(`SELECT key, data FROM school_settings WHERE tenant_id = ?`).bind(tenantId).all();
      if (settings.results) {
        const admins = [];
        for (const row of settings.results) {
          if (row.key === 'school_info') {
            try { data.schoolInfo = JSON.parse(row.data); } catch {}
          } else if (row.key.startsWith('auth_')) {
            try {
              const userData = JSON.parse(row.data);
              admins.push({
                id: userData.id || userData.username,
                username: userData.username,
                fullName: userData.fullName || userData.full_name || userData.username,
                name: userData.fullName || userData.full_name || userData.username,
                email: userData.email || '',
                role: userData.role || 'admin',
                department: userData.department || '',
                tenantId: userData.tenantId || tenantId,
                is_super_admin: Boolean(userData.is_super_admin),
              });
            } catch {}
          }
        }
        if (admins.length > 0) data.admins = admins;
      }
      const allEntities = await fetchAll(db, `SELECT entity_type, data FROM entities WHERE tenant_id = ?`, [tenantId]);
      for (const row of allEntities) {
        const bodyKey = ENTITY_TYPE_MAP[row.entity_type];
        if (bodyKey) {
          if (!data[bodyKey]) data[bodyKey] = [];
          try { data[bodyKey].push(JSON.parse(row.data)); } catch {}
        }
      }
      if (!data.students || data.students.length === 0) data.students = SEED_STUDENTS;
      if (!data.classes || data.classes.length === 0) data.classes = SEED_CLASSES;
      if (!data.modules || data.modules.length === 0) data.modules = SEED_MODULES;
      if (!data.schoolInfo || Object.keys(data.schoolInfo).length === 0) data.schoolInfo = SEED_SCHOOL_INFO;
      if (!data.academicYears || data.academicYears.length === 0) data.academicYears = SEED_ACADEMIC_YEARS;
      if (!data.admins || data.admins.length === 0) data.admins = SEED_ADMINS;

      const totalCount = Object.values(data).reduce((a, v) => a + (Array.isArray(v) ? v.length : 1), 0);
      try {
        await db.prepare(
          `INSERT INTO sync_log (tenant_id, operation, record_count, status, details) VALUES (?, 'pull', ?, 'success', ?)`
        ).bind(tenantId, totalCount, 'Manual trigger pull').run();
      } catch {}
      results.operations.push({ operation: 'pull', count: totalCount, status: 'success' });
      results.data = data;
    }

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (err) {
    console.error('[sync/trigger] Error:', err);
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
  return handleTrigger(context);
}

export async function onRequestPost(context) {
  return handleTrigger(context);
}
