export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Allow static assets through
  if (path.startsWith('/_next/') || path.startsWith('/logo') || path === '/robots.txt' || path === '/_redirects') {
    return context.next();
  }

  // Try to serve the actual file first
  try {
    const response = await context.env.ASSETS.fetch(new Request(
      new URL(path, context.request.url).toString(),
      context.request
    ));
    if (response && response.status !== 404) {
      return response;
    }
  } catch (e) {
    // File not found, fall through to SPA
  }

  // Serve index.html for all SPA routes
  return context.env.ASSETS.fetch(new URL('/index.html', context.request.url).toString());
}
