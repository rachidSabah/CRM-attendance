/**
 * GET /api/parent/attendance
 * Strictly isolated attendance data for verified parent session
 * Unauthenticated by admin token, but validated via Bearer <parent_token>
 */
import { getCorsHeaders } from '../../_lib/cors.js';
import { fetchAll } from '../../_lib/paginate.js';

export async function onRequestGet(context) {
  const cors = getCorsHeaders(context.request);
  const db = context.env.DB;

  try {
    const authHeader = context.request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Session parent non fournie' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // Lookup session in school_settings
    const sessionKey = `parent_session_${token}`;
    const row = await db.prepare(
      "SELECT data FROM school_settings WHERE key = ? LIMIT 1"
    ).bind(sessionKey).first();

    if (!row || !row.data) {
      return new Response(JSON.stringify({ success: false, error: 'Session parent invalide ou expirée' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const session = JSON.parse(row.data);
    if (Date.now() > session.expiresAt) {
      await db.prepare("DELETE FROM school_settings WHERE key = ?").bind(sessionKey).run();
      return new Response(JSON.stringify({ success: false, error: 'Session parent expirée. Veuillez vous reconnecter.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const allowedStudentIds = new Set(session.studentIds || []);
    if (allowedStudentIds.size === 0) {
      return new Response(JSON.stringify({
        success: true,
        students: [],
        attendance: [],
        justifications: [],
        summary: { totalSessions: 0, presentCount: 0, absentCount: 0, rate: 100 },
      }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    // 1. Fetch only matching students
    const studentRows = await fetchAll(
      db,
      "SELECT id, data FROM entities WHERE entity_type = 'students'",
      []
    );

    const students = [];
    for (const r of studentRows) {
      if (allowedStudentIds.has(r.id)) {
        try {
          const s = JSON.parse(r.data);
          students.push({
            id: s.id,
            fullName: s.fullName,
            studentId: s.studentId,
            className: s.className || s.group,
            group: s.group,
            photo: s.photo || null,
            status: s.status || 'active',
          });
        } catch {}
      }
    }

    // 2. Fetch attendance records for these students
    const attendanceRows = await fetchAll(
      db,
      "SELECT id, data FROM entities WHERE entity_type = 'attendance_records'",
      []
    );

    const attendance = [];
    let presentCount = 0;
    let absentExcusedCount = 0;
    let absentUnexcusedCount = 0;
    let lateCount = 0;

    for (const r of attendanceRows) {
      try {
        const a = JSON.parse(r.data);
        if (allowedStudentIds.has(a.studentId)) {
          attendance.push(a);

          if (a.status === 'present') presentCount++;
          else if (a.status === 'late') { lateCount++; presentCount++; }
          else if (a.status === 'excused') absentExcusedCount++;
          else if (a.status === 'absent') {
            if (a.justificationId) absentExcusedCount++;
            else absentUnexcusedCount++;
          }
        }
      } catch {}
    }

    // Sort attendance by date descending
    attendance.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 3. Fetch excuse justifications for these students
    const justRows = await fetchAll(
      db,
      "SELECT id, data FROM entities WHERE entity_type = 'justifications'",
      []
    );

    const justifications = [];
    for (const r of justRows) {
      try {
        const j = JSON.parse(r.data);
        if (allowedStudentIds.has(j.studentId)) {
          justifications.push(j);
        }
      } catch {}
    }
    justifications.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const totalSessions = presentCount + absentExcusedCount + absentUnexcusedCount;
    const rate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

    return new Response(JSON.stringify({
      success: true,
      students,
      attendance,
      justifications,
      summary: {
        totalSessions,
        presentCount,
        absentExcusedCount,
        absentUnexcusedCount,
        lateCount,
        rate,
      },
      expiresAt: session.expiresAt,
    }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    console.error('[parent/attendance] Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Erreur lors de la récupération des données parent',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
}
