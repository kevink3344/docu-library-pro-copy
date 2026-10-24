/**
 * STEP 1 of 2 — Export MySQL data to a JSON file.
 *
 * Run this from a machine that can reach the MySQL server (i.e. on VPN):
 *   node server/scripts/export-mysql.js [output.json]
 *
 * Produces a JSON file containing every row of every table in dependency order.
 * Buffers (file_blob) are base64-encoded so the file is portable.
 */
import '../config.js';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

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

const outFile = process.argv[2] || 'mysql-export.json';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  dateStrings: true,
});

console.log(`Exporting from ${process.env.DB_HOST}/${process.env.DB_NAME}...\n`);

const dump = { exportedAt: new Date().toISOString(), tables: {} };

for (const table of TABLES) {
  try {
    const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
    // Encode Buffers as base64 markers so JSON round-trips them
    const encoded = rows.map((row) => {
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        if (Buffer.isBuffer(v)) {
          out[k] = { __buffer__: v.toString('base64') };
        } else {
          out[k] = v;
        }
      }
      return out;
    });
    dump.tables[table] = encoded;
    console.log(`  ${table}: ${rows.length} rows`);
  } catch (err) {
    console.log(`  ${table}: ERROR — ${err.message}`);
    dump.tables[table] = [];
  }
}

await conn.end();

fs.writeFileSync(outFile, JSON.stringify(dump, null, 2));
const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
console.log(`\nWrote ${outFile} (${sizeMb} MB)`);
console.log('Next: run import-azuresql.js from a machine that can reach Azure SQL.');
process.exit(0);
