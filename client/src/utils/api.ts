const BASE = '/api';

async function request(path: string, options?: RequestInit) {
  const token = localStorage.getItem('demiurge_token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Request failed');
  return json.success !== undefined ? json.data : json;
}

export function apiGet(path: string) {
  return request(path, { method: 'GET' });
}

export function apiPost(path: string, body?: unknown) {
  return request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export function apiPatch(path: string, body?: unknown) {
  return request(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

export function apiDelete(path: string) {
  return request(path, { method: 'DELETE' });
}
