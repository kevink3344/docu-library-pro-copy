-- =====================================================================
-- KBB Portal — Azure SQL (T-SQL) Schema
-- Converted from the MySQL schema (server/init.sql).
--
-- Notes:
--   * UUID PKs kept as VARCHAR(36) (simplest; matches existing data)
--   * TEXT -> NVARCHAR(MAX)
--   * TINYINT(1) booleans -> BIT
--   * LONGBLOB -> VARBINARY(MAX)
--   * DATETIME -> DATETIME2
--   * No ENGINE/CHARSET clauses (SQL Server)
--   * Indexes created only if they don't already exist (idempotent)
-- =====================================================================

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.users', 'U') IS NULL
CREATE TABLE dbo.users (
  id            VARCHAR(36)     NOT NULL PRIMARY KEY,
  full_name     NVARCHAR(255)   NULL,
  email         NVARCHAR(255)   NULL,
  role          VARCHAR(32)     NOT NULL DEFAULT 'user',
  password_hash NVARCHAR(255)   NULL,
  created_date  VARCHAR(32)     NULL,
  updated_date  VARCHAR(32)     NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_users_email' AND object_id=OBJECT_ID('dbo.users'))
  CREATE INDEX idx_users_email ON dbo.users (email);
GO

-- ---------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.app_settings', 'U') IS NULL
CREATE TABLE dbo.app_settings (
  [key]   NVARCHAR(100) NOT NULL PRIMARY KEY,
  [value] NVARCHAR(MAX) NOT NULL
);
GO

-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.organizations', 'U') IS NULL
CREATE TABLE dbo.organizations (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  name            NVARCHAR(255) NOT NULL,
  description     NVARCHAR(MAX) NULL,
  admin_user_ids  NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  slug            NVARCHAR(255) NULL,
  is_active       BIT           NOT NULL DEFAULT 1,
  created_date    VARCHAR(32)   NULL,
  updated_date    VARCHAR(32)   NULL,
  created_by_id   VARCHAR(64)   NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_organizations_slug' AND object_id=OBJECT_ID('dbo.organizations'))
  CREATE INDEX idx_organizations_slug ON dbo.organizations (slug);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_organizations_is_active' AND object_id=OBJECT_ID('dbo.organizations'))
  CREATE INDEX idx_organizations_is_active ON dbo.organizations (is_active);
GO

-- ---------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.locations', 'U') IS NULL
CREATE TABLE dbo.locations (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  org_id        VARCHAR(36)   NOT NULL,
  name          NVARCHAR(255) NOT NULL,
  is_active     BIT           NOT NULL DEFAULT 1,
  pinned        BIT           NOT NULL DEFAULT 0,
  created_date  VARCHAR(32)   NULL,
  updated_date  VARCHAR(32)   NULL,
  created_by_id VARCHAR(64)   NULL,
  CONSTRAINT fk_locations_org FOREIGN KEY (org_id) REFERENCES dbo.organizations (id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_locations_org_id' AND object_id=OBJECT_ID('dbo.locations'))
  CREATE INDEX idx_locations_org_id ON dbo.locations (org_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_locations_org_active' AND object_id=OBJECT_ID('dbo.locations'))
  CREATE INDEX idx_locations_org_active ON dbo.locations (org_id, is_active);
GO

-- ---------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.departments', 'U') IS NULL
CREATE TABLE dbo.departments (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  org_id        VARCHAR(36)   NOT NULL,
  name          NVARCHAR(255) NOT NULL,
  is_active     BIT           NOT NULL DEFAULT 1,
  pinned        BIT           NOT NULL DEFAULT 0,
  created_date  VARCHAR(32)   NULL,
  updated_date  VARCHAR(32)   NULL,
  created_by_id VARCHAR(64)   NULL,
  CONSTRAINT fk_departments_org FOREIGN KEY (org_id) REFERENCES dbo.organizations (id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_departments_org_id' AND object_id=OBJECT_ID('dbo.departments'))
  CREATE INDEX idx_departments_org_id ON dbo.departments (org_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_departments_org_active' AND object_id=OBJECT_ID('dbo.departments'))
  CREATE INDEX idx_departments_org_active ON dbo.departments (org_id, is_active);
GO

-- ---------------------------------------------------------------------
-- kbb_documents
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.kbb_documents', 'U') IS NULL
CREATE TABLE dbo.kbb_documents (
  id                   VARCHAR(36)     NOT NULL PRIMARY KEY,
  org_id               VARCHAR(36)     NOT NULL,
  title                NVARCHAR(500)   NOT NULL,
  description          NVARCHAR(MAX)   NULL,
  document_id          NVARCHAR(255)   NULL,
  link_url             NVARCHAR(MAX)   NULL,
  file_url             NVARCHAR(500)   NULL,
  file_type            VARCHAR(32)     NULL,
  file_blob            VARBINARY(MAX)  NULL,
  tags                 NVARCHAR(MAX)   NOT NULL DEFAULT '[]',
  location             NVARCHAR(MAX)   NOT NULL DEFAULT '[]',
  department           NVARCHAR(MAX)   NOT NULL DEFAULT '[]',
  renew_date           VARCHAR(32)     NULL,
  renew_notified_30    BIT             NOT NULL DEFAULT 0,
  renew_notified_7     BIT             NOT NULL DEFAULT 0,
  visibility           VARCHAR(16)     NOT NULL DEFAULT 'everyone',
  allowed_team_ids     NVARCHAR(MAX)   NOT NULL DEFAULT '[]',
  creator_user_id      VARCHAR(36)     NULL,
  custom_field_values  NVARCHAR(MAX)   NOT NULL DEFAULT '{}',
  is_archived          BIT             NOT NULL DEFAULT 0,
  created_date         VARCHAR(32)     NULL,
  updated_date         VARCHAR(32)     NULL,
  created_by_id        VARCHAR(64)     NULL,
  CONSTRAINT fk_kbb_documents_org FOREIGN KEY (org_id) REFERENCES dbo.organizations (id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_kbb_documents_org_id' AND object_id=OBJECT_ID('dbo.kbb_documents'))
  CREATE INDEX idx_kbb_documents_org_id ON dbo.kbb_documents (org_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_kbb_documents_created_date' AND object_id=OBJECT_ID('dbo.kbb_documents'))
  CREATE INDEX idx_kbb_documents_created_date ON dbo.kbb_documents (created_date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_kbb_documents_visibility' AND object_id=OBJECT_ID('dbo.kbb_documents'))
  CREATE INDEX idx_kbb_documents_visibility ON dbo.kbb_documents (visibility);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_kbb_documents_is_archived' AND object_id=OBJECT_ID('dbo.kbb_documents'))
  CREATE INDEX idx_kbb_documents_is_archived ON dbo.kbb_documents (is_archived);
GO

-- ---------------------------------------------------------------------
-- custom_fields
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.custom_fields', 'U') IS NULL
CREATE TABLE dbo.custom_fields (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  org_id         VARCHAR(36)   NOT NULL,
  name           NVARCHAR(255) NOT NULL,
  input_type     VARCHAR(32)   NOT NULL,
  options        NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  display_order  FLOAT         NOT NULL DEFAULT 0,
  status         VARCHAR(16)   NOT NULL DEFAULT 'active',
  created_date   VARCHAR(32)   NULL,
  updated_date   VARCHAR(32)   NULL,
  created_by_id  VARCHAR(64)   NULL,
  CONSTRAINT fk_custom_fields_org FOREIGN KEY (org_id) REFERENCES dbo.organizations (id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_custom_fields_org_id' AND object_id=OBJECT_ID('dbo.custom_fields'))
  CREATE INDEX idx_custom_fields_org_id ON dbo.custom_fields (org_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_custom_fields_order' AND object_id=OBJECT_ID('dbo.custom_fields'))
  CREATE INDEX idx_custom_fields_order ON dbo.custom_fields (org_id, display_order);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_custom_fields_status' AND object_id=OBJECT_ID('dbo.custom_fields'))
  CREATE INDEX idx_custom_fields_status ON dbo.custom_fields (status);
GO

-- ---------------------------------------------------------------------
-- field_configs
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.field_configs', 'U') IS NULL
CREATE TABLE dbo.field_configs (
  id                     VARCHAR(36)   NOT NULL PRIMARY KEY,
  org_id                 VARCHAR(36)   NOT NULL,
  hidden_required_fields NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  add_screen_order       NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  view_screen_order      NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  dashboard_columns      NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  created_date           VARCHAR(32)   NULL,
  updated_date           VARCHAR(32)   NULL,
  created_by_id          VARCHAR(64)   NULL,
  CONSTRAINT fk_field_configs_org FOREIGN KEY (org_id) REFERENCES dbo.organizations (id),
  CONSTRAINT uq_field_configs_org UNIQUE (org_id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_field_configs_org_id' AND object_id=OBJECT_ID('dbo.field_configs'))
  CREATE INDEX idx_field_configs_org_id ON dbo.field_configs (org_id);
GO

-- ---------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.teams', 'U') IS NULL
CREATE TABLE dbo.teams (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  org_id          VARCHAR(36)   NOT NULL,
  name            NVARCHAR(255) NOT NULL,
  description     NVARCHAR(MAX) NULL,
  member_user_ids NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  created_date    VARCHAR(32)   NULL,
  updated_date    VARCHAR(32)   NULL,
  created_by_id   VARCHAR(64)   NULL,
  CONSTRAINT fk_teams_org FOREIGN KEY (org_id) REFERENCES dbo.organizations (id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_teams_org_id' AND object_id=OBJECT_ID('dbo.teams'))
  CREATE INDEX idx_teams_org_id ON dbo.teams (org_id);
GO

-- ---------------------------------------------------------------------
-- org_members
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.org_members', 'U') IS NULL
CREATE TABLE dbo.org_members (
  id            VARCHAR(36) NOT NULL PRIMARY KEY,
  org_id        VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36) NOT NULL,
  role          VARCHAR(32) NOT NULL DEFAULT 'standard_user',
  created_date  VARCHAR(32) NULL,
  updated_date  VARCHAR(32) NULL,
  created_by_id VARCHAR(64) NULL,
  CONSTRAINT fk_org_members_org  FOREIGN KEY (org_id)  REFERENCES dbo.organizations (id),
  CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
  CONSTRAINT uq_org_members_org_user UNIQUE (org_id, user_id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_org_members_org_id' AND object_id=OBJECT_ID('dbo.org_members'))
  CREATE INDEX idx_org_members_org_id ON dbo.org_members (org_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_org_members_user_id' AND object_id=OBJECT_ID('dbo.org_members'))
  CREATE INDEX idx_org_members_user_id ON dbo.org_members (user_id);
GO

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.notifications', 'U') IS NULL
CREATE TABLE dbo.notifications (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id        VARCHAR(36)   NOT NULL,
  org_id         VARCHAR(36)   NULL,
  document_id    VARCHAR(36)   NULL,
  type           VARCHAR(32)   NOT NULL DEFAULT 'renewal_30',
  message        NVARCHAR(MAX) NOT NULL,
  is_read        BIT           NOT NULL DEFAULT 0,
  document_title NVARCHAR(500) NULL,
  created_date   VARCHAR(32)   NULL,
  updated_date   VARCHAR(32)   NULL,
  created_by_id  VARCHAR(64)   NULL,
  CONSTRAINT fk_notifications_user     FOREIGN KEY (user_id)     REFERENCES dbo.users (id),
  CONSTRAINT fk_notifications_org      FOREIGN KEY (org_id)      REFERENCES dbo.organizations (id),
  CONSTRAINT fk_notifications_document FOREIGN KEY (document_id) REFERENCES dbo.kbb_documents (id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_notifications_user_id' AND object_id=OBJECT_ID('dbo.notifications'))
  CREATE INDEX idx_notifications_user_id ON dbo.notifications (user_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_notifications_user_unread' AND object_id=OBJECT_ID('dbo.notifications'))
  CREATE INDEX idx_notifications_user_unread ON dbo.notifications (user_id, is_read);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_notifications_org_id' AND object_id=OBJECT_ID('dbo.notifications'))
  CREATE INDEX idx_notifications_org_id ON dbo.notifications (org_id);
GO

-- ---------------------------------------------------------------------
-- system_messages
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.system_messages', 'U') IS NULL
CREATE TABLE dbo.system_messages (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  org_id         VARCHAR(36)   NOT NULL,
  title          NVARCHAR(255) NOT NULL,
  text           NVARCHAR(MAX) NOT NULL DEFAULT '',
  pastel_color   VARCHAR(16)   NOT NULL DEFAULT '#E8F4FD',
  is_dismissable BIT           NOT NULL DEFAULT 1,
  is_active      BIT           NOT NULL DEFAULT 1,
  created_date   VARCHAR(32)   NULL,
  updated_date   VARCHAR(32)   NULL,
  created_by_id  VARCHAR(64)   NULL,
  CONSTRAINT fk_system_messages_org FOREIGN KEY (org_id) REFERENCES dbo.organizations (id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_system_messages_org_id' AND object_id=OBJECT_ID('dbo.system_messages'))
  CREATE INDEX idx_system_messages_org_id ON dbo.system_messages (org_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_system_messages_org_active' AND object_id=OBJECT_ID('dbo.system_messages'))
  CREATE INDEX idx_system_messages_org_active ON dbo.system_messages (org_id, is_active);
GO

-- ---------------------------------------------------------------------
-- dismissed_messages
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.dismissed_messages', 'U') IS NULL
CREATE TABLE dbo.dismissed_messages (
  id             VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id        VARCHAR(36) NOT NULL,
  message_id     VARCHAR(36) NOT NULL,
  dismissed_date VARCHAR(32) NULL,
  CONSTRAINT fk_dismissed_messages_user    FOREIGN KEY (user_id)    REFERENCES dbo.users (id),
  CONSTRAINT fk_dismissed_messages_message FOREIGN KEY (message_id) REFERENCES dbo.system_messages (id),
  CONSTRAINT uq_dismissed_messages UNIQUE (user_id, message_id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_dismissed_messages_user' AND object_id=OBJECT_ID('dbo.dismissed_messages'))
  CREATE INDEX idx_dismissed_messages_user ON dbo.dismissed_messages (user_id);
GO

-- ---------------------------------------------------------------------
-- settings_tabs
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.settings_tabs', 'U') IS NULL
CREATE TABLE dbo.settings_tabs (
  id         VARCHAR(36)   NOT NULL PRIMARY KEY,
  name       NVARCHAR(255) NOT NULL,
  slug       NVARCHAR(255) NOT NULL,
  sort_order INT           NOT NULL DEFAULT 0,
  visible_to VARCHAR(16)   NOT NULL DEFAULT 'all',
  created_at VARCHAR(32)   NULL,
  updated_at VARCHAR(32)   NULL,
  CONSTRAINT uq_settings_tabs_slug UNIQUE (slug)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_settings_tabs_sort_order' AND object_id=OBJECT_ID('dbo.settings_tabs'))
  CREATE INDEX idx_settings_tabs_sort_order ON dbo.settings_tabs (sort_order);
GO

-- ---------------------------------------------------------------------
-- settings_tab_sections
-- ---------------------------------------------------------------------
IF OBJECT_ID('dbo.settings_tab_sections', 'U') IS NULL
CREATE TABLE dbo.settings_tab_sections (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  tab_id      VARCHAR(36)  NOT NULL,
  section_key VARCHAR(100) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  VARCHAR(32)  NULL,
  CONSTRAINT fk_settings_tab_sections_tab FOREIGN KEY (tab_id) REFERENCES dbo.settings_tabs (id),
  CONSTRAINT uq_settings_tab_sections UNIQUE (tab_id, section_key)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_settings_tab_sections_tab_id' AND object_id=OBJECT_ID('dbo.settings_tab_sections'))
  CREATE INDEX idx_settings_tab_sections_tab_id ON dbo.settings_tab_sections (tab_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_settings_tab_sections_tab_order' AND object_id=OBJECT_ID('dbo.settings_tab_sections'))
  CREATE INDEX idx_settings_tab_sections_tab_order ON dbo.settings_tab_sections (tab_id, sort_order);
GO
