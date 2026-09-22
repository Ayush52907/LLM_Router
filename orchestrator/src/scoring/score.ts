/**
 * Scoring engine — the core routing formula.
 *
 * Formula (PRD §3.3, Addendum B — bug-fixed version):
 *   score(candidate) = w_lat   * fixed_norm(latency_ms,    0, bound_lat)
 *                    + w_acc   * (1 - fixed_norm(accuracy,  0, 1))       ← candidate-dependent
 *                    + w_cost  * fixed_norm(cost_usd,       0, bound_cost)
 *                    + w_energy* fixed_norm(energy_kwh,     0, bound_energy)
 *                    + w_carbon* fixed_norm(carbon_kgco2eq, 0, bound_carbon)
 *                    - jev_confidence * 0.02                              ← if candidate matches Jev choice
 *
 * Lower score = better candidate.
 *
 * Invariants enforced here:
 *   - Bounds are fixed absolute values (Addendum B), never pool min-max.
 *   - Accuracy term is candidate-dependent (v2 bug: it was a constant — fixed).
 *   - Jev bonus is at most 0.02, capped at 1/3 of smallest active weight.
 *   - Carbon for cloud = cloud_carbon_per_1k * tokens / 1000 (NEVER energy * intensity).
 *   - Carbon for local = energy_per_1k * tokens / 1000 * live_grid_intensity.
 */

import type {
  ModelEntry,
  ScoringWeights,
  NormBounds,
  CandidateScore,
  SubtaskType,
  ComplexityTier,
  Urgency,
} from '../registry/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants (PRD Addendum B)
// ─────────────────────────────────────────────────────────────────────────────

/** Jev bonus coefficient. Addendum B overrides PRD §3.3's value of 0.05. */
const JEV_BONUS_COEFFICIENT = 0.02;

/** Accuracy normalization upper bound — always 1.0 (fixed absolute, not pool max). */
const ACCURACY_UPPER_BOUND = 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// fixed_norm — PRD §3.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fixed-bounds normalization. Clamps to [0, 1].
 * Uses absolute bounds from config, NOT pool min-max.
 * Preserves real magnitude differences between candidates and across runs.
 */
