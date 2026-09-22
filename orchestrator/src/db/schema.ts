import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * SQLite schema — all tables from PRD §10 + Addendum G.
 * Initialized once on startup. Idempotent (uses CREATE TABLE IF NOT EXISTS).
 */

const SCHEMA_SQL = `
-- ─────────────────────────────────────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                          TEXT PRIMARY KEY,
  raw_input                   TEXT NOT NULL,
  urgency                     TEXT NOT NULL CHECK(urgency IN ('urgent','normal')),
  data_sensitivity            TEXT NOT NULL CHECK(data_sensitivity IN ('public','internal','pii')),
  max_total_latency_ms        INTEGER NOT NULL,
  max_total_cost_usd          REAL NOT NULL,
  min_accuracy_tier_per_subtask REAL NOT NULL DEFAULT 0,
  max_total_carbon_kgco2eq    REAL NOT NULL,
  running_cost_usd            REAL NOT NULL DEFAULT 0,
  running_carbon_kgco2eq      REAL NOT NULL DEFAULT 0,
  running_latency_ms          REAL NOT NULL DEFAULT 0,
  created_at                  INTEGER NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'queued'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- subtasks
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subtasks (
  id                          TEXT PRIMARY KEY,
  task_id                     TEXT NOT NULL REFERENCES tasks(id),
  description                 TEXT NOT NULL,
  prompt                      TEXT NOT NULL,
  output                      TEXT,
  type                        TEXT NOT NULL CHECK(type IN ('extraction','generation','classification','summarization','code','other')),
  depends_on                  TEXT NOT NULL DEFAULT '[]',   -- JSON array of subtask IDs
  input_from                  TEXT NOT NULL DEFAULT '[]',   -- JSON array of subtask IDs
  urgency                     TEXT NOT NULL DEFAULT 'normal',
  data_sensitivity            TEXT NOT NULL DEFAULT 'public',
  pii_class                   TEXT CHECK(pii_class IN ('raw_pii','redacted_ok')),
  redacted_prompt             TEXT,
  complexity_tier             TEXT NOT NULL DEFAULT 'medium' CHECK(complexity_tier IN ('trivial','low','medium','high','expert')),
  status                      TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','routing','executing','verifying','done','failed')),
  subtask_budget_allowance_usd REAL,
  routed_model                TEXT,
  routed_location             TEXT CHECK(routed_location IN ('cloud','local')),
  jev_confidence              REAL,
  predicted_latency_ms        REAL,
  predicted_cost_usd          REAL,
  predicted_energy_kwh        REAL,
  predicted_carbon_kgco2eq    REAL,
  predicted_output_tokens     INTEGER,
  actual_latency_ms           REAL,
  actual_cost_usd             REAL,
  actual_energy_kwh           REAL,
  actual_carbon_kgco2eq       REAL,
  actual_input_tokens         INTEGER,
  actual_output_tokens        INTEGER,
  verification_pass           INTEGER CHECK(verification_pass IN (0,1)),
  verification_probability    REAL,
  escalation_count            INTEGER NOT NULL DEFAULT 0,
  embedding                   BLOB,
  created_at                  INTEGER NOT NULL,
  completed_at                INTEGER
);

-- ─────────────────────────────────────────────────────────────────────────────
-- escalation_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escalation_events (
  id          TEXT PRIMARY KEY,
  subtask_id  TEXT NOT NULL REFERENCES subtasks(id),
  reason_code TEXT NOT NULL,
  from_model  TEXT NOT NULL,
  to_model    TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- models (registry — seeded from config/registry.json)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS models (
  model_id                            TEXT PRIMARY KEY,
  location                            TEXT NOT NULL CHECK(location IN ('cloud','local')),
  accuracy_tier                       REAL NOT NULL,
  accuracy_tier_source                TEXT NOT NULL,
  predicted_latency_ms                REAL NOT NULL,
  predicted_cost_usd_per_1k_tokens    REAL NOT NULL,
  predicted_energy_kwh_per_1k_tokens  REAL NOT NULL,
  cloud_carbon_kgco2eq_per_1k_tokens  REAL          -- NULL for local rows
);

-- ─────────────────────────────────────────────────────────────────────────────
-- baseline_runs (PRD §6, Addendum E, G)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baseline_runs (
  id                    TEXT PRIMARY KEY,
  task_id               TEXT NOT NULL REFERENCES tasks(id),
  baseline_type         TEXT NOT NULL CHECK(baseline_type IN ('always_strongest','random')),
  total_cost_usd        REAL NOT NULL,
  total_carbon_kgco2eq  REAL NOT NULL,
  total_latency_ms      REAL NOT NULL,
  avg_accuracy_tier     REAL NOT NULL,
  measured              INTEGER NOT NULL DEFAULT 0 CHECK(measured IN (0,1)),  -- 1=real run, 0=estimated
  run_index             INTEGER NOT NULL DEFAULT 0,
  quality_score         REAL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- grid_intensity_cache
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grid_intensity_cache (
  zone              TEXT NOT NULL,
  fetched_at        INTEGER NOT NULL,
  current_gco2_per_kwh REAL NOT NULL,
  PRIMARY KEY (zone, fetched_at)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);
CREATE INDEX IF NOT EXISTS idx_escalation_subtask ON escalation_events(subtask_id);
CREATE INDEX IF NOT EXISTS idx_baseline_task ON baseline_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_grid_cache_zone ON grid_intensity_cache(zone, fetched_at DESC);
`;

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = process.env['DATABASE_PATH'] ?? './db.sqlite';
  const absPath = path.resolve(dbPath);

  _db = new Database(absPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}

/** Seed the models table from registry.json. Idempotent — uses INSERT OR REPLACE. */
export function seedModels(db: Database.Database, models: Array<Record<string, unknown>>): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO models
      (model_id, location, accuracy_tier, accuracy_tier_source,
       predicted_latency_ms, predicted_cost_usd_per_1k_tokens,
       predicted_energy_kwh_per_1k_tokens, cloud_carbon_kgco2eq_per_1k_tokens)
    VALUES
      (@model_id, @location, @accuracy_tier, @accuracy_tier_source,
       @predicted_latency_ms, @predicted_cost_usd_per_1k_tokens,
       @predicted_energy_kwh_per_1k_tokens, @cloud_carbon_kgco2eq_per_1k_tokens)
  `);

  const seed = db.transaction((entries: Array<Record<string, unknown>>) => {
    for (const m of entries) {
      stmt.run(m);
    }
  });

  seed(models);
}

/** Close the DB connection (for tests and graceful shutdown). */
export function closeDb(): void {
  _db?.close();
  _db = null;
}

// Allow running as a standalone script to initialize the DB
if (process.argv[1] && process.argv[1].endsWith('schema.ts')) {
  const db = getDb();
  console.log('✅ Database initialized at', process.env['DATABASE_PATH'] ?? './db.sqlite');
  db.close();
}
