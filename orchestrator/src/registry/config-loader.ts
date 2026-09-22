import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import type { ModelEntry, ScoringWeights, NormBounds } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas — validation errors throw on bad config values
// ─────────────────────────────────────────────────────────────────────────────

const ModelEntrySchema = z.object({
  model_id: z.string().min(1),
  location: z.enum(['cloud', 'local']),
  accuracy_tier: z.number().min(0).max(1),
  accuracy_tier_source: z.string().min(1),
  predicted_latency_ms: z.number().positive(),
  predicted_cost_usd_per_1k_tokens: z.number().min(0),
  predicted_energy_kwh_per_1k_tokens: z.number().min(0),
  cloud_carbon_kgco2eq_per_1k_tokens: z.number().positive().nullable(),
});

const RegistrySchema = z.object({
  models: z.array(ModelEntrySchema).min(1),
});

const WeightsSchema = z.object({
  latency: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  cost: z.number().min(0).max(1),
  energy: z.number().min(0).max(1),
  carbon: z.number().min(0).max(1),
  _urgency_override: z.object({
    latency: z.number().min(0).max(1),
    accuracy: z.number().min(0).max(1),
    cost: z.number().min(0).max(1),
    energy: z.number().min(0).max(1),
    carbon: z.number().min(0).max(1),
  }).optional(),
}).refine(
  (w) => Math.abs(w.latency + w.accuracy + w.cost + w.energy + w.carbon - 1.0) < 0.001,
  { message: 'Default weights must sum to 1.0' }
);

const BoundsSchema = z.object({
  latency_ms: z.number().positive(),
  cost_usd: z.number().positive(),
  energy_kwh: z.number().positive(),
  carbon_kgco2eq: z.number().positive(),
});

const TierFloorsSchema = z.object({
  trivial: z.number().min(0).max(1),
  low: z.number().min(0).max(1),
  medium: z.number().min(0).max(1),
  high: z.number().min(0).max(1),
  expert: z.number().min(0).max(1),
});

const TokenDefaultsSchema = z.object({
  extraction: z.number().int().positive(),
  classification: z.number().int().positive(),
  summarization: z.number().int().positive(),
  generation: z.number().int().positive(),
  code: z.number().int().positive(),
  other: z.number().int().positive(),
  _ema_alpha: z.number().min(0).max(1),
});

const ZonesSchema = z.object({
  local_zone: z.string().min(1),
  local_zone_label: z.string(),
  _mock_intensity_gco2_per_kwh: z.number().positive(),
  _time_shift_threshold_pct: z.number().positive(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Config loader — reads from config/ relative to repo root
// ─────────────────────────────────────────────────────────────────────────────

function loadJson(relativePath: string): unknown {
  // Find repo root by looking for config/ dir upwards
  let currentDir = __dirname;
  let repoRoot = currentDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(currentDir, 'config', 'registry.json'))) {
      repoRoot = currentDir;
      break;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  const absPath = path.join(repoRoot, relativePath);
  const raw = fs.readFileSync(absPath, 'utf-8');
  // Strip _comment fields before parsing (json doesn't support comments)
  return JSON.parse(raw);
}

// Strip _comment keys (used for inline comments in JSON)
function stripCommentKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !k.startsWith('_comment'))
  );
}

export interface AppConfig {
  models: ModelEntry[];
  weights: ScoringWeights;
  urgencyWeights: ScoringWeights;
  bounds: NormBounds;
  tierFloors: Record<string, number>;
  tokenDefaults: Record<string, number>;
  emaAlpha: number;
  localZone: string;
  mockGridIntensityGco2PerKwh: number;
  timeShiftThresholdPct: number;
}

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_config) return _config;

  const registryRaw = loadJson('config/registry.json') as { models: unknown[] };
  const registry = RegistrySchema.parse(registryRaw);

  const weightsRaw = loadJson('config/weights.json') as Record<string, unknown>;
  const weightsClean = stripCommentKeys(weightsRaw);
  const weights = WeightsSchema.parse(weightsClean);

  const boundsRaw = loadJson('config/bounds.json') as Record<string, unknown>;
  const boundsClean = stripCommentKeys(boundsRaw);
  const bounds = BoundsSchema.parse(boundsClean);

  const floorsRaw = loadJson('config/tier-floors.json') as Record<string, unknown>;
  const floorsClean = stripCommentKeys(floorsRaw);
  const tierFloors = TierFloorsSchema.parse(floorsClean);

  const tokenRaw = loadJson('config/token-defaults.json') as Record<string, unknown>;
  const tokenClean = stripCommentKeys(tokenRaw);
  const tokenDefaults = TokenDefaultsSchema.parse(tokenClean);

  const zonesRaw = loadJson('config/zones.json') as Record<string, unknown>;
  const zonesClean = stripCommentKeys(zonesRaw);
  const zones = ZonesSchema.parse(zonesClean);

  _config = {
    models: registry.models as ModelEntry[],
    weights: {
      latency: weights.latency,
      accuracy: weights.accuracy,
      cost: weights.cost,
      energy: weights.energy,
      carbon: weights.carbon,
    },
    urgencyWeights: weights._urgency_override ?? {
      latency: 0.50,
      accuracy: 0.25,
      cost: 0.10,
      energy: 0.075,
      carbon: 0.075,
    },
    bounds: {
      latency_ms: bounds.latency_ms,
      cost_usd: bounds.cost_usd,
      energy_kwh: bounds.energy_kwh,
      carbon_kgco2eq: bounds.carbon_kgco2eq,
    },
    tierFloors: {
      trivial: tierFloors.trivial,
      low: tierFloors.low,
      medium: tierFloors.medium,
      high: tierFloors.high,
      expert: tierFloors.expert,
    },
    tokenDefaults: {
      extraction: tokenDefaults.extraction,
      classification: tokenDefaults.classification,
      summarization: tokenDefaults.summarization,
      generation: tokenDefaults.generation,
      code: tokenDefaults.code,
      other: tokenDefaults.other,
    },
    emaAlpha: tokenDefaults._ema_alpha,
    localZone: zones.local_zone,
    mockGridIntensityGco2PerKwh: zones._mock_intensity_gco2_per_kwh,
    timeShiftThresholdPct: zones._time_shift_threshold_pct,
  };

  return _config;
}

/** Reset config cache (for tests that need to reload) */
export function resetConfigCache(): void {
  _config = null;
}
