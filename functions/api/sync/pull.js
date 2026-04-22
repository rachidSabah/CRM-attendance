/**
 * GET /api/sync/pull?tenant_id=default
 * Pull all entity data from D1 to frontend
 * REQUIRES AUTHENTICATION
 */

import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';
import { fetchAll } from '../../_lib/paginate.js';

const ENTITY_TYPE_MAP = {
  students: 'students',
  classes: 'classes',
  modules: 'modules',
  attendance_records: 'attendance',
  grades: 'grades',
  behavior_records: 'behavior',
  tasks: 'tasks',
  incidents: 'incidents',
  teachers: 'teachers',
  employees: 'employees',
  templates: 'templates',
  academic_years: 'academicYears',
  schedules: 'schedules',
  exams: 'exams',
  exam_grades: 'examGrades',
  curriculum_items: 'curriculum',
  calendar_events: 'calendarEvents',
};

async function handlePull(context) {
  // Auth check — pull requires authentication
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  try {
    const url = new URL(context.request.url);
    const tenantId = url.searchParams.get('tenant_id') || auth.user?.tenantId || 'default';
    const db = context.env.DB;

    const result = { success: true, tenant_id: tenantId, data: {}, synced_at: new Date().toISOString() };

    // Pull school settings (including admin user records without sensitive fields)
    const settings = await db.prepare(
      `SELECT key, data FROM school_settings WHERE tenant_id = ?`
    ).bind(tenantId).all();
    if (settings.results) {
      const admins = [];
      for (const row of settings.results) {
        if (row.key === 'school_info') {
          try { result.data.schoolInfo = JSON.parse(row.data); } catch {}
        } else if (row.key.startsWith('auth_')) {
          // Include admin records for frontend sync (strip password & token)
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
      if (admins.length > 0) result.data.admins = admins;
    }

    // Pull entities by type (paginated to avoid D1 1000-row limit)
    const allEntities = await fetchAll(
      db,
      `SELECT entity_type, data FROM entities WHERE tenant_id = ?`,
      [tenantId]
    );

    for (const row of allEntities) {
      const bodyKey = ENTITY_TYPE_MAP[row.entity_type];
      if (bodyKey) {
        if (!result.data[bodyKey]) result.data[bodyKey] = [];
        try { result.data[bodyKey].push(JSON.parse(row.data)); } catch {}
      }
    }

    // Count entities
    const counts = await db.prepare(
      `SELECT entity_type, COUNT(*) as count FROM entities WHERE tenant_id = ? GROUP BY entity_type`
    ).bind(tenantId).all();
    result.counts = {};
    if (counts.results) {
      for (const row of counts.results) {
        result.counts[row.entity_type] = row.count;
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (err) {
    console.error('[sync/pull] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }
}

export async function onRequestOptions(context) {
  return new Response(null, { headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  return handlePull(context);
}
