/**
 * Shared CORS configuration.
 * Only allows requests from the actual production domain.
 */

const ALLOWED_ORIGINS = [
  'https://crm-attendance.pages.dev',
  'http://localhost:3000',
  'http://localhost:3001',
];

export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
