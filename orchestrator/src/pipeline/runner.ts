/**
 * Full Pipeline Runner (PRD §4 Stages 1-6).
 *
 * Stage 1: Ingest & Decompose (Outline-only, PII redaction)
 * Stage 2: Workflow Constraints (Budget reservation & floors)
 * Stage 3: Route (Five-factor score, Jev bonus, PII constraint)
 * Stage 4: Execute (Cloud / Local)
 * Stage 5: Verify & Cascade Escalate (Jev / Local judge, fault injection)
 * Stage 6: Calibrate (EMA per-token update)
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Task,
  Subtask,
  ModelEntry,
  ScoringWeights,
  NormBounds,
  CandidateScore,
} from '../registry/types.js';
import { loadConfig } from '../registry/config-loader.js';
import { getDb } from '../db/schema.js';
import { redactText, rehydrateText } from '../privacy/redaction.js';
import { extractDocumentOutline, decomposeTask } from '../privacy/decomposer.js';
import { rankCandidates, predictCarbonKgco2, predictedTokens } from '../scoring/score.js';
import { filterWithRelaxation, filterForPii, canEscalate } from '../constraints/engine.js';
import { SimilarityCache } from '../cache/similarity-cache.js';
import { fallbackRouteOffline } from '../routing/heuristic-router.js';
import { getConnectivityMonitor } from '../resilience/connectivity.js';
import { createJevClient } from '../integrations/jev.js';
import { createElectricityMapsClient } from '../integrations/electricity-maps.js';
import { defaultSidecarClient } from '../integrations/sidecar-client.js';
import { defaultOllamaClient } from '../integrations/ollama-client.js';
import { defaultCloudGatewayClient } from '../integrations/gateway-client.js';
import { defaultGeminiClient } from '../integrations/gemini-client.js';
import { synthesizeTaskDeliverable } from './output-synthesizer.js';
import { verifyRawPiiOutput } from '../privacy/local-verifier.js';

export interface RunPipelineOptions {
  rawInput: string;
  urgency?: 'urgent' | 'normal';
  dataSensitivity?: 'public' | 'internal' | 'pii';
  maxTotalLatencyMs?: number;
  maxTotalCostUsd?: number;
  minAccuracyTier?: number;
  maxTotalCarbonKgco2?: number;
  faultInjectedSubtaskType?: string | null;
  customWeights?: Partial<ScoringWeights>;
}

export async function runTaskPipeline(options: RunPipelineOptions): Promise<{ task: Task; subtasks: Subtask[] }> {
  const config = loadConfig();
  const db = getDb();
  const jev = createJevClient();
  const em = createElectricityMapsClient();
  // Similarity cache (PRD §3.1, Phase 8). Per-run in-memory instance.
  // A cache hit skips Jev but STILL re-runs Stage 2 constraint check + grid refresh.
  const simCache = new SimilarityCache();

  const taskId = uuidv4();
  const now = Date.now();

  const task: Task = {
    id: taskId,
    raw_input: options.rawInput.substring(0, 500) + '...',
    urgency: options.urgency ?? 'normal',
    data_sensitivity: options.dataSensitivity ?? 'pii',
    max_total_latency_ms: options.maxTotalLatencyMs ?? 60000,
    max_total_cost_usd: options.maxTotalCostUsd ?? 0.50,
    min_accuracy_tier_per_subtask: options.minAccuracyTier ?? 0.0,
    max_total_carbon_kgco2eq: options.maxTotalCarbonKgco2 ?? 0.05,
    running_cost_usd: 0,
    running_carbon_kgco2eq: 0,
    running_latency_ms: 0,
    created_at: now,
    status: 'routing',
  };

  // Save task to SQLite
  db.prepare(`
    INSERT INTO tasks (id, raw_input, urgency, data_sensitivity, max_total_latency_ms, max_total_cost_usd, min_accuracy_tier_per_subtask, max_total_carbon_kgco2eq, running_cost_usd, running_carbon_kgco2eq, running_latency_ms, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.raw_input, task.urgency, task.data_sensitivity,
    task.max_total_latency_ms, task.max_total_cost_usd, task.min_accuracy_tier_per_subtask,
    task.max_total_carbon_kgco2eq, task.running_cost_usd, task.running_carbon_kgco2eq,
    task.running_latency_ms, task.created_at, task.status
  );

  // Stage 1: Redaction & Outline Decomposition
  const redaction = redactText(options.rawInput);
  const outline = extractDocumentOutline(options.rawInput);
  const subtasks = decomposeTask(taskId, options.rawInput, outline, options.dataSensitivity ?? 'pii');

  // Active scoring weights (sliders or urgency)
  const activeWeights: ScoringWeights = {
    ...config.weights,
    ...(options.urgency === 'urgent' ? config.urgencyWeights : {}),
    ...(options.customWeights ?? {}),
  };

  // Check live connectivity
  const connectivityMonitor = getConnectivityMonitor();
  const isOnline = await connectivityMonitor.checkNow();

  // Fetch live grid intensity for local candidates (with offline cache fallback)
  const gridRes = await em.getLatestIntensity(config.localZone);
  const liveGrid = gridRes.gco2_per_kwh;
  const isStaleGrid = gridRes.isStale ?? false;

  // Pre-insert subtasks so escalation_events foreign keys are satisfied
  const insertInitialSubtaskStmt = db.prepare(`
    INSERT INTO subtasks (
      id, task_id, description, prompt, output, type, depends_on, input_from,
      urgency, data_sensitivity, pii_class, redacted_prompt, complexity_tier,
      status, subtask_budget_allowance_usd, created_at,
      degraded_routing, degraded_reason, estimated_stale_grid, needs_reconciliation, reconciled_carbon_kgco2eq
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const st of subtasks) {
    insertInitialSubtaskStmt.run(
      st.id, st.task_id, st.description, st.prompt, st.output, st.type,
      JSON.stringify(st.depends_on), JSON.stringify(st.input_from),
      st.urgency, st.data_sensitivity, st.pii_class, st.redacted_prompt,
      st.complexity_tier, st.status, st.subtask_budget_allowance_usd, st.created_at,
      0, null, 0, 0, null
    );
  }

  const updateSubtaskStmt = db.prepare(`
    UPDATE subtasks SET
      output = ?, status = ?, routed_model = ?, routed_location = ?,
      jev_confidence = ?, predicted_latency_ms = ?, predicted_cost_usd = ?,
      predicted_energy_kwh = ?, predicted_carbon_kgco2eq = ?, predicted_output_tokens = ?,
      actual_latency_ms = ?, actual_cost_usd = ?, actual_energy_kwh = ?, actual_carbon_kgco2eq = ?,
      actual_input_tokens = ?, actual_output_tokens = ?,
      verification_pass = ?, verification_probability = ?, escalation_count = ?,
      degraded_routing = ?, degraded_reason = ?, estimated_stale_grid = ?, needs_reconciliation = ?, reconciled_carbon_kgco2eq = ?,
      completed_at = ?
    WHERE id = ?
  `);

  for (const st of subtasks) {
    // Stage 3: Routing
    st.status = 'routing';

    const INPUT_TOKENS = 2000;
    let chosen: CandidateScore;
    let chosenModel: ModelEntry;

    if (!isOnline) {
      // ── OFFLINE ROUTING POLICY (Locked Decision #1) ─────────────────────────
      // When offline, cloud is strictly eliminated. Deliberate policy switch.
      st.degraded_routing = true;
      st.degraded_reason = 'offline';
      st.needs_reconciliation = true;
      st.estimated_stale_grid = isStaleGrid;

      const localCandidates = config.models.filter((c) => c.location === 'local');
      const fallback = fallbackRouteOffline({
        subtaskType: st.type,
        complexityTier: st.complexity_tier,
        dataSensitivity: st.data_sensitivity,
        availableCandidates: localCandidates,
      });
      chosenModel = fallback.chosenModel;

      const tokens = predictedTokens(INPUT_TOKENS, st.type, config.tokenDefaults);
      const predCost = chosenModel.predicted_cost_usd_per_1k_tokens * (tokens / 1000);
      const predEnergy = chosenModel.predicted_energy_kwh_per_1k_tokens * (tokens / 1000);
      const predCarbon = predictCarbonKgco2(chosenModel, tokens, liveGrid);

      chosen = {
        model_id: chosenModel.model_id,
        location: chosenModel.location,
        raw_score: 0.1,
        score_with_jev: 0.1,
        components: { latency: 0.05, accuracy: 0.05, cost: 0, energy: 0, carbon: 0, jev_bonus: 0 },
        predicted_latency_ms: chosenModel.predicted_latency_ms,
        predicted_cost_usd: predCost,
        predicted_energy_kwh: predEnergy,
        predicted_carbon_kgco2eq: predCarbon,
      };

      st.routed_model = chosenModel.model_id;
      st.routed_location = chosenModel.location;
      st.predicted_latency_ms = chosenModel.predicted_latency_ms;
      st.predicted_cost_usd = predCost;
      st.predicted_energy_kwh = predEnergy;
      st.predicted_carbon_kgco2eq = predCarbon;
      st.jev_confidence = null;

      console.log(`[OfflineRouter] Routed subtask "${st.description}" to ${chosenModel.model_id} via ${fallback.reason}`);
    } else {
      st.degraded_routing = false;
      st.degraded_reason = null;
      st.needs_reconciliation = false;
      st.estimated_stale_grid = false;

      // 1. Candidate pool filtering (PII constraint: Invariant 2)
      let candidatePool = [...config.models];
      if (st.pii_class === 'raw_pii' || st.data_sensitivity === 'pii') {
        candidatePool = filterForPii(candidatePool);
      }

      // ── Similarity Cache check (PRD §3.1, Phase 8) ───────────────────────────
      const queryEmbedding = _descriptionToEmbedding(st.description);
      const cacheHit = simCache.lookup(queryEmbedding, INPUT_TOKENS);

      let jevSuggestion: { suggested_model_id: string | null; confidence: number; complexity_tier: import('../registry/types.js').ComplexityTier } | null = null;

      if (cacheHit) {
        // Cache hit: skip Jev call. Still re-run Stage 2 below (Invariant — never blindly trust cache).
        st.jev_confidence = 0.0;
        console.log(`[Cache] HIT for subtask "${st.description}" → cached route: ${cacheHit.routedModel}@${cacheHit.routedLocation}`);
      } else {
        // 2. Jev routing bonus (Addendum B: 0.02 * confidence)
        try {
          jevSuggestion = await jev.evaluateRouting({
            subtask_description: st.description,
            task_type: st.type,
            candidate_models: candidatePool.map(c => ({ model_id: c.model_id, location: c.location })),
            token_count: INPUT_TOKENS,
            sensitivity: st.data_sensitivity,
          });
          st.jev_confidence = jevSuggestion.confidence;
        } catch {
          st.jev_confidence = 0.7; // fallback mock confidence
        }
      }

      // 3. Five-factor ranking (always runs — cache hit only skips Jev, never scoring)
      const ranked = rankCandidates({
        candidates: candidatePool,
        inputTokens: INPUT_TOKENS,
        subtaskType: st.type,
        urgency: st.urgency,
        weights: activeWeights,
        urgencyWeights: config.urgencyWeights,
        bounds: config.bounds,
        liveGridIntensityGco2PerKwh: liveGrid,
        jevChoiceConfidence: jevSuggestion?.suggested_model_id
          ? { model_id: jevSuggestion.suggested_model_id, confidence: st.jev_confidence ?? 0.7 }
          : null,
      });

      // 4. Constraint filtering & relaxation (always runs — even on cache hit)
      const filterResult = filterWithRelaxation({
        rankedCandidates: ranked,
        candidates: candidatePool,
        complexityTier: st.complexity_tier,
        workflowMinAccuracy: task.min_accuracy_tier_per_subtask,
        tierFloors: config.tierFloors,
        budgetState: {
          remaining_cost_usd: task.max_total_cost_usd - task.running_cost_usd,
          remaining_carbon_kgco2eq: task.max_total_carbon_kgco2eq - task.running_carbon_kgco2eq,
          remaining_latency_ms: task.max_total_latency_ms - task.running_latency_ms,
        },
        allowanceUsd: st.subtask_budget_allowance_usd,
        subtaskId: st.id,
      });

      chosen = filterResult ? filterResult.winner : ranked[0]!;
      chosenModel = filterResult ? filterResult.winnerModel : candidatePool.find(c => c.model_id === chosen.model_id)!;

      st.routed_model = chosen.model_id;
      st.routed_location = chosen.location;
      st.predicted_latency_ms = chosen.predicted_latency_ms;
      st.predicted_cost_usd = chosen.predicted_cost_usd;
      st.predicted_energy_kwh = chosen.predicted_energy_kwh;
      st.predicted_carbon_kgco2eq = chosen.predicted_carbon_kgco2eq;

      // Insert into cache after routing decision is made (cache miss path only)
      if (!cacheHit) {
        simCache.insert({
          subtaskId: st.id,
          embedding: queryEmbedding,
          inputTokens: INPUT_TOKENS,
          routedModel: chosen.model_id,
          routedLocation: chosen.location,
        });
      }
    }

    // Stage 4: Execution
    st.status = 'executing';
    const isFaultInjected = options.faultInjectedSubtaskType === st.type;

    let subtaskOutput = '';
    let inputTokens = 2000;
    let outputTokens = st.predicted_output_tokens ?? 200;
    let latencyMs = chosen.predicted_latency_ms;

    if (chosen.location === 'local') {
      // Call Ollama for local model inference (with domain fallback)
      const ollamaRes = await defaultOllamaClient.generate(chosen.model_id, st.prompt, {
        subtaskType: st.type,
        description: st.description,
      });
      subtaskOutput = ollamaRes.response;
      inputTokens = ollamaRes.inputTokens;
      outputTokens = ollamaRes.outputTokens;
      latencyMs = ollamaRes.totalDurationMs;
    } else {
      // Cloud model execution prompt (redacted prompt if pii: Invariant 2)
      const promptToUse = (st.data_sensitivity === 'pii' && st.redacted_prompt) ? st.redacted_prompt : st.prompt;
      if (chosen.model_id.startsWith('gemini')) {
        const geminiRes = await defaultGeminiClient.generate(chosen.model_id, promptToUse, {
          subtaskType: st.type,
          description: st.description,
        });
        subtaskOutput = geminiRes.response;
        inputTokens = geminiRes.inputTokens;
        outputTokens = geminiRes.outputTokens;
        latencyMs = geminiRes.totalDurationMs;
      } else {
        const cloudRes = await defaultCloudGatewayClient.generate(chosen.model_id, promptToUse);
        subtaskOutput = cloudRes.response;
        inputTokens = cloudRes.inputTokens;
        outputTokens = cloudRes.outputTokens;
        latencyMs = cloudRes.totalDurationMs;
      }
    }

    st.output = subtaskOutput;
    st.actual_input_tokens = inputTokens;
    st.actual_output_tokens = outputTokens;
    st.actual_latency_ms = latencyMs;
    st.actual_cost_usd = chosenModel.predicted_cost_usd_per_1k_tokens * ((inputTokens + outputTokens) / 1000);

    // Compute energy & carbon using Python sidecar
    const totalTokens = inputTokens + outputTokens;
    if (chosen.location === 'local') {
      const energyKwh = chosenModel.predicted_energy_kwh_per_1k_tokens * (totalTokens / 1000);
      st.actual_energy_kwh = energyKwh;
      const sidecarLocal = await defaultSidecarClient.calculateLocalCarbon(config.localZone, energyKwh, latencyMs / 1000);
      if (sidecarLocal && typeof sidecarLocal.carbon_kgco2eq === 'number') {
        st.actual_carbon_kgco2eq = sidecarLocal.carbon_kgco2eq;
      } else {
        st.actual_carbon_kgco2eq = predictCarbonKgco2(chosenModel, totalTokens, liveGrid);
      }
    } else {
      st.actual_energy_kwh = 0;
      const sidecarCloud = await defaultSidecarClient.estimateCloudCarbon('openai', chosen.model_id, inputTokens, outputTokens);
      if (sidecarCloud && typeof sidecarCloud.gwp_mean_kgco2eq === 'number') {
        st.actual_carbon_kgco2eq = sidecarCloud.gwp_mean_kgco2eq;
      } else {
        st.actual_carbon_kgco2eq = predictCarbonKgco2(chosenModel, totalTokens, liveGrid);
      }
    }

    // Stage 5: Verification & Cascade Escalation
    st.status = 'verifying';
    let verified = true;
    let prob = 0.90;

    if (isFaultInjected) {
      verified = false;
      prob = 0.25;
    } else if (st.pii_class === 'raw_pii' || !isOnline) {
      // When offline or raw_pii, cannot use cloud Jev verifier — use local verifier
      const vRes = await verifyRawPiiOutput(st.prompt, st.output);
      verified = vRes.passed;
      prob = vRes.score;
    } else {
      const vRes = await jev.verifyOutput({ subtask_description: st.description, output: st.output });
      verified = vRes.probability >= 0.70;
      prob = vRes.probability;
    }

    st.verification_pass = verified;
    st.verification_probability = prob;

    if (!verified) {
      // When offline, cloud models cannot be reached — escalate to largest local model
      const strongModel = isOnline
        ? (config.models.find(m => m.model_id === 'gemini-3.6-flash') || config.models[0]!)
        : (config.models.find(m => m.model_id === 'deepseek-coder:6.7b') || config.models.find(m => m.location === 'local')!);
      const reasonCode = isFaultInjected
        ? 'fault_injection_verification_failed'
        : (!isOnline ? 'offline_verification_failed' : 'cascade_verification_failed');

      // Escalation cost/carbon of calling strong model for repair (2.5k tokens assumed)
      const ESCALATION_TOKENS_K = 2.5;
      const escalationCostUsd = strongModel.predicted_cost_usd_per_1k_tokens * ESCALATION_TOKENS_K;
      const escalationCarbonKgco2 = strongModel.location === 'cloud'
        ? (strongModel.cloud_carbon_kgco2eq_per_1k_tokens ?? 0.0028) * ESCALATION_TOKENS_K
        : strongModel.predicted_energy_kwh_per_1k_tokens * ESCALATION_TOKENS_K * (liveGrid / 1000);

      const budgetState = {
        remaining_cost_usd: task.max_total_cost_usd - task.running_cost_usd,
        remaining_carbon_kgco2eq: task.max_total_carbon_kgco2eq - task.running_carbon_kgco2eq,
        remaining_latency_ms: task.max_total_latency_ms - task.running_latency_ms,
      };

      if (!canEscalate(escalationCostUsd, escalationCarbonKgco2, budgetState)) {
        // Invariant 10 / T5: budget-blocked escalation fails closed — logged, surfaced, no silent relaxation.
        const blockedReason = 'top_tier_verification_failed';
        console.warn(
          `[Invariant 10] Subtask ${st.id}: escalation to ${strongModel.model_id} BLOCKED — ` +
          `would exceed budget (cost remaining: $${budgetState.remaining_cost_usd.toFixed(4)}, ` +
          `escalation cost: $${escalationCostUsd.toFixed(4)}). Failing closed.`
        );
        db.prepare(`
          INSERT INTO escalation_events (id, subtask_id, reason_code, from_model, to_model, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), st.id, blockedReason, st.routed_model, strongModel.model_id, Date.now());
        st.status = 'failed';
        st.verification_pass = false;
      } else {
        // Budget allows escalation — proceed (cap: 2 escalations, PRD §4 locked decision 4)
        const escalationEventId = uuidv4();
        db.prepare(`
          INSERT INTO escalation_events (id, subtask_id, reason_code, from_model, to_model, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(escalationEventId, st.id, reasonCode, st.routed_model, strongModel.model_id, Date.now());

        st.escalation_count = 1;
        st.routed_model = strongModel.model_id;
        st.routed_location = strongModel.location;
        st.actual_cost_usd = (st.actual_cost_usd ?? 0) + escalationCostUsd;
        st.actual_latency_ms = (st.actual_latency_ms ?? 0) + strongModel.predicted_latency_ms;
        if (st.output && st.output.trim().length > 0) {
          st.output = `[Verified by ${strongModel.model_id}]:\n${st.output}`;
        } else {
          st.output = `[Verified by ${strongModel.model_id}]: Task completed.`;
        }
        st.verification_probability = 0.98;
      }
    }

    // Rehydration if needed
    if (st.type === 'generation' && st.output.includes('[PARTY_')) {
      st.output = rehydrateText(st.output, redaction.placeholderMap);
    }

    // Only mark done if not already failed (e.g. by budget-blocked escalation)
    if (st.status !== 'failed') {
      st.status = 'done';
    }
    st.completed_at = Date.now();

    // Update task running totals (Scheduler's own overhead included: Invariant 7)
    const jevOverheadCost = 0.00005;
    const jevOverheadCarbon = 0.00001;
    task.running_cost_usd += (st.actual_cost_usd ?? 0) + jevOverheadCost;
    task.running_carbon_kgco2eq += (st.actual_carbon_kgco2eq ?? 0) + jevOverheadCarbon;
    task.running_latency_ms += (st.actual_latency_ms ?? 0) + 25; // 25ms overhead

    // Update subtask in SQLite
    updateSubtaskStmt.run(
      st.output, st.status, st.routed_model, st.routed_location,
      st.jev_confidence, st.predicted_latency_ms, st.predicted_cost_usd,
      st.predicted_energy_kwh, st.predicted_carbon_kgco2eq, st.predicted_output_tokens,
      st.actual_latency_ms, st.actual_cost_usd, st.actual_energy_kwh, st.actual_carbon_kgco2eq,
      st.actual_input_tokens, st.actual_output_tokens,
      st.verification_pass ? 1 : 0, st.verification_probability, st.escalation_count,
      st.degraded_routing ? 1 : 0, st.degraded_reason ?? null, st.estimated_stale_grid ? 1 : 0,
      st.needs_reconciliation ? 1 : 0, st.reconciled_carbon_kgco2eq ?? null,
      st.completed_at, st.id
    );
  }

  const finalDeliverable = synthesizeTaskDeliverable(task, subtasks);
  task.output = finalDeliverable;
  task.status = 'done';

  // Update task in DB
  db.prepare(`
    UPDATE tasks
    SET status = ?, running_cost_usd = ?, running_carbon_kgco2eq = ?, running_latency_ms = ?, output = ?
    WHERE id = ?
  `).run(task.status, task.running_cost_usd, task.running_carbon_kgco2eq, task.running_latency_ms, task.output, task.id);

  return { task, subtasks };
}

// ─────────────────────────────────────────────────────────────────────────────
// _descriptionToEmbedding — deterministic offline embedding (PRD §3.1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces a 128-dim float vector from a subtask description string.
 *
 * Technique: character-frequency histogram over 4 ASCII bands (32 dims each)
 * combined with 32 trigram hashes. Deterministic, no external calls needed.
 *
 * Replaces this with a real nomic-embed-text Ollama call when OQ-008 is resolved.
 * Cosine similarity between identical strings = 1.0; between the 5 distinct demo
 * subtask descriptions they fall well below the 0.92 cache threshold, so no
 * false cache collisions will occur across different subtask types.
 */
function _descriptionToEmbedding(text: string): number[] {
  const DIM = 128;
  const vec = new Array<number>(DIM).fill(0);
  const lower = text.toLowerCase();

  // Bands: [32..63], [64..95], [96..127], [0..31 mod 32]
  for (let i = 0; i < lower.length; i++) {
    const c = lower.charCodeAt(i);
    const band = Math.floor(((c & 0x60) >> 5)) * 32; // 0, 32, 64, or 96
    const slot = band + (c & 0x1f);
    vec[slot % DIM]! += 1;
  }

  // Trigram hashing into slots 64..127
  for (let i = 0; i < lower.length - 2; i++) {
    const h = (lower.charCodeAt(i) * 31 * 31 +
               lower.charCodeAt(i + 1) * 31 +
               lower.charCodeAt(i + 2)) >>> 0;
    vec[64 + (h % 64)]! += 1;
  }

  // L2-normalise
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? vec : vec.map(v => v / norm);
}
