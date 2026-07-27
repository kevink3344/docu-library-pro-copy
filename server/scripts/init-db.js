import '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.resolve(__dirname, '../init.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

await db.executeMultiple(sql);

async function safeMigrate(label, sqlText) {
  try {
    await db.execute(sqlText);
    console.log(label);
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.error('Migration error:', err.message);
      process.exit(1);
    }
  }
}

await safeMigrate('Added file_blob column to kbb_documents', 'ALTER TABLE kbb_documents ADD COLUMN file_blob BLOB');
await safeMigrate('Added password_hash column to users', 'ALTER TABLE users ADD COLUMN password_hash TEXT');
await safeMigrate(
  'Ensured app_settings table exists',
  `CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`
);

await safeMigrate(
  'Created system_messages table',
  `CREATE TABLE IF NOT EXISTS system_messages (
    id              TEXT PRIMARY KEY NOT NULL,
    org_id          TEXT NOT NULL,
    title           TEXT NOT NULL,
    text            TEXT NOT NULL DEFAULT '',
    pastel_color    TEXT NOT NULL DEFAULT '#E8F4FD',
    is_dismissable  INTEGER NOT NULL DEFAULT 1,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_by_id   TEXT,
    FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
  )`
);

await safeMigrate(
  'Created idx_system_messages_org_id index',
  'CREATE INDEX IF NOT EXISTS idx_system_messages_org_id ON system_messages (org_id)'
);

await safeMigrate(
  'Created idx_system_messages_org_active index',
  'CREATE INDEX IF NOT EXISTS idx_system_messages_org_active ON system_messages (org_id, is_active)'
);

await safeMigrate(
  'Created dismissed_messages table',
  `CREATE TABLE IF NOT EXISTS dismissed_messages (
    id              TEXT PRIMARY KEY NOT NULL,
    user_id         TEXT NOT NULL,
    message_id      TEXT NOT NULL,
    dismissed_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id)    REFERENCES users (id)           ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (message_id) REFERENCES system_messages (id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (user_id, message_id)
  )`
);

await safeMigrate(
  'Created idx_dismissed_messages_user index',
  'CREATE INDEX IF NOT EXISTS idx_dismissed_messages_user ON dismissed_messages (user_id)'
);

await safeMigrate(
  'Created settings_tabs table',
  `CREATE TABLE IF NOT EXISTS settings_tabs (
    id            TEXT PRIMARY KEY NOT NULL,
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    visible_to    TEXT NOT NULL DEFAULT 'all' CHECK(visible_to IN ('all', 'super_admin')),
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`
);

await safeMigrate(
  'Created idx_settings_tabs_sort_order index',
  'CREATE INDEX IF NOT EXISTS idx_settings_tabs_sort_order ON settings_tabs (sort_order)'
);

await safeMigrate(
  'Created settings_tab_sections table',
  `CREATE TABLE IF NOT EXISTS settings_tab_sections (
    id            TEXT PRIMARY KEY NOT NULL,
    tab_id        TEXT NOT NULL,
    section_key   TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (tab_id) REFERENCES settings_tabs(id) ON DELETE CASCADE,
    UNIQUE (tab_id, section_key)
  )`
);

await safeMigrate(
  'Created idx_settings_tab_sections_tab_id index',
  'CREATE INDEX IF NOT EXISTS idx_settings_tab_sections_tab_id ON settings_tab_sections (tab_id)'
);

await safeMigrate(
  'Created idx_settings_tab_sections_tab_order index',
  'CREATE INDEX IF NOT EXISTS idx_settings_tab_sections_tab_order ON settings_tab_sections (tab_id, sort_order)'
);

// Seed default settings tabs
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
    general: [
      'apiDocs', 'branding', 'systemMessages',
    ],
    configuration: [
      'fields', 'layout', 'teams', 'loginMode',
    ],
    storage: [
      'locations', 'departments', 'members', 'organizations',
    ],
    private: [],
  };

  for (const [slug, sections] of Object.entries(defaultAssignments)) {
    const tabId = tabIds[slug];
    if (!tabId) continue;
    for (let i = 0; i < sections.length; i++) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO settings_tab_sections (id, tab_id, section_key, sort_order, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [randomUUID(), tabId, sections[i], i, now],
      });
    }
  }

  console.log('Settings tabs seeded with 4 default tabs and section assignments.');
}

console.log('Database schema initialized');
