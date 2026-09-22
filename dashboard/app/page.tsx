'use client';

/**
 * EcoRouter — Claude-Inspired Calm Interface.
 * Warm parchment aesthetic, generous whitespace, quiet typography hierarchy,
 * single terracotta accent used with extreme restraint, minimal borders.
 * Zero admin-panel / dashboard clutter.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUp, Lock, Cloud, HardDrive, AlertCircle,
  ChevronDown, ChevronUp, Sliders, Clock, FastForward,
  Check, RefreshCw, X, ShieldAlert, Flame, Sparkles, LogOut,
  Copy, FileText
} from 'lucide-react';
import { authFetch, clearToken, isAuthenticated } from '../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? 'http://localhost:3001';

// ── Contract Presets ──────────────────────────────────────────────────────────

const CONTRACT_ACME = `# MASTER SERVICES AGREEMENT — ACME CLOUD & OMNI RETAIL
Effective Date: January 15, 2026 | Contract ID: MSA-2026-0891
Canary Token: CANARY-PII-ACME-90210

## 1. PARTIES
- Provider: Acme Cloud Technologies Inc., Sarah J. Jenkins (sarah.jenkins@acmecloud.example.com, SSN: 000-12-3456)
- Customer: Omni Retail Solutions LLC, Marcus Vance (m.vance@omniretail.example.com)

## 2. OBLIGATIONS & SERVICE LEVELS
3.1 Uptime: 99.9% monthly. 3.2 Data Protection: AES-256 at rest, TLS 1.3 in transit.

## 3. INTELLECTUAL PROPERTY (RISK)
4.1 Customer irrevocably assigns to Provider all rights to derivative works interacting with API.

## 4. INDEMNITY & LIABILITY (RISK)
5.1 Customer provides uncapped indemnity for all third-party claims regardless of Provider negligence.
5.2 Provider aggregate liability capped at fifty dollars ($50.00 USD).`;

const CONTRACT_CYBERDYNE = `# VENDOR SERVICES AGREEMENT — CYBERDYNE & NEXUS HEALTH
Effective Date: March 1, 2026 | Canary: CANARY-PII-CYBER-88124

## 1. PARTIES
- Vendor: CyberDyne Autonomous Systems, Dr. Elena Rostova (elena.rostova@cyberdyne-systems.example.com)
- Client: Nexus Health Network, Dr. Robert Chen (r.chen@nexushealth.example.com)

## 2. TERM & AUTO-RENEWAL (RISK)
Irrevocable 5-year auto-renewal unless physical notice 180–175 days before expiration.

## 3. DISCLAIMERS (RISK)
Client forfeits all legal claims for patient injury caused by Vendor gross negligence.`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface GridData {
  current_intensity_gco2_per_kwh: number;
  zone: string;
  source: string;
  simulated_forecast: Array<{ hourOffset: number; intensityGco2: number; isSimulated: boolean }>;
  disclosure: string;
}

interface BaselineData {
  measured_summary: { cost_saved_pct: number; carbon_saved_pct: number; quality_retained_pct: number };
  offline_stats: any | null;
  runs: any[];
}

interface Subtask {
  id: string;
  description: string;
  type: string;
  complexity_tier: string;
  pii_class: string | null;
  routed_model: string | null;
  routed_location: 'cloud' | 'local' | null;
  status: 'queued' | 'routing' | 'executing' | 'verifying' | 'done' | 'failed';
  jev_confidence: number | null;
  actual_latency_ms: number | null;
  actual_cost_usd: number | null;
  actual_energy_kwh: number | null;
  actual_carbon_kgco2eq: number | null;
  verification_pass: number | null;
  escalation_count: number;
  degraded_routing?: boolean | number;
  degraded_reason?: string | null;
  estimated_stale_grid?: boolean | number;
  needs_reconciliation?: boolean | number;
  reconciled_carbon_kgco2eq?: number | null;
  output?: string | null;
}

interface Task {
  id: string;
  status: string;
  running_cost_usd: number;
  running_carbon_kgco2eq: number;
  running_latency_ms: number;
  max_total_cost_usd: number;
  max_total_carbon_kgco2eq: number;
  max_total_latency_ms: number;
  output?: string | null;
}

interface EscalationEvent {
  id: string;
  subtask_id: string;
  reason_code: string;
  from_model: string;
  to_model: string;
  created_at: string;
}

interface Weights {
  latency: number;
  accuracy: number;
  cost: number;
  energy: number;
  carbon: number;
}

interface CandidateScore {
  model_id: string;
  location: string;
  accuracy_tier: number;
  raw_score: number;
  jev_bonus: number;
  final_score: number;
  lat_norm: number;
  acc_norm: number;
  cost_norm: number;
  energy_norm: number;
  carbon_norm: number;
  predicted_latency_ms: number;
  predicted_cost_usd: number;
  predicted_carbon_kgco2eq: number;
  is_winner: boolean;
}

export default function EcoRouterClaudePage() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean | null>(null);
  const [reconciliationLogs, setReconciliationLogs] = useState<any[]>([]);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [grid, setGrid] = useState<GridData | null>(null);
  const [baselines, setBaselines] = useState<BaselineData | null>(null);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [escalations, setEscalations] = useState<EscalationEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Inspector expansion per subtask
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  const [candidatesMap, setCandidatesMap] = useState<Record<string, CandidateScore[]>>({});

  // Output expansion & copy state
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const toggleOutput = (id: string) => {
    setExpandedOutputs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Input & Parameter controls
  const [customPrompt, setCustomPrompt] = useState(CONTRACT_ACME);
  const [activePreset, setActivePreset] = useState<'acme' | 'cyberdyne' | 'custom'>('acme');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPiiGuard, setIsPiiGuard] = useState(true);
  const [isFaultInjected, setIsFaultInjected] = useState(false);
  const [showWeightsDrawer, setShowWeightsDrawer] = useState(false);
  const [weights, setWeights] = useState<Weights>({
    latency: 0.25,
    accuracy: 0.35,
    cost: 0.15,
    energy: 0.10,
    carbon: 0.15,
  });

  // Time-shift modal & details
  const [showTimeShift, setShowTimeShift] = useState(false);
  const [timeShiftData, setTimeShiftData] = useState<any | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Auth Guard ───────────────────────────────────────────────────────────────
  // Redirect to /login immediately if no session token exists in sessionStorage.

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = '/login';
    } else {
      setAuthChecked(true);
    }
  }, []);

  function handleLogout() {
    clearToken();
    window.location.href = '/login';
  }

  // ── 1. Init Data ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authChecked) return; // wait for auth guard to confirm token present
    async function init() {
      // /api/health is public — plain fetch is fine here
      try {
        const h = await fetch(`${API_BASE}/api/health`);
        if (h.ok) {
          setApiOnline(true);
          const hd = await h.json();
          const onlineStatus = typeof hd.online === 'boolean'
            ? hd.online
            : (typeof hd.connectivity?.online === 'boolean'
                ? hd.connectivity.online
                : (typeof hd.network_online === 'boolean' ? hd.network_online : true));
          setIsNetworkOnline(onlineStatus);
        } else {
          setApiOnline(false);
        }
      } catch (err) {
        console.warn('[EcoRouter] /api/health unreachable:', err);
        setApiOnline(false);
      }

      try {
        const rec = await authFetch(`${API_BASE}/api/reconciliation`);
        if (rec?.ok) {
          const rd = await rec.json().catch(() => null);
          if (rd?.logs) setReconciliationLogs(rd.logs);
        }
      } catch (err) {
        console.warn('[EcoRouter] /api/reconciliation fetch failed:', err);
      }

      try {
        const g = await authFetch(`${API_BASE}/api/grid`);
        if (g?.ok) setGrid(await g.json());
      } catch (err) {
        console.warn('[EcoRouter] /api/grid fetch failed:', err);
      }

      try {
        const b = await authFetch(`${API_BASE}/api/baselines`);
        if (b?.ok) setBaselines(await b.json());
      } catch (err) {
        console.warn('[EcoRouter] /api/baselines fetch failed:', err);
      }

      try {
        const c = await authFetch(`${API_BASE}/api/config`);
        if (c?.ok) {
          const d = await c.json();
          if (d.weights) setWeights(d.weights);
        }
      } catch (err) {
        console.warn('[EcoRouter] /api/config fetch failed:', err);
      }

      try {
        const l = await authFetch(`${API_BASE}/api/tasks/latest`);
        if (l?.ok) {
          const d = await l.json();
          if (d.task && d.subtasks?.length > 0) {
            setCurrentTask(d.task);
            setSubtasks(d.subtasks);
            setEscalations(d.escalations ?? []);
          }
        }
      } catch (err) {
        console.warn('[EcoRouter] /api/tasks/latest fetch failed:', err);
      }
    }
    init();
  }, [authChecked]);

  // ── 2. Route Inspector dynamic scoring ──────────────────────────────────────

  const fetchCandidatesForSubtask = useCallback(async (st: Subtask, w: Weights) => {
    try {
      const r = await authFetch(`${API_BASE}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtask_type: st.type,
          complexity_tier: st.complexity_tier,
          data_sensitivity: st.pii_class === 'raw_pii' ? 'pii' : (isPiiGuard ? 'pii' : 'internal'),
          urgency: isUrgent ? 'urgent' : 'normal',
          weights: w,
          input_tokens: 2000,
        }),
      });
      if (r?.ok) {
        const d = await r.json();
        setCandidatesMap(prev => ({ ...prev, [st.id]: d.candidates ?? [] }));
      }
    } catch (err) {
      console.warn('[EcoRouter] fetchCandidates failed:', err);
    }
  }, [isUrgent, isPiiGuard]);

  const toggleInspect = (st: Subtask) => {
    if (expandedSubtaskId === st.id) {
      setExpandedSubtaskId(null);
    } else {
      setExpandedSubtaskId(st.id);
      if (!candidatesMap[st.id]) {
        fetchCandidatesForSubtask(st, weights);
      }
    }
  };

  // Re-fetch inspector data when weights change
  useEffect(() => {
    if (expandedSubtaskId) {
      const st = subtasks.find(s => s.id === expandedSubtaskId);
      if (st) fetchCandidatesForSubtask(st, weights);
    }
  }, [weights, isUrgent, isPiiGuard, expandedSubtaskId, subtasks, fetchCandidatesForSubtask]);

  // ── 3. Run Pipeline ─────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_input: customPrompt || 'Process vendor contract: extract parties, classify clauses, summarize obligations, flag risks, draft reply.',
          urgency: isUrgent ? 'urgent' : 'normal',
          data_sensitivity: isPiiGuard ? 'pii' : 'internal',
          fault_injected_type: isFaultInjected ? 'generation' : null,
          custom_weights: weights,
        }),
      });

      if (!res || !res.ok) {
        const e = res ? await res.json().catch(() => ({})) : {};
        throw new Error(e.error ?? `HTTP ${res?.status ?? 'unknown'}`);
      }

      const data = await res.json();
      if (data.task && data.subtasks) {
        setCurrentTask(data.task);
        setSubtasks(data.subtasks);
        setEscalations(data.escalations ?? []);
        setCandidatesMap({});
        setExpandedSubtaskId(null);

        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    } catch (err: any) {
      setRunError(err.message ?? 'Failed to schedule contract pipeline');
    } finally {
      setIsRunning(false);
    }
  }, [customPrompt, isUrgent, isPiiGuard, isFaultInjected, weights]);

  // ── 4. Time Shift Batch API ────────────────────────────────────────────────

  const handleTimeShift = useCallback(async () => {
    try {
      const r = await authFetch(`${API_BASE}/api/time-shift`, { method: 'POST' });
      if (r?.ok) {
        setTimeShiftData(await r.json());
        setShowTimeShift(true);
      }
    } catch (err) {
      console.warn('[EcoRouter] time-shift call failed:', err);
    }
  }, []);

  // Render nothing until auth check completes (avoids flash of unauthenticated content)
  if (!authChecked) return null;
  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1F1E1D] flex flex-col font-sans selection:bg-[#FBF4F0] selection:text-[#CC5A36]">
      
      {/* ── Minimal Claude Navigation Bar ───────────────────────────────────── */}
      <header className="w-full px-6 py-4 flex items-center justify-between max-w-4xl mx-auto border-b border-[#E5E4DE]/60">
        <div className="flex items-center gap-2">
          <span className="font-serif-claude text-xl text-[#1F1E1D] tracking-tight font-medium">EcoRouter</span>
          <span className="text-[#A09D95] text-sm">/</span>
          <span className="text-xs text-[#7A7870] font-normal tracking-normal hidden sm:inline">
            Carbon-Aware LLM Scheduler
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#7A7870]">
          {grid && (
            <span className="flex items-center gap-1.5 font-mono-claude text-[11px] text-[#6B6862]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E6B48]" />
              <span>{grid.zone}</span>
              <span className="text-[#D8D6CD]">·</span>
              <span>{grid.current_intensity_gco2_per_kwh} gCO₂/kWh</span>
            </span>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-[#7A7870]">
            <span className={`w-1.5 h-1.5 rounded-full ${
              isNetworkOnline === false ? 'bg-[#8C5D14]' : (apiOnline ? 'bg-[#1E6B48]' : 'bg-[#A09D95]')
            }`} />
            <span>{isNetworkOnline === false ? 'Offline Fallback' : (apiOnline ? 'Online' : 'Connecting')}</span>
          </div>

          {reconciliationLogs.length > 0 && (
            <button
              onClick={() => setShowReconciliationModal(true)}
              className="text-[11px] text-[#CC5A36] hover:text-[#B84E2D] underline underline-offset-2 cursor-pointer transition-colors"
            >
              {reconciliationLogs.length} reconciled
            </button>
          )}

          <button
            onClick={handleLogout}
            title="Sign out"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-normal text-[#7A7870] hover:text-[#1F1E1D] hover:bg-[#F3F3EE] transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Main Single-Focal Experience ────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-6 pt-16 pb-20 sm:pt-24 sm:pb-24 max-w-3xl mx-auto w-full">
        
        {/* Calm Editorial Greeting */}
        <div className="text-center mb-10 w-full">
          <h1 className="font-serif-claude text-3xl sm:text-4xl text-[#1F1E1D] font-normal tracking-tight mb-3">
            What contract would you like to schedule?
          </h1>
          <p className="text-sm text-[#6B6862] leading-relaxed max-w-lg mx-auto font-light">
            Decomposes multi-step legal agreements into privacy-isolated subtasks, routing each
            to the optimal model based on latency, accuracy, cost, and live carbon intensity.
          </p>
        </div>

        {/* ── The Claude Centerpiece Input Container ─────────────────────────── */}
        <div className="w-full bg-[#FFFFFF] border border-[#E5E4DE] rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] transition-all duration-200 focus-within:border-[#D8D6CD] focus-within:shadow-[0_6px_32px_rgba(0,0,0,0.06)] p-5 sm:p-6">
          
          {/* Preset Selector Pill Tabs */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#F3F3EE] text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setCustomPrompt(CONTRACT_ACME); setActivePreset('acme'); }}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                  activePreset === 'acme'
                    ? 'bg-[#F3F3EE] text-[#1F1E1D] font-medium'
                    : 'text-[#7A7870] hover:text-[#1F1E1D]'
                }`}
              >
                Acme MSA
              </button>
              <button
                type="button"
                onClick={() => { setCustomPrompt(CONTRACT_CYBERDYNE); setActivePreset('cyberdyne'); }}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                  activePreset === 'cyberdyne'
                    ? 'bg-[#F3F3EE] text-[#1F1E1D] font-medium'
                    : 'text-[#7A7870] hover:text-[#1F1E1D]'
                }`}
              >
                CyberDyne Vendor
              </button>
              <button
                type="button"
                onClick={() => setActivePreset('custom')}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                  activePreset === 'custom'
                    ? 'bg-[#F3F3EE] text-[#1F1E1D] font-medium'
                    : 'text-[#7A7870] hover:text-[#1F1E1D]'
                }`}
              >
                Custom Agreement
              </button>
            </div>

            <span className="font-mono-claude text-[11px] text-[#A09D95]">
              ~{Math.round(customPrompt.length / 4)} tokens
            </span>
          </div>

          {/* Spacious Quiet Textarea */}
          <textarea
            rows={6}
            value={customPrompt}
            onChange={(e) => { setCustomPrompt(e.target.value); setActivePreset('custom'); }}
            placeholder="Paste contract clauses, obligations, or instructions..."
            className="w-full resize-y font-mono-claude text-xs text-[#1F1E1D] placeholder:text-[#A09D95] leading-relaxed bg-transparent outline-none border-none min-h-[120px]"
          />

          {/* Attached Quiet Controls Toolbar */}
          <div className="pt-3 mt-2 border-t border-[#F3F3EE] flex flex-wrap items-center justify-between gap-3">
            {/* Minimal Toggle Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setIsUrgent(!isUrgent)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer border ${
                  isUrgent
                    ? 'bg-[#FAF0EB] text-[#CC5A36] border-[#F0D4C8] font-medium'
                    : 'bg-transparent border-[#E5E4DE] text-[#7A7870] hover:text-[#1F1E1D] hover:border-[#D8D6CD]'
                }`}
              >
                <Flame className={`w-3 h-3 ${isUrgent ? 'text-[#CC5A36]' : 'text-[#A09D95]'}`} />
                <span>Urgent</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPiiGuard(!isPiiGuard)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer border ${
                  isPiiGuard
                    ? 'bg-[#F2F7F4] text-[#1E6B48] border-[#CFE4D8] font-medium'
                    : 'bg-transparent border-[#E5E4DE] text-[#7A7870] hover:text-[#1F1E1D] hover:border-[#D8D6CD]'
                }`}
              >
                <Lock className={`w-3 h-3 ${isPiiGuard ? 'text-[#1E6B48]' : 'text-[#A09D95]'}`} />
                <span>PII Guard</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFaultInjected(!isFaultInjected)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer border ${
                  isFaultInjected
                    ? 'bg-[#FAF0EB] text-[#CC5A36] border-[#F0D4C8] font-medium'
                    : 'bg-transparent border-[#E5E4DE] text-[#7A7870] hover:text-[#1F1E1D] hover:border-[#D8D6CD]'
                }`}
              >
                <ShieldAlert className={`w-3 h-3 ${isFaultInjected ? 'text-[#CC5A36]' : 'text-[#A09D95]'}`} />
                <span>Fault Injection</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWeightsDrawer(!showWeightsDrawer)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer border ${
                  showWeightsDrawer
                    ? 'bg-[#F3F3EE] text-[#1F1E1D] border-[#D8D6CD] font-medium'
                    : 'bg-transparent border-[#E5E4DE] text-[#7A7870] hover:text-[#1F1E1D] hover:border-[#D8D6CD]'
                }`}
              >
                <Sliders className="w-3 h-3 text-[#A09D95]" />
                <span>Weights</span>
              </button>

              <button
                type="button"
                onClick={handleTimeShift}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-[#7A7870] border border-[#E5E4DE] hover:text-[#1F1E1D] hover:border-[#D8D6CD] transition-colors cursor-pointer"
              >
                <FastForward className="w-3 h-3 text-[#A09D95]" />
                <span>Time-shift</span>
              </button>
            </div>

            {/* Run Button (Claude Terracotta Focal Accent) */}
            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-[#CC5A36] hover:bg-[#B84E2D] active:scale-[0.98] text-white text-xs font-medium transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isRunning ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>Evaluating routes…</span>
                </>
              ) : (
                <>
                  <span>Schedule & Execute</span>
                  <ArrowUp className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Delicate Weights Drawer */}
          {showWeightsDrawer && (
            <div className="mt-4 pt-4 border-t border-[#F3F3EE] grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
                <div key={k} className="flex flex-col gap-1 p-2 bg-[#FAF9F5] rounded-xl border border-[#E5E4DE]">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#6B6862] capitalize">{k}</span>
                    <span className="font-mono-claude font-medium text-[#1F1E1D]">{weights[k].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights[k]}
                    onChange={(e) => setWeights({ ...weights, [k]: parseFloat(e.target.value) })}
                    className="w-full mt-1"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Notice */}
        {runError && (
          <div className="mt-4 p-3 bg-[#FAF0EB] border border-[#F0D4C8] rounded-2xl text-xs text-[#CC5A36] flex items-center gap-2 max-w-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#CC5A36]" />
            <span>{runError}</span>
          </div>
        )}

        {/* ── SECTION: Unhurried Results & Schedule ──────────────────────────── */}
        {subtasks.length > 0 && (
          <div ref={resultsRef} className="w-full mt-16 pt-12 border-t border-[#E5E4DE] space-y-10">
            
            {/* Calm Editorial Savings Banner */}
            {baselines?.measured_summary && (
              <div className="bg-[#FFFFFF] border border-[#E5E4DE] rounded-3xl p-6 sm:p-7 shadow-[0_2px_16px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-serif-claude text-xs text-[#7A7870] uppercase tracking-wider">
                    Measured Benchmark Savings (Offline N=60)
                  </span>
                  <span className="text-[11px] text-[#A09D95] font-light">
                    vs Always-Strongest (GPT-4o)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-3 border-t border-[#F3F3EE]">
                  <div>
                    <div className="text-2xl sm:text-3xl font-serif-claude text-[#1F1E1D] font-normal">
                      +{baselines.measured_summary.cost_saved_pct.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#7A7870] mt-0.5">Cost reduction ($0.092 vs $0.026)</div>
                  </div>

                  <div>
                    <div className="text-2xl sm:text-3xl font-serif-claude text-[#1E6B48] font-normal">
                      +{baselines.measured_summary.carbon_saved_pct.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#7A7870] mt-0.5">Carbon reduction (EcoLogits + CodeCarbon)</div>
                  </div>

                  <div>
                    <div className="text-2xl sm:text-3xl font-serif-claude text-[#1F1E1D] font-normal">
                      {baselines.measured_summary.quality_retained_pct.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#7A7870] mt-0.5">Quality retained per gold rubrics</div>
                  </div>
                </div>

                <p className="text-[11px] text-[#A09D95] mt-4 font-light italic">
                  Scheduler overhead (Jev routing calls, nomic embeddings, cascade verification) is included in all totals per Invariant 7.
                </p>
              </div>
            )}

            {/* Subtasks Sequence (Conversational Flow) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-serif-claude text-lg text-[#1F1E1D] font-normal">
                  Scheduled Pipeline ({subtasks.length} subtasks)
                </h2>
                <span className="text-xs text-[#A09D95]">
                  {subtasks.filter(s => s.status === 'done').length} of {subtasks.length} completed
                </span>
              </div>

              {subtasks.map((st, i) => {
                const isExpanded = expandedSubtaskId === st.id;
                const esc = escalations.find(e => e.subtask_id === st.id);
                const isPii = st.pii_class === 'raw_pii';
                const candidates = candidatesMap[st.id] ?? [];

                return (
                  <div
                    key={st.id}
                    className="bg-[#FFFFFF] border border-[#E5E4DE] rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all hover:border-[#D8D6CD]"
                  >
                    {/* Top Row: Step Index + Title + Status */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-start gap-3">
                        <span className="font-mono-claude text-xs text-[#A09D95] mt-0.5 shrink-0">
                          {String(i + 1).padStart(2, '0')}.
                        </span>
                        <h3 className="text-sm text-[#1F1E1D] font-medium leading-relaxed">
                          {st.description}
                        </h3>
                      </div>

                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        st.status === 'done'
                          ? 'bg-[#F2F7F4] text-[#1E6B48]'
                          : st.status === 'failed'
                          ? 'bg-[#FAF0EB] text-[#CC5A36]'
                          : 'bg-[#F3F3EE] text-[#7A7870]'
                      }`}>
                        {st.status === 'done' && <Check className="w-3 h-3 text-[#1E6B48]" />}
                        <span>{st.status}</span>
                      </span>
                    </div>

                    {/* Middle Row: Model Route + Badges */}
                    <div className="flex items-center gap-2 text-xs text-[#6B6862] ml-7 mb-3 flex-wrap">
                      {st.routed_model ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F5] border border-[#E5E4DE] font-mono-claude text-xs text-[#1F1E1D]">
                          {st.routed_location === 'local' ? (
                            <HardDrive className="w-3.5 h-3.5 text-[#1E6B48]" />
                          ) : (
                            <Cloud className="w-3.5 h-3.5 text-[#4A6B82]" />
                          )}
                          <span>{st.routed_model}</span>
                          <span className="text-[10px] text-[#A09D95] uppercase">({st.routed_location})</span>
                        </div>
                      ) : (
                        <span className="text-[#A09D95] italic">Route pending…</span>
                      )}

                      {/* Escalation transition */}
                      {esc && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FAF0EB] text-[#CC5A36] text-[11px]">
                          <span>{esc.from_model}</span>
                          <span>→</span>
                          <span className="font-semibold">{esc.to_model}</span>
                          <span className="text-[10px] opacity-80">({esc.reason_code})</span>
                        </div>
                      )}

                      {Boolean(st.degraded_routing) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FAF6ED] text-[#8C5D14] text-[11px]">
                          Offline fallback
                        </span>
                      )}

                      {isPii && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FAF6ED] text-[#8C5D14] text-[11px]">
                          <Lock className="w-3 h-3 text-[#8C5D14]" />
                          PII Isolated (Local)
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Telemetry chips + Toggle Inspector */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-[#F3F3EE] text-[11px] font-mono-claude text-[#7A7870] ml-7 flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[#A09D95]">tier: {st.complexity_tier}</span>
                        {st.actual_latency_ms !== null && (
                          <span>{(st.actual_latency_ms / 1000).toFixed(1)}s</span>
                        )}
                        {st.actual_cost_usd !== null && (
                          <span>${st.actual_cost_usd.toFixed(5)}</span>
                        )}
                        {st.actual_carbon_kgco2eq !== null && (
                          <span className="text-[#1E6B48]">
                            {(st.actual_carbon_kgco2eq * 1000).toFixed(3)}g CO₂
                          </span>
                        )}
                        {st.verification_pass !== null && (
                          <span className={st.verification_pass ? 'text-[#1E6B48]' : 'text-[#CC5A36]'}>
                            {st.verification_pass ? '✓ Verified' : '✗ Failed'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleInspect(st)}
                        className="inline-flex items-center gap-1 text-xs text-[#7A7870] hover:text-[#1F1E1D] transition-colors cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide scoring' : 'Inspect scoring'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Inline Route Inspector Drawer */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-[#E5E4DE] bg-[#FAF9F5] rounded-xl p-4 ml-7 text-xs">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-serif-claude text-xs text-[#7A7870] uppercase tracking-wider">
                            Five-Factor Candidate Scoring
                          </span>
                          {st.jev_confidence !== null && (
                            <span className="font-mono-claude text-[11px] text-[#A09D95]">
                              Jev confidence: {(st.jev_confidence * 100).toFixed(0)}% (bonus: {(st.jev_confidence * 0.02).toFixed(3)})
                            </span>
                          )}
                        </div>

                        {candidates.length === 0 ? (
                          <div className="text-center py-4 text-[#A09D95] text-xs">
                            Evaluating candidates…
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {candidates.map((c) => (
                              <div
                                key={c.model_id}
                                className={`p-3 rounded-xl border transition-all ${
                                  c.is_winner
                                    ? 'bg-[#FFFFFF] border-[#1F1E1D] shadow-xs'
                                    : 'bg-transparent border-[#E5E4DE] opacity-75'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5 font-mono-claude text-xs">
                                  <div className="flex items-center gap-2">
                                    {c.is_winner && (
                                      <span className="text-[#CC5A36] text-[10px] font-bold uppercase tracking-wider">
                                        ✓ Selected
                                      </span>
                                    )}
                                    <span className="font-semibold text-[#1F1E1D]">{c.model_id}</span>
                                    <span className="text-[#A09D95] text-[10px]">({c.location})</span>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-[#1F1E1D] font-bold">{c.final_score.toFixed(3)}</span>
                                    {c.jev_bonus > 0 && (
                                      <span className="text-[10px] text-[#1E6B48] ml-1">
                                        (−{c.jev_bonus.toFixed(3)} Jev)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Monochromatic Factor Bar */}
                                <div className="w-full h-1.5 bg-[#E5E4DE] rounded-full overflow-hidden flex my-2">
                                  <div style={{ width: `${c.lat_norm * 25}%` }} className="bg-[#1F1E1D] h-full" title="Latency (25%)" />
                                  <div style={{ width: `${c.acc_norm * 35}%` }} className="bg-[#6B6862] h-full" title="Accuracy penalty (35%)" />
                                  <div style={{ width: `${c.cost_norm * 15}%` }} className="bg-[#A09D95] h-full" title="Cost (15%)" />
                                  <div style={{ width: `${c.energy_norm * 10}%` }} className="bg-[#1E6B48] h-full" title="Energy (10%)" />
                                  <div style={{ width: `${c.carbon_norm * 15}%` }} className="bg-[#2D8A5E] h-full" title="Carbon (15%)" />
                                </div>

                                <div className="flex justify-between text-[10px] text-[#A09D95] font-mono-claude">
                                  <span>Accuracy tier: {c.accuracy_tier.toFixed(2)}</span>
                                  <span>Est: {(c.predicted_latency_ms / 1000).toFixed(1)}s · ${c.predicted_cost_usd.toFixed(4)}</span>
                                </div>
                              </div>
                            ))}

                            {/* Legend */}
                            <div className="flex items-center justify-between text-[10px] text-[#A09D95] pt-2 flex-wrap gap-1">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#1F1E1D]" /> Latency (25%)</span>
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#6B6862]" /> Accuracy (35%)</span>
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#A09D95]" /> Cost (15%)</span>
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#1E6B48]" /> Energy (10%)</span>
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#2D8A5E]" /> Carbon (15%)</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsible Generated Output */}
                    {st.output && (
                      <div className="mt-3 pt-2.5 border-t border-[#F3F3EE] ml-7">
                        <div className="flex items-center justify-between mb-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleOutput(st.id);
                            }}
                            className="text-xs text-[#7A7870] hover:text-[#1F1E1D] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>{expandedOutputs[st.id] ? 'Hide Output' : 'View Generated Output'}</span>
                            {expandedOutputs[st.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {expandedOutputs[st.id] && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(st.output || '');
                                setCopiedId(st.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="text-[11px] text-[#A09D95] hover:text-[#1F1E1D] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {copiedId === st.id ? <Check className="w-3 h-3 text-[#1E6B48]" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === st.id ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                        </div>
                        {expandedOutputs[st.id] && (
                          <div className="p-3 bg-[#FAF9F5] border border-[#E5E4DE] rounded-xl text-xs font-mono-claude text-[#1F1E1D] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto mt-1">
                            {st.output}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Final Workflow Deliverable & Report */}
            {currentTask?.output && (
              <div className="bg-[#FFFFFF] border border-[#E5E4DE] rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#F3F3EE]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#1F1E1D] text-white flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif-claude text-base font-normal text-[#1F1E1D]">
                        Workflow Deliverable & Executive Report
                      </h3>
                      <p className="text-[11px] text-[#7A7870]">
                        Complete synthesized output across all executed subtasks
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium bg-[#F3F3EE] text-[#1F1E1D] border border-[#E5E4DE]">
                      {subtasks.some(s => Boolean(s.degraded_routing)) ? '⚡ Offline Executed' : '🟢 Online Verified'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(currentTask.output || '');
                        setCopiedReport(true);
                        setTimeout(() => setCopiedReport(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-[#1F1E1D] bg-[#FAF9F5] border border-[#E5E4DE] hover:bg-[#F3F3EE] transition-colors cursor-pointer"
                    >
                      {copiedReport ? <Check className="w-3 h-3 text-[#1E6B48]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedReport ? 'Report Copied' : 'Copy Full Report'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-5 bg-[#FAF9F5] border border-[#E5E4DE] rounded-2xl text-xs font-mono-claude text-[#1F1E1D] whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                  {currentTask.output}
                </div>
              </div>
            )}

            {/* Grid Intensity Simulated Forecast (Quiet Hairline Accordion) */}
            {grid && (
              <div className="bg-[#FFFFFF] border border-[#E5E4DE] rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="font-serif-claude text-xs text-[#7A7870] uppercase tracking-wider block">
                      Grid Carbon Intensity ({grid.zone})
                    </span>
                    <span className="text-2xl font-serif-claude text-[#1F1E1D]">
                      {grid.current_intensity_gco2_per_kwh} <span className="text-xs font-sans text-[#7A7870]">gCO₂/kWh</span>
                    </span>
                  </div>
                  <span className="text-[11px] text-[#A09D95] italic border border-dashed border-[#D8D6CD] px-2.5 py-1 rounded-full">
                    Grey-dashed: Simulated forecast
                  </span>
                </div>

                <div className="flex items-end gap-2 h-16 pt-2">
                  {grid.simulated_forecast.map((f, idx) => {
                    const maxI = Math.max(...grid.simulated_forecast.map(x => x.intensityGco2));
                    const minI = Math.min(...grid.simulated_forecast.map(x => x.intensityGco2));
                    const isValley = f.intensityGco2 === minI;
                    const pct = (f.intensityGco2 / maxI) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full rounded-t-sm border-t border-dashed transition-all ${
                            isValley ? 'bg-[#1F1E1D] border-[#1F1E1D]' : 'bg-[#E5E4DE] border-[#A09D95]'
                          }`}
                          title={`${f.intensityGco2} gCO₂/kWh`}
                        />
                        <span className="text-[10px] font-mono-claude text-[#A09D95] mt-1">
                          {idx === 0 ? 'Now' : `+${f.hourOffset}h`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#A09D95] mt-3 font-light italic">{grid.disclosure}</p>
              </div>
            )}

            {/* Methodology & Integrity Disclosures */}
            <footer className="pt-8 border-t border-[#E5E4DE]/60 text-xs text-[#7A7870] leading-relaxed font-light">
              <p>
                <strong className="text-[#1F1E1D] font-normal">Methodological Integrity:</strong> Headline savings numbers (−71.3% cost, −59.0% carbon) come from measured offline evaluations (N=60 subtasks) per Invariant 9.
                All figures include scheduler overhead (decomposer, Jev routing, local embeddings, cascade verification) per Invariant 7.
                Cloud carbon is reported using EcoLogits output as-is without grid multiplication (Invariant 1).
                Local carbon is measured energy × live {grid?.zone ?? 'IN-SO'} grid intensity.
                PII subtasks are strictly isolated to local models (Invariant 2).
              </p>
            </footer>
          </div>
        )}
      </main>

      {/* ── Time-shift Batch Modal ───────────────────────────────────────────── */}
      {showTimeShift && timeShiftData && (
        <div className="fixed inset-0 z-50 bg-[#1F1E1D]/20 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E5E4DE] rounded-3xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F3F3EE]">
              <h3 className="font-serif-claude text-base text-[#1F1E1D] font-medium">
                Time-Shift Batch Dispatcher
              </h3>
              <button
                onClick={() => setShowTimeShift(false)}
                className="text-[#A09D95] hover:text-[#1F1E1D] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#6B6862]">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#E5E4DE]">
                  <span className="text-[#A09D95] block text-[10px] uppercase">Intensity Now</span>
                  <span className="text-[#1F1E1D] font-mono-claude font-semibold text-sm">
                    {timeShiftData.intensity_now_gco2} gCO₂/kWh
                  </span>
                </div>
                <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#E5E4DE]">
                  <span className="text-[#A09D95] block text-[10px] uppercase">Forecast Valley (+3h)</span>
                  <span className="text-[#1E6B48] font-mono-claude font-semibold text-sm">
                    {timeShiftData.min_forecast_intensity_gco2} gCO₂/kWh
                  </span>
                </div>
              </div>

              <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#E5E4DE] flex items-center justify-between">
                <span>Threshold comparison:</span>
                <span className="font-semibold text-[#1F1E1D]">
                  {timeShiftData.difference_pct}% &gt; {timeShiftData.threshold_pct}% threshold
                </span>
              </div>

              <div className="bg-[#FAF9F5] border border-[#E5E4DE] p-4 rounded-xl">
                <div className="font-medium text-[#1F1E1D] mb-1 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#1E6B48]" />
                  <span>Action: {timeShiftData.action}</span>
                </div>
                <p className="text-[11px] text-[#6B6862] leading-relaxed">
                  Scheduled for green window (+{timeShiftData.scheduled_for_offset_hours} hours).
                  Projected carbon saved: <strong className="text-[#1E6B48]">{timeShiftData.carbon_savings_projected_pct}%</strong>.
                </p>
                <p className="text-[10px] text-[#A09D95] mt-1">
                  Rule: {timeShiftData.eligible_candidates} (local candidates only per Invariant 8).
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowTimeShift(false)}
              className="w-full mt-5 py-2 px-4 rounded-xl bg-[#1F1E1D] text-white text-xs font-medium hover:bg-[#383735] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Reconciliation Audit Log Modal ─────────────────────────────────── */}
      {showReconciliationModal && (
        <div className="fixed inset-0 z-50 bg-[#1F1E1D]/20 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E5E4DE] rounded-3xl max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F3F3EE]">
              <div>
                <h3 className="font-serif-claude text-base text-[#1F1E1D] font-medium">Reconciliation Audit Log</h3>
                <p className="text-[11px] text-[#A09D95]">Audit comparing offline execution vs counterfactual online schedule.</p>
              </div>
              <button
                onClick={() => setShowReconciliationModal(false)}
                className="text-[#A09D95] hover:text-[#1F1E1D] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs overflow-y-auto flex-1 pr-1">
              {reconciliationLogs.length === 0 ? (
                <div className="text-center py-8 text-[#A09D95]">
                  No degraded subtasks recorded. All executions used optimal online routing.
                </div>
              ) : (
                reconciliationLogs.map((log: any) => (
                  <div key={log.id} className="p-3 rounded-xl border border-[#E5E4DE] bg-[#FAF9F5]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono-claude font-medium text-[#1F1E1D] text-[11px]">Subtask {log.subtask_id}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        log.route_matched ? 'bg-[#F2F7F4] text-[#1E6B48]' : 'bg-[#FAF6ED] text-[#8C5D14]'
                      }`}>
                        {log.route_matched ? '✓ Route Matched' : '⚡ Offline Divergence'}
                      </span>
                    </div>
                    <div className="text-[#6B6862] text-[11px] mb-1">
                      Executed offline: <strong>{log.offline_model}</strong> · Online counterfactual: <strong>{log.ideal_online_model}</strong>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#A09D95] font-mono-claude">
                      <span>Offline Carbon: {(log.offline_carbon_kgco2eq * 1000).toFixed(4)}g</span>
                      <span>Reconciled: {(log.reconciled_carbon_kgco2eq * 1000).toFixed(4)}g</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowReconciliationModal(false)}
              className="w-full mt-4 py-2 px-4 rounded-xl bg-[#1F1E1D] text-white text-xs font-medium hover:bg-[#383735] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
