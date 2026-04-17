/**
 * Client-side email helper — sends email via the Brevo Cloudflare Pages Function.
 *
 * Usage:
 *   import { sendTaskAssignmentEmail, sendEmail } from './email';
 *
 *   // Specific: task assignment notification
 *   await sendTaskAssignmentEmail({
 *     to: 'person@email.com',
 *     toName: 'John Doe',
 *     taskTitle: 'Review Attendance Report',
 *     assignedBy: 'Admin Name',
 *     priority: 'high',
 *     dueDate: '2025-02-15',
 *     description: 'Please review and submit.',
 *   });
 *
 *   // Generic: any HTML email
 *   await sendEmail({ to, subject, htmlContent });
 */

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface TaskEmailParams {
  to: string;
  toName?: string;
  taskTitle: string;
  assignedBy?: string;
  priority?: string;
  dueDate?: string;
  description?: string;
  ticketNumber?: string;
  category?: string;
  language?: 'en' | 'fr';
}

/**
 * Generic email sender — calls /api/send-email Cloudflare Pages Function
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    return data as { success: boolean; error?: string; messageId?: string };
  } catch (err) {
    console.error('[email] Failed to send:', err);
    return { success: false, error: 'Network error — could not reach email service' };
  }
}

/**
 * Build a professional HTML email for task assignment notification
 */
function buildTaskAssignmentHtml(params: TaskEmailParams): string {
  const {
    taskTitle,
    assignedBy,
    priority,
    dueDate,
    description,
    ticketNumber,
    category,
    toName,
    language = 'en',
  } = params;

  const isFr = language === 'fr';

  const priorityColors: Record<string, string> = {
    urgent: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
  };
  const priorityColor = priorityColors[priority || 'medium'] || priorityColors.medium;

  const priorityLabel: Record<string, Record<string, string>> = {
    en: { urgent: 'URGENT', high: 'High', medium: 'Medium', low: 'Low' },
    fr: { urgent: 'URGENT', high: 'Élevée', medium: 'Moyenne', low: 'Basse' },
  };
  const pLabel = priorityLabel[language]?.[priority || 'medium'] || priority;

  const greeting = toName
    ? (isFr ? `Bonjour ${toName},` : `Dear ${toName},`)
    : (isFr ? 'Bonjour,' : 'Hello,');

  const mainMessage = isFr
    ? `Une nouvelle tâche vous a été assignée dans le système CRM Attendance.`
    : `A new task has been assigned to you in the CRM Attendance system.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #059669, #10b981); padding: 28px 32px; color: white; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
    .body { padding: 28px 32px; color: #334155; font-size: 15px; line-height: 1.6; }
    .body .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .task-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; }
    .task-card h2 { margin: 0 0 12px; font-size: 17px; color: #0f172a; }
    .task-card .ticket { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 12px; font-family: monospace; padding: 3px 8px; border-radius: 4px; margin-bottom: 10px; }
    .priority-badge { display: inline-block; color: white; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; }
    .info-value { font-weight: 600; color: #1e293b; }
    .description { margin-top: 14px; padding: 12px 16px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 6px 6px 0; font-size: 14px; color: #44403c; }
    .footer { padding: 20px 32px; background: #f8fafc; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .footer a { color: #059669; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isFr ? 'Nouvelle Tâche Assignée' : 'New Task Assigned'}</h1>
      <p>CRM Attendance — ${isFr ? 'Système de Gestion' : 'Management System'}</p>
    </div>
    <div class="body">
      <p class="greeting">${greeting}</p>
      <p>${mainMessage}</p>
      <div class="task-card">
        ${ticketNumber ? `<div class="ticket">${ticketNumber}</div>` : ''}
        <h2>${taskTitle}</h2>
        <span class="priority-badge" style="background: ${priorityColor};">${pLabel}</span>
        ${category ? `&nbsp; <span style="display:inline-block; background:#f1f5f9; color:#475569; font-size:12px; padding:3px 10px; border-radius:20px; margin-left:6px;">${category}</span>` : ''}
        <div style="margin-top: 16px;">
          <div class="info-row">
            <span class="info-label">${isFr ? 'Assigné par' : 'Assigned by'}</span>
            <span class="info-value">${assignedBy || '—'}</span>
          </div>
          ${dueDate ? `<div class="info-row">
            <span class="info-label">${isFr ? 'Date limite' : 'Due Date'}</span>
            <span class="info-value">${dueDate}</span>
          </div>` : ''}
        </div>
        ${description ? `<div class="description">${description}</div>` : ''}
      </div>
      <p style="font-size:13px; color:#64748b;">${isFr ? 'Merci de consulter le système CRM pour plus de détails.' : 'Please check the CRM system for more details.'}</p>
    </div>
    <div class="footer">
      <p>${isFr ? 'Cet email a été envoyé automatiquement par le système CRM Attendance.' : 'This email was sent automatically by the CRM Attendance system.'}</p>
      <p style="margin-top:4px;">&copy; ${new Date().getFullYear()} CRM Attendance</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a task assignment notification email
 */
export async function sendTaskAssignmentEmail(params: TaskEmailParams): Promise<{ success: boolean; error?: string }> {
  const { to, toName } = params;

  if (!to || !to.includes('@')) {
    return { success: false, error: 'Invalid recipient email' };
  }

  const isFr = (params.language || 'en') === 'fr';
  const subject = params.ticketNumber
    ? (isFr
      ? `[CRM] Tâche assignée: ${params.taskTitle} (${params.ticketNumber})`
      : `[CRM] Task Assigned: ${params.taskTitle} (${params.ticketNumber})`)
    : (isFr
      ? `[CRM] Tâche assignée: ${params.taskTitle}`
      : `[CRM] Task Assigned: ${params.taskTitle}`);

  const htmlContent = buildTaskAssignmentHtml(params);

  return sendEmail({ to, toName, subject, htmlContent });
}
