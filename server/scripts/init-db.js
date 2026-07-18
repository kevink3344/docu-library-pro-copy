import '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.resolve(__dirname, '../init.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

await db.execute(sql);

// Safe migrations for existing databases
try {
  await db.execute('ALTER TABLE kbb_documents ADD COLUMN file_blob BLOB');
  console.log('Added file_blob column to kbb_documents');
} catch (err) {
  if (!err.message?.toLowerCase().includes('duplicate column') && !err.message?.toLowerCase().includes('already exists')) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

console.log('Database schema initialized');
