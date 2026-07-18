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
console.log('Database schema initialized');
