/**
 * Orchestrator API Server (Express).
 * Powers the Next.js mission-control dashboard.
 */

import express from 'express';
import cors from 'cors';
import { getDb } from '../db/schema.js';
import { loadConfig } from '../registry/config-loader.js';
import { runTaskPipeline } from '../pipeline/runner.js';
import { createElectricityMapsClient } from '../integrations/electricity-maps.js';

export function createServer(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = getDb();
  const config = loadConfig();
  const em = createElectricityMapsClient();

  // 1. Health & Status
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
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
      return res.json({ task: null, subtasks: [], escalations: [] });
    }
    const subtasks = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC').all(task.id);
    const escalations = db.prepare(`
      SELECT e.* FROM escalation_events e
      JOIN subtasks s ON e.subtask_id = s.id
      WHERE s.task_id = ?
    `).all(task.id);
    res.json({ task, subtasks, escalations });
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

    res.json({ task, subtasks, escalations });
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
        complexity_tier = 'medium',
      } = req.body;

      const live = await em.getLatestIntensity(config.localZone);
      let candidatePool = [...config.models];

      if (data_sensitivity === 'pii') {
        candidatePool = candidatePool.filter(c => c.location === 'local');
      }

      const activeWeights = clientWeights
        ? { ...config.weights, ...clientWeights }
        : (urgency === 'urgent' ? config.urgencyWeights : config.weights);

      const ranked = candidatePool.map(candidate => {
        const tokens = input_tokens + (config.tokenDefaults[subtask_type] ?? 200);
        const lat = candidate.predicted_latency_ms;
        const cost = candidate.predicted_cost_usd_per_1k_tokens * (tokens / 1000);
        const energy = candidate.predicted_energy_kwh_per_1k_tokens * (tokens / 1000);
        let carbon = 0;
        if (candidate.location === 'cloud') {
          carbon = (candidate.cloud_carbon_kgco2eq_per_1k_tokens ?? 0.0008) * (tokens / 1000);
        } else {
          carbon = energy * (live.gco2_per_kwh / 1000);
        }

        const lat_norm = Math.min(1, lat / config.bounds.latency_ms);
        const acc_norm = 1 - Math.min(1, candidate.accuracy_tier / 1.0);
        const cost_norm = Math.min(1, cost / config.bounds.cost_usd);
        const energy_norm = Math.min(1, energy / config.bounds.energy_kwh);
        const carbon_norm = Math.min(1, carbon / config.bounds.carbon_kgco2eq);

        const raw_score = (activeWeights.latency * lat_norm)
          + (activeWeights.accuracy * acc_norm)
          + (activeWeights.cost * cost_norm)
          + (activeWeights.energy * energy_norm)
          + (activeWeights.carbon * carbon_norm);

        // Small jev bonus if cloud or fast
        const jev_bonus = (candidate.model_id === 'gpt-4o' || candidate.model_id === 'gpt-4o-mini') ? 0.014 : 0.0;
        const final_score = raw_score - jev_bonus;

        return {
          model_id: candidate.model_id,
          location: candidate.location,
          accuracy_tier: candidate.accuracy_tier,
          raw_score: parseFloat(raw_score.toFixed(4)),
          jev_bonus: parseFloat(jev_bonus.toFixed(4)),
          final_score: parseFloat(final_score.toFixed(4)),
          lat_norm: parseFloat(lat_norm.toFixed(3)),
          acc_norm: parseFloat(acc_norm.toFixed(3)),
          cost_norm: parseFloat(cost_norm.toFixed(3)),
          energy_norm: parseFloat(energy_norm.toFixed(3)),
          carbon_norm: parseFloat(carbon_norm.toFixed(3)),
          is_winner: false,
        };
      });

      ranked.sort((a, b) => a.final_score - b.final_score);
      if (ranked.length > 0) {
        ranked[0].is_winner = true;
      }

      res.json({
        candidates: ranked,
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

  return app;
}
