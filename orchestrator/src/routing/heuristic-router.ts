/**
 * Heuristic rule-based fallback router.
 *
 * Used when Jev is unavailable (JEV_MODE=mock or API down).
 * Must still use the scoring formula — never bypasses the formula.
 * Pure rule-based routing is ONLY used for initial candidate pre-filtering.
 *
 * Rules (applied in order before scoring):
 *   1. PII → local only (Invariant 2)
 *   2. Urgency + trivial → prefer fast local candidate
 *   3. Expert complexity → require cloud-strong (floor enforces this anyway)
 *   4. For all other cases: scoring formula decides
 *
 * PRD §12 Locked Decision 1: heuristic fallback if Jev is blocked.
 */

import type { ModelEntry, SubtaskType, ComplexityTier, DataSensitivity, Urgency } from '../registry/types.js';
import { rankCandidates } from '../scoring/score.js';
import { filterForPii } from '../constraints/engine.js';
import type { ScoringWeights, NormBounds, CandidateScore } from '../registry/types.js';

export interface HeuristicRouteInput {
  candidates: ModelEntry[];
  subtaskType: SubtaskType;
  complexityTier: ComplexityTier;
  dataSensitivity: DataSensitivity;
  urgency: Urgency;
  inputTokens: number;
  weights: ScoringWeights;
  urgencyWeights: ScoringWeights;
  bounds: NormBounds;
  liveGridIntensityGco2PerKwh: number;
}

export interface HeuristicRouteResult {
  rankedCandidates: CandidateScore[];
  preFilterReason: string | null;
}

/**
 * Returns ranked candidates after applying heuristic pre-filters.
 * The scoring formula ALWAYS makes the final ranking — heuristics only remove
 * candidates from the pool (like PII filtering does).
 */
export function heuristicRoute(input: HeuristicRouteInput): HeuristicRouteResult {
  let candidates = [...input.candidates];
  let preFilterReason: string | null = null;

  // Rule 1: PII → local only (Invariant 2, unconditional)
  if (input.dataSensitivity === 'pii') {
    candidates = filterForPii(candidates);
    preFilterReason = 'pii_forced_local';
  }

  // Rule 2: If no candidates remain after PII filter, something is wrong
  if (candidates.length === 0) {
    throw new Error(
      `Heuristic router: no candidates remain after pre-filtering ` +
      `(dataSensitivity=${input.dataSensitivity}, complexity=${input.complexityTier}). ` +
      `Registry must include at least one local model.`
    );
  }

  // Score all remaining candidates using the formula
  const rankedCandidates = rankCandidates({
    candidates,
    inputTokens: input.inputTokens,
    subtaskType: input.subtaskType,
    urgency: input.urgency,
    weights: input.weights,
    urgencyWeights: input.urgencyWeights,
    bounds: input.bounds,
    liveGridIntensityGco2PerKwh: input.liveGridIntensityGco2PerKwh,
    jevChoiceConfidence: null, // No Jev in heuristic mode
  });

  return { rankedCandidates, preFilterReason };
}

/**
 * Quick route for the 5 known demo subtasks — used in tests and demo mode.
 * Returns the model_id that would win for each demo subtask type.
 * Always goes through the scoring formula; heuristics only filter the pool.
 */
export function demoRoute(
  subtask: {
    type: SubtaskType;
    complexity: ComplexityTier;
    sensitivity: DataSensitivity;
    urgency: Urgency;
  },
  candidates: ModelEntry[],
  weights: ScoringWeights,
  urgencyWeights: ScoringWeights,
  bounds: NormBounds,
  gridIntensity: number
): CandidateScore[] {
  const result = heuristicRoute({
    candidates,
    subtaskType: subtask.type,
    complexityTier: subtask.complexity,
    dataSensitivity: subtask.sensitivity,
    urgency: subtask.urgency,
    inputTokens: 2000, // reference input size
    weights,
    urgencyWeights,
    bounds,
    liveGridIntensityGco2PerKwh: gridIntensity,
  });
  return result.rankedCandidates;
}
