/**
 * Cloudflare Pages Function — Send Email via Brevo (Sendinblue) API
 *
 * Route: POST /api/send-email
 *
 * Credentials (either source works):
 *   Option A — Cloudflare Environment Variables (more secure):
 *     BREVO_API_KEY   — Your Brevo API key (starts with xkeysib-...)
 *     BREVO_SENDER    — Sender email (must be verified in Brevo)
 *   Option B — From request body (configured via CRM Settings page):
 *     apiKey       — Brevo API key
 *     senderEmail  — Sender email address
 *
 * Request Body (JSON):
 *   to           — Recipient email address (string)
 *   toName       — Recipient name (string, optional)
 *   subject      — Email subject (string)
 *   htmlContent  — HTML body (string)
 *   textContent  — Plain text fallback (string, optional)
 *   apiKey       — Brevo API key (optional, overrides env var)
 *   senderEmail  — Sender email (optional, overrides env var)
 *
 * Response:
 *   { success: true, messageId: "..." }  on success
 *   { success: false, error: "..." }     on failure
 */

export async function onRequest(context) {
  return context.next();
}

export async function onRequestPost(context) {
  try {
    // --- Parse request body ---
    let body;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- Resolve credentials: body > env vars ---
    const apiKey = body.apiKey || context.env.BREVO_API_KEY;
    const senderEmail = body.senderEmail || context.env.BREVO_SENDER;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brevo API key not configured. Set it in Settings > Email (Brevo) or as BREVO_API_KEY env var.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!senderEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sender email not configured. Set it in Settings > Email (Brevo) or as BREVO_SENDER env var.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { to, toName, subject, htmlContent, textContent } = body;

    // --- Validate required fields ---
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid "to" email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!subject || typeof subject !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: '"subject" is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!htmlContent || typeof htmlContent !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: '"htmlContent" is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- Call Brevo API ---
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
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
        textContent: textContent || stripHtml(htmlContent),
      }),
    });

    const responseData = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('[Brevo API Error]', brevoResponse.status, responseData);
      return new Response(
        JSON.stringify({
          success: false,
          error: responseData.message || `Brevo API error ${brevoResponse.status}`,
          code: responseData.code,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- Success ---
    return new Response(
      JSON.stringify({
        success: true,
        messageId: responseData.messageId || null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[send-email] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}


// --- Utility: strip HTML tags for plain text fallback ---
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '  - ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
