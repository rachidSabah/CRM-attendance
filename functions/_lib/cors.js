/**
 * Shared CORS configuration.
 * Only allows requests from the actual production domain.
 */

const ALLOWED_ORIGINS = [
  'https://crm-attendance.pages.dev',
  'https://admin.cabincrew.academy',
  'http://localhost:3000',
  'http://localhost:3001',
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.pages.dev') || origin.endsWith('.run.app') || origin.endsWith('cabincrew.academy')) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

export function corsResponse(request, response, status = 200) {
  const headers = getCorsHeaders(request);
  return new Response(response, {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
