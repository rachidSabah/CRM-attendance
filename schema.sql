-- CRM Attendance D1 Database Schema
-- All entity data stored as JSON blobs for flexibility with the existing data model

-- School settings (key-value per tenant)
CREATE TABLE IF NOT EXISTS school_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, key)
);

-- Generic entity storage: students, classes, modules, etc.
CREATE TABLE IF NOT EXISTS entities (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id, tenant_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(entity_type, tenant_id, updated_at);

-- Sync log for tracking operations
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  entity_type TEXT,
  record_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_tenant ON sync_log(tenant_id, created_at DESC);

-- Reminder tracking (prevent duplicate sends)
CREATE TABLE IF NOT EXISTS reminder_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  date TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, student_id, date, reminder_type)
);
