-- Fork M1: reversible provider/model lifecycle policies. No credentials or
-- provider_connections/model catalog rows are modified by this migration.
CREATE TABLE IF NOT EXISTS provider_lifecycle_policies (
  provider_id TEXT PRIMARY KEY,
  presentation_hidden INTEGER NOT NULL DEFAULT 0 CHECK (presentation_hidden IN (0, 1)),
  routing_disabled INTEGER NOT NULL DEFAULT 0 CHECK (routing_disabled IN (0, 1)),
  auto_sync_suppressed INTEGER NOT NULL DEFAULT 0 CHECK (auto_sync_suppressed IN (0, 1)),
  reason TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS model_lifecycle_overrides (
  provider_id TEXT NOT NULL,
  canonical_model_id TEXT NOT NULL,
  modality TEXT NOT NULL,
  catalog_hidden INTEGER NOT NULL DEFAULT 0 CHECK (catalog_hidden IN (0, 1)),
  routing_disabled INTEGER NOT NULL DEFAULT 0 CHECK (routing_disabled IN (0, 1)),
  reason TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider_id, canonical_model_id, modality)
);

CREATE INDEX IF NOT EXISTS idx_model_lifecycle_provider_modality
  ON model_lifecycle_overrides (provider_id, modality, canonical_model_id);

CREATE TABLE IF NOT EXISTS catalog_lifecycle_revision (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
INSERT OR IGNORE INTO catalog_lifecycle_revision (id, revision) VALUES (1, 0);
