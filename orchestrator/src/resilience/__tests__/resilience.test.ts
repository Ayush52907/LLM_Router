import { describe, it, expect, beforeEach } from 'vitest';
import { fallbackRouteOffline } from '../../routing/heuristic-router.js';
import { runReconciliationPass } from '../reconciliation.js';
import { getDb } from '../../db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import type { ModelEntry } from '../../registry/types.js';

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

const ALL_CANDIDATES = [LOCAL_SMALL, LOCAL_MEDIUM, CLOUD_STRONG];

describe('Offline Resilience: Fallback Router (Locked Decision #1)', () => {
  it('strictly excludes cloud candidates when offline', () => {
    const result = fallbackRouteOffline({
      subtaskType: 'extraction',
      complexityTier: 'expert',
      dataSensitivity: 'public',
      availableCandidates: ALL_CANDIDATES,
    });
    expect(result.chosenModel.location).toBe('local');
    expect(result.chosenModel.model_id).not.toBe('gpt-4o');
  });

  it('routes trivial complexity to the smallest local model', () => {
    const result = fallbackRouteOffline({
      subtaskType: 'classification',
      complexityTier: 'trivial',
      dataSensitivity: 'public',
      availableCandidates: ALL_CANDIDATES,
    });
    expect(result.chosenModel.model_id).toBe('llama3.2:3b');
    expect(result.reason).toContain('smallest_local');
  });

  it('routes low complexity to the smallest local model', () => {
    const result = fallbackRouteOffline({
      subtaskType: 'classification',
      complexityTier: 'low',
      dataSensitivity: 'internal',
      availableCandidates: ALL_CANDIDATES,
    });
    expect(result.chosenModel.model_id).toBe('llama3.2:3b');
  });

  it('routes medium, high, and expert complexity to the largest local model', () => {
    for (const tier of ['medium', 'high', 'expert'] as const) {
      const result = fallbackRouteOffline({
        subtaskType: 'generation',
        complexityTier: tier,
        dataSensitivity: 'public',
        availableCandidates: ALL_CANDIDATES,
      });
      expect(result.chosenModel.model_id).toBe('mistral:7b');
      expect(result.reason).toContain('largest_local');
    }
  });

  it('throws an informative error if no local candidates exist', () => {
    expect(() =>
      fallbackRouteOffline({
        subtaskType: 'extraction',
        complexityTier: 'low',
        dataSensitivity: 'public',
        availableCandidates: [CLOUD_STRONG],
      })
    ).toThrow(/No local models available/);
  });
});

describe('Offline Resilience: Reconciliation Engine', () => {
  it('processes subtasks with needs_reconciliation = 1 and records deltas in reconciliation_log', async () => {
    const db = getDb();
    const taskId = uuidv4();
    const subtaskId = uuidv4();

    // Seed task
    db.prepare(`
      INSERT INTO tasks (id, raw_input, urgency, data_sensitivity, max_total_latency_ms, max_total_cost_usd, min_accuracy_tier_per_subtask, max_total_carbon_kgco2eq, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(taskId, 'Test contract offline execution', 'normal', 'internal', 60000, 1.0, 0, 0.1, Date.now(), 'done');

    // Seed offline-executed subtask
    db.prepare(`
      INSERT INTO subtasks (
        id, task_id, description, prompt, output, type, complexity_tier, status,
        routed_model, routed_location, actual_latency_ms, actual_cost_usd, actual_energy_kwh, actual_carbon_kgco2eq,
        degraded_routing, degraded_reason, estimated_stale_grid, needs_reconciliation, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subtaskId, taskId, 'Analyze indemnity obligations', 'Analyze indemnity', 'Obligations extracted locally',
      'generation', 'high', 'done',
      'mistral:7b', 'local', 6500, 0, 0.0008, 0.00052,
      1, 'offline', 1, 1, Date.now()
    );

    // Run reconciliation pass
    const summary = await runReconciliationPass();
    expect(summary.reconciledCount).toBeGreaterThanOrEqual(1);

    // Check that subtask needs_reconciliation is now 0
    const updatedSubtask = db.prepare(`SELECT * FROM subtasks WHERE id = ?`).get(subtaskId) as any;
    expect(updatedSubtask.needs_reconciliation).toBe(0);
    expect(updatedSubtask.reconciled_carbon_kgco2eq).toBeDefined();

    // Check that reconciliation_log has an entry for this subtask
    const logEntry = db.prepare(`SELECT * FROM reconciliation_log WHERE subtask_id = ?`).get(subtaskId) as any;
    expect(logEntry).toBeDefined();
    expect(logEntry.actual_routed_to).toBe('mistral:7b');
    expect(logEntry.would_have_routed_to).toBeDefined();
    expect(typeof logEntry.match).toBe('number');
  });
});
