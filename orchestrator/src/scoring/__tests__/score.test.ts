import { describe, it, expect } from 'vitest';
import {
  fixedNorm,
  scoreCandidate,
  rankCandidates,
  predictCarbonKgco2,
  getEffectiveFloor,
  filterByAccuracyFloor,
} from '../score.js';
import type { ModelEntry, ScoringWeights, NormBounds } from '../../registry/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures — 4 models from config/registry.json
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_SMALL: ModelEntry = {
  model_id: 'llama3.2:3b',
  location: 'local',
  accuracy_tier: 0.55,
  accuracy_tier_source: 'test fixture',
  predicted_latency_ms: 4000,
  predicted_cost_usd_per_1k_tokens: 0.0,
  predicted_energy_kwh_per_1k_tokens: 0.0002,
  cloud_carbon_kgco2eq_per_1k_tokens: null,
};

const LOCAL_MEDIUM: ModelEntry = {
  model_id: 'mistral:7b',
  location: 'local',
  accuracy_tier: 0.65,
  accuracy_tier_source: 'test fixture',
  predicted_latency_ms: 7000,
  predicted_cost_usd_per_1k_tokens: 0.0,
  predicted_energy_kwh_per_1k_tokens: 0.0004,
  cloud_carbon_kgco2eq_per_1k_tokens: null,
};

const CLOUD_SMALL: ModelEntry = {
  model_id: 'gpt-4o-mini',
  location: 'cloud',
  accuracy_tier: 0.72,
  accuracy_tier_source: 'test fixture',
  predicted_latency_ms: 1800,
  predicted_cost_usd_per_1k_tokens: 0.00015,
  predicted_energy_kwh_per_1k_tokens: 0.0,
  cloud_carbon_kgco2eq_per_1k_tokens: 0.00080,
};

const CLOUD_STRONG: ModelEntry = {
  model_id: 'gpt-4o',
  location: 'cloud',
  accuracy_tier: 0.95,
  accuracy_tier_source: 'test fixture',
  predicted_latency_ms: 3500,
  predicted_cost_usd_per_1k_tokens: 0.0025,
  predicted_energy_kwh_per_1k_tokens: 0.0,
  cloud_carbon_kgco2eq_per_1k_tokens: 0.0028,
};

const ALL_CANDIDATES = [LOCAL_SMALL, LOCAL_MEDIUM, CLOUD_SMALL, CLOUD_STRONG];

const DEFAULT_WEIGHTS: ScoringWeights = {
  latency: 0.25,
  accuracy: 0.35,
  cost: 0.15,
  energy: 0.10,
  carbon: 0.15,
};

const HIGH_CARBON_WEIGHTS: ScoringWeights = {
  latency: 0.15,
  accuracy: 0.20,
  cost: 0.10,
  energy: 0.07,
  carbon: 0.48, // boosted — deliberately pushes sum close to 1 with test values
};
// Normalise to exactly 1.0
const sumHC = HIGH_CARBON_WEIGHTS.latency + HIGH_CARBON_WEIGHTS.accuracy +
  HIGH_CARBON_WEIGHTS.cost + HIGH_CARBON_WEIGHTS.energy + HIGH_CARBON_WEIGHTS.carbon;
const HC_WEIGHTS_NORMALIZED: ScoringWeights = {
  latency: HIGH_CARBON_WEIGHTS.latency / sumHC,
  accuracy: HIGH_CARBON_WEIGHTS.accuracy / sumHC,
  cost: HIGH_CARBON_WEIGHTS.cost / sumHC,
  energy: HIGH_CARBON_WEIGHTS.energy / sumHC,
  carbon: HIGH_CARBON_WEIGHTS.carbon / sumHC,
};

// Bounds updated to accommodate realistic cloud carbon values (gpt-4o: 0.0028/1k tokens)
// At 2500 tokens: 0.007 kgCO2. Bound = 1.25 * max = 1.25 * 0.007 = ~0.009
const PROVISIONAL_BOUNDS: NormBounds = {
  latency_ms: 30000,
  cost_usd: 0.02,
  energy_kwh: 0.003,
  carbon_kgco2eq: 0.010, // Updated to handle realistic cloud carbon values
};


