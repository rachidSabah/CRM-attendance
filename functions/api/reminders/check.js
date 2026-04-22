/**
 * POST /api/reminders/check
 * Check today's absences and send reminder emails via Brevo
 * 
 * Body: { 
 *   date: "2025-01-15" (optional, defaults to today),
 *   tenant_id: "default",
 *   brevo_api_key: "xkeysib-...",
 *   sender_email: "noreply@domain.com",
 *   language: "en" | "fr",
 *   school_info: { name, address, ... }
 * }
 */

import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';
import { fetchAll } from '../../_lib/paginate.js';

function buildAbsenceEmailHtml(studentName, className, date, schoolName, language) {
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const dir = isAr ? 'rtl' : 'ltr';
  const L = (ar, fr, en) => isAr ? ar : isFr ? fr : en;
  return `<!DOCTYPE html>
<html dir="${dir}"><head><meta charset="utf-8">
<style>
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9}
.container{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#dc2626,#ef4444);padding:28px 32px;color:#fff}
.header h1{margin:0;font-size:20px;font-weight:700}
.header p{margin:6px 0 0;font-size:13px;opacity:.9}
.body{padding:28px 32px;color:#334155;font-size:15px;line-height:1.6}
.greeting{font-size:16px;font-weight:600;margin-bottom:16px}
.alert-box{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:20px;margin:20px 0}
.alert-box h2{margin:0 0 8px;color:#991b1b;font-size:17px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.info-row:last-child{border-bottom:none}
.info-label{color:#64748b}
.info-value{font-weight:600;color:#1e293b}
.footer{padding:20px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
</style></head><body>
<div class="container">
  <div class="header">
    <h1>${L('إشعار غياب', "Notification d'Absence", 'Absence Notification')}</h1>
    <p>${schoolName || 'CRM Attendance'} — ${L('نظام إدارة الحضور', 'Système de Gestion', 'Management System')}</p>
  </div>
  <div class="body">
    <p class="greeting">${L('عزيزي ولي الأمر،', 'Bonjour,', 'Hello,')}</p>
    <p>${L('نود إعلامكم بأن ابنكم/ابنتكم تم تسجيله/ها غائباً/غائبة أثناء تسجيل الحضور اليوم.',
      "Nous vous informons que votre enfant a été marqué(e) absent(e) lors de l'appel aujourd'hui.",
      'We would like to inform you that your child was marked absent during today\'s attendance check.')}</p>
    <div class="alert-box">
      <h2>${L('تفاصيل الغياب', "Détails de l'absence", 'Absence Details')}</h2>
      <div class="info-row"><span class="info-label">${L('الطالب/ة', 'Élève', 'Student')}</span><span class="info-value">${studentName}</span></div>
      <div class="info-row"><span class="info-label">${L('القسم', 'Classe', 'Class')}</span><span class="info-value">${className || '-'}</span></div>
      <div class="info-row"><span class="info-label">${L('التاريخ', 'Date', 'Date')}</span><span class="info-value">${date}</span></div>
    </div>
    <p style="font-size:13px;color:#64748b;">${L('إذا كنتم تعتقدون أن هذا خطأ، يرجى الاتصال بإدارة المدرسة في أقرب وقت ممكن.',
      "Si vous pensez qu'il s'agit d'une erreur, veuillez contacter l'administration de l'école dès que possible.",
      'If you believe this is an error, please contact the school administration as soon as possible.')}</p>
  </div>
  <div class="footer">
    <p>${L('تم إرسال هذه الرسالة تلقائياً بواسطة نظام CRM للحضور.', 'Cet email a été envoyé automatiquement par le système CRM Attendance.', 'This email was sent automatically by the CRM Attendance system.')}</p>
    <p style="margin-top:4px">&copy; ${new Date().getFullYear()} ${schoolName || 'CRM Attendance'}</p>
  </div>
</div>
</body></html>`;
}

