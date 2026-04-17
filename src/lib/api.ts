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
  } catch (e) {
    // Only log real errors (network failures, etc.), not 404s
    if (e instanceof TypeError && (e as TypeError).message.includes('Failed to fetch')) {
      console.warn('[API] Network error for', endpoint);
    }
    return null;
  }
}

export const api = {
  get: (endpoint: string) => apiRequest('GET', endpoint),
  post: (endpoint: string, body?: unknown) => apiRequest('POST', endpoint, body),
  put: (endpoint: string, body?: unknown) => apiRequest('PUT', endpoint, body),
  delete: (endpoint: string) => apiRequest('DELETE', endpoint),
};
