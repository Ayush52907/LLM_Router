/**
 * Reconciliation Engine (Offline Resilience).
 *
 * Automatically triggered when the connectivity monitor transitions from
 * OFFLINE → ONLINE.
 *
 * Spec:
 *   1. Queries all subtasks where needs_reconciliation = 1.
 *   2. For each: re-runs the real routing decision with full cloud+local pool & Jev.
 *   3. Compares actual_routed_to vs would_have_routed_to.
 *   4. Logs delta to reconciliation_log table.
 *   5. If estimated_stale_grid was set, re-fetches live grid intensity and backfills
 *      reconciled_carbon_kgco2eq alongside the original actual_carbon_kgco2eq.
 *   6. Sets needs_reconciliation = 0.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';
import { loadConfig } from '../registry/config-loader.js';
import { rankCandidates } from '../scoring/score.js';
import { filterWithRelaxation, filterForPii } from '../constraints/engine.js';
import { createJevClient } from '../integrations/jev.js';
import { createElectricityMapsClient } from '../integrations/electricity-maps.js';
import type { Subtask, ReconciliationRecord } from '../registry/types.js';

export interface ReconciliationSummary {
  reconciledCount: number;
  matches: number;
  mismatches: number;
  staleGridFixed: number;
  records: ReconciliationRecord[];
  summaryMessage: string;
}

let _isReconciling = false;

export async function runReconciliationPass(): Promise<ReconciliationSummary> {
  if (_isReconciling) {
    console.log('[Reconciliation] Pass already running, skipping overlapping invocation.');
    return {
      reconciledCount: 0,
      matches: 0,
      mismatches: 0,
      staleGridFixed: 0,
      records: [],
      summaryMessage: 'Reconciliation pass already in progress',
    };
  }

  _isReconciling = true;

  try {
    const db = getDb();
    const config = loadConfig();

    // 1. Query all subtasks that require reconciliation
    const subtasksToReconcile = db
      .prepare(`SELECT * FROM subtasks WHERE needs_reconciliation = 1 ORDER BY created_at ASC`)
      .all() as any[];

    if (subtasksToReconcile.length === 0) {
      return {
        reconciledCount: 0,
        matches: 0,
        mismatches: 0,
        staleGridFixed: 0,
        records: [],
        summaryMessage: 'No pending subtasks requiring reconciliation',
      };
    }

    console.log(`[Reconciliation] Starting automatic reconciliation for ${subtasksToReconcile.length} offline subtask(s)...`);

    // 2. Fetch fresh grid intensity now that online is restored
    const em = createElectricityMapsClient();
    const freshGrid = await em.getLatestIntensity(config.localZone);
    const jev = createJevClient();

    let matches = 0;
    let mismatches = 0;
    let staleGridFixed = 0;
    const records: ReconciliationRecord[] = [];

    const insertLogStmt = db.prepare(`
      INSERT INTO reconciliation_log (
        id, subtask_id, task_id, actual_routed_to, would_have_routed_to, match,
        original_carbon_kgco2eq, reconciled_carbon_kgco2eq, notes, reconciled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateSubtaskStmt = db.prepare(`
      UPDATE subtasks
      SET needs_reconciliation = 0,
          reconciled_carbon_kgco2eq = ?
      WHERE id = ?
    `);

    for (const st of subtasksToReconcile) {
      // Re-run the real routing decision with full candidate pool
      let candidatePool = [...config.models];
      if (st.pii_class === 'raw_pii' || st.data_sensitivity === 'pii') {
        candidatePool = filterForPii(candidatePool);
      }

      // Jev evaluation
      let jevSuggestion = null;
      try {
        jevSuggestion = await jev.evaluateRouting({
          subtask_description: st.description,
          task_type: st.type,
          candidate_models: candidatePool.map(c => ({ model_id: c.model_id, location: c.location })),
          token_count: 2000,
          sensitivity: st.data_sensitivity,
        });
      } catch {
        // Fallback to null bonus
      }

      // Full scoring formula
      const ranked = rankCandidates({
        candidates: candidatePool,
        inputTokens: 2000,
        subtaskType: st.type,
        urgency: st.urgency,
        weights: config.weights,
        urgencyWeights: config.urgencyWeights,
        bounds: config.bounds,
        liveGridIntensityGco2PerKwh: freshGrid.gco2_per_kwh,
        jevChoiceConfidence: jevSuggestion?.suggested_model_id
          ? { model_id: jevSuggestion.suggested_model_id, confidence: jevSuggestion.confidence }
          : null,
      });

      // Constraint filtering
      const filterResult = filterWithRelaxation({
        rankedCandidates: ranked,
        candidates: candidatePool,
        complexityTier: st.complexity_tier,
        workflowMinAccuracy: 0,
        tierFloors: config.tierFloors,
        budgetState: {
          remaining_cost_usd: 1.0,
          remaining_carbon_kgco2eq: 1.0,
          remaining_latency_ms: 60000,
        },
        allowanceUsd: st.subtask_budget_allowance_usd ?? 0.1,
        subtaskId: st.id,
      });

      const winner = filterResult ? filterResult.winner : ranked[0]!;
      const wouldHaveRoutedTo = winner.model_id;
      const isMatch = wouldHaveRoutedTo === st.routed_model;

      if (isMatch) {
        matches++;
      } else {
        mismatches++;
      }

      // If grid was stale/estimated during outage, backfill reconciled carbon using fresh live grid
      let reconciledCarbon: number | null = null;
      if (st.estimated_stale_grid === 1 && typeof st.actual_energy_kwh === 'number') {
        reconciledCarbon = st.actual_energy_kwh * (freshGrid.gco2_per_kwh / 1000);
        staleGridFixed++;
      }

      const notes = isMatch
        ? `Offline routing matched ideal online choice (${wouldHaveRoutedTo}).`
        : `Offline routing selected ${st.routed_model} (local); online formula would have chosen ${wouldHaveRoutedTo} (${winner.location}).`;

      const reconId = uuidv4();
      const reconciledAt = Date.now();

      // Write reconciliation log row
      insertLogStmt.run(
        reconId,
        st.id,
        st.task_id,
        st.routed_model || 'unknown',
        wouldHaveRoutedTo,
        isMatch ? 1 : 0,
        st.actual_carbon_kgco2eq,
        reconciledCarbon,
        notes,
        reconciledAt
      );

      // Update subtask
      updateSubtaskStmt.run(reconciledCarbon, st.id);

      records.push({
        id: reconId,
        subtask_id: st.id,
        task_id: st.task_id,
        actual_routed_to: st.routed_model || 'unknown',
        would_have_routed_to: wouldHaveRoutedTo,
        match: isMatch,
        original_carbon_kgco2eq: st.actual_carbon_kgco2eq,
        reconciled_carbon_kgco2eq: reconciledCarbon,
        notes,
        reconciled_at: reconciledAt,
      });
    }

    const summaryMessage = `${subtasksToReconcile.length} subtask(s) executed offline. Reconciliation: ${matches} routing choices matched, ${mismatches} would have routed differently (${mismatches > 0 ? 'review recommended' : 'all optimal'}).`;
    console.log(`[Reconciliation] Complete: ${summaryMessage}`);

    return {
      reconciledCount: subtasksToReconcile.length,
      matches,
      mismatches,
      staleGridFixed,
      records,
      summaryMessage,
    };
  } finally {
    _isReconciling = false;
  }
}
