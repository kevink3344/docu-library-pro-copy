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

console.log('Database schema initialized');
