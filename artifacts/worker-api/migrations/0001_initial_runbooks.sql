-- Initial D1 schema for runbooks (v1)
-- Mirrors current PostgreSQL/Drizzle shape while staying SQLite-native.

CREATE TABLE IF NOT EXISTS runbooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  system TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  steps TEXT NOT NULL DEFAULT '',
  rollback TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_runbooks_system ON runbooks(system);
CREATE INDEX IF NOT EXISTS idx_runbooks_severity ON runbooks(severity);
