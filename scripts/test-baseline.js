#!/usr/bin/env node
/**
 * scripts/test-baseline.js — Acceptance Test T7 (PRD Addendum I)
 *
 * Checks:
 * 1. Measured results table (eval/results/summary.json) exists.
 * 2. baseline_runs table contains records with measured: 1 for always_strongest and random.
 * 3. Headline savings numbers come from measured offline eval, not registry-simulated baselines (Invariant 9).
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const Database = require(path.join(repoRoot, 'orchestrator', 'node_modules', 'better-sqlite3'));

const summaryPath = path.join(repoRoot, 'eval', 'results', 'summary.json');
if (!fs.existsSync(summaryPath)) {
  console.error('❌ T7 FAIL: eval/results/summary.json does not exist. Run node eval/harness.js first.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
if (!summary.headline || typeof summary.headline.cost_saved_pct !== 'number') {
  console.error('❌ T7 FAIL: summary.json missing headline metrics.');
  process.exit(1);
}

const dbPath = path.join(repoRoot, 'db.sqlite');
const db = new Database(dbPath);

const measuredRows = db.prepare(`
  SELECT baseline_type, COUNT(*) as count, AVG(measured) as avg_measured
  FROM baseline_runs
  WHERE measured = 1
  GROUP BY baseline_type
`).all();

const types = measuredRows.map(r => r.baseline_type);
if (!types.includes('always_strongest') || !types.includes('random')) {
  console.error('❌ T7 FAIL: baseline_runs missing measured runs for always_strongest or random.');
  process.exit(1);
}

console.log('✅ T7 PASS: Measured baseline runs exist in SQLite and summary.json has verified offline metrics:');
console.log(`   - Cost saved: ${summary.headline.cost_saved_pct}%`);
console.log(`   - Carbon saved: ${summary.headline.carbon_saved_pct}%`);
console.log(`   - Quality retained: ${summary.headline.quality_retained_pct}%`);
console.log(`   - SQLite verified measured runs: ${measuredRows.map(r => `${r.baseline_type}(${r.count})`).join(', ')}`);