function buildLateEmailHtml(studentName, className, date, schoolName, language) {
  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const dir = isAr ? 'rtl' : 'ltr';
  const L = (ar, fr, en) => isAr ? ar : isFr ? fr : en;
  return `<!DOCTYPE html>
<html dir="${dir}"><head><meta charset="utf-8">
<style>
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9}
.container{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#d97706,#f59e0b);padding:28px 32px;color:#fff}
.header h1{margin:0;font-size:20px;font-weight:700}
.header p{margin:6px 0 0;font-size:13px;opacity:.9}
.body{padding:28px 32px;color:#334155;font-size:15px;line-height:1.6}
.greeting{font-size:16px;font-weight:600;margin-bottom:16px}
.alert-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:20px;margin:20px 0}
.alert-box h2{margin:0 0 8px;color:#92400e;font-size:17px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.info-row:last-child{border-bottom:none}
.info-label{color:#64748b}
.info-value{font-weight:600;color:#1e293b}
.footer{padding:20px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}
</style></head><body>
<div class="container">
  <div class="header">
    <h1>${L('إشعار تأخر', 'Notification de Retard', 'Late Arrival Notification')}</h1>
    <p>${schoolName || 'CRM Attendance'} — ${L('نظام إدارة الحضور', 'Système de Gestion', 'Management System')}</p>
  </div>
  <div class="body">
    <p class="greeting">${L('عزيزي ولي الأمر،', 'Bonjour,', 'Hello,')}</p>
    <p>${L('نود إعلامكم بأن ابنكم/ابنتكم وصل/ت متأخراً/ة إلى المدرسة اليوم.',
      "Nous vous informons que votre enfant est arrivé(e) en retard aujourd'hui.",
      'We would like to inform you that your child arrived late today.')}</p>
    <div class="alert-box">
      <h2>${L('تفاصيل التأخر', 'Détails du retard', 'Late Arrival Details')}</h2>
      <div class="info-row"><span class="info-label">${L('الطالب/ة', 'Élève', 'Student')}</span><span class="info-value">${studentName}</span></div>
      <div class="info-row"><span class="info-label">${L('القسم', 'Classe', 'Class')}</span><span class="info-value">${className || '-'}</span></div>
      <div class="info-row"><span class="info-label">${L('التاريخ', 'Date', 'Date')}</span><span class="info-value">${date}</span></div>
    </div>
  </div>
  <div class="footer">
    <p>${L('تم إرسال هذه الرسالة تلقائياً بواسطة نظام CRM للحضور.', 'Cet email a été envoyé automatiquement par le système CRM Attendance.', 'This email was sent automatically by the CRM Attendance system.')}</p>
    <p style="margin-top:4px">&copy; ${new Date().getFullYear()} ${schoolName || 'CRM Attendance'}</p>
  </div>
</div>
</body></html>`;
}

