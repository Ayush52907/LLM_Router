/**
 * Constraint engine — budget reservation, accuracy floor, relaxation order.
 *
 * PRD §4 Stage 2, Addendum C.
 *
 * Relaxation order when no candidate satisfies all constraints:
 *   latency → cost → carbon → accuracy (last, logged warning — Invariant 10)
 */

import type { ModelEntry, ComplexityTier, Urgency } from '../registry/types.js';
import type { CandidateScore } from '../registry/types.js';
import { getEffectiveFloor, filterByAccuracyFloor } from '../scoring/score.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tier weights for budget allocation (Addendum C)
// ─────────────────────────────────────────────────────────────────────────────

const TIER_WEIGHTS: Record<ComplexityTier, number> = {
  trivial: 1,
  low: 2,
  medium: 3,
  high: 5,
  expert: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
// Budget allowance (lazy, computed when subtask enters routing)
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetState {
  remaining_cost_usd: number;
  remaining_carbon_kgco2eq: number;
  remaining_latency_ms: number;
}

export interface AllowanceResult {
  allowance_usd: number;
}

/**
 * Computes a subtask's cost allowance lazily when it enters routing.
 * allowance_i = remaining_budget * weight(tier_i) / sum(weight(tier_j) for unrouted j)
 */
export function computeAllowance(
  remainingBudgetUsd: number,
  currentTier: ComplexityTier,
  unroutedTiers: ComplexityTier[]
): number {
  const currentWeight = TIER_WEIGHTS[currentTier];
  const totalWeight = unroutedTiers.reduce((sum, t) => sum + TIER_WEIGHTS[t], 0);

  if (totalWeight === 0) return remainingBudgetUsd;
  return remainingBudgetUsd * (currentWeight / totalWeight);
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraint filtering with relaxation
// ─────────────────────────────────────────────────────────────────────────────

export interface ConstraintFilterInput {
  rankedCandidates: CandidateScore[];
  candidates: ModelEntry[];
  complexityTier: ComplexityTier;
  workflowMinAccuracy: number;
  tierFloors: Record<string, number>;
  budgetState: BudgetState;
  allowanceUsd: number;
  subtaskId: string;
}

export interface ConstraintFilterResult {
  winner: CandidateScore;
  winnerModel: ModelEntry;
  relaxations: string[]; // list of constraints that were relaxed, in order
  warnings: string[];    // logged warnings (Invariant 10)
}

/**
 * Filters candidates through constraints with relaxation order.
 * Relaxation: latency → cost → carbon → accuracy (last, always logged).
 *
 * Invariant 10: accuracy floors are relaxed last, with a logged warning.
 */
export function filterWithRelaxation(input: ConstraintFilterInput): ConstraintFilterResult | null {
  const { rankedCandidates, candidates, complexityTier, workflowMinAccuracy, tierFloors, budgetState, allowanceUsd, subtaskId } = input;

  const candidateMap = new Map(candidates.map((c) => [c.model_id, c]));
  const relaxations: string[] = [];
  const warnings: string[] = [];

  const effectiveFloor = getEffectiveFloor(complexityTier, workflowMinAccuracy, tierFloors);

  // Helper: filter by a constraint predicate
  function filterBudget(
    pool: CandidateScore[],
    predicate: (s: CandidateScore) => boolean
  ): CandidateScore[] {
    return pool.filter(predicate);
  }

  // Start with floor-filtered candidates
  let { passing } = filterByAccuracyFloor(rankedCandidates, candidates, effectiveFloor);

  if (passing.length === 0) {
    // No candidates meet the accuracy floor — this is the last resort
    const warning = `[Invariant 10] Subtask ${subtaskId}: no candidate meets accuracy floor ` +
                    `${effectiveFloor.toFixed(2)} (tier=${complexityTier}). ` +
                    `Relaxing accuracy floor — this MUST be logged and surfaced.`;
    warnings.push(warning);
    console.warn(warning);
    relaxations.push('accuracy');
    passing = [...rankedCandidates]; // use all candidates
  }

  // Apply constraint filters with relaxation order
  // 1. Latency constraint: all subtasks must fit within the remaining budget window
  let pool = filterBudget(passing, (s) => s.predicted_latency_ms <= budgetState.remaining_latency_ms);
  if (pool.length === 0) {
    relaxations.push('latency');
    pool = [...passing];
  }

  // 2. Cost constraint: check allowance first, then shared remaining budget
  let costPool = filterBudget(pool, (s) => s.predicted_cost_usd <= allowanceUsd);
  if (costPool.length === 0) {
    // Try shared remainder (more permissive)
    costPool = filterBudget(pool, (s) => s.predicted_cost_usd <= budgetState.remaining_cost_usd);
  }
  if (costPool.length === 0) {
    relaxations.push('cost');
    costPool = [...pool];
  }
  pool = costPool;

  // 3. Carbon constraint: all subtasks should fit within remaining carbon budget
  let carbonPool = filterBudget(pool, (s) => s.predicted_carbon_kgco2eq <= budgetState.remaining_carbon_kgco2eq);
  if (carbonPool.length === 0) {
    relaxations.push('carbon');
    carbonPool = [...pool];
  }
  pool = carbonPool;

  if (pool.length === 0) return null;

  // Winner is the first (lowest score) passing candidate
  const winner = pool[0]!;
  const winnerModel = candidateMap.get(winner.model_id);
  if (!winnerModel) return null;

  return { winner, winnerModel, relaxations, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// PII filter (PRD §4 Stage 2, Addendum A — Invariant 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters candidate pool to local-only for PII subtasks.
 * Applied BEFORE scoring, unconditionally.
 * Invariant 2: cloud services never see raw PII.
 */
export function filterForPii(candidates: ModelEntry[]): ModelEntry[] {
  return candidates.filter((c) => c.location === 'local');
}

// ─────────────────────────────────────────────────────────────────────────────
// Escalation budget check (PRD §5 Stage 5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if escalating to a higher-tier model would breach the workflow budget.
 * Returns true if escalation is allowed, false if it would breach constraints.
 */
export function canEscalate(
  escalationCostUsd: number,
  escalationCarbonKgco2: number,
  budgetState: BudgetState
): boolean {
  return (
    escalationCostUsd <= budgetState.remaining_cost_usd &&
    escalationCarbonKgco2 <= budgetState.remaining_carbon_kgco2eq
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Complexity tier merge (Addendum C)
// ─────────────────────────────────────────────────────────────────────────────

const TIER_ORDER: ComplexityTier[] = ['trivial', 'low', 'medium', 'high', 'expert'];

/**
 * Jev's complexity can only raise the decomposer's tier, not lower it.
 * tier = max(decomposer_tier, jev_tier)
 */
export function mergeComplexityTier(
  decomposerTier: ComplexityTier,
  jevTier: ComplexityTier
): ComplexityTier {
  const decomposerIdx = TIER_ORDER.indexOf(decomposerTier);
  const jevIdx = TIER_ORDER.indexOf(jevTier);
  return TIER_ORDER[Math.max(decomposerIdx, jevIdx)] ?? decomposerTier;
}
