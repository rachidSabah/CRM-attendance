/**
 * Cloudflare Pages Function — Hybrid WhatsApp Dispatch Engine
 *
 * Route: POST /api/whatsapp/dispatch
 *
 * Supports both:
 * 1. Mode "baileys": Headless automated dispatch via local/remote Baileys gateway service.
 * 2. Mode "wame": Generates structured web/desktop wa.me deep links.
 * 3. Mode "auto": Attempts Baileys gateway first, automatically falls back to wa.me if offline.
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0') && (cleaned.length === 10 || cleaned.length === 9)) {
    cleaned = '212' + cleaned.substring(1);
  } else if (cleaned.length === 9 && !cleaned.startsWith('212')) {
    cleaned = '212' + cleaned;
  }
  return cleaned;
}

export async function onRequestPost(context) {
  // Auth validation
  const auth = await validateRequest(context.request, context.env.DB);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
    );
  }

  try {
    let body = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    const { to, text, mode = 'auto', gatewayUrl } = body;
    if (!to || !text) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parameters "to" and "text" are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    const normalizedTo = normalizePhone(to);
    const waMeUrl = `https://wa.me/${normalizedTo}?text=${encodeURIComponent(text)}`;

    if (mode === 'wame') {
      return new Response(
        JSON.stringify({ success: true, mode: 'wame', url: waMeUrl }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }

    // Baileys Gateway attempt
    const targetGateway = gatewayUrl || context.env.BAILEYS_GATEWAY_URL || 'http://127.0.0.1:8003';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(`${targetGateway.replace(/\/+$/, '')}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: normalizedTo, text }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ success: true, mode: 'baileys', data }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
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
          notice: `Passerelle Baileys non joignable (${err.message || 'offline'}). Redirection WhatsApp Desktop/Web activée.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error' }),
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
