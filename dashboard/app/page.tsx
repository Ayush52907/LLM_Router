'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HeadlinePanel } from '../components/HeadlinePanel';
import { ControlsStrip, ScoringWeightsState } from '../components/ControlsStrip';
import { DagCanvas, DagNode } from '../components/DagCanvas';
import { RouteInspector } from '../components/RouteInspector';
import { RightMiniPanels } from '../components/RightMiniPanels';
import { ComparisonChart } from '../components/ComparisonChart';
import { FooterDisclosure } from '../components/FooterDisclosure';
import { X, CheckCircle2, Clock, Leaf, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:3001';

const PRESET_CONTRACT_1 = `# MASTER SERVICES AGREEMENT — ACME CLOUD & OMNI RETAIL
Effective Date: January 15, 2026 | Contract ID: MSA-2026-0891
Canary Token: CANARY-PII-ACME-90210

## 1. PARTIES
- Provider: Acme Cloud Technologies Inc., Sarah J. Jenkins (sarah.jenkins@acmecloud.example.com, SSN: 000-12-3456)
- Customer: Omni Retail Solutions LLC, Marcus Vance (m.vance@omniretail.example.com)

## 2. SCOPE OF SERVICES & TERM
Provider delivers multi-tenant cloud data hosting. Initial term: 3 years.

## 3. OBLIGATIONS & SERVICE LEVELS
3.1 Uptime Commitment: 99.9% monthly service availability.
3.2 Data Protection: Encryption at rest (AES-256) and transit (TLS 1.3).
3.3 Payment: Invoices net 30 days.

## 4. INTELLECTUAL PROPERTY (RISK)
4.1 Customer irrevocably assigns to Provider all rights to derivative works and code modifications interacting with API.

## 5. INDEMNITY & LIABILITY (RISK)
5.1 Customer provides uncapped indemnity for all third-party claims regardless of Provider negligence.
5.2 Provider aggregate liability capped at fifty dollars ($50.00 USD).`;

const PRESET_CONTRACT_2 = `# VENDOR SERVICES AGREEMENT — CYBERDYNE & NEXUS HEALTH
Effective Date: March 1, 2026 | Canary Token: CANARY-PII-CYBER-88124

## 1. PARTIES
- Vendor: CyberDyne Autonomous Systems Corp., Dr. Elena Rostova (elena.rostova@cyberdyne-systems.example.com)
- Client: Nexus Health Network Inc., Dr. Robert Chen (r.chen@nexushealth.example.com)

## 2. SERVICES & PERFORMANCE
24x7 automated robotic telemetry dispatch.

## 3. TERM & AUTOMATIC RENEWAL (RISK)
3.1 Irrevocable 5-year auto-renewal unless physical notice delivered strictly between 180 and 175 days before expiration.

## 4. DISCLAIMERS (RISK)
4.1 Client forfeits all legal claims for patient injury or record loss caused by Vendor gross negligence.`;

export default function MissionControlDashboard() {
  const [nodes, setNodes] = useState<DagNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [apiOnline, setApiOnline] = useState<boolean>(false);

  // Custom Prompt Input State
  const [showPromptEditor, setShowPromptEditor] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>(PRESET_CONTRACT_1);


  // Controls state
  const [weights, setWeights] = useState<ScoringWeightsState>({
    latency: 0.25,
    accuracy: 0.35,
    cost: 0.15,
    energy: 0.10,
    carbon: 0.15,
  });
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPiiEnabled, setIsPiiEnabled] = useState(true);
  const [isFaultInjected, setIsFaultInjected] = useState(false);

  // Headline metrics from offline eval
  const [headlineMetrics, setHeadlineMetrics] = useState({
    costSavedPct: 0,
    carbonSavedPct: 0,
    qualityRetainedPct: 0,
    isMeasuredOffline: true,
  });

  // Budgets
  const [budgets, setBudgets] = useState({
    runningCost: 0,
    maxCost: 0.50,
    runningCarbon: 0,
    maxCarbon: 0.05,
    runningLatency: 0,
    maxLatency: 60000,
  });

  // Grid
  const [gridIntensity, setGridIntensity] = useState(650);
  const [localZone, setLocalZone] = useState('IN-KA');

  // Escalation events
  const [escalations, setEscalations] = useState<Array<{ id: string; reason: string; from: string; to: string; time: string }>>([]);

  // Route Inspector live candidates
  const [inspectorCandidates, setInspectorCandidates] = useState<any[]>([]);

  // Policy comparison chart data
  const [comparisonData, setComparisonData] = useState({
    alwaysStrongest: { cost: 0.0921, carbon: 0.10318, latency: 70000, quality: 1.0 },
    randomPolicy: { cost: 0.0485, carbon: 0.0612, latency: 62000, quality: 0.74 },
    thisSystem: { cost: 0.0265, carbon: 0.04232, latency: 54300, quality: 1.0 },
  });

  // Time-shift modal state
  const [timeShiftModal, setTimeShiftModal] = useState<any | null>(null);

  // 1. Initial Load: Fetch baselines, grid, config, and latest task
  useEffect(() => {
    async function initData() {
      try {
        // Fetch health
        const healthRes = await fetch(`${API_BASE}/api/health`).catch(() => null);
        if (healthRes && healthRes.ok) {
          setApiOnline(true);
        }

        // Fetch baselines
        const baselinesRes = await fetch(`${API_BASE}/api/baselines`).catch(() => null);
        if (baselinesRes && baselinesRes.ok) {
          const bData = await baselinesRes.json();
          if (bData.measured_summary) {
            setHeadlineMetrics({
              costSavedPct: bData.measured_summary.cost_saved_pct,
              carbonSavedPct: bData.measured_summary.carbon_saved_pct,
              qualityRetainedPct: bData.measured_summary.quality_retained_pct,
              isMeasuredOffline: true,
            });
          }
          if (bData.offline_stats) {
            setComparisonData({
              alwaysStrongest: {
                cost: bData.offline_stats.always_strongest.cost.mean,
                carbon: bData.offline_stats.always_strongest.carbon.mean,
                latency: bData.offline_stats.always_strongest.latency.mean,
                quality: bData.offline_stats.always_strongest.quality.mean,
              },
              randomPolicy: {
                cost: bData.offline_stats.random.cost.mean,
                carbon: bData.offline_stats.random.carbon.mean,
                latency: bData.offline_stats.random.latency.mean,
                quality: bData.offline_stats.random.quality.mean,
              },
              thisSystem: {
                cost: bData.offline_stats.this_system.cost.mean,
                carbon: bData.offline_stats.this_system.carbon.mean,
                latency: bData.offline_stats.this_system.latency.mean,
                quality: bData.offline_stats.this_system.quality.mean,
              },
            });
          }
        }

        // Fetch live grid
        const gridRes = await fetch(`${API_BASE}/api/grid`).catch(() => null);
        if (gridRes && gridRes.ok) {
          const gData = await gridRes.json();
          setGridIntensity(gData.current_intensity_gco2_per_kwh);
          setLocalZone(gData.zone || 'IN-KA');
        }

        // Fetch config weights
        const configRes = await fetch(`${API_BASE}/api/config`).catch(() => null);
        if (configRes && configRes.ok) {
          const cData = await configRes.json();
          if (cData.weights) {
            setWeights(cData.weights);
          }
        }

        // Fetch latest task from DB
        const latestTaskRes = await fetch(`${API_BASE}/api/tasks/latest`).catch(() => null);
        if (latestTaskRes && latestTaskRes.ok) {
          const lData = await latestTaskRes.json();
          if (lData.task && lData.subtasks && lData.subtasks.length > 0) {
            mapTaskToState(lData.task, lData.subtasks, lData.escalations || []);
          }
        }
      } catch (err) {
        console.warn('Initial fetch error:', err);
      }
    }

    initData();
  }, []);

  // Helper to map backend task + subtasks to UI state
  const mapTaskToState = (task: any, subtasks: any[], escEvents: any[]) => {
    const mappedNodes: DagNode[] = subtasks.map((st: any) => ({
      id: st.id,
      description: st.description,
      type: st.type,
      complexity: st.complexity_tier,
      piiClass: st.pii_class,
      routedModel: st.routed_model,
      routedLocation: st.routed_location,
      status: st.status,
      escalated: st.escalation_count > 0,
      originalModel: st.escalation_count > 0 ? (escEvents.find((e: any) => e.subtask_id === st.id)?.from_model || 'mistral:7b') : null,
    }));

    setNodes(mappedNodes);
    if (mappedNodes.length > 0) {
      setSelectedNodeId(mappedNodes[0].id);
    }

    setBudgets({
      runningCost: task.running_cost_usd || 0,
      maxCost: task.max_total_cost_usd || 0.50,
      runningCarbon: task.running_carbon_kgco2eq || 0,
      maxCarbon: task.max_total_carbon_kgco2eq || 0.05,
      runningLatency: task.running_latency_ms || 0,
      maxLatency: task.max_total_latency_ms || 60000,
    });

    setEscalations(
      escEvents.map((e: any) => ({
        id: e.id,
        reason: e.reason_code,
        from: e.from_model,
        to: e.to_model,
        time: new Date(e.created_at).toLocaleTimeString(),
      }))
    );
  };

  // 2. Live Dynamic Route Scoring (Whenever node selection or sliders change)
  const fetchDynamicScore = useCallback(
    async (nodeType: string, complexity: string, piiActive: boolean, currentWeights: ScoringWeightsState) => {
      try {
        const resp = await fetch(`${API_BASE}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subtask_type: nodeType,
            complexity_tier: complexity,
            data_sensitivity: piiActive ? 'pii' : 'internal',
            urgency: isUrgent ? 'urgent' : 'normal',
            weights: currentWeights,
            input_tokens: 2000,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          setInspectorCandidates(data.candidates || []);
        }
      } catch (err) {
        console.warn('Failed to fetch dynamic score:', err);
      }
    },
    [isUrgent]
  );

  // Trigger dynamic score whenever selected node, weights, or PII changes
  useEffect(() => {
    const selected = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
    if (selected) {
      const isPiiNode = selected.piiClass === 'raw_pii' || isPiiEnabled;
      fetchDynamicScore(selected.type, selected.complexity, isPiiNode, weights);
    }
  }, [selectedNodeId, nodes, weights, isPiiEnabled, fetchDynamicScore]);

  // Handle weight slider changes
  const handleWeightChange = (key: keyof ScoringWeightsState, val: number) => {
    const nextWeights = { ...weights, [key]: val };
    setWeights(nextWeights);
    const selected = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
    if (selected) {
      const isPiiNode = selected.piiClass === 'raw_pii' || isPiiEnabled;
      fetchDynamicScore(selected.type, selected.complexity, isPiiNode, nextWeights);
    }
  };

  // 3. Real "Run Demo Task" Execution with Backend Polling
  const handleRunDemoTask = async () => {
    setIsRunning(true);

    try {
      // 1. Submit pipeline task to backend
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_input: customPrompt || "Master Services Agreement between Acme Cloud Technologies Inc. and Omni Retail Solutions LLC. Canary: CANARY-PII-ACME-90210.",
          urgency: isUrgent ? 'urgent' : 'normal',
          data_sensitivity: isPiiEnabled ? 'pii' : 'internal',
          fault_injected_type: isFaultInjected ? 'generation' : null,
          custom_weights: weights,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to submit task: ${res.statusText}`);
      }

      const data = await res.json();
      const taskId = data.task.id;

      // 2. Poll until status is 'done' or update directly
      let completed = false;
      let attempts = 0;

      while (!completed && attempts < 10) {
        const pollRes = await fetch(`${API_BASE}/api/tasks/${taskId}`);
        if (pollRes.ok) {
          const pollData = await pollRes.json();
          if (pollData.task.status === 'done' || pollData.task.status === 'failed') {
            mapTaskToState(pollData.task, pollData.subtasks, pollData.escalations || []);
            completed = true;
          }
        }
        attempts++;
        if (!completed) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (!completed && data.task && data.subtasks) {
        mapTaskToState(data.task, data.subtasks, []);
      }
    } catch (err: any) {
      alert(`Error running task on orchestrator: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // 4. Real Time-Shift Batch API Call
  const handleRunTimeShift = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/time-shift`, {
        method: 'POST',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setTimeShiftModal(data);
    } catch (err: any) {
      alert(`Error calling time-shift endpoint: ${err.message}`);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0] || {
    description: 'No active workflow loaded. Click "Run Demo Task" to submit a real contract.',
    complexity: 'N/A',
    piiClass: null,
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100 p-3 gap-3">
      {/* 1. Top Strip: Headline Panel & Interactive Controls */}
      <HeadlinePanel
        costSavedPct={headlineMetrics.costSavedPct}
        carbonSavedPct={headlineMetrics.carbonSavedPct}
        qualityRetainedPct={headlineMetrics.qualityRetainedPct}
        isMeasuredOffline={headlineMetrics.isMeasuredOffline}
      />

      <ControlsStrip
        weights={weights}
        onWeightChange={handleWeightChange}
        isUrgent={isUrgent}
        onToggleUrgent={() => setIsUrgent(!isUrgent)}
        isPiiEnabled={isPiiEnabled}
        onTogglePii={() => setIsPiiEnabled(!isPiiEnabled)}
        isFaultInjected={isFaultInjected}
        onToggleFaultInjection={() => setIsFaultInjected(!isFaultInjected)}
        onRunDemoTask={handleRunDemoTask}
        onRunTimeShift={handleRunTimeShift}
        isRunning={isRunning}
      />

      {/* Prompt / Contract Input Drawer Toggle */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <button
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Workflow Prompt & Contract Input Document</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              ~{Math.round(customPrompt.length / 4)} tokens
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>{showPromptEditor ? 'Hide Prompt Editor' : 'Click to View / Edit Custom Prompt'}</span>
            {showPromptEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showPromptEditor && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Presets:</span>
                <button
                  onClick={() => setCustomPrompt(PRESET_CONTRACT_1)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700"
                >
                  Acme Cloud (Contract 1)
                </button>
                <button
                  onClick={() => setCustomPrompt(PRESET_CONTRACT_2)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700"
                >
                  CyberDyne (Contract 2)
                </button>
                <button
                  onClick={() => setCustomPrompt('')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
                >
                  Clear / Custom Prompt
                </button>
              </div>

              <span className="text-[10px] text-slate-500 font-mono">
                {customPrompt.length} chars · ~{Math.round(customPrompt.length / 4)} tokens
              </span>
            </div>

            <textarea
              rows={5}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Paste any contract markdown, prompt, or task instructions here..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}
      </div>

      {/* 2. Middle Main Grid: 40% DAG | 30% Inspector | 30% Right Mini-Panels */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-[420px]">
        {/* Left 40% (approx 5 cols of 12) */}
        <div className="col-span-5 h-full">
          {nodes.length === 0 ? (
            <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-8 shadow-lg flex flex-col items-center justify-center h-full text-center">
              <Clock className="w-8 h-8 text-sky-400 mb-2 animate-pulse" />
              <div className="text-sm font-bold text-slate-200">No active workflow loaded</div>
              <div className="text-xs text-slate-400 mt-1 max-w-xs">
                Click <strong className="text-emerald-400">Run Demo Task</strong> to submit a vendor contract through the real router pipeline.
              </div>
            </div>
          ) : (
            <DagCanvas
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />
          )}
        </div>

        {/* Center 30% (approx 4 cols of 12) */}
        <div className="col-span-4 h-full">
          <RouteInspector
            selectedNodeTitle={selectedNode.description}
            complexity={selectedNode.complexity}
            piiForced={selectedNode.piiClass === 'raw_pii'}
            candidates={inspectorCandidates}
          />
        </div>

        {/* Right 30% (approx 3 cols of 12) */}
        <div className="col-span-3 h-full">
          <RightMiniPanels
            runningCost={budgets.runningCost}
            maxCost={budgets.maxCost}
            runningCarbon={budgets.runningCarbon}
            maxCarbon={budgets.maxCarbon}
            runningLatency={budgets.runningLatency}
            maxLatency={budgets.maxLatency}
            currentGridIntensity={gridIntensity}
            localZone={localZone}
            escalationEvents={escalations}
          />
        </div>
      </div>

      {/* 3. Bottom Strip: Policy Comparison Chart */}
      <ComparisonChart
        alwaysStrongest={comparisonData.alwaysStrongest}
        randomPolicy={comparisonData.randomPolicy}
        thisSystem={comparisonData.thisSystem}
        overheadPct={0.08}
      />

      {/* 4. Persistent Footer Disclosure */}
      <FooterDisclosure />

      {/* Time-Shift Batch Result Modal */}
      {timeShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-teal-500/60 rounded-xl max-w-md w-full p-5 shadow-2xl shadow-teal-500/20 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Time-Shift Batch Dispatcher (PRD Addendum F)
                </h3>
              </div>
              <button
                onClick={() => setTimeShiftModal(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Scenario</span>
                <span className="text-slate-200 font-bold">{timeShiftModal.scenario}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Intensity Now</span>
                  <span className="text-amber-400 font-bold">{timeShiftModal.intensity_now_gco2} gCO₂/kWh</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Forecast Valley (+3h)</span>
                  <span className="text-emerald-400 font-bold">{timeShiftModal.min_forecast_intensity_gco2} gCO₂/kWh</span>
                </div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 flex items-center justify-between">
                <span>Threshold Check:</span>
                <span className="text-teal-300 font-bold">
                  {timeShiftModal.difference_pct}% difference &gt; {timeShiftModal.threshold_pct}% threshold
                </span>
              </div>

              <div className="bg-emerald-950/80 border border-emerald-600/80 p-3 rounded-lg text-emerald-200">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Action: {timeShiftModal.action}
                </div>
                <div className="text-[11px] text-emerald-300/90 space-y-1">
                  <p>• Scheduled for: <strong>+{timeShiftModal.scheduled_for_offset_hours} hours offset</strong> (Valley window)</p>
                  <p>• Projected carbon saved: <strong>{timeShiftModal.carbon_savings_projected_pct}%</strong></p>
                  <p>• Rule: <strong>{timeShiftModal.eligible_candidates}</strong></p>
                  <p>• Clock simulation: <strong>{timeShiftModal.clock_mode}</strong></p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setTimeShiftModal(null)}
              className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg transition-colors border border-slate-700"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
