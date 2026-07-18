-- =====================================================================
-- KBB Portal — Turso SQLite Schema (SQLite-compatible DDL)
-- Generated from Base44 entity definitions
-- =====================================================================

-- Enable foreign key enforcement at the driver/connection level:
--   PRAGMA foreign_keys = ON;
-- (Per-connection pragma; not persisted in the database file.)

-- ---------------------------------------------------------------------
-- users (built-in Base44 User entity)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY NOT NULL,
  full_name     TEXT,
  email         TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  created_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id              TEXT PRIMARY KEY NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  admin_user_ids  TEXT NOT NULL DEFAULT '[]',   -- JSON array of user IDs
  slug            TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,   -- boolean (0/1)
  created_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations (slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations (is_active);

-- ---------------------------------------------------------------------
-- locations (Sites)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id            TEXT PRIMARY KEY NOT NULL,
  org_id        TEXT NOT NULL,
  name          TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,     -- boolean (0/1)
  pinned        INTEGER NOT NULL DEFAULT 0,     -- boolean (0/1)
  created_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_locations_org_id ON locations (org_id);
CREATE INDEX IF NOT EXISTS idx_locations_org_active ON locations (org_id, is_active);

-- ---------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id            TEXT PRIMARY KEY NOT NULL,
  org_id        TEXT NOT NULL,
  name          TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,     -- boolean (0/1)
  pinned        INTEGER NOT NULL DEFAULT 0,     -- boolean (0/1)
  created_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_departments_org_id ON departments (org_id);
CREATE INDEX IF NOT EXISTS idx_departments_org_active ON departments (org_id, is_active);

-- ---------------------------------------------------------------------
-- kbb_documents (Safety Data Sheets)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kbb_documents (
  id                   TEXT PRIMARY KEY NOT NULL,
  org_id               TEXT NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  document_id          TEXT,                     -- custom document identifier
  link_url             TEXT,
  file_url             TEXT,
  file_type            TEXT,                     -- pdf | word | excel | google-doc | url
  tags                 TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
  location             TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings (site names)
  department           TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
  renew_date           TEXT,                     -- ISO-8601 date (YYYY-MM-DD); blank = no renewal
  renew_notified_30    INTEGER NOT NULL DEFAULT 0,         -- boolean (0/1)
  renew_notified_7     INTEGER NOT NULL DEFAULT 0,         -- boolean (0/1)
  visibility           TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'teams')),
  allowed_team_ids     TEXT NOT NULL DEFAULT '[]',          -- JSON array of team IDs
  creator_user_id      TEXT,
  custom_field_values  TEXT NOT NULL DEFAULT '{}',         -- JSON object: custom_field_id -> value
  is_archived          INTEGER NOT NULL DEFAULT 0,         -- boolean (0/1)
  created_date         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id        TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kbb_documents_org_id        ON kbb_documents (org_id);
CREATE INDEX IF NOT EXISTS idx_kbb_documents_created_date  ON kbb_documents (created_date);
CREATE INDEX IF NOT EXISTS idx_kbb_documents_visibility    ON kbb_documents (visibility);
CREATE INDEX IF NOT EXISTS idx_kbb_documents_is_archived  ON kbb_documents (is_archived);

-- ---------------------------------------------------------------------
-- custom_fields
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_fields (
  id             TEXT PRIMARY KEY NOT NULL,
  org_id         TEXT NOT NULL,
  name           TEXT NOT NULL,
  input_type     TEXT NOT NULL CHECK (input_type IN ('text-short', 'text-paragraph', 'single-select', 'multi-select')),
  options        TEXT NOT NULL DEFAULT '[]',     -- JSON array of strings
  display_order  REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_date   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id  TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_org_id     ON custom_fields (org_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_order      ON custom_fields (org_id, display_order);
CREATE INDEX IF NOT EXISTS idx_custom_fields_status     ON custom_fields (status);

-- ---------------------------------------------------------------------
-- field_configs (per-org layout & visibility configuration)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_configs (
  id                    TEXT PRIMARY KEY NOT NULL,
  org_id                TEXT NOT NULL,
  hidden_required_fields TEXT NOT NULL DEFAULT '[]',   -- JSON array of field keys
  add_screen_order      TEXT NOT NULL DEFAULT '[]',    -- JSON array of field IDs
  view_screen_order     TEXT NOT NULL DEFAULT '[]',    -- JSON array of field IDs
  dashboard_columns     TEXT NOT NULL DEFAULT '[]',    -- JSON array of {key,label,display_mode}
  created_date          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id         TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_field_configs_org_id ON field_configs (org_id);

-- ---------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id              TEXT PRIMARY KEY NOT NULL,
  org_id          TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  member_user_ids TEXT NOT NULL DEFAULT '[]',     -- JSON array of user IDs
  created_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id   TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams (org_id);

-- ---------------------------------------------------------------------
-- org_members (membership linking users to organizations)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_members (
  id            TEXT PRIMARY KEY NOT NULL,
  org_id        TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'standard_user'
                CHECK (role IN ('org_admin', 'team_member', 'standard_user')),
  created_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id TEXT,
  FOREIGN KEY (org_id)   REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON org_members (org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members (user_id);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY NOT NULL,
  user_id         TEXT NOT NULL,
  org_id          TEXT,
  document_id     TEXT,                          -- KBBDocument ID
  type            TEXT NOT NULL DEFAULT 'renewal_30'
                  CHECK (type IN ('renewal_30', 'renewal_7', 'renewal_overdue')),
  message         TEXT NOT NULL,
  is_read         INTEGER NOT NULL DEFAULT 0,    -- boolean (0/1)
  document_title  TEXT,
  created_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id   TEXT,
  FOREIGN KEY (user_id)     REFERENCES users (id)          ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (org_id)     REFERENCES organizations (id)  ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (document_id) REFERENCES kbb_documents (id)  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id      ON notifications (org_id);
