'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HeadlinePanel } from '../components/HeadlinePanel';
import { ControlsStrip, ScoringWeightsState } from '../components/ControlsStrip';
import { DagCanvas, DagNode } from '../components/DagCanvas';
import { RouteInspector } from '../components/RouteInspector';
import { RightMiniPanels } from '../components/RightMiniPanels';
import { ComparisonChart } from '../components/ComparisonChart';
import { FooterDisclosure } from '../components/FooterDisclosure';
import {
  X,
  CheckCircle2,
  Clock,
  Leaf,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LogOut,
  User,
  MessageSquare,
  Search,
  Plus,
  Settings,
  Share2,
  Paperclip,
  Mic,
  Send,
  Sparkles,
  Calendar,
  Bell,
  Sliders,
  Flame,
  Lock,
  ShieldAlert,
  FastForward,
  Layers,
  BarChart3,
  Bot,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
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

type ViewTab = 'dag' | 'inspector' | 'comparison' | 'budget';

export default function OrbitaGptDashboard() {
  const [nodes, setNodes] = useState<DagNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [apiOnline, setApiOnline] = useState<boolean>(false);

  // Custom Prompt Input State
  const [customPrompt, setCustomPrompt] = useState<string>(PRESET_CONTRACT_1);
  const [selectedSource, setSelectedSource] = useState<'contract_1' | 'contract_2' | 'custom'>('contract_1');

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

  // UI Interactive States
  const [isSavedOpen, setIsSavedOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('dag');
  const [isPromptExpanded, setIsPromptExpanded] = useState<boolean>(false);

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

  // 2. Live Dynamic Route Scoring
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

  const handleSelectPreset = (presetKey: 'contract_1' | 'contract_2' | 'custom') => {
    setSelectedSource(presetKey);
    if (presetKey === 'contract_1') setCustomPrompt(PRESET_CONTRACT_1);
    else if (presetKey === 'contract_2') setCustomPrompt(PRESET_CONTRACT_2);
    else setCustomPrompt('');
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0] || {
    description: 'No active workflow loaded. Click Send or run a contract.',
    complexity: 'N/A',
    piiClass: null,
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] text-slate-500 flex items-center justify-center font-sans text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#5B7EFF] animate-ping" />
          <span>Connecting to Orbita GPT...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F9FB] text-slate-900 overflow-hidden font-sans antialiased">
      
      {/* ──────────────────────────────────────────────────────────────────────────
          FAR-LEFT VERTICAL ICON BAR (~64px)
          ────────────────────────────────────────────────────────────────────────── */}
      <aside className="w-16 bg-white border-r border-slate-200/80 flex flex-col items-center py-4 justify-between select-none shrink-0 z-30">
        <div className="flex flex-col items-center gap-6">
          {/* Blue Circular Logo */}
          <div
            className="w-10 h-10 rounded-full bg-[#5B7EFF] flex items-center justify-center text-white shadow-md shadow-blue-500/20 cursor-pointer transition-transform hover:scale-105"
            title="Orbita GPT"
          >
            <Sparkles className="w-5 h-5 fill-white" />
          </div>

          {/* Nav Icons */}
          <div className="flex flex-col items-center gap-3">
            <button
              className="w-10 h-10 rounded-xl bg-blue-50 text-[#5B7EFF] flex items-center justify-center transition-colors"
              title="Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('dag')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'dag' ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
              title="Workflow Graph (DAG)"
            >
              <Layers className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('comparison')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                activeTab === 'comparison' ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
              title="Policy Benchmarks"
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            <button
              onClick={handleRunTimeShift}
              className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
              title="Time-Shift Schedule (+6h Green Valley)"
            >
              <Calendar className="w-5 h-5" />
            </button>

            <button
              className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="w-2 h-2 rounded-full bg-[#5B7EFF] absolute top-2.5 right-2.5 ring-2 ring-white" />
            </button>
          </div>
        </div>

        {/* Bottom Dock: Config, Avatar & Logout */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setIsConfigDrawerOpen(!isConfigDrawerOpen)}
            className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
            title="Configuration"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={() => logout(API_BASE)}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors text-xs font-semibold"
            title={`Logged in as ${currentUserEmail || 'operator'} — Click to sign out`}
          >
            {currentUserEmail ? currentUserEmail[0].toUpperCase() : 'O'}
          </button>
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────────────────────
          LEFT SIDEBAR (280px)
          ────────────────────────────────────────────────────────────────────────── */}
      <aside className="w-[280px] bg-[#F8F9FB] border-r border-slate-200/80 flex flex-col justify-between select-none shrink-0 z-20">
        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Sidebar Top: Chat Label & Search */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800 tracking-tight">Chat</span>
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer shadow-2xs">
              <Search className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#5B7EFF] transition-colors"
            />
          </div>

          {/* + New Chat Pill-shaped Button */}
          <button
            onClick={() => {
              setCustomPrompt('');
              setSelectedSource('custom');
            }}
            className="w-full py-2.5 px-4 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          {/* Expandable "Saved" Section */}
          <div className="space-y-1 pt-1">
            <button
              onClick={() => setIsSavedOpen(!isSavedOpen)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 py-1 hover:text-slate-600"
            >
              <span>Saved</span>
              {isSavedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {isSavedOpen && (
              <div className="space-y-0.5">
                <button
                  onClick={() => handleSelectPreset('contract_1')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-2 transition-colors ${
                    selectedSource === 'contract_1' ? 'bg-white font-medium text-slate-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5 text-[#5B7EFF]" />
                  <span className="truncate">ChatAI · Acme MSA (PII)</span>
                </button>

                <button
                  onClick={() => handleSelectPreset('contract_2')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-2 transition-colors ${
                    selectedSource === 'contract_2' ? 'bg-white font-medium text-slate-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="truncate">Image of sun · CyberDyne</span>
                </button>

                <button
                  onClick={() => setActiveTab('comparison')}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100 flex items-center gap-2 transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="truncate">Data Analyst · Benchmarks</span>
                </button>
              </div>
            )}
          </div>

          {/* "Today" Section */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 block">Today</span>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span className="truncate">Contract Dispatch Workflow</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {customPrompt.slice(0, 75)}...
              </p>
            </div>
          </div>

          {/* "Yesterday" Section */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 block">Yesterday</span>
            <div className="space-y-0.5">
              <div className="px-2.5 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer">
                <span className="truncate block">Clause Liability & Indemnity Audit</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100 cursor-pointer">
                <span className="truncate block">Batch 200 Contracts (+6h valley)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer Status Badge */}
        <div className="p-3 border-t border-slate-200/80 bg-white/50 text-[11px] text-slate-500 flex items-center justify-between font-mono">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${apiOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>{localZone}</span>
          </div>
          <span>{gridIntensity} gCO₂/kWh</span>
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN CONTENT AREA
          ────────────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
        
        {/* Header Bar */}
        <header className="h-16 border-b border-slate-200/80 px-6 flex items-center justify-between bg-white select-none shrink-0">
          <div className="flex items-center gap-3">
            {/* EcoRouter Mission Control Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 shadow-2xs">
              <div className="w-2 h-2 rounded-full bg-[#5B7EFF]" />
              <span className="text-xs font-semibold text-slate-900 tracking-tight">EcoRouter Mission Control</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">EcoRouter Dispatcher</span>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConfigDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Configuration</span>
            </button>

            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  alert('URL copied to clipboard!');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Share</span>
            </button>

            <button
              onClick={() => {
                setCustomPrompt('');
                setSelectedSource('custom');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>

            {/* Profile & Logout button */}
            <button
              onClick={() => logout(API_BASE)}
              className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Center Chat Display Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* If no pipeline nodes generated yet -> Render Orbita GPT Welcome Hero */}
            {nodes.length === 0 && (
              <div className="py-8 text-center space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-[#5B7EFF] text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
                  <Sparkles className="w-7 h-7 fill-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    How can I help you today?
                  </h1>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                    Submit contract text to decompose into subtasks, schedule across local and cloud LLMs, and measure carbon and latency savings.
                  </p>
                </div>

                {/* Suggested Prompt Cards (2x2 Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left max-w-2xl mx-auto pt-2">
                  <div
                    onClick={() => {
                      setCustomPrompt("What are the best open opportunities by company size across our standard master service agreements?");
                      setSelectedSource('custom');
                    }}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#5B7EFF] hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800 group-hover:text-[#5B7EFF]">
                      <span>Open Opportunities Analysis</span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#5B7EFF]" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      "What are the best open opportunities by company size?"
                    </p>
                  </div>

                  <div
                    onClick={() => handleSelectPreset('contract_1')}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#5B7EFF] hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800 group-hover:text-[#5B7EFF]">
                      <span>Acme Cloud MSA (PII Isolation)</span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#5B7EFF]" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Decompose 30-page agreement, extract parties, isolate canary PII, and flag uncapped liability.
                    </p>
                  </div>

                  <div
                    onClick={() => handleSelectPreset('contract_2')}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#5B7EFF] hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800 group-hover:text-[#5B7EFF]">
                      <span>CyberDyne Autonomous Audit</span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#5B7EFF]" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Audit robotic telemetry agreement and detect irrevocable 5-year auto-renewal clauses.
                    </p>
                  </div>

                  <div
                    onClick={handleRunTimeShift}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#5B7EFF] hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800 group-hover:text-[#5B7EFF]">
                      <span>Time-Shift Batch Scenario</span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#5B7EFF]" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Evaluate +6h green valley deferral rule for 200 archived documents.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* If task has been run or is running -> Render Conversation Flow */}
            {nodes.length > 0 && (
              <div className="space-y-6">
                
                {/* 1. User Message */}
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    U
                  </div>
                  <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-800">
                    <div className="flex items-center justify-between font-semibold text-slate-900 mb-1.5">
                      <span>Contract Workflow Request</span>
                      <button
                        onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                        className="text-[11px] text-[#5B7EFF] hover:underline cursor-pointer"
                      >
                        {isPromptExpanded ? 'Collapse prompt' : 'Expand full contract'}
                      </button>
                    </div>
                    <p className="font-mono leading-relaxed whitespace-pre-wrap">
                      {isPromptExpanded ? customPrompt : `${customPrompt.slice(0, 260)}...`}
                    </p>
                  </div>
                </div>

                {/* 2. Orbita GPT Assistant Message */}
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#5B7EFF] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-4 h-4 fill-white" />
                  </div>
                  <div className="flex-1 space-y-4">
                    
                    {/* Headline Impact Summary */}
                    <HeadlinePanel
                      costSavedPct={headlineMetrics.costSavedPct}
                      carbonSavedPct={headlineMetrics.carbonSavedPct}
                      qualityRetainedPct={headlineMetrics.qualityRetainedPct}
                      isMeasuredOffline={headlineMetrics.isMeasuredOffline}
                    />

                    {/* Interactive Workspace Navigation Tabs */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
                      <button
                        onClick={() => setActiveTab('dag')}
                        className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                          activeTab === 'dag' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Workflow DAG ({nodes.length} subtasks)
                      </button>

                      <button
                        onClick={() => setActiveTab('inspector')}
                        className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                          activeTab === 'inspector' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Route Inspector
                      </button>

                      <button
                        onClick={() => setActiveTab('comparison')}
                        className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                          activeTab === 'comparison' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Policy Benchmarks
                      </button>

                      <button
                        onClick={() => setActiveTab('budget')}
                        className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                          activeTab === 'budget' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Gauges &amp; Budget
                      </button>
                    </div>

                    {/* Tab 1: Workflow DAG Nodes */}
                    {activeTab === 'dag' && (
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                        <DagCanvas
                          nodes={nodes}
                          selectedNodeId={selectedNodeId}
                          onSelectNode={(id) => {
                            setSelectedNodeId(id);
                            setActiveTab('inspector');
                          }}
                        />
                      </div>
                    )}

                    {/* Tab 2: Route Inspector */}
                    {activeTab === 'inspector' && (
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                        <RouteInspector
                          selectedNodeTitle={selectedNode.description}
                          complexity={selectedNode.complexity}
                          piiForced={selectedNode.piiClass === 'raw_pii'}
                          candidates={inspectorCandidates}
                        />
                      </div>
                    )}

                    {/* Tab 3: Policy Comparisons */}
                    {activeTab === 'comparison' && (
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                        <ComparisonChart
                          alwaysStrongest={comparisonData.alwaysStrongest}
                          randomPolicy={comparisonData.randomPolicy}
                          thisSystem={comparisonData.thisSystem}
                          overheadPct={0.08}
                        />
                      </div>
                    )}

                    {/* Tab 4: Carbon & Budget Gauges */}
                    {activeTab === 'budget' && (
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
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
                    )}

                  </div>
                </div>

              </div>
            )}

          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────────────
            INPUT SECTION AT BOTTOM
            ────────────────────────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-200/80 p-4 bg-white/80 backdrop-blur-md select-none shrink-0">
          <div className="max-w-4xl mx-auto space-y-2.5">
            
            {/* Input Card Container */}
            <div className="rounded-2xl border border-slate-300/80 bg-white shadow-md p-3 focus-within:border-[#5B7EFF] focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              
              {/* Top Selector: Source Dropdown & Info */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Source:</span>
                  <select
                    value={selectedSource}
                    onChange={(e) => handleSelectPreset(e.target.value as any)}
                    className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#5B7EFF] cursor-pointer"
                  >
                    <option value="contract_1">Acme Cloud MSA (Contract 1 - PII)</option>
                    <option value="contract_2">CyberDyne Autonomous (Contract 2 - Risk)</option>
                    <option value="custom">Custom Text / Instructions</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    ~{Math.round(customPrompt.length / 4)} tokens
                  </span>
                </div>
              </div>

              {/* Main Text Input Area */}
              <textarea
                rows={2}
                value={customPrompt}
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  setSelectedSource('custom');
                }}
                placeholder="Ask me anything or paste your contract markdown..."
                className="w-full pt-2.5 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none resize-none font-mono"
              />

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  {/* Attach button */}
                  <button
                    onClick={() => handleSelectPreset('contract_1')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Attach contract document"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Voice button */}
                  <button
                    onClick={() => alert('Voice mode is simulated in local demo.')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Voice input"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* Quick Toggles */}
                  <div className="hidden sm:flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setIsUrgent(!isUrgent)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        isUrgent ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      Urgent
                    </button>

                    <button
                      onClick={() => setIsPiiEnabled(!isPiiEnabled)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        isPiiEnabled ? 'bg-[#5B7EFF] text-white border-[#5B7EFF]' : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      PII Lock
                    </button>
                  </div>
                </div>

                {/* Dark Pill-shaped Send button */}
                <button
                  onClick={handleRunDemoTask}
                  disabled={isRunning || !customPrompt.trim()}
                  className="py-2 px-5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Footer Disclaimer Text */}
            <p className="text-[11px] text-slate-400 text-center font-sans">
              Orbita GPT provides carbon- and latency-aware dispatch. Local carbon computed with CodeCarbon × live grid; cloud carbon via EcoLogits. Raw PII strictly isolated locally.
            </p>

          </div>
        </div>

      </main>

      {/* ──────────────────────────────────────────────────────────────────────────
          CONFIGURATION SLIDE-OVER DRAWER
          ────────────────────────────────────────────────────────────────────────── */}
      {isConfigDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#5B7EFF]" />
                  <h2 className="text-base font-bold text-slate-900">Dispatcher Configuration</h2>
                </div>
                <button
                  onClick={() => setIsConfigDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scoring Weights Sliders */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Five-Factor Scoring Weights
                </h3>
                
                {/* Latency */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">Latency Weight (w_lat)</span>
                    <span className="font-mono font-bold text-slate-900">{weights.latency.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.latency}
                    onChange={(e) => handleWeightChange('latency', parseFloat(e.target.value))}
                    className="w-full accent-[#5B7EFF] cursor-pointer"
                  />
                </div>

                {/* Accuracy */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">Accuracy Tier Weight (w_acc)</span>
                    <span className="font-mono font-bold text-slate-900">{weights.accuracy.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.accuracy}
                    onChange={(e) => handleWeightChange('accuracy', parseFloat(e.target.value))}
                    className="w-full accent-[#5B7EFF] cursor-pointer"
                  />
                </div>

                {/* Cost */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">Cost Weight (w_cost)</span>
                    <span className="font-mono font-bold text-slate-900">{weights.cost.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.cost}
                    onChange={(e) => handleWeightChange('cost', parseFloat(e.target.value))}
                    className="w-full accent-[#5B7EFF] cursor-pointer"
                  />
                </div>

                {/* Energy */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">Energy Weight (w_energy)</span>
                    <span className="font-mono font-bold text-slate-900">{weights.energy.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.energy}
                    onChange={(e) => handleWeightChange('energy', parseFloat(e.target.value))}
                    className="w-full accent-[#5B7EFF] cursor-pointer"
                  />
                </div>

                {/* Carbon */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">Carbon Weight (w_carbon)</span>
                    <span className="font-mono font-bold text-slate-900">{weights.carbon.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights.carbon}
                    onChange={(e) => handleWeightChange('carbon', parseFloat(e.target.value))}
                    className="w-full accent-[#5B7EFF] cursor-pointer"
                  />
                </div>
              </div>

              {/* Toggles & Modes */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Execution Modes
                </h3>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">Urgent Mode</span>
                    <span className="text-[11px] text-slate-500">Overrides w_lat to 0.70</span>
                  </div>
                  <button
                    onClick={() => setIsUrgent(!isUrgent)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      isUrgent ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      isUrgent ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">PII Isolation Lock</span>
                    <span className="text-[11px] text-slate-500">Forces local models on sensitive subtasks</span>
                  </div>
                  <button
                    onClick={() => setIsPiiEnabled(!isPiiEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      isPiiEnabled ? 'bg-[#5B7EFF]' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      isPiiEnabled ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">Fault Injection (T5)</span>
                    <span className="text-[11px] text-slate-500">Tests verification escalation loop</span>
                  </div>
                  <button
                    onClick={() => setIsFaultInjected(!isFaultInjected)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      isFaultInjected ? 'bg-red-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      isFaultInjected ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                </div>
              </div>

            </div>

            <button
              onClick={() => setIsConfigDrawerOpen(false)}
              className="w-full py-2.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TIME-SHIFT BATCH MODAL
          ────────────────────────────────────────────────────────────────────────── */}
      {timeShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  Time-Shift Batch Dispatcher
                </h3>
              </div>
              <button
                onClick={() => setTimeShiftModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Scenario</span>
                <span className="text-slate-900 font-semibold">{timeShiftModal.scenario}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-slate-400 block text-[10px]">Intensity Now</span>
                  <span className="text-slate-800 font-bold">{timeShiftModal.intensity_now_gco2} gCO₂/kWh</span>
                </div>
                <div className="bg-blue-50/80 p-2.5 rounded-xl border border-blue-100">
                  <span className="text-blue-500 block text-[10px] font-semibold">Valley (+3h)</span>
                  <span className="text-[#5B7EFF] font-bold">{timeShiftModal.min_forecast_intensity_gco2} gCO₂/kWh</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-950">
                <div className="flex items-center gap-2 font-semibold mb-1 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Action: {timeShiftModal.action}
                </div>
                <div className="text-[11px] text-emerald-800 space-y-1">
                  <p>• Scheduled for: <strong>+{timeShiftModal.scheduled_for_offset_hours}h green window</strong></p>
                  <p>• Projected carbon saved: <strong>{timeShiftModal.carbon_savings_projected_pct}%</strong></p>
                  <p>• Rule: {timeShiftModal.eligible_candidates}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setTimeShiftModal(null)}
              className="w-full py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs rounded-full transition-colors"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
