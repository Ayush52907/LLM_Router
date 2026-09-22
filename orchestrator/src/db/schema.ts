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
  status                      TEXT NOT NULL DEFAULT 'queued',
  output                      TEXT
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
  degraded_routing            INTEGER NOT NULL DEFAULT 0 CHECK(degraded_routing IN (0,1)),
  degraded_reason             TEXT,
  estimated_stale_grid        INTEGER NOT NULL DEFAULT 0 CHECK(estimated_stale_grid IN (0,1)),
  needs_reconciliation        INTEGER NOT NULL DEFAULT 0 CHECK(needs_reconciliation IN (0,1)),
  reconciled_carbon_kgco2eq   REAL,
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
-- reconciliation_log (Offline resilience & reconciliation)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliation_log (
  id                          TEXT PRIMARY KEY,
  subtask_id                  TEXT NOT NULL REFERENCES subtasks(id),
  task_id                     TEXT NOT NULL,
  actual_routed_to            TEXT NOT NULL,
  would_have_routed_to        TEXT NOT NULL,
  match                       INTEGER NOT NULL CHECK(match IN (0,1)),
  original_carbon_kgco2eq     REAL,
  reconciled_carbon_kgco2eq   REAL,
  notes                       TEXT,
  reconciled_at               INTEGER NOT NULL
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

`;

const INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_needs_reconciliation ON subtasks(needs_reconciliation);
CREATE INDEX IF NOT EXISTS idx_escalation_subtask ON escalation_events(subtask_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_subtask ON reconciliation_log(subtask_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_task ON reconciliation_log(task_id);
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
  // 1. Create tables
  db.exec(SCHEMA_SQL);

  // 2. Safe migration for existing SQLite databases
  const columnsToAdd = [
    { name: 'depends_on', def: `TEXT NOT NULL DEFAULT '[]'` },
    { name: 'input_from', def: `TEXT NOT NULL DEFAULT '[]'` },
    { name: 'pii_class', def: 'TEXT' },
    { name: 'redacted_prompt', def: 'TEXT' },
    { name: 'subtask_budget_allowance_usd', def: 'REAL' },
    { name: 'routed_model', def: 'TEXT' },
    { name: 'routed_location', def: 'TEXT' },
    { name: 'jev_confidence', def: 'REAL' },
    { name: 'predicted_latency_ms', def: 'REAL' },
    { name: 'predicted_cost_usd', def: 'REAL' },
    { name: 'predicted_energy_kwh', def: 'REAL' },
    { name: 'predicted_carbon_kgco2eq', def: 'REAL' },
    { name: 'predicted_output_tokens', def: 'INTEGER' },
    { name: 'actual_latency_ms', def: 'REAL' },
    { name: 'actual_cost_usd', def: 'REAL' },
    { name: 'actual_energy_kwh', def: 'REAL' },
    { name: 'actual_carbon_kgco2eq', def: 'REAL' },
    { name: 'actual_input_tokens', def: 'INTEGER' },
    { name: 'actual_output_tokens', def: 'INTEGER' },
    { name: 'verification_pass', def: 'INTEGER' },
    { name: 'verification_probability', def: 'REAL' },
    { name: 'escalation_count', def: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'embedding', def: 'BLOB' },
    { name: 'degraded_routing', def: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'degraded_reason', def: 'TEXT' },
    { name: 'estimated_stale_grid', def: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'needs_reconciliation', def: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'reconciled_carbon_kgco2eq', def: 'REAL' },
    { name: 'completed_at', def: 'INTEGER' },
  ];

  for (const col of columnsToAdd) {
    try {
      db.exec(`ALTER TABLE subtasks ADD COLUMN ${col.name} ${col.def}`);
    } catch {
      // Column already exists
    }
  }

  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN output TEXT`);
  } catch {
    // Column already exists
  }

  // 3. Create indexes after tables and columns are guaranteed to exist
  db.exec(INDEX_SQL);
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
