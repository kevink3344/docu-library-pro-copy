/**
 * Copies data from MySQL (source) to Azure SQL (target).
 *
 * Prereqs:
 *   - Source MySQL reachable via DB_HOST/DB_NAME/DB_USER/DB_PASSWORD
 *   - Target Azure SQL schema already created (run init-db-azuresql.js first)
 *   - SQL_SERVER/SQL_DATABASE/SQL_USER/SQL_PASSWORD set
 *
 * Usage:
 *   node server/scripts/migrate-mysql-to-azuresql.js
 *
 * Reads in dependency order so foreign keys resolve.
 */
import '../config.js';
import mysql from 'mysql2/promise';
import mssql from 'mssql';

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

// Boolean columns (MySQL 0/1 -> T-SQL BIT true/false)
const BOOL_COLUMNS = {
  organizations: ['is_active'],
  locations: ['is_active', 'pinned'],
  departments: ['is_active', 'pinned'],
  kbb_documents: ['renew_notified_30', 'renew_notified_7', 'is_archived'],
  notifications: ['is_read'],
  system_messages: ['is_dismissable', 'is_active'],
};

// Binary columns (must be Buffer for VARBINARY; MySQL may return '' or string)
const BINARY_COLUMNS = {
  kbb_documents: ['file_blob'],
};

// Reserved-word columns needing brackets on the target
const RESERVED = { app_settings: { key: '[key]', value: '[value]' } };

// ---- Source: MySQL -------------------------------------------------------
const my = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  dateStrings: true,
});
console.log('Connected to MySQL source.');

// ---- Target: Azure SQL ---------------------------------------------------
const pool = new mssql.ConnectionPool({
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
  requestTimeout: 120000,
});
await pool.connect();
console.log('Connected to Azure SQL target.\n');

async function migrateTable(table) {
  const [rows] = await my.query(`SELECT * FROM \`${table}\``);
  if (!rows.length) {
    console.log(`  ${table}: 0 rows (skipped)`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const colNames = columns.map((c) => RESERVED[table]?.[c] || c);
  const paramNames = columns.map((_, i) => `@c${i}`);
  const insertSql = `INSERT INTO ${table} (${colNames.join(', ')}) VALUES (${paramNames.join(', ')})`;

  let inserted = 0;
  let failed = 0;
  for (const row of rows) {
    const request = pool.request();
    columns.forEach((c, i) => {
      let v = row[c];
      const isBinary = (BINARY_COLUMNS[table] || []).includes(c);

      if ((BOOL_COLUMNS[table] || []).includes(c)) {
        v = v ? 1 : 0;
        request.input(`c${i}`, mssql.Bit, v);
        return;
      }

      if (isBinary) {
        // Always declare the param as VarBinary so NULLs don't default to NVarChar
        if (v == null || v === '') {
          request.input(`c${i}`, mssql.VarBinary(mssql.MAX), null);
        } else {
          const buf = Buffer.isBuffer(v) ? v : Buffer.from(v);
          request.input(`c${i}`, mssql.VarBinary(buf.length), buf);
        }
        return;
      }

      request.input(`c${i}`, v);
    });
    try {
      await request.query(insertSql);
      inserted++;
    } catch (err) {
      failed++;
      if (failed <= 3) {
        console.error(`  ${table}: row failed (id=${row.id}): ${err.message}`);
      }
    }
  }
  console.log(`  ${table}: ${inserted}/${rows.length} rows${failed ? ` (${failed} failed)` : ''}`);
}

console.log('Migrating data MySQL -> Azure SQL...\n');

// Make the migration idempotent: clear target tables in reverse dependency order
// so a re-run starts clean and re-inserts everything with the source IDs.
const CLEAR_ORDER = [...TABLES].reverse();
for (const t of CLEAR_ORDER) {
  try {
    await pool.request().query(`DELETE FROM ${t}`);
  } catch (e) {
    // ignore if table missing
  }
}
console.log('  (cleared existing target rows)\n');

for (const table of TABLES) {
  await migrateTable(table);
}

await my.end();
await pool.close();
console.log('\nMigration complete.');
process.exit(0);
