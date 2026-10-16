/**
 * GET /api/sync/pull?tenant_id=default
 * Pull all entity data from D1 to frontend with resilient seed fallback.
 * REQUIRES AUTHENTICATION
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
  saved_schedules: 'savedSchedules',
  justifications: 'justifications',
};

async function handlePull(context) {
  const cors = getCorsHeaders(context.request);
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }

  const url = new URL(context.request.url);
  const tenantId = url.searchParams.get('tenant_id') || auth.user?.tenantId || 'default';
  const db = context.env.DB;
  const result = { success: true, tenant_id: tenantId, data: {}, synced_at: new Date().toISOString() };

  let d1ReadSuccess = false;

  if (db) {
    try {
      // 1. Pull school settings (school_info & admins)
      const settings = await db.prepare(
        `SELECT key, data FROM school_settings WHERE tenant_id = ?`
      ).bind(tenantId).all();

      if (settings && settings.results) {
        const admins = [];
        for (const row of settings.results) {
          if (row.key === 'school_info') {
            try { result.data.schoolInfo = JSON.parse(row.data); } catch (e) { console.warn('[sync/pull] school_info parse failed:', e.message || e); }
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
            } catch (e) { console.warn('[sync/pull] Admin data parse failed:', e.message || e); }
          }
        }
        if (admins.length > 0) result.data.admins = admins;
      }

      // 2. Pull entities by type
      const allEntities = await fetchAll(
        db,
        `SELECT entity_type, data, updated_at FROM entities WHERE tenant_id = ? ORDER BY updated_at ASC`,
        [tenantId]
      );

      if (Array.isArray(allEntities)) {
        d1ReadSuccess = true;
        for (const row of allEntities) {
          const bodyKey = ENTITY_TYPE_MAP[row.entity_type];
          if (bodyKey) {
            if (!result.data[bodyKey]) result.data[bodyKey] = [];
            try {
              result.data[bodyKey].push(JSON.parse(row.data));
            } catch (e) {
              console.warn('[sync/pull] Entity data parse failed:', e.message || e);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[sync/pull] D1 read failed (activating resilient seed fallback):', err.message || err);
    }
  }

  // =========================================================================
  // RESILIENT RECOVERY FALLBACK: Ensure core application data is never empty
  // =========================================================================
  if (!result.data.students || result.data.students.length === 0) {
    result.data.students = SEED_STUDENTS;
  }
  if (!result.data.classes || result.data.classes.length === 0) {
    result.data.classes = SEED_CLASSES;
  }
  if (!result.data.modules || result.data.modules.length === 0) {
    result.data.modules = SEED_MODULES;
  }
  if (!result.data.schoolInfo || Object.keys(result.data.schoolInfo).length === 0) {
    result.data.schoolInfo = SEED_SCHOOL_INFO;
  }
  if (!result.data.academicYears || result.data.academicYears.length === 0) {
    result.data.academicYears = SEED_ACADEMIC_YEARS;
  }
  if (!result.data.admins || result.data.admins.length === 0) {
    result.data.admins = SEED_ADMINS;
  }

  // Deduplicate attendance records
  if (Array.isArray(result.data.attendance)) {
    const dedupedAtt = new Map();
    for (const rec of result.data.attendance) {
      if (rec && rec.studentId && rec.date) {
        const key = `${rec.studentId}_${rec.date}`;
        dedupedAtt.set(key, rec);
      }
    }
    result.data.attendance = Array.from(dedupedAtt.values());
  } else {
    result.data.attendance = [];
  }

  // Calculate entity counts
  result.counts = {
    students: result.data.students?.length || 0,
    classes: result.data.classes?.length || 0,
    modules: result.data.modules?.length || 0,
    attendance_records: result.data.attendance?.length || 0,
    grades: result.data.grades?.length || 0,
    academic_years: result.data.academicYears?.length || 0,
  };

  result.resilient_fallback = !d1ReadSuccess;

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
  );
}

export async function onRequestOptions(context) {
  return new Response(null, { headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  return handlePull(context);
}
