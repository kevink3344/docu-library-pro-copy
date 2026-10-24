import '../config.js';
import db from '../db.js';

const tables = [
  'users', 'organizations', 'locations', 'departments', 'kbb_documents',
  'custom_fields', 'teams', 'org_members', 'notifications', 'system_messages',
  'settings_tabs', 'settings_tab_sections',
];

for (const t of tables) {
  const rs = await db.execute(`SELECT COUNT(*) AS c FROM \`${t}\``);
  console.log(`${t}: ${rs.rows[0].c} rows`);
}
process.exit(0);
