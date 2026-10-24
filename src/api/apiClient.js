/// <reference types="vite/client" />
// When deployed under a subpath (VITE_BASE_PATH), the API lives under the same subpath.
// VITE_API_URL can still override this explicitly.
const BASE_PATH = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '');
export const API_URL = import.meta.env.VITE_API_URL ?? BASE_PATH;

const TOKEN_KEY = 'kbb_token';

export async function fetchApi(path, options = {}) {
  const url = `${API_URL}${path}`;
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}
