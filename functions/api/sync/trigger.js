/**
 * POST /api/sync/trigger
 * Manual sync trigger — runs push then pull
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handleTrigger(context) {
  try {
    const body = await context.request.json();
    const tenantId = body.tenant_id || 'default';
    const mode = body.mode || 'push'; // push | pull | full

    const results = { success: true, operations: [] };

    if (mode === 'push' || mode === 'full') {
      // Push data from body
      const ENTITY_TYPES = {
        students: 'students', classes: 'classes', modules: 'modules',
        attendance: 'attendance_records', grades: 'grades', behavior: 'behavior_records',
        tasks: 'tasks', incidents: 'incidents', teachers: 'teachers',
        employees: 'employees', templates: 'templates', academicYears: 'academic_years',
        schedules: 'schedules', exams: 'exams', examGrades: 'exam_grades',
        curriculum: 'curriculum_items',
      };

      let pushed = 0;
      const db = context.env.DB;

      for (const [bodyKey, entityType] of Object.entries(ENTITY_TYPES)) {
        const data = body[bodyKey];
        if (!Array.isArray(data)) continue;
        for (const record of data) {
          const id = String(record.id || '');
          if (!id) continue;
          await db.prepare(
            `INSERT INTO entities (id, tenant_id, entity_type, data, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(id, tenant_id) DO UPDATE SET data = excluded.data, entity_type = excluded.entity_type, updated_at = excluded.updated_at`
          ).bind(id, tenantId, entityType, JSON.stringify(record)).run();
          pushed++;
        }
      }

      // Sync school info
      if (body.schoolInfo) {
        await db.prepare(
          `INSERT INTO school_settings (id, tenant_id, key, data, updated_at)
           VALUES (?, ?, 'school_info', ?, datetime('now'))
           ON CONFLICT(tenant_id, key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
        ).bind('school_info_' + tenantId, tenantId, JSON.stringify(body.schoolInfo)).run();
      }

      await db.prepare(
        `INSERT INTO sync_log (tenant_id, operation, record_count, status, details) VALUES (?, 'push', ?, 'success', ?)`
      ).bind(tenantId, pushed, 'Manual trigger push').run();

      results.operations.push({ operation: 'push', count: pushed, status: 'success' });
    }

    if (mode === 'pull' || mode === 'full') {
      // Pull data from D1
      const ENTITY_TYPE_MAP = {
        students: 'students', classes: 'classes', modules: 'modules',
        attendance_records: 'attendance', grades: 'grades', behavior_records: 'behavior',
        tasks: 'tasks', incidents: 'incidents', teachers: 'teachers',
        employees: 'employees', templates: 'templates', academic_years: 'academicYears',
        schedules: 'schedules', exams: 'exams', exam_grades: 'examGrades',
        curriculum_items: 'curriculum',
      };

      const db = context.env.DB;
      const data = {};

      const settings = await db.prepare(`SELECT key, data FROM school_settings WHERE tenant_id = ?`).bind(tenantId).all();
      if (settings.results) {
        for (const row of settings.results) {
          if (row.key === 'school_info') try { data.schoolInfo = JSON.parse(row.data); } catch {}
        }
      }

      const allEntities = await db.prepare(`SELECT entity_type, data FROM entities WHERE tenant_id = ?`).bind(tenantId).all();
      if (allEntities.results) {
        for (const row of allEntities.results) {
          const bodyKey = ENTITY_TYPE_MAP[row.entity_type];
          if (bodyKey) {
            if (!data[bodyKey]) data[bodyKey] = [];
            try { data[bodyKey].push(JSON.parse(row.data)); } catch {}
          }
        }
      }

      await db.prepare(
        `INSERT INTO sync_log (tenant_id, operation, record_count, status, details) VALUES (?, 'pull', ?, 'success', ?)`
      ).bind(tenantId, Object.values(data).reduce((a, v) => a + (Array.isArray(v) ? v.length : 1), 0), 'Manual trigger pull').run();

      results.operations.push({ operation: 'pull', count: Object.keys(data).length, status: 'success' });
      results.data = data;
    }

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('[sync/trigger] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequest(context) {
  return handleTrigger(context);
}

export async function onRequestPost(context) {
  return handleTrigger(context);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
    },
  });
}
