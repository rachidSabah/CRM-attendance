/**
 * Cloudflare Pages Function — Send Email via Brevo (Sendinblue) API
 *
 * Route: POST /api/send-email
 *
 * Required Environment Variables (set in Cloudflare Pages dashboard):
 *   BREVO_API_KEY   — Your Brevo API key (starts with xkeysib-...)
 *   BREVO_SENDER    — Sender email (must be verified in Brevo, e.g. "noreply@yourdomain.com")
 *
 * Request Body (JSON):
 *   to          — Recipient email address (string)
 *   toName      — Recipient name (string, optional)
 *   subject     — Email subject (string)
 *   htmlContent — HTML body (string)
 *  textContent  — Plain text fallback (string, optional)
 *
 * Response:
 *   { success: true, messageId: "..." }  on success
 *   { success: false, error: "..." }     on failure
 */

export async function onRequestPost(context) {
  try {
    // --- CORS preflight handled by Cloudflare, but let's set headers on response ---
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // --- Validate environment ---
    const apiKey = context.env.BREVO_API_KEY;
    const senderEmail = context.env.BREVO_SENDER;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'BREVO_API_KEY not configured on server. Set it in Cloudflare Pages Environment Variables.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!senderEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'BREVO_SENDER not configured on server. Set it in Cloudflare Pages Environment Variables.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // --- Parse request body ---
    let body;
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { to, toName, subject, htmlContent, textContent } = body;

    // --- Validate required fields ---
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid "to" email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!subject || typeof subject !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: '"subject" is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!htmlContent || typeof htmlContent !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: '"htmlContent" is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
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
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // --- Success ---
    return new Response(
      JSON.stringify({
        success: true,
        messageId: responseData.messageId || null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    console.error('[send-email] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
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
