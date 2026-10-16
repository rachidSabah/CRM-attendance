/**
 * GET /api/auth/me
 * Returns current authenticated user profile.
 */
import { validateRequest } from '../../_lib/auth.js';
import { getCorsHeaders } from '../../_lib/cors.js';

export async function onRequestOptions(context) {
  return new Response(null, { headers: getCorsHeaders(context.request) });
}

export async function onRequestGet(context) {
  const cors = getCorsHeaders(context.request);
  const auth = await validateRequest(context.request, context.env.DB);

  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      user: auth.user,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
  );
}
