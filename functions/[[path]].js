/**
 * Catch-all SPA fallback — serves index.html for non-API, non-static routes.
 * API routes (/api/*) are passed to specific function handlers via context.next().
 * Static assets (/_next/*, /logo*, etc.) are passed through via context.next().
 */

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Let API routes be handled by specific function handlers
  if (path.startsWith('/api/')) {
    return context.next();
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
  return context.next();
}