async function sendBrevoEmail(apiKey, senderEmail, to, toName, subject, htmlContent) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: 'CRM Attendance' },
      to: [{ email: to, name: toName || to.split('@')[0] }],
      subject,
      htmlContent,
      textContent: htmlContent.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Brevo error ${res.status}`);
  return data;
}

async function handleReminderCheck(context) {
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
    const db = context.env.DB;
    const tenantId = body.tenant_id || 'default';
    const targetDate = body.date || new Date().toISOString().split('T')[0];
    const apiKey = body.brevo_api_key;
    const senderEmail = body.sender_email;
    const language = body.language || 'en';
    const schoolName = body.school_info?.name || 'CRM Attendance';

    if (!apiKey || !senderEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brevo API key and sender email are required. Configure them in Settings > Email (Brevo).' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    // Get today's attendance records for absent/late students (paginated)
    const attendanceRecords = await fetchAll(
      db,
      `SELECT e.data FROM entities e WHERE e.tenant_id = ? AND e.entity_type = 'attendance_records'`,
      [tenantId]
    );

    // Get students (paginated)
    const studentRecords = await fetchAll(
      db,
      `SELECT e.data FROM entities e WHERE e.tenant_id = ? AND e.entity_type = 'students'`,
      [tenantId]
    );

    // Get classes (paginated)
    const classRecords = await fetchAll(
      db,
      `SELECT e.data FROM entities e WHERE e.tenant_id = ? AND e.entity_type = 'classes'`,
      [tenantId]
    );

    // Parse data
    const students = {};
    for (const row of studentRecords) {
      try {
        const s = JSON.parse(row.data);
        students[s.id] = s;
      } catch {}
    }

    const classes = {};
    for (const row of classRecords) {
      try {
        const c = JSON.parse(row.data);
        classes[c.id] = c;
      } catch {}
    }

    // Find absences/late for target date
    const absentStudents = [];
    const lateStudents = [];
    for (const row of attendanceRecords) {
      try {
        const a = JSON.parse(row.data);
        if (a.date === targetDate) {
          if (a.status === 'absent') absentStudents.push(a);
          else if (a.status === 'late') lateStudents.push(a);
        }
      } catch {}
    }

    // Also use body data if provided (for real-time reminders from frontend)
    const bodyAttendance = body.attendance || [];
    const bodyStudents = body.students || [];
    const bodyClasses = body.classes || [];

    // Merge body data
    const allStudents = { ...students };
    for (const s of bodyStudents) allStudents[s.id] = s;
    const allClasses = { ...classes };
    for (const c of bodyClasses) allClasses[c.id] = c;

    // Add body attendance records
    for (const a of bodyAttendance) {
      if (a.date === targetDate) {
        if (a.status === 'absent' && !absentStudents.find(x => x.studentId === a.studentId)) absentStudents.push(a);
        else if (a.status === 'late' && !lateStudents.find(x => x.studentId === a.studentId)) lateStudents.push(a);
      }
    }

    // Check reminder log for already-sent reminders
    const alreadySent = await db.prepare(
      `SELECT student_id, reminder_type FROM reminder_log WHERE tenant_id = ? AND date = ?`
    ).bind(tenantId, targetDate).all();
    const sentSet = new Set();
    for (const row of (alreadySent.results || [])) {
      sentSet.add(`${row.student_id}_${row.reminder_type}`);
    }

    let sentCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Send absence emails
    for (const record of absentStudents) {
      const key = `${record.studentId}_absence`;
      if (sentSet.has(key)) { skippedCount++; continue; }

      const student = allStudents[record.studentId];
      if (!student) continue;

      const studentName = student.fullName || student.full_name || student.name || 'Student';
      const guardianEmail = student.guardianEmail;
      if (!guardianEmail || !guardianEmail.includes('@')) { skippedCount++; continue; }

      const className = student.className || (student.classId ? allClasses[student.classId]?.name : '') || '';
      const isFr = language === 'fr';
      const subject = isFr
        ? `[${schoolName}] Absence de ${studentName} - ${targetDate}`
        : `[${schoolName}] Absence of ${studentName} - ${targetDate}`;

      try {
        const html = buildAbsenceEmailHtml(studentName, className, targetDate, schoolName, language);
        await sendBrevoEmail(apiKey, senderEmail, guardianEmail, student.guardianName, subject, html);

        // Log reminder
        await db.prepare(
          `INSERT OR IGNORE INTO reminder_log (tenant_id, student_id, date, reminder_type, recipient_email, status)
           VALUES (?, ?, ?, 'absence', ?, 'sent')`
        ).bind(tenantId, record.studentId, targetDate, guardianEmail).run();

        sentCount++;
      } catch (err) {
        errors.push({ student: studentName, error: err.message });
        await db.prepare(
          `INSERT OR IGNORE INTO reminder_log (tenant_id, student_id, date, reminder_type, recipient_email, status, created_at)
           VALUES (?, ?, ?, 'absence', ?, 'failed', datetime('now'))`
        ).bind(tenantId, record.studentId, targetDate, guardianEmail).run();
      }
    }

    // Send late emails
    for (const record of lateStudents) {
      const key = `${record.studentId}_late`;
      if (sentSet.has(key)) { skippedCount++; continue; }

      const student = allStudents[record.studentId];
      if (!student) continue;

      const studentName = student.fullName || student.full_name || student.name || 'Student';
      const guardianEmail = student.guardianEmail;
      if (!guardianEmail || !guardianEmail.includes('@')) { skippedCount++; continue; }

      const className = student.className || (student.classId ? allClasses[student.classId]?.name : '') || '';
      const isFr = language === 'fr';
      const subject = isFr
        ? `[${schoolName}] Retard de ${studentName} - ${targetDate}`
        : `[${schoolName}] Late Arrival of ${studentName} - ${targetDate}`;

      try {
        const html = buildLateEmailHtml(studentName, className, targetDate, schoolName, language);
        await sendBrevoEmail(apiKey, senderEmail, guardianEmail, student.guardianName, subject, html);

        await db.prepare(
          `INSERT OR IGNORE INTO reminder_log (tenant_id, student_id, date, reminder_type, recipient_email, status)
           VALUES (?, ?, ?, 'late', ?, 'sent')`
        ).bind(tenantId, record.studentId, targetDate, guardianEmail).run();

        sentCount++;
      } catch (err) {
        errors.push({ student: studentName, error: err.message });
        await db.prepare(
          `INSERT OR IGNORE INTO reminder_log (tenant_id, student_id, date, reminder_type, recipient_email, status, created_at)
           VALUES (?, ?, ?, 'late', ?, 'failed', datetime('now'))`
        ).bind(tenantId, record.studentId, targetDate, guardianEmail).run();
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        absent_count: absentStudents.length,
        late_count: lateStudents.length,
        sent: sentCount,
        skipped: skippedCount,
        errors,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  } catch (err) {
    console.error('[reminders/check] Error:', err);
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
  // Fallback: route to specific method handlers
  return context.next();
}

export async function onRequestPost(context) {
  return handleReminderCheck(context);
}

