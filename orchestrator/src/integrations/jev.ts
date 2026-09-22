/**
 * Jev integration — interface + live TypeSafe AI implementation + fixture mock.
 *
 * Jev is used for three purposes (PRD §3.2, §5):
 *   1. Routing: which model/location fits this subtask? (choice + score)
 *   2. Verification: is this output acceptable? (boolean)
 *   3. Decomposition skip: does this task need multiple steps? (boolean)
 *
 * Mode controlled by JEV_MODE env var:
 *   "mock"  → deterministic fixture responses (default)
 *   "live"  → calls TypeSafe AI API (TYPESAFE_API_KEY required)
 *
 * Invariant 4: Jev's suggestion is only a small bonus (0.02 * confidence).
 * The scoring formula always makes the final decision.
 */

import type { SubtaskType, ComplexityTier } from '../registry/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface JevRoutingInput {
  subtask_description: string;
  task_type: SubtaskType;
  candidate_models: Array<{ model_id: string; location: 'cloud' | 'local' }>;
  token_count: number;
  sensitivity: string;
}

export interface JevRoutingResult {
  /** model_id of Jev's preferred candidate (bonus only — formula decides) */
  suggested_model_id: string | null;
  /** Confidence of Jev's choice [0, 1] — used as bonus multiplier */
  confidence: number;
  /** Complexity tier assigned by Jev (can only raise decomposer's tier) */
  complexity_tier: ComplexityTier;
}

export interface JevVerificationInput {
  subtask_description: string;
  output: string;
}

export interface JevVerificationResult {
  /** Probability that the output is acceptable */
  probability: number;
}

export interface IJevClient {
  /** Check if a task needs decomposition into multiple subtasks */
  isMultiStep(taskDescription: string): Promise<boolean>;

  /** Get routing suggestion (bonus only, not a decision) */
  evaluateRouting(input: JevRoutingInput): Promise<JevRoutingResult>;

  /** Verify output acceptability */
  verifyOutput(input: JevVerificationInput): Promise<JevVerificationResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock implementation — deterministic fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Mock complexity tiers by subtask type — fixed, predictable for tests */
const MOCK_COMPLEXITY_BY_TYPE: Record<SubtaskType, ComplexityTier> = {
  extraction: 'low',
  classification: 'trivial',
  summarization: 'medium',
  generation: 'medium',
  code: 'high',
  other: 'low',
};

export class MockJevClient implements IJevClient {
  async isMultiStep(taskDescription: string): Promise<boolean> {
    // Simple heuristic: tasks with multiple verbs/commas are multi-step
    const hasManyParts = taskDescription.split(',').length >= 3 || taskDescription.includes(' and ');
    return hasManyParts;
  }

  async evaluateRouting(input: JevRoutingInput): Promise<JevRoutingResult> {
    // Mock: prefer first cloud model with confidence 0.7, or first candidate
    const cloudCandidate = input.candidate_models.find((c) => c.location === 'cloud');
    const suggested = cloudCandidate ?? input.candidate_models[0] ?? null;

    return {
      suggested_model_id: suggested?.model_id ?? null,
      confidence: 0.70, // Fixed confidence for deterministic tests
      complexity_tier: MOCK_COMPLEXITY_BY_TYPE[input.task_type] ?? 'medium',
    };
  }

  async verifyOutput(input: JevVerificationInput): Promise<JevVerificationResult> {
    // Mock: pass verification unless output is empty or very short
    const isSubstantial = input.output.trim().length > 50;
    return { probability: isSubstantial ? 0.85 : 0.30 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live implementation — TypeSafe AI (api.typesafe.ai)
// ─────────────────────────────────────────────────────────────────────────────

/** Maps Jev score position [0,1] → ComplexityTier string (PRD §3.2, OQ-003) */
function scoreToComplexityTier(score: number): ComplexityTier {
  // Jev score type returns fractional position on the rubric [0,1]
  // Map to 5 tiers linearly
  if (score < 0.2) return 'trivial';
  if (score < 0.4) return 'low';
  if (score < 0.6) return 'medium';
  if (score < 0.8) return 'high';
  return 'expert';
}

export class LiveJevClient implements IJevClient {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.typesafe.ai/v1/systemone';

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('TYPESAFE_API_KEY is required for Jev live mode');
    this.apiKey = apiKey;
  }

  async isMultiStep(taskDescription: string): Promise<boolean> {
    try {
      const resp = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'jev-latest',
          state: taskDescription,
          questions: {
            needs_decomposition: {
              type: 'noul',
              instructions: 'Does this task require multiple distinct steps to complete?',
            },
          },
        }),
      });

