-- =====================================================================
-- System-Wide Messages
-- Adds support for org-scoped announcement banners that appear at
-- the top of the main page after login. Supports authenticated user
-- dismissals (server-side) and guest dismissals (localStorage).
-- =====================================================================

-- ---------------------------------------------------------------------
-- system_messages (org-scoped announcement banners)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_messages (
  id              TEXT PRIMARY KEY NOT NULL,
  org_id          TEXT NOT NULL,
  title           TEXT NOT NULL,
  text            TEXT NOT NULL DEFAULT '',
  pastel_color    TEXT NOT NULL DEFAULT '#E8F4FD',  -- soft pastel blue
  is_dismissable  INTEGER NOT NULL DEFAULT 1,        -- boolean (0/1)
  is_active       INTEGER NOT NULL DEFAULT 1,        -- boolean (0/1)
  created_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_date    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_id   TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_system_messages_org_id ON system_messages (org_id);
CREATE INDEX IF NOT EXISTS idx_system_messages_org_active ON system_messages (org_id, is_active);

-- ---------------------------------------------------------------------
-- dismissed_messages (tracks per-user dismissals for system messages)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dismissed_messages (
  id              TEXT PRIMARY KEY NOT NULL,
  user_id         TEXT NOT NULL,
  message_id      TEXT NOT NULL,
  dismissed_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id)    REFERENCES users (id)           ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (message_id) REFERENCES system_messages (id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_messages_user ON dismissed_messages (user_id);