/**
 * Cloudflare Pages Function — Absence Escalation & Disciplinary Workflow Engine
 *
 * Route: POST /api/escalations/check
 *
 * Scans all student attendance records against configurable absence thresholds:
 * - Palier 1 (3 absences): Avertissement 1
 * - Palier 2 (5 absences): Avertissement 2 (Mise en demeure / Lettre officielle)
 * - Palier 3 (8+ absences): Conseil de Discipline & Verrouillage examens
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';
import { fetchAll } from '../../_lib/paginate.js';

export async function onRequestPost(context) {
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  try {
    const db = context.env.DB;
    const tenantId = auth.user?.tenantId || 'default';

    // 1. Fetch school info to get customized thresholds if defined
    let warning1Limit = 3;
    let warning2Limit = 5;
    let councilLimit = 8;

    const schoolSetting = await db.prepare(
      `SELECT data FROM school_settings WHERE tenant_id = ? AND key = 'school_info'`
    ).bind(tenantId).first();

    if (schoolSetting?.data) {
      try {
        const sInfo = JSON.parse(schoolSetting.data);
        if (sInfo.absenceThresholds) {
          warning1Limit = sInfo.absenceThresholds.warning1 || 3;
          warning2Limit = sInfo.absenceThresholds.warning2 || 5;
          councilLimit = sInfo.absenceThresholds.council || 8;
        }
      } catch {}
    }

    // 2. Fetch all students and attendance records
    const [studentsRows, attendanceRows] = await Promise.all([
      fetchAll(db, 'SELECT data FROM entities WHERE tenant_id = ? AND entity_type = "students"', [tenantId]),
      fetchAll(db, 'SELECT data FROM entities WHERE tenant_id = ? AND entity_type = "attendance_records"', [tenantId]),
    ]);

    const students = studentsRows.map(r => { try { return JSON.parse(r.data); } catch { return null; } }).filter(Boolean);
    const attendance = attendanceRows.map(r => { try { return JSON.parse(r.data); } catch { return null; } }).filter(Boolean);

    // Group absences by student
    const absencesByStudent = new Map();
    for (const r of attendance) {
      if (r.status === 'absent') {
        const list = absencesByStudent.get(r.studentId) || [];
        list.push(r.date);
        absencesByStudent.set(r.studentId, list);
      }
    }

    const escalations = [];

    for (const s of students) {
      if (s.status !== 'active') continue;
      const dates = absencesByStudent.get(s.id) || [];
      const count = dates.length;

      let level = 'normal';
      let examLocked = false;
      let label = 'Normal';

      if (count >= councilLimit) {
        level = 'discipline_council';
        examLocked = true;
        label = `Conseil de Discipline (${count} absences)`;
      } else if (count >= warning2Limit) {
        level = 'warning_2';
        label = `Avertissement 2 (${count} absences)`;
      } else if (count >= warning1Limit) {
        level = 'warning_1';
        label = `Avertissement 1 (${count} absences)`;
      }

      if (level !== 'normal') {
        escalations.push({
          studentId: s.id,
          studentCode: s.studentId,
          fullName: s.fullName,
          classId: s.classId,
          className: s.className || '',
          guardianName: s.guardianName || '',
          guardianPhone: s.guardianPhone || '',
          guardianEmail: s.guardianEmail || '',
          unexcusedAbsenceCount: count,
          absenceDates: dates.sort(),
          level,
          examLocked,
          label,
        });
      }
    }

    // Sort by absence count descending
    escalations.sort((a, b) => b.unexcusedAbsenceCount - a.unexcusedAbsenceCount);

    return new Response(
      JSON.stringify({
        success: true,
        thresholds: { warning1: warning1Limit, warning2: warning2Limit, council: councilLimit },
        totalEscalated: escalations.length,
        escalations,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erreur interne' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}