      if (!resp.ok) {
        throw new Error(`TypeSafe Jev error: ${resp.status} ${await resp.text()}`);
      }

      const data = (await resp.json()) as any;
      const prob = data.answers?.needs_decomposition?.noul ?? 0.5;
      return prob >= 0.5;
    } catch (err) {
      console.warn('[LiveJevClient] isMultiStep error:', err);
      return taskDescription.split(',').length >= 3 || taskDescription.includes(' and ');
    }
  }

  async evaluateRouting(input: JevRoutingInput): Promise<JevRoutingResult> {
    const candidateCriteria: Record<string, string> = {};
    for (const c of input.candidate_models) {
      candidateCriteria[c.model_id] = `${c.model_id} (${c.location})`;
    }

    try {
      const resp = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'jev-latest',
          state: {
            subtask_description: input.subtask_description,
            task_type: input.task_type,
            candidate_models: input.candidate_models,
            token_count: input.token_count,
            sensitivity: input.sensitivity,
          },
          questions: {
            model_choice: {
              type: 'choice',
              instructions: 'Which model/location pair best fits this subtask?',
              criteria: candidateCriteria,
            },
            complexity: {
              type: 'score',
              instructions: 'Rate the complexity of this subtask.',
              criteria: ['trivial', 'low', 'medium', 'high', 'expert'],
            },
          },
        }),
      });

      if (!resp.ok) {
        throw new Error(`TypeSafe Jev routing error: ${resp.status} ${await resp.text()}`);
      }

      const data = (await resp.json()) as any;
      const choiceAnswer = data.answers?.model_choice;
      const complexityAnswer = data.answers?.complexity;

      const suggestedModelId: string | null = choiceAnswer?.choice ?? null;
      const confidence: number = choiceAnswer?.confidence ?? 0.70;

      // Score ranges from 0.0 to 4.0 across the 5 levels
      const rawScore: number = complexityAnswer?.score ?? 2.0;
      const normalizedScore = Math.max(0, Math.min(1, rawScore / 4.0));
      const complexityTier = scoreToComplexityTier(normalizedScore);

      return { suggested_model_id: suggestedModelId, confidence, complexity_tier: complexityTier };
    } catch (err) {
      console.warn('[LiveJevClient] evaluateRouting error:', err);
      return {
        suggested_model_id: input.candidate_models[0]?.model_id ?? null,
        confidence: 0.70,
        complexity_tier: 'medium',
      };
    }
  }

  async verifyOutput(input: JevVerificationInput): Promise<JevVerificationResult> {
    try {
      const resp = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'jev-latest',
          state: {
            subtask: input.subtask_description,
            output: input.output,
          },
          questions: {
            is_acceptable: {
              type: 'noul',
              instructions: 'Is this output acceptable and complete for the given task?',
            },
          },
        }),
      });

      if (!resp.ok) {
        throw new Error(`TypeSafe Jev verify error: ${resp.status} ${await resp.text()}`);
      }

      const data = (await resp.json()) as any;
      const prob: number = data.answers?.is_acceptable?.noul ?? 0.85;
      return { probability: prob };
    } catch (err) {
      console.warn('[LiveJevClient] verifyOutput error:', err);
      const isSubstantial = input.output.trim().length > 50;
      return { probability: isSubstantial ? 0.85 : 0.30 };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createJevClient(): IJevClient {
  const mode = process.env['JEV_MODE'] ?? 'mock';

  if (mode === 'live') {
    const apiKey = process.env['TYPESAFE_API_KEY'];
    if (!apiKey) {
      console.warn(
        '[Jev] JEV_MODE=live but TYPESAFE_API_KEY is not set. ' +
        'Falling back to heuristic mock. Add your key to .env.'
      );
      return new MockJevClient();
    }
    return new LiveJevClient(apiKey);
  }

  return new MockJevClient();
}
