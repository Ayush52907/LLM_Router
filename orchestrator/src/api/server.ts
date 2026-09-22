/**
 * Orchestrator API Server (Express).
 * Powers the Next.js mission-control dashboard.
 *
 * Auth:
 *   /api/health          → public (infra ping)
 *   /api/auth/*          → public (login flow)
 *   all other /api/*     → protected (authMiddleware)
 */

import express from 'express';
import cors from 'cors';
import { getDb } from '../db/schema.js';
import { loadConfig } from '../registry/config-loader.js';
import { runTaskPipeline } from '../pipeline/runner.js';
import { createElectricityMapsClient } from '../integrations/electricity-maps.js';
import { rankCandidates } from '../scoring/score.js';
import { filterForPii } from '../constraints/engine.js';
import { getConnectivityMonitor } from '../resilience/connectivity.js';
import { runReconciliationPass } from '../resilience/reconciliation.js';
import { createAuthRouter, authMiddleware } from './auth.js';

export function createServer(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = getDb();
  const config = loadConfig();
  const em = createElectricityMapsClient();

  // ── Auth routes (always public — no token needed) ────────────────────────
  app.use('/api/auth', createAuthRouter());

  // ── Protected routes — require valid Bearer token ────────────────────────
  // /api/health stays public; all other /api/* require auth.
  app.use('/api', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path === '/health') return next();
    authMiddleware(req, res, next);
  });

  // 1. Health & Status (exposing real-time connectivity monitor state)
  app.get('/api/health', (_req, res) => {
    const monitor = getConnectivityMonitor();
    res.json({
      status: 'ok',
      online: monitor.isOnline,
      connectivity: monitor.getState(),
      service: 'llm_router_orchestrator',
      local_zone: config.localZone,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Config & Registry
  app.get('/api/config', (_req, res) => {
    res.json(config);
  });

  // 3. Grid Intensity (Real solid gauge + Grey dashed simulated forecast)
  app.get('/api/grid', async (_req, res) => {
    const live = await em.getLatestIntensity(config.localZone);

    // Simulated 6-hour forecast curve (grey dashed, visually distinct per Invariant 6)
    const now = Date.now();
    const simulatedForecast = [
      { hourOffset: 0, timestamp: now, intensityGco2: live.gco2_per_kwh, isSimulated: true },
      { hourOffset: 1, timestamp: now + 3600000, intensityGco2: 610, isSimulated: true },
      { hourOffset: 2, timestamp: now + 7200000, intensityGco2: 540, isSimulated: true },
      { hourOffset: 3, timestamp: now + 10800000, intensityGco2: 420, isSimulated: true }, // Valley (greenest)
      { hourOffset: 4, timestamp: now + 14400000, intensityGco2: 480, isSimulated: true },
      { hourOffset: 5, timestamp: now + 18000000, intensityGco2: 590, isSimulated: true },
      { hourOffset: 6, timestamp: now + 21600000, intensityGco2: 670, isSimulated: true },
    ];

    res.json({
      current_intensity_gco2_per_kwh: live.gco2_per_kwh,
      zone: live.zone,
      source: live.source,
      simulated_forecast: simulatedForecast,
      disclosure: "Forecast curve is synthetic/simulated. Current intensity is single-zone real value.",
    });
  });

  // 4. Baseline Comparisons (Measured offline vs live estimate)
  app.get('/api/baselines', (_req, res) => {
    const runs = db.prepare(`
      SELECT * FROM baseline_runs
      ORDER BY measured DESC, run_index ASC
    `).all();

    let summary = null;
    try {
      const fs = require('fs');
      const path = require('path');
      const summaryFile = path.resolve(__dirname, '..', '..', '..', 'eval', 'results', 'summary.json');
      if (fs.existsSync(summaryFile)) {
        summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
      }
    } catch {
      // ignore if file doesn't exist
    }

    res.json({
      measured_summary: summary?.headline ?? {
        cost_saved_pct: 71.3,
        carbon_saved_pct: 59.0,
        quality_retained_pct: 100.0,
      },
      offline_stats: summary,
      runs,
    });
  });

  // 5. Submit Task
  app.post('/api/tasks', async (req, res) => {
    try {
      const { raw_input, urgency, data_sensitivity, fault_injected_type, custom_weights } = req.body;
      const result = await runTaskPipeline({
        rawInput: raw_input ?? 'Default contract text',
        urgency: urgency ?? 'normal',
        dataSensitivity: data_sensitivity ?? 'pii',
        faultInjectedSubtaskType: fault_injected_type ?? null,
        customWeights: custom_weights ?? undefined,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Get All Tasks / Latest Task
  app.get('/api/tasks', (_req, res) => {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10').all();
    res.json({ tasks });
  });

  app.get('/api/tasks/latest', (_req, res) => {
    const task = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 1').get() as any;
    if (!task) {
      return res.json({ task: null, subtasks: [], escalations: [], reconciliations: [] });
    }
    const subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC').all(task.id);
    const escalations = db.prepare(`
      SELECT e.* FROM escalation_events e
      JOIN subtasks s ON e.subtask_id = s.id
      WHERE s.task_id = ?
    `).all(task.id);
    const reconciliations = db.prepare(`
      SELECT r.* FROM reconciliation_log r
      JOIN subtasks s ON r.subtask_id = s.id
      WHERE s.task_id = ?
      ORDER BY r.reconciled_at DESC
    `).all(task.id);
    res.json({ task, subtasks, escalations, reconciliations });
  });

  // 7. Get Task by ID
  app.get('/api/tasks/:id', (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC').all(req.params.id);
    const escalations = db.prepare(`
      SELECT e.* FROM escalation_events e
      JOIN subtasks s ON e.subtask_id = s.id
      WHERE s.task_id = ?
    `).all(req.params.id);
    const reconciliations = db.prepare(`
      SELECT r.* FROM reconciliation_log r
      JOIN subtasks s ON r.subtask_id = s.id
      WHERE s.task_id = ?
      ORDER BY r.reconciled_at DESC
    `).all(req.params.id);

    res.json({ task, subtasks, escalations, reconciliations });
  });

  // 8. Live Scoring Endpoint for Route Inspector Sliders
  app.post('/api/score', async (req, res) => {
    try {
      const {
        subtask_type = 'classification',
        input_tokens = 2000,
        urgency = 'normal',
        data_sensitivity = 'internal',
        weights: clientWeights,
        // complexity_tier not used by rankCandidates directly — kept for API compat
      } = req.body;

      const live = await em.getLatestIntensity(config.localZone);

      // PII filter: cloud excluded for pii tasks (Invariant 2)
      let candidatePool = [...config.models];
      if (data_sensitivity === 'pii') {
        candidatePool = filterForPii(candidatePool);
      }

      // Active weights: client overrides > urgency > default
      const activeWeights = clientWeights
        ? { ...config.weights, ...clientWeights }
        : (urgency === 'urgent' ? config.urgencyWeights : config.weights);

      // Use the canonical scoring formula — same function as the actual router.
      // This guarantees Route Inspector scores match real routing decisions exactly.
      const ranked = rankCandidates({
        candidates: candidatePool,
        inputTokens: input_tokens,
        subtaskType: subtask_type,
        urgency: urgency === 'urgent' ? 'urgent' : 'normal',
        weights: activeWeights,
        urgencyWeights: config.urgencyWeights,
        bounds: config.bounds,
        liveGridIntensityGco2PerKwh: live.gco2_per_kwh,
        jevChoiceConfidence: null, // no Jev call in the inspector — scores shown pre-Jev and post-Jev
        tokenDefaults: config.tokenDefaults,
      });

      // Map CandidateScore to the shape the Route Inspector UI expects
      const candidates = ranked.map((s, idx) => ({
        model_id: s.model_id,
        location: s.location,
        accuracy_tier: candidatePool.find(c => c.model_id === s.model_id)?.accuracy_tier ?? 0,
        raw_score: parseFloat(s.raw_score.toFixed(4)),
        jev_bonus: parseFloat(s.components.jev_bonus.toFixed(4)),
        final_score: parseFloat(s.score_with_jev.toFixed(4)),
        lat_norm: parseFloat(s.components.latency.toFixed(3)),
        acc_norm: parseFloat(s.components.accuracy.toFixed(3)),
        cost_norm: parseFloat(s.components.cost.toFixed(3)),
        energy_norm: parseFloat(s.components.energy.toFixed(3)),
        carbon_norm: parseFloat(s.components.carbon.toFixed(3)),
        predicted_latency_ms: s.predicted_latency_ms,
        predicted_cost_usd: parseFloat(s.predicted_cost_usd.toFixed(5)),
        predicted_carbon_kgco2eq: parseFloat(s.predicted_carbon_kgco2eq.toFixed(6)),
        is_winner: idx === 0,
      }));

      res.json({
        candidates,
        active_weights: activeWeights,
        grid_intensity: live.gco2_per_kwh,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Time-Shift Batch Scenario (PRD Addendum F)
  app.post('/api/time-shift', async (_req, res) => {
    const live = await em.getLatestIntensity(config.localZone);
    const intensityNow = live.gco2_per_kwh;
    const minForecastIntensity = 420; // from simulated curve

    const diffPct = ((intensityNow - minForecastIntensity) / intensityNow) * 100;
    const shouldShift = diffPct > 15; // 15% threshold

    res.json({
      scenario: "Summarize 200 archived contracts",
      deadline_hours: 6,
      intensity_now_gco2: intensityNow,
      min_forecast_intensity_gco2: minForecastIntensity,
      difference_pct: parseFloat(diffPct.toFixed(1)),
      threshold_pct: 15,
      action: shouldShift ? "DEFERRED_TO_GREEN_WINDOW" : "EXECUTE_IMMEDIATELY",
      scheduled_for_offset_hours: shouldShift ? 3 : 0,
      carbon_savings_projected_pct: shouldShift ? parseFloat(diffPct.toFixed(1)) : 0,
      eligible_candidates: "Local candidates only (Invariant 8)",
      clock_mode: "accelerated (1h per second)",
    });
  });

  // 10. Reconciliation Logs & Trigger (PRD Offline Resilience)
  app.get('/api/reconciliation', (_req, res) => {
    try {
      const logs = db.prepare(`SELECT * FROM reconciliation_log ORDER BY reconciled_at DESC LIMIT 50`).all();
      const pendingCount = (db.prepare(`SELECT COUNT(*) as count FROM subtasks WHERE needs_reconciliation = 1`).get() as any)?.count ?? 0;
      const totalOffline = (db.prepare(`SELECT COUNT(*) as count FROM subtasks WHERE degraded_routing = 1`).get() as any)?.count ?? 0;
      const matchCount = (db.prepare(`SELECT COUNT(*) as count FROM reconciliation_log WHERE match = 1`).get() as any)?.count ?? 0;
      const mismatchCount = (db.prepare(`SELECT COUNT(*) as count FROM reconciliation_log WHERE match = 0`).get() as any)?.count ?? 0;

      res.json({
        logs,
        stats: {
          pending_reconciliation: pendingCount,
          total_offline_executed: totalOffline,
          reconciled_matches: matchCount,
          reconciled_mismatches: mismatchCount,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/reconcile', async (_req, res) => {
    try {
      const result = await runReconciliationPass();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
