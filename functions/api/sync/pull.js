/**
 * GET /api/sync/pull?tenant_id=default
 * Pull all entity data from D1 to frontend
 */

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
};

async function handlePull(context) {
  try {
    const url = new URL(context.request.url);
    const tenantId = url.searchParams.get('tenant_id') || 'default';
    const db = context.env.DB;

    const result = { success: true, tenant_id: tenantId, data: {}, synced_at: new Date().toISOString() };

    // Pull school settings
    const settings = await db.prepare(
      `SELECT key, data FROM school_settings WHERE tenant_id = ?`
    ).bind(tenantId).all();
    if (settings.results) {
      for (const row of settings.results) {
        if (row.key === 'school_info') {
          try { result.data.schoolInfo = JSON.parse(row.data); } catch {}
        }
      }
    }

    // Pull entities by type
    const allEntities = await db.prepare(
      `SELECT entity_type, data FROM entities WHERE tenant_id = ?`
    ).bind(tenantId).all();

    if (allEntities.results) {
      for (const row of allEntities.results) {
        const bodyKey = ENTITY_TYPE_MAP[row.entity_type];
        if (bodyKey) {
          if (!result.data[bodyKey]) result.data[bodyKey] = [];
          try { result.data[bodyKey].push(JSON.parse(row.data)); } catch {}
        }
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
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[sync/pull] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequest(context) {
  return handlePull(context);
}

export async function onRequestGet(context) {
  return handlePull(context);
}

