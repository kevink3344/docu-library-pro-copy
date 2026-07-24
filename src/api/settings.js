import { fetchApi, API_URL } from './apiClient';

const TOKEN_KEY = 'kbb_token';

export async function getPublicSetting(key) {
  const data = await fetchApi(`/api/settings/${key}`);
  return data?.value;
}

export async function updateSetting(key, value) {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetchApi(`/api/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function getAppInfo() {
  const res = await fetch(`${API_URL}/api/info`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchAppBranding() {
  const [logoUrl, title, hideLogo] = await Promise.all([
    getPublicSetting('app_logo_url'),
    getPublicSetting('app_title'),
    getPublicSetting('hide_logo'),
  ]);
  return { logoUrl: logoUrl || '', title: title || 'KBB Pro', hideLogo: hideLogo === 'true' };
}
