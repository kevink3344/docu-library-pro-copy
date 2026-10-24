/**
 * Drops all tables in the MySQL/MariaDB database (reverse dependency order).
 * Used to reset the schema before re-running init-db.js.
 */
import '../config.js';
import db from '../db.js';

const { pool } = db;

const TABLES = [
  'settings_tab_sections',
  'settings_tabs',
  'dismissed_messages',
  'system_messages',
  'notifications',
  'org_members',
  'teams',
  'field_configs',
  'custom_fields',
  'kbb_documents',
  'departments',
  'locations',
  'organizations',
  'app_settings',
  'users',
];

await pool.query('SET FOREIGN_KEY_CHECKS = 0');
for (const table of TABLES) {
  await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
}
await pool.query('SET FOREIGN_KEY_CHECKS = 1');

console.log('All tables dropped.');
await pool.end();