const MOCK_GRID_INTENSITY_GCO2_PER_KWH = 650; // IN-KA mock value

const INPUT_TOKENS = 2000; // reference subtask

// ─────────────────────────────────────────────────────────────────────────────
// fixedNorm tests
// ─────────────────────────────────────────────────────────────────────────────

describe('fixedNorm', () => {
  it('returns 0 for value at lower bound', () => {
    expect(fixedNorm(0, 0, 100)).toBe(0);
  });

  it('returns 1 for value at upper bound', () => {
    expect(fixedNorm(100, 0, 100)).toBe(1);
  });

  it('clamps values above upper bound to 1', () => {
    expect(fixedNorm(200, 0, 100)).toBe(1);
  });

  it('clamps values below lower bound to 0', () => {
    expect(fixedNorm(-50, 0, 100)).toBe(0);
  });

  it('returns midpoint for value at midpoint', () => {
    expect(fixedNorm(50, 0, 100)).toBeCloseTo(0.5);
  });

  it('throws if upperBound <= lowerBound', () => {
    expect(() => fixedNorm(50, 100, 50)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Carbon computation invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('predictCarbonKgco2 (Invariant 1)', () => {
  it('cloud carbon uses cloud_carbon_per_1k, never grid intensity', () => {
    const tokens = 1000;
    const result = predictCarbonKgco2(CLOUD_STRONG, tokens, MOCK_GRID_INTENSITY_GCO2_PER_KWH);
    // Expected: 0.00065 * (1000/1000) = 0.00065
    expect(result).toBeCloseTo(0.00065);
  });

  it('local carbon = energy_per_1k * tokens/1000 * grid_intensity_kg', () => {
    const tokens = 1000;
    const gridKg = MOCK_GRID_INTENSITY_GCO2_PER_KWH / 1000; // gCO2 → kgCO2 per kWh
    const expected = LOCAL_SMALL.predicted_energy_kwh_per_1k_tokens * (tokens / 1000) * gridKg;
    const result = predictCarbonKgco2(LOCAL_SMALL, tokens, MOCK_GRID_INTENSITY_GCO2_PER_KWH);
    expect(result).toBeCloseTo(expected);
  });

  it('throws if cloud model has null cloud_carbon field', () => {
    const brokenCloudModel: ModelEntry = { ...CLOUD_STRONG, cloud_carbon_kgco2eq_per_1k_tokens: null };
    expect(() => predictCarbonKgco2(brokenCloudModel, 1000, 650)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreCandidate — accuracy term is candidate-dependent (v2 bug fix)
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreCandidate — accuracy is candidate-dependent', () => {
  it('LOCAL_SMALL has higher accuracy component than CLOUD_STRONG (lower tier → higher penalty)', () => {
    const scoreLocal = scoreCandidate({
      candidate: LOCAL_SMALL,
      inputTokens: INPUT_TOKENS,
      subtaskType: 'classification',
      weights: DEFAULT_WEIGHTS,
      bounds: PROVISIONAL_BOUNDS,
      liveGridIntensityGco2PerKwh: MOCK_GRID_INTENSITY_GCO2_PER_KWH,
    });
    const scoreCloud = scoreCandidate({
      candidate: CLOUD_STRONG,
      inputTokens: INPUT_TOKENS,
      subtaskType: 'classification',
      weights: DEFAULT_WEIGHTS,
      bounds: PROVISIONAL_BOUNDS,
      liveGridIntensityGco2PerKwh: MOCK_GRID_INTENSITY_GCO2_PER_KWH,
    });
    // Local has lower accuracy tier → accuracy component should be higher (worse)
    expect(scoreLocal.components.accuracy).toBeGreaterThan(scoreCloud.components.accuracy);
  });

  it('all four models produce different accuracy components', () => {
    const scores = ALL_CANDIDATES.map((c) =>
      scoreCandidate({
        candidate: c,
        inputTokens: INPUT_TOKENS,
        subtaskType: 'classification',
        weights: DEFAULT_WEIGHTS,
        bounds: PROVISIONAL_BOUNDS,
        liveGridIntensityGco2PerKwh: MOCK_GRID_INTENSITY_GCO2_PER_KWH,
      })
    );
    const accComponents = scores.map((s) => s.components.accuracy);
    // All unique — proves no constant was used
    const unique = new Set(accComponents.map((v) => v.toFixed(6)));
    expect(unique.size).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T1 — Slider flip test (PRD Addendum B)
// Moving w_carbon from 0.15 to a high value must flip at least one subtask
// from cloud to local. The flip is expected between gpt-4o (high cloud carbon)
// and a local candidate (lower measured carbon). 
// Diagnostic: gpt-4o carbon ≈ 0.007 kgCO2 at 2500 tokens; local-medium ≈ 0.0006.
// ─────────────────────────────────────────────────────────────────────────────

describe('T1 — Slider flip', () => {
  function routeAll(weights: ScoringWeights): string[] {
    return ['extraction', 'classification', 'summarization', 'generation'].map((type) => {
      const ranked = rankCandidates({
        candidates: ALL_CANDIDATES,
        inputTokens: INPUT_TOKENS,
        subtaskType: type as 'extraction' | 'classification' | 'summarization' | 'generation',
        urgency: 'normal',
        weights,
        urgencyWeights: DEFAULT_WEIGHTS,
        bounds: PROVISIONAL_BOUNDS,
        liveGridIntensityGco2PerKwh: MOCK_GRID_INTENSITY_GCO2_PER_KWH,
      });
      return ranked[0]!.model_id; // track model not just location
    });
  }

  it('at least one subtask flips from cloud to local when w_carbon is boosted to ~0.48', () => {
    // Default weights: w_carbon = 0.15 — cloud (gpt-4o) wins on accuracy+latency
    const defaultRoutes = routeAll(DEFAULT_WEIGHTS);

    // High-carbon weights normalized to sum=1.0: w_carbon ≈ 0.48
    // With high carbon weight, gpt-4o's large carbon footprint (0.007 kgCO2 at 2500 tokens)
    // is penalized more than local-medium (0.0006 kgCO2), enabling a flip.
    const highCarbonRoutes = routeAll(HC_WEIGHTS_NORMALIZED);

    // A flip: a task that was going to a cloud model now goes to a local one
    const cloudModels = new Set(['gpt-4o-mini', 'gpt-4o']);
    const localModels = new Set(['llama3.2:3b', 'mistral:7b']);
    const flips = defaultRoutes.filter(
      (modelId, i) => cloudModels.has(modelId) && localModels.has(highCarbonRoutes[i]!)
    );

    // At least one flip from cloud → local
    expect(flips.length).toBeGreaterThanOrEqual(1);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// T2 — Jev bounded test
// Removing the Jev bonus must change at most 1 routing decision out of 5
// ─────────────────────────────────────────────────────────────────────────────

describe('T2 — Jev bounded', () => {
  const subtaskTypes: Array<'extraction' | 'classification' | 'summarization' | 'generation' | 'other'> =
    ['extraction', 'classification', 'summarization', 'generation', 'other'];

  function routeWithJev(jevConfidence: number): string[] {
    return subtaskTypes.map((type) => {
      const ranked = rankCandidates({
        candidates: ALL_CANDIDATES,
        inputTokens: INPUT_TOKENS,
        subtaskType: type,
        urgency: 'normal',
        weights: DEFAULT_WEIGHTS,
        urgencyWeights: DEFAULT_WEIGHTS,
        bounds: PROVISIONAL_BOUNDS,
        liveGridIntensityGco2PerKwh: MOCK_GRID_INTENSITY_GCO2_PER_KWH,
        // Jev always prefers the cloud-strong model
        jevChoiceConfidence: { model_id: 'gpt-4o', confidence: jevConfidence },
      });
      return ranked[0]!.model_id;
    });
  }

  it('with Jev bonus removed, no more than 1 routing decision changes', () => {
    const withJev = routeWithJev(0.95);    // full confidence bonus applied
    const withoutJev = routeWithJev(0);    // bonus zeroed out

    const changed = withJev.filter((choice, i) => choice !== withoutJev[i]);
    expect(changed.length).toBeLessThanOrEqual(1);
  });

  it('Jev bonus is bounded to at most 1/3 of smallest active weight', () => {
    const smallestWeight = Math.min(...Object.values(DEFAULT_WEIGHTS));
    const maxBonus = smallestWeight / 3;

    const score = scoreCandidate({
      candidate: CLOUD_STRONG,
      inputTokens: INPUT_TOKENS,
      subtaskType: 'generation',
      weights: DEFAULT_WEIGHTS,
      bounds: PROVISIONAL_BOUNDS,
      liveGridIntensityGco2PerKwh: MOCK_GRID_INTENSITY_GCO2_PER_KWH,
      jevConfidence: 1.0, // maximum possible confidence
    });

    expect(score.components.jev_bonus).toBeLessThanOrEqual(maxBonus + 0.0001);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T4 — Floor check (basic unit test; full integration test in scripts/)
// ─────────────────────────────────────────────────────────────────────────────

describe('T4 — getEffectiveFloor and filterByAccuracyFloor', () => {
  const tierFloors = { trivial: 0.40, low: 0.50, medium: 0.65, high: 0.80, expert: 0.90 };

  it('effective floor is max of tier floor and workflow min', () => {
    expect(getEffectiveFloor('high', 0.0, tierFloors)).toBe(0.80);
    expect(getEffectiveFloor('high', 0.85, tierFloors)).toBe(0.85);
    expect(getEffectiveFloor('trivial', 0.60, tierFloors)).toBe(0.60);
  });

  it('filterByAccuracyFloor correctly splits passing and below', () => {
    const ranked = rankCandidates({
      candidates: ALL_CANDIDATES,
      inputTokens: INPUT_TOKENS,
      subtaskType: 'generation',
      urgency: 'normal',
      weights: DEFAULT_WEIGHTS,
      urgencyWeights: DEFAULT_WEIGHTS,
      bounds: PROVISIONAL_BOUNDS,
      liveGridIntensityGco2PerKwh: MOCK_GRID_INTENSITY_GCO2_PER_KWH,
    });

    // For a 'high' complexity task, floor = 0.80
    // LOCAL_SMALL (0.55), LOCAL_MEDIUM (0.65) → below
    // CLOUD_SMALL (0.72) → below
    // CLOUD_STRONG (0.95) → passing
    const { passing, below } = filterByAccuracyFloor(ranked, ALL_CANDIDATES, 0.80);

    expect(passing.map((s) => s.model_id)).toContain('gpt-4o');
    expect(below.map((s) => s.model_id)).toContain('llama3.2:3b');
    expect(below.map((s) => s.model_id)).toContain('mistral:7b');
    expect(below.map((s) => s.model_id)).toContain('gpt-4o-mini');
  });

  it('all candidates pass for trivial tasks (floor 0.40)', () => {
    const ranked = rankCandidates({
      candidates: ALL_CANDIDATES,
      inputTokens: INPUT_TOKENS,
      subtaskType: 'classification',
      urgency: 'normal',
      weights: DEFAULT_WEIGHTS,
      urgencyWeights: DEFAULT_WEIGHTS,
      bounds: PROVISIONAL_BOUNDS,
      liveGridIntensityGco2PerKwh: MOCK_GRID_INTENSITY_GCO2_PER_KWH,
    });

    const { passing, below } = filterByAccuracyFloor(ranked, ALL_CANDIDATES, 0.40);
    expect(passing.length).toBe(4);
    expect(below.length).toBe(0);
  });
});
