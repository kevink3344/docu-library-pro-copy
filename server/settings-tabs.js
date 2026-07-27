import db from './db.js';

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
 * @typedef {Object} SettingsTabInput
 * @property {string} name
 * @property {string} slug
 * @property {'all'|'super_admin'} visible_to
 */

// ---------------------------------------------------------------------------
// List all tabs with their sections
// ---------------------------------------------------------------------------

/** @returns {Promise<SettingsTab[]>} */
export async function listSettingsTabs() {
  const tabRows = await db.execute('SELECT * FROM settings_tabs ORDER BY sort_order ASC');
  const sectionRows = await db.execute('SELECT * FROM settings_tab_sections ORDER BY sort_order ASC');

  return tabRows.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    sort_order: Number(row.sort_order),
    visible_to: String(row.visible_to),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    sections: sectionRows.rows
      .filter((s) => String(s.tab_id) === String(row.id))
      .map((s) => ({
        id: String(s.id),
        tab_id: String(s.tab_id),
        section_key: String(s.section_key),
        sort_order: Number(s.sort_order),
      })),
  }));
}

// ---------------------------------------------------------------------------
// Get tabs visible to a specific role
// ---------------------------------------------------------------------------

/**
 * @param {string} role
 * @returns {Promise<SettingsTab[]>}
 */
export async function listVisibleSettingsTabs(role) {
  const allTabs = await listSettingsTabs();
  return allTabs.filter((tab) => {
    if (tab.visible_to === 'super_admin' && role !== 'admin') return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Create a new tab
// ---------------------------------------------------------------------------

/**
 * @param {SettingsTabInput} input
 * @returns {Promise<SettingsTab|null>}
 */
export async function createSettingsTab(input) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Get next sort_order
  const maxResult = await db.execute('SELECT MAX(sort_order) AS max_order FROM settings_tabs');
  const sortOrder = (Number(maxResult.rows[0]?.max_order ?? -1)) + 1;

  await db.execute({
    sql: `INSERT INTO settings_tabs (id, name, slug, sort_order, visible_to, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.name, input.slug, sortOrder, input.visible_to, now, now],
  });

  return {
    id,
    name: input.name,
    slug: input.slug,
    sort_order: sortOrder,
    visible_to: input.visible_to,
    created_at: now,
    updated_at: now,
    sections: [],
  };
}

// ---------------------------------------------------------------------------
// Update a tab (name, visible_to)
// ---------------------------------------------------------------------------

/**
 * @param {string} tabId
 * @param {{ name?: string; visible_to?: 'all' | 'super_admin' }} patch
 * @returns {Promise<SettingsTab|null>}
 */
export async function updateSettingsTab(tabId, patch) {
  const existing = await db.execute({
    sql: 'SELECT * FROM settings_tabs WHERE id = ?',
    args: [tabId],
  });
  if (!existing.rows[0]) return null;

  const now = new Date().toISOString();
  const name = patch.name ?? String(existing.rows[0].name);
  const visibleTo = patch.visible_to ?? String(existing.rows[0].visible_to);

  await db.execute({
    sql: 'UPDATE settings_tabs SET name = ?, visible_to = ?, updated_at = ? WHERE id = ?',
    args: [name, visibleTo, now, tabId],
  });

  // Return full tab from DB for verification
  const tabs = await listSettingsTabs();
  return tabs.find((t) => t.id === tabId) ?? null;
}

// ---------------------------------------------------------------------------
// Delete a tab and its sections (CASCADE handles sections)
// ---------------------------------------------------------------------------

/**
 * @param {string} tabId
 * @returns {Promise<boolean>}
 */
export async function deleteSettingsTab(tabId) {
  const result = await db.execute({
    sql: 'DELETE FROM settings_tabs WHERE id = ?',
    args: [tabId],
  });
  return result.rowsAffected > 0;
}

// ---------------------------------------------------------------------------
// Reorder tabs (accepts ordered array of tab IDs)
// ---------------------------------------------------------------------------

/**
 * @param {string[]} orderedIds
 * @returns {Promise<SettingsTab[]>}
 */
export async function reorderSettingsTabs(orderedIds) {
  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute({
      sql: 'UPDATE settings_tabs SET sort_order = ?, updated_at = ? WHERE id = ?',
      args: [i, now, orderedIds[i]],
    });
  }
  return listSettingsTabs();
}

// ---------------------------------------------------------------------------
// Update sections for a tab (full replacement — ordered array of section_keys)
// ---------------------------------------------------------------------------

/**
 * @param {string} tabId
 * @param {string[]} sectionKeys
 * @returns {Promise<SettingsTabSection[]>}
 */
export async function updateTabSections(tabId, sectionKeys) {
  const now = new Date().toISOString();

  // Delete existing sections for this tab
  await db.execute({
    sql: 'DELETE FROM settings_tab_sections WHERE tab_id = ?',
    args: [tabId],
  });

  // Insert new sections in order
  /** @type {SettingsTabSection[]} */
  const sections = [];
  for (let i = 0; i < sectionKeys.length; i++) {
    const id = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO settings_tab_sections (id, tab_id, section_key, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [id, tabId, sectionKeys[i], i, now],
    });
    sections.push({ id, tab_id: tabId, section_key: sectionKeys[i], sort_order: i });
  }

  return sections;
}
