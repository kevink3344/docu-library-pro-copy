/**
 * STEP 2 of 2 — Import a JSON dump (from export-mysql.js) into Azure SQL.
 *
 * Run this from a machine that can reach Azure SQL:
 *   node server/scripts/import-azuresql.js [input.json]
 *
 * The Azure SQL schema must already exist (run init-db-azuresql.js first).
 * Inserts in dependency order so foreign keys resolve.
 */
import '../config.js';
import fs from 'fs';
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

// Boolean columns (0/1 -> BIT)
const BOOL_COLUMNS = {
  organizations: ['is_active'],
  locations: ['is_active', 'pinned'],
  departments: ['is_active', 'pinned'],
  kbb_documents: ['renew_notified_30', 'renew_notified_7', 'is_archived'],
  notifications: ['is_read'],
  system_messages: ['is_dismissable', 'is_active'],
};

// Reserved-word columns needing brackets on the target
const RESERVED = { app_settings: { key: '[key]', value: '[value]' } };

const inFile = process.argv[2] || 'mysql-export.json';
if (!fs.existsSync(inFile)) {
  console.error(`Input file not found: ${inFile}`);
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(inFile, 'utf-8'));

const pool = new mssql.ConnectionPool({
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
  requestTimeout: 120000,
});
await pool.connect();
console.log(`Importing into ${process.env.SQL_SERVER}/${process.env.SQL_DATABASE}...\n`);

function decodeValue(v) {
  if (v && typeof v === 'object' && v.__buffer__) {
    return Buffer.from(v.__buffer__, 'base64');
  }
  return v;
}

async function importTable(table) {
  const rows = dump.tables[table] || [];
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
      let v = decodeValue(row[c]);
      if ((BOOL_COLUMNS[table] || []).includes(c)) v = v ? 1 : 0;
      request.input(`c${i}`, v);
    });
    try {
      await request.query(insertSql);
      inserted++;
    } catch (err) {
      failed++;
      if (failed <= 5) console.error(`  ${table}: row failed (id=${row.id}): ${err.message}`);
    }
  }
  console.log(`  ${table}: ${inserted}/${rows.length} rows${failed ? ` (${failed} failed)` : ''}`);
}

for (const table of TABLES) {
  await importTable(table);
}

await pool.close();
console.log('\nImport complete.');
process.exit(0);
