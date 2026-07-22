import sql from '../db.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// Fields stored as JSON strings in SQLite
const JSON_FIELDS = {
  organizations:  ['admin_user_ids'],
  locations:      [],
  departments:    [],
  kbb_documents:  ['tags', 'location', 'department', 'allowed_team_ids', 'custom_field_values'],
  custom_fields:  ['options'],
  field_configs:  ['hidden_required_fields', 'add_screen_order', 'view_screen_order', 'dashboard_columns'],
  teams:          ['member_user_ids'],
  org_members:    [],
  notifications:  [],
  users:          [],
};

// Fields stored as 0/1 integers in SQLite
const BOOL_FIELDS = {
  organizations: ['is_active'],
  locations:     ['is_active', 'pinned'],
  departments:   ['is_active', 'pinned'],
  kbb_documents: ['renew_notified_30', 'renew_notified_7', 'is_archived'],
  notifications: ['is_read'],
};

function parseRow(table, row) {
  if (!row) return null;
  const obj = { ...row };
  for (const f of (JSON_FIELDS[table] || [])) {
    if (obj[f] !== undefined && obj[f] !== null) {
      try { obj[f] = JSON.parse(obj[f]); } catch { obj[f] = []; }
    }
  }
  for (const f of (BOOL_FIELDS[table] || [])) {
    if (obj[f] !== undefined) obj[f] = obj[f] === 1 || obj[f] === true;
  }
  // Never expose password hashes via the generic entity API
  if (table === 'users') delete obj.password_hash;
  return obj;
}

function serializeRow(table, data) {
  const obj = { ...data };
  for (const f of (JSON_FIELDS[table] || [])) {
    if (obj[f] !== undefined) {
      obj[f] = typeof obj[f] === 'string' ? obj[f] : JSON.stringify(obj[f]);
    }
  }
  return obj;
}

function buildWhere(filters) {
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined);
  if (!entries.length) return { clause: '', args: {} };
  const parts = entries.map(([k]) => `${k} = :${k}`);
  return {
    clause: 'WHERE ' + parts.join(' AND '),
    args: Object.fromEntries(entries),
  };
}

// ---------------------------------------------------------------------------
// Generic CRUD factory
// ---------------------------------------------------------------------------

function makeEntity(table) {
  return {
    async list() {
      const rs = await sql.execute(`SELECT * FROM ${table}`);
      return rs.rows.map(r => parseRow(table, r));
    },

    async filter(where = {}, sort = null, limit = null) {
      const { clause, args } = buildWhere(where);
      let sqlText = `SELECT * FROM ${table} ${clause}`;
      if (sort) {
        const desc = sort.startsWith('-');
        const col = desc ? sort.slice(1) : sort;
        sqlText += ` ORDER BY ${col} ${desc ? 'DESC' : 'ASC'}`;
      }
      if (limit) sqlText += ` LIMIT ${Number(limit)}`;
      const rs = await sql.execute({ sql: sqlText, args });
      return rs.rows.map(r => parseRow(table, r));
    },

    async get(id) {
      const rs = await sql.execute({
        sql: `SELECT * FROM ${table} WHERE id = :id`,
        args: { id },
      });
      return parseRow(table, rs.rows[0] || null);
    },

    async create(data) {
      const id = data.id || uuid();
      const d = serializeRow(table, {
        ...data,
        id,
        created_date: data.created_date || now(),
        updated_date: data.updated_date || now(),
      });
      const keys = Object.keys(d);
      const sqlText = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(k => ':' + k).join(', ')})`;
      await sql.execute({ sql: sqlText, args: d });
      return this.get(id);
    },

    async update(id, data) {
      const d = serializeRow(table, { ...data, updated_date: now() });
      delete d.id;
      delete d.created_date;
      if (!Object.keys(d).length) return this.get(id);
      const sets = Object.keys(d).map(k => `${k} = :${k}`).join(', ');
      await sql.execute({
        sql: `UPDATE ${table} SET ${sets} WHERE id = :id`,
        args: { ...d, id },
      });
      return this.get(id);
    },

    async delete(id) {
      await sql.execute({
        sql: `DELETE FROM ${table} WHERE id = :id`,
        args: { id },
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Entity exports (matching the table names used throughout the app)
// ---------------------------------------------------------------------------

export const db = {
  Organization:  makeEntity('organizations'),
  Location:      makeEntity('locations'),
  Department:    makeEntity('departments'),
  KBBDocument:   makeEntity('kbb_documents'),
  CustomField:   makeEntity('custom_fields'),
  FieldConfig:   makeEntity('field_configs'),
  Team:          makeEntity('teams'),
  OrgMember:     makeEntity('org_members'),
  Notification:  makeEntity('notifications'),
  User:          makeEntity('users'),
};

// ---------------------------------------------------------------------------
// Specialised queries
// ---------------------------------------------------------------------------

/** Returns all organizations a user belongs to (via org_members).
 *  Admin users (role = 'admin') receive every organization. */
export async function getOrgsForUser(userId, userRole) {
  if (userRole === 'admin') {
    return db.Organization.list();
  }
  const rs = await sql.execute({
    sql: `SELECT o.*
          FROM organizations o
          INNER JOIN org_members m ON m.org_id = o.id
          WHERE m.user_id = :userId`,
    args: { userId },
  });
  return rs.rows.map(r => parseRow('organizations', r));
}

// ---------------------------------------------------------------------------
// Org membership helpers
// ---------------------------------------------------------------------------

export async function getOrgMembersWithUsers(orgId) {
  const rs = await sql.execute({
    sql: `SELECT u.*, m.id AS member_id, m.role AS org_role
          FROM users u
          LEFT JOIN org_members m ON m.user_id = u.id AND m.org_id = :orgId
          ORDER BY u.full_name`,
    args: { orgId },
  });
  return rs.rows.map(r => ({
    ...parseRow('users', r),
    member_id: r.member_id,
    org_role: r.org_role,
  }));
}

export async function addOrgMember(orgId, { full_name, email, role }) {
  // Find existing user by email
  const existing = await sql.execute({
    sql: 'SELECT id FROM users WHERE email = :email LIMIT 1',
    args: { email },
  });

  let userId;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
  } else {
    const user = await db.User.create({ full_name, email, role: 'user' });
    userId = user.id;
  }

  return addExistingUserToOrg(orgId, userId, role);
}

export async function addExistingUserToOrg(orgId, userId, role) {
  // Check for existing org membership
  const membership = await sql.execute({
    sql: 'SELECT id FROM org_members WHERE org_id = :orgId AND user_id = :userId LIMIT 1',
    args: { orgId, userId },
  });
  if (membership.rows.length > 0) throw new Error('User is already a member of this organization');

  return db.OrgMember.create({ org_id: orgId, user_id: userId, role: role || 'standard_user' });
}

export async function updateOrgMember(memberId, userId, { full_name, email, role }) {
  await db.User.update(userId, { full_name, email });
  if (role) {
    await db.OrgMember.update(memberId, { role });
  }
}

export async function removeOrgMember(memberId) {
  return db.OrgMember.delete(memberId);
}
