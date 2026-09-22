'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HeadlinePanel } from '../components/HeadlinePanel';
import { ControlsStrip, ScoringWeightsState } from '../components/ControlsStrip';
import { DagCanvas, DagNode } from '../components/DagCanvas';
import { RouteInspector } from '../components/RouteInspector';
import { RightMiniPanels } from '../components/RightMiniPanels';
import { ComparisonChart } from '../components/ComparisonChart';
import { FooterDisclosure } from '../components/FooterDisclosure';
import { X, CheckCircle2, Clock, Leaf, FileText, ChevronDown, ChevronUp, LogOut, User } from 'lucide-react';
import { isAuthenticated, getUserEmail, logout, authFetch } from '../lib/auth';

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

  // Auth state & guard
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = '/login';
    } else {
      setCurrentUserEmail(getUserEmail());
      setAuthChecked(true);
    }
  }, []);

  // 1. Initial Load: Fetch baselines, grid, config, and latest task
  useEffect(() => {
    if (!authChecked) return;

    async function initData() {
      try {
        // Fetch health (public)
        const healthRes = await fetch(`${API_BASE}/api/health`).catch(() => null);
        if (healthRes && healthRes.ok) {
          setApiOnline(true);
        }

        // Fetch baselines
        const baselinesRes = await authFetch(`${API_BASE}/api/baselines`).catch(() => null);
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
        const gridRes = await authFetch(`${API_BASE}/api/grid`).catch(() => null);
        if (gridRes && gridRes.ok) {
          const gData = await gridRes.json();
          setGridIntensity(gData.current_intensity_gco2_per_kwh);
          setLocalZone(gData.zone || 'IN-KA');
        }

        // Fetch config weights
        const configRes = await authFetch(`${API_BASE}/api/config`).catch(() => null);
        if (configRes && configRes.ok) {
          const cData = await configRes.json();
          if (cData.weights) {
            setWeights(cData.weights);
          }
        }

        // Fetch latest task from DB
        const latestTaskRes = await authFetch(`${API_BASE}/api/tasks/latest`).catch(() => null);
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
  }, [authChecked]);

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
        const resp = await authFetch(`${API_BASE}/api/score`, {
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

        if (resp && resp.ok) {
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
      const res = await authFetch(`${API_BASE}/api/tasks`, {
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

      if (!res || !res.ok) {
        throw new Error(`Failed to submit task: ${res ? res.statusText : 'Authentication error'}`);
      }

      const data = await res.json();
      const taskId = data.task.id;

      // 2. Poll until status is 'done' or update directly
      let completed = false;
      let attempts = 0;

      while (!completed && attempts < 10) {
        const pollRes = await authFetch(`${API_BASE}/api/tasks/${taskId}`);
        if (pollRes && pollRes.ok) {
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
      const resp = await authFetch(`${API_BASE}/api/time-shift`, {
        method: 'POST',
      });
      if (!resp || !resp.ok) throw new Error(`HTTP ${resp ? resp.status : 401}`);
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

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black text-neutral-400 flex items-center justify-center font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>Validating EcoRouter credentials...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-neutral-100 p-3 gap-3">
      {/* 0. Top Navigation & User Session Bar */}
      <header className="flex items-center justify-between px-4 py-2 rounded-xl bg-[#0a0a0a] border border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm shadow-white/40 animate-pulse" />
            <span className="font-bold text-xs tracking-wider uppercase text-white font-mono">EcoRouter</span>
            <span className="text-neutral-600 text-xs font-mono">/</span>
            <span className="text-xs text-neutral-400 font-medium">Mission Control</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border ${
            apiOnline
              ? 'bg-neutral-900 text-neutral-200 border-neutral-700'
              : 'bg-red-950/40 text-red-400 border-red-800/40'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-emerald-400' : 'bg-red-500'}`} />
            {apiOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#121212] border border-[#262626] text-xs">
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-300 font-mono text-[11px] max-w-[200px] truncate">
              {currentUserEmail || 'operator'}
            </span>
          </div>
          <button
            onClick={() => logout(API_BASE)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 text-xs font-medium transition-colors cursor-pointer"
            title="Sign out of EcoRouter"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

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
      <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg overflow-hidden shadow-sm">
        <button
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-neutral-300 hover:bg-[#141414] transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>Workflow Prompt &amp; Contract Input Document</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#171717] text-neutral-400 border border-[#262626]">
              ~{Math.round(customPrompt.length / 4)} tokens
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono">
            <span>{showPromptEditor ? 'Hide Prompt Editor' : 'Click to View / Edit Custom Prompt'}</span>
            {showPromptEditor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {showPromptEditor && (
          <div className="p-3 border-t border-[#262626] bg-[#0d0d0d] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-500 uppercase font-mono">Presets:</span>
                <button
                  onClick={() => setCustomPrompt(PRESET_CONTRACT_1)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#171717] hover:bg-[#262626] text-neutral-300 border border-[#262626] transition-colors"
                >
                  Acme Cloud (Contract 1)
                </button>
                <button
                  onClick={() => setCustomPrompt(PRESET_CONTRACT_2)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#171717] hover:bg-[#262626] text-neutral-300 border border-[#262626] transition-colors"
                >
                  CyberDyne (Contract 2)
                </button>
                <button
                  onClick={() => setCustomPrompt('')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#171717] hover:bg-[#262626] text-neutral-400 border border-[#262626] transition-colors"
                >
                  Clear / Custom Prompt
                </button>
              </div>

              <span className="text-[10px] text-neutral-500 font-mono">
                {customPrompt.length} chars · ~{Math.round(customPrompt.length / 4)} tokens
              </span>
            </div>

            <textarea
              rows={5}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Paste any contract markdown, prompt, or task instructions here..."
              className="w-full bg-[#121212] border border-[#262626] rounded-md p-2.5 text-xs font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-white transition-colors"
            />
          </div>
        )}
      </div>

      {/* 2. Middle Main Grid: 40% DAG | 30% Inspector | 30% Right Mini-Panels */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-[420px]">
        {/* Left 40% (approx 5 cols of 12) */}
        <div className="col-span-5 h-full">
          {nodes.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-8 shadow-sm flex flex-col items-center justify-center h-full text-center">
              <Clock className="w-8 h-8 text-neutral-500 mb-2 animate-pulse" />
              <div className="text-sm font-semibold text-neutral-200">No active workflow loaded</div>
              <div className="text-xs text-neutral-400 mt-1 max-w-xs font-mono">
                Click <strong className="text-white underline underline-offset-2">Run Demo Task</strong> to submit a vendor contract through the real router pipeline.
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl max-w-md w-full p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-white" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                  Time-Shift Batch Dispatcher (PRD Addendum F)
                </h3>
              </div>
              <button
                onClick={() => setTimeShiftModal(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-[#121212] p-2.5 rounded border border-[#262626]">
                <span className="text-neutral-500 block text-[10px] uppercase">Scenario</span>
                <span className="text-neutral-200 font-semibold">{timeShiftModal.scenario}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#121212] p-2 rounded border border-[#262626]">
                  <span className="text-neutral-500 block text-[10px]">Intensity Now</span>
                  <span className="text-neutral-300 font-semibold">{timeShiftModal.intensity_now_gco2} gCO₂/kWh</span>
                </div>
                <div className="bg-[#121212] p-2 rounded border border-[#262626]">
                  <span className="text-neutral-500 block text-[10px]">Forecast Valley (+3h)</span>
                  <span className="text-white font-semibold">{timeShiftModal.min_forecast_intensity_gco2} gCO₂/kWh</span>
                </div>
              </div>

              <div className="bg-[#121212] p-2.5 rounded border border-[#262626] flex items-center justify-between">
                <span className="text-neutral-400">Threshold Check:</span>
                <span className="text-white font-medium">
                  {timeShiftModal.difference_pct}% difference &gt; {timeShiftModal.threshold_pct}% threshold
                </span>
              </div>

              <div className="bg-[#141414] border border-[#333333] p-3 rounded-lg text-neutral-200">
                <div className="flex items-center gap-2 font-semibold mb-1 text-white">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  Action: {timeShiftModal.action}
                </div>
                <div className="text-[11px] text-neutral-400 space-y-1">
                  <p>• Scheduled for: <strong className="text-neutral-200">+{timeShiftModal.scheduled_for_offset_hours} hours offset</strong> (Valley window)</p>
                  <p>• Projected carbon saved: <strong className="text-neutral-200">{timeShiftModal.carbon_savings_projected_pct}%</strong></p>
                  <p>• Rule: <strong className="text-neutral-200">{timeShiftModal.eligible_candidates}</strong></p>
                  <p>• Clock simulation: <strong className="text-neutral-200">{timeShiftModal.clock_mode}</strong></p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setTimeShiftModal(null)}
              className="mt-4 w-full py-2 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-md transition-colors"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
