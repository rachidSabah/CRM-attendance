/**
 * Catch-all SPA fallback — serves index.html for non-API, non-static routes.
 * Also acts as middleware for /api/* routes: enforces CORS and token validation.
 */

import { getCorsHeaders } from './_lib/cors.js';
import { validateRequest } from './_lib/auth.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Handle CORS preflight for API routes
  if (path.startsWith('/api/')) {
    return handleApiRequest(context);
  }

  // Allow static assets through
  if (
    path.startsWith('/_next/') ||
    path.startsWith('/logo') ||
    path.startsWith('/icons/') ||
    path === '/robots.txt' ||
    path === '/manifest.json' ||
    path === '/sw.js' ||
    path.startsWith('/_redirects') ||
    path.startsWith('/_routes.json')
  ) {
    return context.next();
  }

  // Try to serve the actual static file first
  try {
    const response = await context.env.ASSETS.fetch(
      new Request(new URL(path, context.request.url).toString(), context.request)
    );
    if (response && response.status !== 404) {
      return response;
    }
  } catch (e) {
    // File not found, fall through to SPA
  }

  // Serve index.html for all SPA routes
  return context.env.ASSETS.fetch(new URL('/index.html', context.request.url).toString());
}

async function handleApiRequest(context) {
  const request = context.request;
  const corsHeaders = getCorsHeaders(request);

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Token validation
  const db = context.env.DB;
  const auth = await validateRequest(request, db);

  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Pass to specific API handler
  const response = await context.next();

  // Inject CORS headers into the response
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export async function onRequestGet(context) {
  return onRequest(context);
}

export async function onRequestPost(context) {
  return onRequest(context);
}

export async function onRequestPut(context) {
  return onRequest(context);
}

export async function onRequestDelete(context) {
  return onRequest(context);
}

export async function onRequestPatch(context) {
  return onRequest(context);
}

export async function onRequestHead(context) {
  return onRequest(context);
}

export async function onRequestOptions(context) {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/api/')) {
    const corsHeaders = getCorsHeaders(context.request);
    return new Response(null, { headers: corsHeaders });
  }
  return context.next();
}
