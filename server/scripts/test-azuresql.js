// Quick connectivity test for Azure SQL
import '../config.js';
import sql from 'mssql';

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 20000 },
};

console.log('Connecting to', config.server, '/', config.database, 'as', config.user);
try {
  const pool = await sql.connect(config);
  const r = await pool.request().query('SELECT @@VERSION AS v, DB_NAME() AS db');
  console.log('OK — connected.');
  console.log('DB:', r.recordset[0].db);
  console.log('Version:', String(r.recordset[0].v).split('\n')[0]);
  await pool.close();
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
}
