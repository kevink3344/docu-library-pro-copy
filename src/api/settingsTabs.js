import { fetchApi } from './apiClient';

/**
 * @typedef {Object} SettingsTab
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {number} sort_order
 * @property {'all'|'super_admin'} visible_to
 * @property {string} created_at
 * @property {string} updated_at
 * @property {SettingsTabSection[]} sections
 */

/**
 * @typedef {Object} SettingsTabSection
 * @property {string} id
 * @property {string} tab_id
 * @property {string} section_key
 * @property {number} sort_order
 */

/**
 * Fetch all settings tabs (filtered by current user's role on the server).
 * @returns {Promise<SettingsTab[]>}
 */
export async function fetchSettingsTabs() {
  const data = await fetchApi('/api/settings/tabs');
  return data.tabs ?? [];
}

/**
 * Create a new settings tab.
 * @param {{ name: string, slug: string, visible_to: 'all' | 'super_admin' }} input
 * @returns {Promise<{ tab: SettingsTab, tabs: SettingsTab[] }>}
 */
export async function createSettingsTab(input) {
  return fetchApi('/api/settings/tabs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Update a settings tab.
 * @param {string} tabId
 * @param {{ name?: string, visible_to?: 'all' | 'super_admin' }} patch
 * @returns {Promise<{ tab: SettingsTab, tabs: SettingsTab[] }>}
 */
export async function updateSettingsTab(tabId, patch) {
  return fetchApi(`/api/settings/tabs/${tabId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/**
 * Delete a settings tab.
 * @param {string} tabId
 * @returns {Promise<{ deleted: boolean, tabs: SettingsTab[] }>}
 */
export async function deleteSettingsTab(tabId) {
  return fetchApi(`/api/settings/tabs/${tabId}`, {
    method: 'DELETE',
  });
}

/**
 * Reorder settings tabs.
 * @param {string[]} orderedIds
 * @returns {Promise<{ tabs: SettingsTab[] }>}
 */
export async function reorderSettingsTabs(orderedIds) {
  return fetchApi('/api/settings/tabs/reorder', {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}

/**
 * Replace sections in a tab.
 * @param {string} tabId
 * @param {string[]} sectionKeys
 * @returns {Promise<{ sections: SettingsTabSection[], tabs: SettingsTab[] }>}
 */
export async function updateTabSections(tabId, sectionKeys) {
  return fetchApi(`/api/settings/tabs/${tabId}/sections`, {
    method: 'PUT',
    body: JSON.stringify({ sectionKeys }),
  });
}