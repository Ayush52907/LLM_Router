#!/usr/bin/env ts-node
/**
 * calibrate_bounds.ts — Computes fixed normalization bounds from the model registry.
 *
 * Rule (PRD Addendum B):
 *   reference_subtask = 2000 input tokens + 500 output tokens = 2500 total
 *   bound_X = 1.25 * max over ALL registry candidates of X at reference_subtask
 *
 * Writes output to config/bounds.json.
 * Run this script whenever the registry is updated or before running T1/T2.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_INPUT_TOKENS = 2000;
const REFERENCE_OUTPUT_TOKENS = 500;
const REFERENCE_TOKENS = REFERENCE_INPUT_TOKENS + REFERENCE_OUTPUT_TOKENS; // 2500

const BOUND_MULTIPLIER = 1.25; // 25% above the max value observed

// Mock grid intensity for calibration (mid-range global estimate)
// Not IN-KA specifically — want a representative value for bounds calibration
const CALIBRATION_GRID_INTENSITY_GCO2_PER_KWH = 500;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RegistryModel {
  model_id: string;
  location: 'cloud' | 'local';
  predicted_latency_ms: number;
  predicted_cost_usd_per_1k_tokens: number;
  predicted_energy_kwh_per_1k_tokens: number;
  cloud_carbon_kgco2eq_per_1k_tokens: number | null;
}

interface BoundsOutput {
  latency_ms: number;
  cost_usd: number;
  energy_kwh: number;
  carbon_kgco2eq: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function calibrate(): void {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const registryPath = path.join(repoRoot, 'config', 'registry.json');
  const boundsPath = path.join(repoRoot, 'config', 'bounds.json');

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as { models: RegistryModel[] };
  const models = registry.models;

  const gridKgPerKwh = CALIBRATION_GRID_INTENSITY_GCO2_PER_KWH / 1000;

  let maxLatencyMs = 0;
  let maxCostUsd = 0;
  let maxEnergyKwh = 0;
  let maxCarbonKgco2 = 0;

  for (const model of models) {
    const tokensFactor = REFERENCE_TOKENS / 1000;

    // Latency
    maxLatencyMs = Math.max(maxLatencyMs, model.predicted_latency_ms);

    // Cost
    const cost = model.predicted_cost_usd_per_1k_tokens * tokensFactor;
    maxCostUsd = Math.max(maxCostUsd, cost);

    // Energy
    const energy = model.predicted_energy_kwh_per_1k_tokens * tokensFactor;
    maxEnergyKwh = Math.max(maxEnergyKwh, energy);

    // Carbon (cloud vs local rule — invariant preserved)
    let carbon: number;
    if (model.location === 'cloud') {
      if (model.cloud_carbon_kgco2eq_per_1k_tokens === null) {
        console.warn(`[calibrate_bounds] Cloud model ${model.model_id} has null carbon field — skipping.`);
        continue;
      }
      carbon = model.cloud_carbon_kgco2eq_per_1k_tokens * tokensFactor;
    } else {
      // Local: energy * grid intensity
      carbon = model.predicted_energy_kwh_per_1k_tokens * tokensFactor * gridKgPerKwh;
    }
    maxCarbonKgco2 = Math.max(maxCarbonKgco2, carbon);
  }

  const bounds: BoundsOutput = {
    latency_ms: Math.round(maxLatencyMs * BOUND_MULTIPLIER),
    cost_usd: parseFloat((maxCostUsd * BOUND_MULTIPLIER).toFixed(6)),
    energy_kwh: parseFloat((maxEnergyKwh * BOUND_MULTIPLIER).toFixed(6)),
    carbon_kgco2eq: parseFloat((maxCarbonKgco2 * BOUND_MULTIPLIER).toFixed(6)),
  };

  const output = {
    _comment: `Computed by calibrate_bounds.ts on ${new Date().toISOString()}. Overwrite by re-running the script.`,
    _reference_subtask: `${REFERENCE_INPUT_TOKENS} input + ${REFERENCE_OUTPUT_TOKENS} output = ${REFERENCE_TOKENS} total tokens`,
    _formula: `bound_X = ${BOUND_MULTIPLIER} * max over ALL registry candidates of X at reference_subtask`,
    _grid_intensity_used: `${CALIBRATION_GRID_INTENSITY_GCO2_PER_KWH} gCO2/kWh (calibration estimate, not IN-KA specific)`,
    ...bounds,
  };

  fs.writeFileSync(boundsPath, JSON.stringify(output, null, 2) + '\n');

  console.log('✅ Bounds written to config/bounds.json:');
  console.log(`   latency_ms:       ${bounds.latency_ms} ms`);
  console.log(`   cost_usd:         ${bounds.cost_usd} USD`);
  console.log(`   energy_kwh:       ${bounds.energy_kwh} kWh`);
  console.log(`   carbon_kgco2eq:   ${bounds.carbon_kgco2eq} kgCO2eq`);
  console.log('');
  console.log('Per-model contributions:');
  for (const model of models) {
    const tokens = REFERENCE_TOKENS / 1000;
    const cost = model.predicted_cost_usd_per_1k_tokens * tokens;
    const energy = model.predicted_energy_kwh_per_1k_tokens * tokens;
    let carbon: number;
    if (model.location === 'cloud' && model.cloud_carbon_kgco2eq_per_1k_tokens !== null) {
      carbon = model.cloud_carbon_kgco2eq_per_1k_tokens * tokens;
    } else if (model.location === 'local') {
      carbon = model.predicted_energy_kwh_per_1k_tokens * tokens * (CALIBRATION_GRID_INTENSITY_GCO2_PER_KWH / 1000);
    } else {
      carbon = 0;
    }
    console.log(
      `   ${model.model_id.padEnd(20)} | lat=${model.predicted_latency_ms}ms | cost=$${cost.toFixed(6)} | energy=${energy.toFixed(6)}kWh | carbon=${carbon.toFixed(6)}kgCO2`
    );
  }
}

calibrate();
