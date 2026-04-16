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

async function apiRequest(method: string, endpoint: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getApiToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API_BASE + endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

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
}

export const api = {
  get: (endpoint: string) => apiRequest('GET', endpoint),
  post: (endpoint: string, body?: unknown) => apiRequest('POST', endpoint, body),
  put: (endpoint: string, body?: unknown) => apiRequest('PUT', endpoint, body),
  delete: (endpoint: string) => apiRequest('DELETE', endpoint),
};
