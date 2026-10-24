/**
 * Creates the Azure SQL schema from server/init-azuresql.sql, then seeds the
 * default settings tabs (same as the MySQL init-db.js).
 *
 * Usage (with DB_MODE=azuresql and SQL_* vars in .env):
 *   node server/scripts/init-db-azuresql.js
 */
import '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.resolve(__dirname, '../init-azuresql.sql');
const sqlText = fs.readFileSync(sqlPath, 'utf-8');

console.log('Applying Azure SQL schema...');
await db.executeMultiple(sqlText);
console.log('Schema applied.');

// Seed default settings tabs (idempotent)
const countResult = await db.execute('SELECT COUNT(1) AS cnt FROM settings_tabs');
const tabCount = Number(countResult.rows[0]?.cnt ?? 0);

if (tabCount === 0) {
  const { randomUUID } = await import('node:crypto');
  const now = new Date().toISOString();

  const tabs = [
    { name: 'General', slug: 'general', sort_order: 0, visible_to: 'all' },
    { name: 'Configuration', slug: 'configuration', sort_order: 1, visible_to: 'all' },
    { name: 'Storage', slug: 'storage', sort_order: 2, visible_to: 'all' },
    { name: 'Private', slug: 'private', sort_order: 3, visible_to: 'super_admin' },
  ];

  const tabIds = {};
  for (const tab of tabs) {
    const tabId = randomUUID();
    tabIds[tab.slug] = tabId;
    await db.execute({
      sql: `INSERT INTO settings_tabs (id, name, slug, sort_order, visible_to, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [tabId, tab.name, tab.slug, tab.sort_order, tab.visible_to, now, now],
    });
  }

  const defaultAssignments = {
    general: ['apiDocs', 'branding', 'systemMessages'],
    configuration: ['fields', 'layout', 'teams', 'loginMode'],
    storage: ['locations', 'departments', 'members', 'organizations'],
    private: [],
  };

  for (const [slug, sections] of Object.entries(defaultAssignments)) {
    const tabId = tabIds[slug];
    if (!tabId) continue;
    for (let i = 0; i < sections.length; i++) {
      await db.execute({
        sql: `INSERT INTO settings_tab_sections (id, tab_id, section_key, sort_order, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [randomUUID(), tabId, sections[i], i, now],
      });
    }
  }

  console.log('Settings tabs seeded (4 default tabs).');
} else {
  console.log(`Settings tabs already present (${tabCount}); skipped seeding.`);
}

console.log('Azure SQL schema initialized.');
process.exit(0);
