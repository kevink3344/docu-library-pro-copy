import './config.js';
import mysql from 'mysql2/promise';

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT || 3306);
const database = process.env.DB_NAME;
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD || '';

if (!host || !database || !user) {
  throw new Error('DB_HOST, DB_NAME, and DB_USER must be set in .env');
}

const pool = mysql.createPool({
  host,
  port,
  database,
  user,
  password,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_MAX || 10),
  queueLimit: 0,
  dateStrings: true,
});

/**
 * Translates a SQL string using `:named` placeholders into one using `?`
 * positional placeholders, and reorders the args object into a positional array.
 *
 * This lets existing call sites keep using `:named` / `{ key: value }` style
 * while the underlying driver (mysql2) only understands `?`.
 */
function toPositional(sqlText, args) {
  if (args === undefined || args === null) return { sql: sqlText, values: [] };
  if (Array.isArray(args)) return { sql: sqlText, values: args };

  const values = [];
  const replaced = sqlText.replace(/:([a-zA-Z0-9_]+)/g, (match, name) => {
    if (!(name in args)) {
      throw new Error(`Missing value for named parameter ":${name}"`);
    }
    values.push(args[name]);
    return '?';
  });
  return { sql: replaced, values };
}

/**
 * Executes a single statement and returns a libsql-compatible result.
 *
 * Accepts either a raw SQL string or `{ sql, args }`.
 * `args` may be an object (named placeholders) or an array (positional).
 *
 * Returns `{ rows, rowsAffected }`:
 *   - SELECT → rows is an array of objects, rowsAffected is 0
 *   - INSERT/UPDATE/DELETE → rows is [], rowsAffected is the affected count
 */
async function execute(sqlOrOptions, maybeArgs) {
  let sqlText;
  let args;
  if (typeof sqlOrOptions === 'string') {
    sqlText = sqlOrOptions;
    args = maybeArgs;
  } else {
    sqlText = sqlOrOptions.sql;
    args = sqlOrOptions.args;
  }

  const { sql, values } = toPositional(sqlText, args);
  const [result] = await pool.execute(sql, values);

  // mysql2: SELECT → array of rows; DML → ResultSetHeader { affectedRows }
  if (Array.isArray(result)) {
    return { rows: result, rowsAffected: 0 };
  }
  return { rows: [], rowsAffected: (result && result.affectedRows) || 0 };
}

/**
 * Executes multiple semicolon-separated statements (used by init-db.js).
 * Strips `--` line comments first (so a `;` inside a comment doesn't split),
 * then splits on `;` and runs each statement.
 */
async function executeMultiple(sqlText) {
  // Remove `--` line comments (everything from `--` to end of line)
  const withoutComments = sqlText
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');

  const statements = withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err) {
      // Index creation may be denied for restricted DB users — warn but continue.
      // Table creation failures are fatal and should surface.
      const isIndex = /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(statement);
      if (isIndex) {
        console.warn(`  (warning) skipped index: ${err.message}`);
        continue;
      }
      throw err;
    }
  }
  return { rows: [] };
}

/** Returns the underlying pool (for transactions and low-level access). */
function getPool() {
  return pool;
}

/**
 * Runs `fn(connection)` inside a transaction.
 * `connection` exposes the same `execute(sqlOrOptions, maybeArgs)` shape,
 * but all statements run on a single connection until commit/rollback.
 */
async function transaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn({
      execute: async (sqlOrOptions, maybeArgs) => {
        let sqlText;
        let args;
        if (typeof sqlOrOptions === 'string') {
          sqlText = sqlOrOptions;
          args = maybeArgs;
        } else {
          sqlText = sqlOrOptions.sql;
          args = sqlOrOptions.args;
        }
        const { sql, values } = toPositional(sqlText, args);
        const [res] = await connection.execute(sql, values);
        if (Array.isArray(res)) {
          return { rows: res, rowsAffected: 0 };
        }
        return { rows: [], rowsAffected: (res && res.affectedRows) || 0 };
      },
    });
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export default {
  execute,
  executeMultiple,
  transaction,
  getPool,
  pool,
};

