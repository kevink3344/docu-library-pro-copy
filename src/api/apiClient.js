/// <reference types="vite/client" />
export const API_URL = import.meta.env.VITE_API_URL || '';

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
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}
