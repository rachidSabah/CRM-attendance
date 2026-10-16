/**
 * Cloudflare Pages Function — Hybrid WhatsApp Dispatch Engine
 *
 * Route: POST /api/whatsapp/dispatch
 *
 * Supports both:
 * 1. Mode "baileys": Headless automated dispatch via local/remote Baileys gateway service.
 * 2. Mode "wame": Generates structured web/desktop wa.me deep links with standards-compliant URL encoding.
 * 3. Mode "auto": Attempts Baileys gateway first, automatically falls back to wa.me if offline.
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

function normalizePhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Moroccan number normalization
  if (digits.length === 10 && digits.startsWith('0')) {
    return '212' + digits.slice(1);
  }
  if (digits.length === 9 && (digits.startsWith('5') || digits.startsWith('6') || digits.startsWith('7'))) {
    return '212' + digits;
  }
  if (digits.length === 13 && digits.startsWith('2120')) {
    return '212' + digits.slice(4);
  }
  if (digits.length === 12 && digits.startsWith('212')) {
    return digits;
  }

  return digits;
}

function sanitizeWhatsAppText(rawText) {
  if (!rawText) return '';
  let text = String(rawText);
  text = text.replace(/\uFFFD/g, '');
  text = text.replace(/\\([*_~`\[\]\\])/g, '$1');
  text = text.replace(/^#\s+(.+)$/gm, (_, heading) => '*' + heading.trim().toUpperCase() + '*');
  text = text.replace(/^#{2,4}\s+(.+)$/gm, (_, heading) => '*' + heading.trim() + '*');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '*$1* : $2');
  text = text.replace(/^[\*\-]\s+(.+)$/gm, '• $1');
  text = text.replace(/~~([^~]+)~~/g, '~$1~');
  text = text.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  text = text.replace(/\*([^*\n]+?)\*/g, (_, inner) => '*' + inner.trim() + '*');
  text = text.replace(/_([^_\n]+?)_/g, (_, inner) => '_' + inner.trim() + '_');
  text = text.replace(/\r\n/g, '\n');
  return text.trim();
}

function buildWhatsAppUrl(phone, text) {
  const cleanPhone = normalizePhone(phone);
  const sanitized = sanitizeWhatsAppText(text);
  const url = new URL(`https://wa.me/${cleanPhone}`);
  url.search = `?text=${encodeURIComponent(sanitized)}`;
  return url.toString();
}

export async function onRequestPost(context) {
  const corsHeaders = {
    ...getCorsHeaders(context.request),
    'Content-Type': 'application/json; charset=utf-8',
  };

  // Auth validation
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    let body = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { to, text, mode = 'auto', gatewayUrl } = body;
    if (!to || !text) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parameters "to" and "text" are required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedTo = normalizePhone(to);
    const sanitizedText = sanitizeWhatsAppText(text);
    const waMeUrl = buildWhatsAppUrl(normalizedTo, sanitizedText);

    if (mode === 'wame') {
      return new Response(
        JSON.stringify({ success: true, mode: 'wame', url: waMeUrl, to: normalizedTo, text: sanitizedText }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Baileys Gateway attempt
    const targetGateway = gatewayUrl || context.env.BAILEYS_GATEWAY_URL || 'http://127.0.0.1:8003';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(`${targetGateway.replace(/\/+$/, '')}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ to: normalizedTo, text: sanitizedText }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: true, mode: 'baileys', data, to: normalizedTo }),
          { status: 200, headers: corsHeaders }
        );
      } else {
        throw new Error(`Gateway returned HTTP ${resp.status}`);
      }
    } catch (err) {
      // Graceful fallback to wa.me if Baileys gateway is unreachable or timed out
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'wame_fallback',
          url: waMeUrl,
          to: normalizedTo,
          notice: `Passerelle Baileys non joignable (${err.message || 'offline'}). Redirection WhatsApp Desktop/Web activée.`,
        }),
        { status: 200, headers: corsHeaders }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}
