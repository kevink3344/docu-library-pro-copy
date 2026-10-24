import './config.js';

// ---------------------------------------------------------------------------
// Backend selection
//   DB_MODE=mysql     → MySQL / MariaDB          [local dev / on-prem]
//   DB_MODE=azuresql  → Azure SQL Database       [production]
// Defaults to 'mysql' so existing setups keep working unchanged.
// ---------------------------------------------------------------------------
const DB_MODE = (process.env.DB_MODE || 'mysql').trim().toLowerCase();

// ===========================================================================
// MySQL / MariaDB backend
// ===========================================================================
async function createMysqlBackend() {
  const mysql = (await import('mysql2/promise')).default;

  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || '';

  if (!host || !database || !user) {
    throw new Error('DB_HOST, DB_NAME, and DB_USER must be set (DB_MODE=mysql)');
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
   * Translates `:named` placeholders into `?` positional placeholders and
   * reorders the args object into a positional array (mysql2 only understands `?`).
   */
  function toPositional(sqlText, args) {
    if (args === undefined || args === null) return { sql: sqlText, values: [] };
    if (Array.isArray(args)) return { sql: sqlText, values: args };

    const values = [];
    const replaced = sqlText.replace(/:([a-zA-Z0-9_]+)/g, (m, name) => {
      if (!(name in args)) {
        throw new Error(`Missing value for named parameter ":${name}"`);
      }
      values.push(args[name]);
      return '?';
    });
    return { sql: replaced, values };
  }

  function normalizeArgs(sqlOrOptions, maybeArgs) {
    if (typeof sqlOrOptions === 'string') {
      return { sqlText: sqlOrOptions, args: maybeArgs };
    }
    return { sqlText: sqlOrOptions.sql, args: sqlOrOptions.args };
  }

  async function execute(sqlOrOptions, maybeArgs) {
    const { sqlText, args } = normalizeArgs(sqlOrOptions, maybeArgs);
    const { sql, values } = toPositional(sqlText, args);
    const [result] = await pool.execute(sql, values);
    if (Array.isArray(result)) return { rows: result, rowsAffected: 0 };
    return { rows: [], rowsAffected: (result && result.affectedRows) || 0 };
  }

  async function executeMultiple(sqlText) {
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

  async function transaction(fn) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await fn({
        execute: async (sqlOrOptions, maybeArgs) => {
          const { sqlText, args } = normalizeArgs(sqlOrOptions, maybeArgs);
          const { sql, values } = toPositional(sqlText, args);
          const [res] = await connection.execute(sql, values);
          if (Array.isArray(res)) return { rows: res, rowsAffected: 0 };
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

  return {
    execute,
    executeMultiple,
    transaction,
    getPool: () => pool,
    pool,
  };
}

// ===========================================================================
// Azure SQL Database backend (mssql / T-SQL)
// ===========================================================================
async function createAzureSqlBackend() {
  const mssql = (await import('mssql')).default;

  const server = process.env.SQL_SERVER;
  const database = process.env.SQL_DATABASE;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;

  if (!server || !database || !user) {
    throw new Error('SQL_SERVER, SQL_DATABASE, and SQL_USER must be set (DB_MODE=azuresql)');
  }

  const pool = new mssql.ConnectionPool({
    server,
    database,
    user,
    password,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
    },
    pool: {
      min: Number(process.env.DB_POOL_MIN || 0),
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 60000,
  });

  await pool.connect();

  /**
   * Converts `:named` placeholders to `@named` (T-SQL style) and returns the
   * params object. Positional `?` args are mapped to @p0, @p1, ...
   */
  function buildRequest(sqlText, args) {
    const request = pool.request();
    if (args === undefined || args === null) return { request, sql: sqlText };

    if (Array.isArray(args)) {
      let i = 0;
      const sql = sqlText.replace(/\?/g, () => `@p${i++}`);
      args.forEach((v, idx) => request.input(`p${idx}`, v));
      return { request, sql };
    }

    // Named args: replace :name -> @name and register inputs
    const sql = sqlText.replace(/:([a-zA-Z0-9_]+)/g, (m, name) => {
      if (!(name in args)) {
        throw new Error(`Missing value for named parameter ":${name}"`);
      }
      return `@${name}`;
    });
    for (const [k, v] of Object.entries(args)) {
      request.input(k, v);
    }
    return { request, sql };
  }

  /**
   * Translates common MySQL-isms to T-SQL so the shared query code works on both.
   *   `key` / `value` backticks  -> [key] / [value] brackets
   *   LIMIT n                    -> OFFSET 0 ROWS FETCH NEXT n ROWS ONLY
   *   ON DUPLICATE KEY UPDATE    -> IF EXISTS UPDATE ... ELSE INSERT
   */
  function mysqlToTsql(sqlText) {
    let s = sqlText;

    // Backtick identifiers -> [brackets]
    s = s.replace(/`([^`]+)`/g, '[$1]');

    // LIMIT n  ->  OFFSET 0 ROWS FETCH NEXT n ROWS ONLY
    s = s.replace(/\bLIMIT\s+(\d+)\s*$/i, (m, n) => {
      if (/\bORDER\s+BY\b/i.test(s)) {
        return `OFFSET 0 ROWS FETCH NEXT ${n} ROWS ONLY`;
      }
      return `ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT ${n} ROWS ONLY`;
    });

    return s;
  }

  /**
   * Handles `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)` which has no
   * direct T-SQL equivalent. We rewrite it into an UPDATE-then-INSERT pattern
   * executed as a single batch.
   *
   * Only the app_settings upsert uses this shape, so we special-case it.
   */
  function rewriteUpsert(sqlText) {
    // Match: INSERT INTO tbl (cols) VALUES (vals) ON DUPLICATE KEY UPDATE assign
    const m = sqlText.match(
      /^\s*INSERT\s+INTO\s+([^\s(]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*ON\s+DUPLICATE\s+KEY\s+UPDATE\s+(.+)$/is
    );
    if (!m) return null;
    const [, table, colsRaw, valsRaw, updateRaw] = m;
    const cols = colsRaw.split(',').map((c) => c.trim());
    const vals = valsRaw.split(',').map((v) => v.trim());

    // Build the update assignments, mapping VALUES(col) -> @col
    const assignments = updateRaw
      .split(',')
      .map((a) => a.trim().replace(/VALUES\(\s*([^)]+)\s*\)/gi, (mm, c) => `@${c.replace(/[[\]`]/g, '').trim()}`))
      .join(', ');

    const pk = cols[0];               // first column is the key
    const pkVal = vals[0];

    // UPDATE ... WHERE pk = pkVal; IF @@ROWCOUNT = 0 INSERT ...
    return `UPDATE ${table} SET ${assignments} WHERE ${pk} = ${pkVal};
            IF @@ROWCOUNT = 0
              INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
  }

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

    // --- ON DUPLICATE KEY UPDATE -> UPDATE/INSERT batch ---
    const upsert = rewriteUpsert(sqlText);
    if (upsert) {
      const { request, sql } = buildRequest(upsert, args);
      const result = await request.query(sql);
      const affected = Array.isArray(result.rowsAffected)
        ? result.rowsAffected.reduce((a, b) => a + b, 0)
        : (result.rowsAffected || 0);
      return { rows: [], rowsAffected: affected };
    }

    // --- INSERT IGNORE INTO -> INSERT + swallow duplicate-key errors ---
    const isInsertIgnore = /^\s*INSERT\s+IGNORE\s+INTO/i.test(sqlText);
    let effectiveSql = sqlText;
    if (isInsertIgnore) {
      effectiveSql = sqlText.replace(/^\s*INSERT\s+IGNORE\s+INTO/i, 'INSERT INTO');
    }

    effectiveSql = mysqlToTsql(effectiveSql);

    const { request, sql } = buildRequest(effectiveSql, args);
    try {
      const result = await request.query(sql);
      const rows = result.recordset || [];
      const affected = Array.isArray(result.rowsAffected)
        ? result.rowsAffected.reduce((a, b) => a + b, 0)
        : (result.rowsAffected || 0);
      return { rows, rowsAffected: affected };
    } catch (err) {
      if (isInsertIgnore && (err.number === 2627 || err.number === 2601)) {
        return { rows: [], rowsAffected: 0 };
      }
      throw err;
    }
  }

  async function executeMultiple(sqlText) {
    // mssql can run batches separated by GO via .batch(); our T-SQL file uses GO.
    // Split on GO lines and run each batch.
    const batches = sqlText
      .split(/^\s*GO\s*$/gim)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
    for (const batch of batches) {
      await pool.request().batch(batch);
    }
    return { rows: [] };
  }

  async function transaction(fn) {
    const tx = new mssql.Transaction(pool);
    await tx.begin();
    try {
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
          const request = new mssql.Request(tx);
          let sql = sqlText;
          if (Array.isArray(args)) {
            let i = 0;
            sql = sqlText.replace(/\?/g, () => `@p${i++}`);
            args.forEach((v, idx) => request.input(`p${idx}`, v));
          } else if (args && typeof args === 'object') {
            sql = sqlText.replace(/:([a-zA-Z0-9_]+)/g, (m, name) => `@${name}`);
            for (const [k, v] of Object.entries(args)) request.input(k, v);
          }
          const res = await request.query(sql);
          const rows = res.recordset || [];
          const affected = Array.isArray(res.rowsAffected)
            ? res.rowsAffected.reduce((a, b) => a + b, 0)
            : (res.rowsAffected || 0);
          return { rows, rowsAffected: affected };
        },
      });
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  return {
    execute,
    executeMultiple,
    transaction,
    getPool: () => pool,
    pool,
  };
}

// ---------------------------------------------------------------------------
// Resolve the active backend once at module load
// ---------------------------------------------------------------------------
const backend = DB_MODE === 'azuresql'
  ? await createAzureSqlBackend()
  : await createMysqlBackend();

console.log(`[db] Using ${DB_MODE} backend`);

export default backend;


