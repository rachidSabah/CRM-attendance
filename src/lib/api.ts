const API_BASE = 'https://infohas-attendance-api.rachidelsabah.workers.dev/api';

let apiToken: string | null = null;

export function setApiToken(token: string | null) {
  apiToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('api_token', token);
    else localStorage.removeItem('api_token');
  }
}

export function getApiToken(): string | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('api_token');
    if (stored) apiToken = stored;
  }
  return apiToken;
}

/** Auth headers for local /api/* requests — includes Bearer token */
export function localAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getApiToken();
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

/** Local API fetch with auth headers — for /api/* endpoints */
export async function localApi(method: string, endpoint: string, body?: unknown): Promise<Response> {
  const res = await fetch(endpoint, {
    method,
    headers: localAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 401) {
    console.warn(`[API] ${method} ${endpoint} returned ${res.status}`);
  }
  return res;
}

async function apiRequest(method: string, endpoint: string, body?: unknown): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getApiToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  try {
    const res = await fetch(API_BASE + endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 404 gracefully — return null instead of throwing
    if (res.status === 404) return null;

    // Handle non-JSON responses gracefully
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(text || `API Error ${res.status}`);
      return { success: true, data: text };
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
  } catch {
    return null;
  }
}

export const api = {
  get: (endpoint: string) => apiRequest('GET', endpoint),
  post: (endpoint: string, body?: unknown) => apiRequest('POST', endpoint, body),
  put: (endpoint: string, body?: unknown) => apiRequest('PUT', endpoint, body),
  delete: (endpoint: string) => apiRequest('DELETE', endpoint),
};
