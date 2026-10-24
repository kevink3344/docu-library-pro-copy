-- =====================================================================
-- KBB Portal — MySQL Schema
-- Converted from the Turso SQLite schema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36) PRIMARY KEY NOT NULL,
  full_name     VARCHAR(255),
  email         VARCHAR(255),
  role          VARCHAR(32) NOT NULL DEFAULT 'user',
  password_hash VARCHAR(255),                              -- bcrypt hash; NULL for select-mode / unset
  created_date  VARCHAR(32),
  updated_date  VARCHAR(32)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_users_email ON users (email);

-- ---------------------------------------------------------------------
-- app_settings (global key/value config)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  `key`   VARCHAR(100) PRIMARY KEY NOT NULL,
  `value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id              VARCHAR(36) PRIMARY KEY NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  admin_user_ids  TEXT NOT NULL,             -- JSON array of user IDs
  slug            VARCHAR(255),
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_date    VARCHAR(32),
  updated_date    VARCHAR(32),
  created_by_id VARCHAR(64)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_organizations_slug ON organizations (slug);
CREATE INDEX idx_organizations_is_active ON organizations (is_active);

-- ---------------------------------------------------------------------
-- locations (Sites)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id            VARCHAR(36) PRIMARY KEY NOT NULL,
  org_id        VARCHAR(36) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  pinned        TINYINT(1) NOT NULL DEFAULT 0,
  created_date  VARCHAR(32),
  updated_date  VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_locations_org FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_locations_org_id ON locations (org_id);
CREATE INDEX idx_locations_org_active ON locations (org_id, is_active);

-- ---------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id            VARCHAR(36) PRIMARY KEY NOT NULL,
  org_id        VARCHAR(36) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  pinned        TINYINT(1) NOT NULL DEFAULT 0,
  created_date  VARCHAR(32),
  updated_date  VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_departments_org FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_departments_org_id ON departments (org_id);
CREATE INDEX idx_departments_org_active ON departments (org_id, is_active);

-- ---------------------------------------------------------------------
-- kbb_documents (Safety Data Sheets)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kbb_documents (
  id                   VARCHAR(36) PRIMARY KEY NOT NULL,
  org_id               VARCHAR(36) NOT NULL,
  title                VARCHAR(500) NOT NULL,
  description          TEXT,
  document_id          VARCHAR(255),
  link_url             TEXT,
  file_url             VARCHAR(500),
  file_type            VARCHAR(32),
  file_blob            LONGBLOB,
  tags                 TEXT NOT NULL,             -- JSON array of strings
  location             TEXT NOT NULL,             -- JSON array of strings (site names)
  department           TEXT NOT NULL,             -- JSON array of strings
  renew_date           VARCHAR(32),
  renew_notified_30    TINYINT(1) NOT NULL DEFAULT 0,
  renew_notified_7     TINYINT(1) NOT NULL DEFAULT 0,
  visibility           VARCHAR(16) NOT NULL DEFAULT 'everyone',
  allowed_team_ids     TEXT NOT NULL,             -- JSON array of team IDs
  creator_user_id      VARCHAR(36),
  custom_field_values  TEXT NOT NULL,             -- JSON object: custom_field_id -> value
  is_archived          TINYINT(1) NOT NULL DEFAULT 0,
  created_date         VARCHAR(32),
  updated_date         VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_kbb_documents_org FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_kbb_documents_org_id        ON kbb_documents (org_id);
CREATE INDEX idx_kbb_documents_created_date  ON kbb_documents (created_date);
CREATE INDEX idx_kbb_documents_visibility    ON kbb_documents (visibility);
CREATE INDEX idx_kbb_documents_is_archived   ON kbb_documents (is_archived);

-- ---------------------------------------------------------------------
-- custom_fields
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_fields (
  id             VARCHAR(36) PRIMARY KEY NOT NULL,
  org_id         VARCHAR(36) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  input_type     VARCHAR(32) NOT NULL,
  options        TEXT NOT NULL,             -- JSON array of strings
  display_order  DOUBLE NOT NULL DEFAULT 0,
  status         VARCHAR(16) NOT NULL DEFAULT 'active',
  created_date   VARCHAR(32),
  updated_date   VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_custom_fields_org FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_custom_fields_org_id     ON custom_fields (org_id);
CREATE INDEX idx_custom_fields_order      ON custom_fields (org_id, display_order);
CREATE INDEX idx_custom_fields_status     ON custom_fields (status);

-- ---------------------------------------------------------------------
-- field_configs (per-org layout & visibility configuration)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_configs (
  id                    VARCHAR(36) PRIMARY KEY NOT NULL,
  org_id                VARCHAR(36) NOT NULL,
  hidden_required_fields TEXT NOT NULL,
  add_screen_order      TEXT NOT NULL,
  view_screen_order     TEXT NOT NULL,
  dashboard_columns     TEXT NOT NULL,
  created_date          VARCHAR(32),
  updated_date          VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_field_configs_org FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_field_configs_org (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_field_configs_org_id ON field_configs (org_id);

-- ---------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id              VARCHAR(36) PRIMARY KEY NOT NULL,
  org_id          VARCHAR(36) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  member_user_ids TEXT NOT NULL,             -- JSON array of user IDs
  created_date    VARCHAR(32),
  updated_date    VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_teams_org FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_teams_org_id ON teams (org_id);

-- ---------------------------------------------------------------------
-- org_members (membership linking users to organizations)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_members (
  id            VARCHAR(36) PRIMARY KEY NOT NULL,
  org_id        VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36) NOT NULL,
  role          VARCHAR(32) NOT NULL DEFAULT 'standard_user',
  created_date  VARCHAR(32),
  updated_date  VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_org_members_org  FOREIGN KEY (org_id)  REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_org_members_org_user (org_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_org_members_org_id  ON org_members (org_id);
CREATE INDEX idx_org_members_user_id ON org_members (user_id);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              VARCHAR(36) PRIMARY KEY NOT NULL,
  user_id         VARCHAR(36) NOT NULL,
  org_id          VARCHAR(36),
  document_id     VARCHAR(36),
  type            VARCHAR(32) NOT NULL DEFAULT 'renewal_30',
  message         TEXT NOT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  document_title  VARCHAR(500),
  created_date    VARCHAR(32),
  updated_date    VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_notifications_user     FOREIGN KEY (user_id)     REFERENCES users (id)          ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notifications_org      FOREIGN KEY (org_id)      REFERENCES organizations (id)  ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_notifications_document FOREIGN KEY (document_id) REFERENCES kbb_documents (id)  ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read);
CREATE INDEX idx_notifications_org_id      ON notifications (org_id);

-- ---------------------------------------------------------------------
-- system_messages (org-scoped announcement banners)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_messages (
  id              VARCHAR(36) PRIMARY KEY NOT NULL,
  org_id          VARCHAR(36) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  text            TEXT NOT NULL,
  pastel_color    VARCHAR(16) NOT NULL DEFAULT '#E8F4FD',
  is_dismissable  TINYINT(1) NOT NULL DEFAULT 1,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_date    VARCHAR(32),
  updated_date    VARCHAR(32),
  created_by_id VARCHAR(64),
  CONSTRAINT fk_system_messages_org FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_system_messages_org_id ON system_messages (org_id);
CREATE INDEX idx_system_messages_org_active ON system_messages (org_id, is_active);

-- ---------------------------------------------------------------------
-- dismissed_messages (tracks per-user dismissals for system messages)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dismissed_messages (
  id              VARCHAR(36) PRIMARY KEY NOT NULL,
  user_id         VARCHAR(36) NOT NULL,
  message_id      VARCHAR(36) NOT NULL,
  dismissed_date  VARCHAR(32),
  CONSTRAINT fk_dismissed_messages_user    FOREIGN KEY (user_id)    REFERENCES users (id)           ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dismissed_messages_message FOREIGN KEY (message_id) REFERENCES system_messages (id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_dismissed_messages (user_id, message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_dismissed_messages_user ON dismissed_messages (user_id);

-- ---------------------------------------------------------------------
-- settings_tabs (tabbed navigation for the Settings page)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings_tabs (
  id            VARCHAR(36) PRIMARY KEY NOT NULL,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) NOT NULL UNIQUE,
  sort_order    INT NOT NULL DEFAULT 0,
  visible_to    VARCHAR(16) NOT NULL DEFAULT 'all',
  created_at    VARCHAR(32),
  updated_at    VARCHAR(32)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_settings_tabs_sort_order ON settings_tabs (sort_order);

-- ---------------------------------------------------------------------
-- settings_tab_sections (maps settings sections to tabs)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings_tab_sections (
  id            VARCHAR(36) PRIMARY KEY NOT NULL,
  tab_id        VARCHAR(36) NOT NULL,
  section_key   VARCHAR(100) NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    VARCHAR(32),
  CONSTRAINT fk_settings_tab_sections_tab FOREIGN KEY (tab_id) REFERENCES settings_tabs(id) ON DELETE CASCADE,
  UNIQUE KEY uq_settings_tab_sections (tab_id, section_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_settings_tab_sections_tab_id ON settings_tab_sections (tab_id);
CREATE INDEX idx_settings_tab_sections_tab_order ON settings_tab_sections (tab_id, sort_order);
