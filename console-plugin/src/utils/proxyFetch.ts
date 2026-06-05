import { PROXY_BASE } from '../constants';

export function getCsrfToken(): string {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : '';
}

/** Fetch via console plugin proxy (requires CSRF for console API). */
export async function proxyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
    'X-CSRFToken': getCsrfToken(),
  };
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${PROXY_BASE}${path}`, { ...init, headers, credentials: 'same-origin' });
}
