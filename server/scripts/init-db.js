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

console.log('Database schema initialized');
