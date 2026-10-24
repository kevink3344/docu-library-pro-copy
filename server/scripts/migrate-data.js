/**
 * Data migration script: Turso (SQLite) → MySQL.
 *
 * Reads all rows from the Turso database (using TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
 * from .env.local) and inserts them into MySQL (using DB_* from .env).
 *
 * Usage:
 *   node server/scripts/migrate-data.js
 *
 * Prerequisites:
 *   - The MySQL schema must already exist (run `node server/scripts/init-db.js` first).
 *   - The @libsql/client package must be available (reinstall temporarily if removed):
 *       npm install @libsql/client
 *
 * Tables are migrated in dependency order so foreign keys resolve.
 */
import '../config.js';
import { createClient } from '@libsql/client';
import mysql from 'mysql2/promise';

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set (in .env.local).');
  process.exit(1);
}

const turso = createClient({ url: tursoUrl, authToken: tursoToken });

const mysqlConn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
});

// Tables in dependency order (parents before children).
const TABLES = [
  'users',
  'app_settings',
  'organizations',
  'locations',
  'departments',
  'kbb_documents',
  'custom_fields',
  'field_configs',
  'teams',
  'org_members',
  'notifications',
  'system_messages',
  'dismissed_messages',
  'settings_tabs',
  'settings_tab_sections',
];

// Column name overrides for MySQL reserved words / renamed columns.
const COLUMN_OVERRIDES = {
  app_settings: { key: '`key`', value: '`value`' },
};

async function migrateTable(table) {
  const rs = await turso.execute(`SELECT * FROM ${table}`);
  const rows = rs.rows;
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skipped)`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const colNames = columns.map((c) => COLUMN_OVERRIDES[table]?.[c] || c);
  const placeholders = columns.map(() => '?').join(', ');

  const sql = `INSERT INTO ${table} (${colNames.join(', ')}) VALUES (${placeholders})`;

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((c) => {
      const v = row[c];
      // SQLite stores blobs as Uint8Array — convert to Buffer for MySQL
      if (v instanceof Uint8Array) return Buffer.from(v);
      return v;
    });
    try {
      await mysqlConn.execute(sql, values);
      inserted++;
    } catch (err) {
      console.error(`  ${table}: failed to insert row (id=${row.id}): ${err.message}`);
    }
  }

  console.log(`  ${table}: ${inserted}/${rows.length} rows`);
}

console.log('Starting data migration (Turso → MySQL)...\n');
for (const table of TABLES) {
  await migrateTable(table);
}

await mysqlConn.end();
console.log('\nData migration complete.');
