/**
 * Core domain types for the Carbon- and Latency-Aware Agent Workflow Scheduler.
 * All interfaces defined here before implementations. See PRD §4, §5, §10.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums (no magic strings)
// ─────────────────────────────────────────────────────────────────────────────

export type SubtaskType =
  | 'extraction'
  | 'generation'
  | 'classification'
  | 'summarization'
  | 'code'
  | 'other';

export type ComplexityTier = 'trivial' | 'low' | 'medium' | 'high' | 'expert';

export type Urgency = 'urgent' | 'normal';

export type DataSensitivity = 'public' | 'internal' | 'pii';

export type PiiClass = 'raw_pii' | 'redacted_ok';

export type SubtaskStatus =
  | 'queued'
  | 'routing'
  | 'executing'
  | 'verifying'
  | 'done'
  | 'failed';

export type ModelLocation = 'cloud' | 'local';

// ─────────────────────────────────────────────────────────────────────────────
// Model Registry (PRD §5, Addendum D, G)
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelEntry {
  model_id: string;
  location: ModelLocation;
  /** Benchmark-derived quality tier [0, 1]. NEVER presented as measured accuracy. */
  accuracy_tier: number;
  /** e.g. "MMLU-based tier estimate", "manual size-class estimate" */
  accuracy_tier_source: string;
  /** EMA-updated. Includes local cold-start allowance where applicable. */
  predicted_latency_ms: number;
  predicted_cost_usd_per_1k_tokens: number;
  /** EMA-updated. 0 for cloud (carbon comes from EcoLogits, not energy * intensity). */
  predicted_energy_kwh_per_1k_tokens: number;
  /**
   * Cloud-only: EcoLogits-derived carbon per 1k tokens. null for local rows.
   * Invariant: NEVER set for local; NEVER compute energy * zone_intensity for cloud.
   */
  cloud_carbon_kgco2eq_per_1k_tokens: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Constraints (PRD §4 Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowConstraints {
  max_total_latency_ms: number;
  max_total_cost_usd: number;
  /**
   * Per-subtask floor (not an average). Defaults to 0 — tier floor table drives
   * the actual floor via effective_floor = max(tier_floor, workflow_min_accuracy).
   * The old flat 0.6 constant is removed per Addendum C.
   */
  min_accuracy_tier_per_subtask: number;
  max_total_carbon_kgco2eq: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtask (PRD §4 Stage 1, Addendum G)
// ─────────────────────────────────────────────────────────────────────────────

export interface Subtask {
  id: string;
  task_id: string;
  description: string;
  prompt: string;
  output: string | null;
  type: SubtaskType;
  depends_on: string[]; // stored as JSON in SQLite
  input_from: string[]; // stored as JSON in SQLite
  urgency: Urgency;
  data_sensitivity: DataSensitivity;
  pii_class: PiiClass | null;
  redacted_prompt: string | null;
  complexity_tier: ComplexityTier;
  status: SubtaskStatus;
  subtask_budget_allowance_usd: number;
  routed_model: string | null;
  routed_location: ModelLocation | null;
  jev_confidence: number | null;
  predicted_latency_ms: number | null;
  predicted_cost_usd: number | null;
  predicted_energy_kwh: number | null;
  predicted_carbon_kgco2eq: number | null;
  predicted_output_tokens: number | null;
  actual_latency_ms: number | null;
  actual_cost_usd: number | null;
  actual_energy_kwh: number | null;
  actual_carbon_kgco2eq: number | null;
  actual_input_tokens: number | null;
  actual_output_tokens: number | null;
  verification_pass: boolean | null;
  verification_probability: number | null;
  escalation_count: number;
  embedding: Buffer | null;
  degraded_routing?: boolean;
  degraded_reason?: string | null;
  estimated_stale_grid?: boolean;
  needs_reconciliation?: boolean;
  reconciled_carbon_kgco2eq?: number | null;
  created_at: number;
  completed_at: number | null;
}

export interface ReconciliationRecord {
  id: string;
  subtask_id: string;
  task_id: string;
  actual_routed_to: string;
  would_have_routed_to: string;
  match: boolean;
  original_carbon_kgco2eq: number | null;
  reconciled_carbon_kgco2eq: number | null;
  notes: string | null;
  reconciled_at: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring (PRD §3.3, Addendum B)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoringWeights {
  latency: number;
  accuracy: number;
  cost: number;
  energy: number;
  carbon: number;
}

export interface NormBounds {
  latency_ms: number;
  cost_usd: number;
  energy_kwh: number;
  carbon_kgco2eq: number;
}

export interface CandidateScore {
  model_id: string;
  location: ModelLocation;
  raw_score: number;         // lower = better
  score_with_jev: number;    // after jev bonus subtracted
  components: {
    latency: number;
    accuracy: number;
    cost: number;
    energy: number;
    carbon: number;
    jev_bonus: number;
  };
  predicted_latency_ms: number;
  predicted_cost_usd: number;
  predicted_energy_kwh: number;
  predicted_carbon_kgco2eq: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task (PRD §10)
// ─────────────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  raw_input: string;
  urgency: Urgency;
  data_sensitivity: DataSensitivity;
  max_total_latency_ms: number;
  max_total_cost_usd: number;
  min_accuracy_tier_per_subtask: number;
  max_total_carbon_kgco2eq: number;
  running_cost_usd: number;
  running_carbon_kgco2eq: number;
  running_latency_ms: number;
  created_at: number;
  status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escalation (PRD §10)
// ─────────────────────────────────────────────────────────────────────────────

export interface EscalationEvent {
  id: string;
  subtask_id: string;
  reason_code: string;
  from_model: string;
  to_model: string;
  created_at: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Baseline (PRD §6, Addendum E, G)
// ─────────────────────────────────────────────────────────────────────────────

export type BaselineType = 'always_strongest' | 'random';

export interface BaselineRun {
  id: string;
  task_id: string;
  baseline_type: BaselineType;
  total_cost_usd: number;
  total_carbon_kgco2eq: number;
  total_latency_ms: number;
  avg_accuracy_tier: number;
  measured: boolean; // true = real run, false = registry-estimated
  run_index: number;
  quality_score: number | null;
}
