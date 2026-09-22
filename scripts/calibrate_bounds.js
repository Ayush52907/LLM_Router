#!/usr/bin/env node
/**
 * calibrate_bounds.js — Computes fixed normalization bounds from the model registry.
 * 
 * Plain JS version for compatibility with TypeScript 7 (ts-node incompatible).
 * See scripts/calibrate_bounds.ts for the TS source.
 *
 * Rule (PRD Addendum B):
 *   reference_subtask = 2000 input tokens + 500 output tokens = 2500 total
 *   bound_X = 1.25 * max over ALL registry candidates of X at reference_subtask
 *
 * Usage: node scripts/calibrate_bounds.js
 */

const fs = require('fs');
const path = require('path');

const REFERENCE_TOKENS = 2500;
const BOUND_MULTIPLIER = 1.25;
const CALIBRATION_GRID_INTENSITY_GCO2_PER_KWH = 500;

const repoRoot = path.resolve(__dirname, '..');
const registryPath = path.join(repoRoot, 'config', 'registry.json');
const boundsPath = path.join(repoRoot, 'config', 'bounds.json');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
const models = registry.models;

const gridKgPerKwh = CALIBRATION_GRID_INTENSITY_GCO2_PER_KWH / 1000;

let maxLatencyMs = 0;
let maxCostUsd = 0;
let maxEnergyKwh = 0;
let maxCarbonKgco2 = 0;

for (const model of models) {
  const tokensFactor = REFERENCE_TOKENS / 1000;

  maxLatencyMs = Math.max(maxLatencyMs, model.predicted_latency_ms);
  maxCostUsd = Math.max(maxCostUsd, model.predicted_cost_usd_per_1k_tokens * tokensFactor);
  maxEnergyKwh = Math.max(maxEnergyKwh, model.predicted_energy_kwh_per_1k_tokens * tokensFactor);

  let carbon;
  if (model.location === 'cloud') {
    if (model.cloud_carbon_kgco2eq_per_1k_tokens === null) {
      console.warn(`[calibrate_bounds] Cloud model ${model.model_id} has null carbon — skipping.`);
      continue;
    }
    carbon = model.cloud_carbon_kgco2eq_per_1k_tokens * tokensFactor;
  } else {
    carbon = model.predicted_energy_kwh_per_1k_tokens * tokensFactor * gridKgPerKwh;
  }
  maxCarbonKgco2 = Math.max(maxCarbonKgco2, carbon);
}

const bounds = {
  latency_ms: Math.round(maxLatencyMs * BOUND_MULTIPLIER),
  cost_usd: parseFloat((maxCostUsd * BOUND_MULTIPLIER).toFixed(6)),
  energy_kwh: parseFloat((maxEnergyKwh * BOUND_MULTIPLIER).toFixed(6)),
  carbon_kgco2eq: parseFloat((maxCarbonKgco2 * BOUND_MULTIPLIER).toFixed(6)),
};

const output = {
  _comment: `Computed by calibrate_bounds.js on ${new Date().toISOString()}.`,
  _reference_subtask: `2000 input + 500 output = ${REFERENCE_TOKENS} total tokens`,
  _formula: `bound_X = ${BOUND_MULTIPLIER} * max over ALL registry candidates`,
  _grid_intensity_used: `${CALIBRATION_GRID_INTENSITY_GCO2_PER_KWH} gCO2/kWh (calibration estimate)`,
  ...bounds,
};

fs.writeFileSync(boundsPath, JSON.stringify(output, null, 2) + '\n');

console.log('✅ config/bounds.json updated:');
console.log(JSON.stringify(bounds, null, 2));