export function fixedNorm(value: number, lowerBound: number, upperBound: number): number {
  if (upperBound <= lowerBound) {
    throw new Error(`fixedNorm: upperBound (${upperBound}) must be > lowerBound (${lowerBound})`);
  }
  return Math.min(1, Math.max(0, (value - lowerBound) / (upperBound - lowerBound)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Predicted metric computation (PRD Addendum D)
// ─────────────────────────────────────────────────────────────────────────────

/** Default predicted output tokens per subtask type. Falls back to 'other'. */
const DEFAULT_OUTPUT_TOKENS: Record<SubtaskType, number> = {
  extraction: 150,
  classification: 50,
  summarization: 400,
  generation: 600,
  code: 800,
  other: 300,
};

/**
 * Computes total predicted tokens (input + output) for a subtask.
 * Input tokens are exact; output tokens use per-type default.
 */
export function predictedTokens(
  inputTokens: number,
  subtaskType: SubtaskType,
  tokenDefaults?: Partial<Record<SubtaskType, number>>
): number {
  const outputTokens = tokenDefaults?.[subtaskType] ?? DEFAULT_OUTPUT_TOKENS[subtaskType];
  return inputTokens + outputTokens;
}

/**
 * Computes predicted carbon for a candidate at score time.
 * CRITICAL INVARIANT (PRD §5/6a, Addendum D):
 *   - Cloud: cloud_carbon_per_1k * tokens / 1000  (EcoLogits-derived, no zone lookup)
 *   - Local: energy_per_1k * tokens / 1000 * liveGridIntensityKgCo2PerKwh
 * NEVER apply grid intensity to cloud. NEVER.
 */
export function predictCarbonKgco2(
  candidate: ModelEntry,
  totalTokens: number,
  /** Live grid intensity in gCO2/kWh — required for local candidates, ignored for cloud */
  liveGridIntensityGco2PerKwh: number
): number {
  const tokensFactor = totalTokens / 1000;

  if (candidate.location === 'cloud') {
    // Cloud: EcoLogits-derived carbon rate. No grid intensity applied.
    if (candidate.cloud_carbon_kgco2eq_per_1k_tokens === null) {
      throw new Error(
        `Cloud model ${candidate.model_id} has null cloud_carbon_kgco2eq_per_1k_tokens. ` +
        'Initialize the sidecar to populate this field before scoring.'
      );
    }
    return candidate.cloud_carbon_kgco2eq_per_1k_tokens * tokensFactor;
  } else {
    // Local: measured energy * live grid intensity.
    // Convert gCO2/kWh → kgCO2/kWh by dividing by 1000.
    const gridIntensityKgCo2PerKwh = liveGridIntensityGco2PerKwh / 1000;
    return candidate.predicted_energy_kwh_per_1k_tokens * tokensFactor * gridIntensityKgCo2PerKwh;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// scoreCandidate — the main function (PRD §3.3 + Addendum B)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreInput {
  candidate: ModelEntry;
  inputTokens: number;
  subtaskType: SubtaskType;
  weights: ScoringWeights;
  bounds: NormBounds;
  /** Live grid intensity in gCO2/kWh. Used for local carbon prediction only. */
  liveGridIntensityGco2PerKwh: number;
  /** If this candidate matches Jev's choice, provide Jev's confidence for the bonus. */
  jevConfidence?: number;
  /** Override output token defaults (EMA-updated values from DB). */
  tokenDefaults?: Partial<Record<SubtaskType, number>>;
}

export function scoreCandidate(input: ScoreInput): CandidateScore {
  const {
    candidate,
    inputTokens,
    subtaskType,
    weights,
    bounds,
    liveGridIntensityGco2PerKwh,
    jevConfidence,
    tokenDefaults,
  } = input;

  // ── Compute predicted metrics ──────────────────────────────────────────────

  const tokens = predictedTokens(inputTokens, subtaskType, tokenDefaults);

  const predictedLatencyMs = candidate.predicted_latency_ms;
  const predictedCostUsd =
    candidate.predicted_cost_usd_per_1k_tokens * (tokens / 1000);
  const predictedEnergyKwh =
    candidate.predicted_energy_kwh_per_1k_tokens * (tokens / 1000);
  const predictedCarbonKgco2 = predictCarbonKgco2(
    candidate,
    tokens,
    liveGridIntensityGco2PerKwh
  );

  // ── Normalize each dimension ───────────────────────────────────────────────

  const normLatency = fixedNorm(predictedLatencyMs, 0, bounds.latency_ms);
  // Accuracy: (1 - norm) so that higher accuracy = lower score component (desired)
  // This is candidate-dependent — the v2 bug was using a constant here.
  const normAccuracy = 1 - fixedNorm(candidate.accuracy_tier, 0, ACCURACY_UPPER_BOUND);
  const normCost = fixedNorm(predictedCostUsd, 0, bounds.cost_usd);
  const normEnergy = fixedNorm(predictedEnergyKwh, 0, bounds.energy_kwh);
  const normCarbon = fixedNorm(predictedCarbonKgco2, 0, bounds.carbon_kgco2eq);

  // ── Score components ───────────────────────────────────────────────────────

  const latencyComponent = weights.latency * normLatency;
  const accuracyComponent = weights.accuracy * normAccuracy;
  const costComponent = weights.cost * normCost;
  const energyComponent = weights.energy * normEnergy;
  const carbonComponent = weights.carbon * normCarbon;

  const rawScore =
    latencyComponent + accuracyComponent + costComponent + energyComponent + carbonComponent;

  // ── Jev bonus (Addendum B) ─────────────────────────────────────────────────
  // Bonus is at most 0.02, AND at most 1/3 of the smallest active weight.
  // It is subtracted from score (lower = better) if this candidate matches Jev's choice.

  let jevBonus = 0;
  if (jevConfidence !== undefined && jevConfidence > 0) {
    const smallestWeight = Math.min(
      weights.latency,
      weights.accuracy,
      weights.cost,
      weights.energy,
      weights.carbon
    );
    const maxAllowedBonus = smallestWeight / 3;
    jevBonus = Math.min(jevConfidence * JEV_BONUS_COEFFICIENT, maxAllowedBonus);
  }

  const scoreWithJev = rawScore - jevBonus;

  return {
    model_id: candidate.model_id,
    location: candidate.location,
    raw_score: rawScore,
    score_with_jev: scoreWithJev,
    components: {
      latency: latencyComponent,
      accuracy: accuracyComponent,
      cost: costComponent,
      energy: energyComponent,
      carbon: carbonComponent,
      jev_bonus: jevBonus,
    },
    predicted_latency_ms: predictedLatencyMs,
    predicted_cost_usd: predictedCostUsd,
    predicted_energy_kwh: predictedEnergyKwh,
    predicted_carbon_kgco2eq: predictedCarbonKgco2,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// rankCandidates — scores all candidates, returns sorted (lowest score first)
// ─────────────────────────────────────────────────────────────────────────────

export interface RankInput {
  candidates: ModelEntry[];
  inputTokens: number;
  subtaskType: SubtaskType;
  urgency: Urgency;
  weights: ScoringWeights;
  urgencyWeights: ScoringWeights;
  bounds: NormBounds;
  liveGridIntensityGco2PerKwh: number;
  /** Map from model_id → jev_confidence for models that match Jev's suggestion */
  jevChoiceConfidence?: { model_id: string; confidence: number } | null;
  tokenDefaults?: Partial<Record<SubtaskType, number>>;
}

export function rankCandidates(input: RankInput): CandidateScore[] {
  // Urgency overrides the weight set (PRD §3.3)
  const activeWeights =
    input.urgency === 'urgent' ? input.urgencyWeights : input.weights;

  const scores = input.candidates.map((candidate) => {
    const isJevChoice = input.jevChoiceConfidence?.model_id === candidate.model_id;
    return scoreCandidate({
      candidate,
      inputTokens: input.inputTokens,
      subtaskType: input.subtaskType,
      weights: activeWeights,
      bounds: input.bounds,
      liveGridIntensityGco2PerKwh: input.liveGridIntensityGco2PerKwh,
      jevConfidence: isJevChoice ? input.jevChoiceConfidence?.confidence : undefined,
      tokenDefaults: input.tokenDefaults,
    });
  });

  // Sort ascending — lowest score wins
  return scores.sort((a, b) => a.score_with_jev - b.score_with_jev);
}

// ─────────────────────────────────────────────────────────────────────────────
// getEffectiveFloor — PRD Addendum C
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the effective accuracy floor for a subtask.
 * effective_floor = max(tier_floor, workflow_min_accuracy)
 * Accuracy floor is relaxed LAST, with a logged warning (Invariant 10).
 */
export function getEffectiveFloor(
  tier: ComplexityTier,
  workflowMinAccuracy: number,
  tierFloors: Record<string, number>
): number {
  const tierFloor = tierFloors[tier] ?? 0;
  return Math.max(tierFloor, workflowMinAccuracy);
}

/**
 * Filters candidates that meet the effective accuracy floor.
 * Returns { passing, below } — below is used for relaxation.
 */
export function filterByAccuracyFloor(
  rankedCandidates: CandidateScore[],
  candidates: ModelEntry[],
  effectiveFloor: number
): { passing: CandidateScore[]; below: CandidateScore[] } {
  const candidateMap = new Map(candidates.map((c) => [c.model_id, c]));

  const passing: CandidateScore[] = [];
  const below: CandidateScore[] = [];

  for (const scored of rankedCandidates) {
    const entry = candidateMap.get(scored.model_id);
    if (!entry) continue;
    if (entry.accuracy_tier >= effectiveFloor) {
      passing.push(scored);
    } else {
      below.push(scored);
    }
  }

  return { passing, below };
}
