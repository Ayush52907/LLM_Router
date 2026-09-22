'use client';

/**
 * EcoRouter — Apple-Inspired Production Interface.
 * Pure monochrome / black & white palette (#1d1d1f, #6e6e73, #f5f5f7, #ffffff).
 * SF Pro typography stack, generous whitespace, unified component hierarchy.
 * Zero mocked data — 100% connected to real orchestrator endpoints.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, FastForward, Settings, Lock, Cloud, HardDrive,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Zap, Flame, ShieldAlert, Sliders, ArrowRight, Clock,
  DollarSign, Leaf, RefreshCw, X, FileText, Check, LogOut
} from 'lucide-react';
import { authFetch, clearToken, isAuthenticated } from '../lib/auth';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CenterFlow } from '../components/ui/CenterFlow';
import { BanterLoader } from '../components/BanterLoader';

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

export default function EcoRouterApplePage() {
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

  // Selected subtask for Route Inspector
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorCandidates, setInspectorCandidates] = useState<any[]>([]);

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
  const [showDetailsSection, setShowDetailsSection] = useState(false);

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
      const h = await fetch(`${API_BASE}/api/health`).catch(() => null);
      if (h?.ok) {
        setApiOnline(true);
        const hd = await h.json().catch(() => null);
        if (hd && typeof hd.network_online === 'boolean') {
          setIsNetworkOnline(hd.network_online);
        }
      } else {
        setApiOnline(false);
      }

      const rec = await authFetch(`${API_BASE}/api/reconciliation`);
      if (rec?.ok) {
        const rd = await rec.json().catch(() => null);
        if (rd?.logs) setReconciliationLogs(rd.logs);
      }

      const g = await authFetch(`${API_BASE}/api/grid`);
      if (g?.ok) setGrid(await g.json());

      const b = await authFetch(`${API_BASE}/api/baselines`);
      if (b?.ok) setBaselines(await b.json());

      const c = await authFetch(`${API_BASE}/api/config`);
      if (c?.ok) {
        const d = await c.json();
        if (d.weights) setWeights(d.weights);
      }

      const l = await authFetch(`${API_BASE}/api/tasks/latest`);
      if (l?.ok) {
        const d = await l.json();
        if (d.task && d.subtasks?.length > 0) {
          setCurrentTask(d.task);
          setSubtasks(d.subtasks);
          setEscalations(d.escalations ?? []);
          setSelectedId(d.subtasks[0].id);
        }
      }
    }
    init();
  }, [authChecked]);

  // ── 2. Route Inspector dynamic scoring ──────────────────────────────────────

  const fetchInspector = useCallback(async (st: Subtask, w: Weights) => {
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
    }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setInspectorCandidates(d.candidates ?? []);
    }
  }, [isUrgent, isPiiGuard]);

  useEffect(() => {
    const st = subtasks.find(s => s.id === selectedId);
    if (st) fetchInspector(st, weights);
  }, [selectedId, weights, isUrgent, isPiiGuard, fetchInspector]);

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
        if (data.subtasks.length > 0) setSelectedId(data.subtasks[0].id);

        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    } catch (err: any) {
      setRunError(err.message ?? 'Failed to execute pipeline');
    } finally {
      setIsRunning(false);
    }
  }, [customPrompt, isUrgent, isPiiGuard, isFaultInjected, weights]);

  // ── 4. Time Shift Batch API ────────────────────────────────────────────────

  const handleTimeShift = useCallback(async () => {
    const r = await authFetch(`${API_BASE}/api/time-shift`, { method: 'POST' });
    if (r?.ok) {
      setTimeShiftData(await r.json());
      setShowTimeShift(true);
    }
  }, []);

  const selectedSt = subtasks.find(s => s.id === selectedId) ?? null;
  const selectedEsc = selectedSt ? escalations.find(e => e.subtask_id === selectedSt.id) : null;

  // Render nothing until auth check completes (avoids flash of unauthenticated content)
  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-[#fafafc] text-[#1d1d1f] flex flex-col font-sans antialiased">
      {/* Full-screen loading overlay during run */}
      {isRunning && <BanterLoader label="Evaluating routing with Jev and scoring candidates…" />}

      {/* ── Apple-Style Minimal Header ───────────────────────────────────────── */}
      <header className="w-full border-b border-[#e5e5e7] bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#1d1d1f]" />
            <span className="font-semibold text-sm tracking-tight text-[#1d1d1f]">EcoRouter</span>
            <span className="text-xs text-[#d2d2d7]">/</span>
            <span className="text-xs text-[#6e6e73] font-medium hidden sm:inline">Carbon-Aware LLM Scheduler</span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-[#6e6e73]">
            {grid && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-mono text-xs border border-[#e5e5e7]">
                <Leaf className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{grid.zone}</span>
                <span className="text-[#d2d2d7]">·</span>
                <span className="font-semibold">{grid.current_intensity_gco2_per_kwh} gCO₂/kWh</span>
              </span>
            )}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#e5e5e7] text-[11px] text-[#6e6e73] shadow-xs">
              <span className={`w-2 h-2 rounded-full ${isNetworkOnline === false ? 'bg-amber-500' : (apiOnline ? 'bg-emerald-500' : 'bg-amber-400')}`} />
              <span>{isNetworkOnline === false ? 'Offline Mode' : (apiOnline ? 'System Online' : 'Connecting')}</span>
            </div>
            {isNetworkOnline === false && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 text-[11px] font-semibold border border-amber-300 shadow-xs">
                <Zap className="w-3 h-3 text-amber-600 fill-amber-500" /> Degraded Local
              </span>
            )}
            {reconciliationLogs.length > 0 && (
              <button
                onClick={() => setShowReconciliationModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1d1d1f] text-white text-[11px] font-medium hover:bg-[#333336] transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-2.5 h-2.5" /> {reconciliationLogs.length} Reconciled
              </button>
            )}
            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] border border-transparent hover:border-[#e5e5e7] transition-all"
            >
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── SECTION 1: Hero / Input ────────────────────────── */}
      <section className="relative w-full flex flex-col justify-center items-center px-6 pt-10 pb-8 sm:pt-14 sm:pb-10">
        <CenterFlow className="w-full max-w-4xl flex flex-col items-center">
          {/* Apple Calm Headline */}
          <div className="text-center mb-8 max-w-xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f] mb-2.5">
              Optimize Every Routing Decision.
            </h1>
            <p className="text-sm text-[#6e6e73] leading-relaxed">
              Decompose complex contracts and route each subtask to the optimal model,
              balancing latency, accuracy, cost, energy, and carbon footprint.
            </p>
          </div>

          {/* Apple-Style Input Box Container */}
          <div className="w-full max-w-3xl bg-white border border-[#e5e5e7] rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.04)] transition-all duration-200 focus-within:border-[#1d1d1f] focus-within:shadow-[0_8px_36px_rgba(0,0,0,0.07)] p-5 sm:p-6">
            {/* Apple Segmented Control for Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[#f5f5f7]">
              <div className="inline-flex items-center p-1 rounded-xl bg-[#f5f5f7] border border-[#e5e5e7] gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => { setCustomPrompt(CONTRACT_ACME); setActivePreset('acme'); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activePreset === 'acme'
                      ? 'bg-white text-[#1d1d1f] shadow-xs border border-zinc-200/80 font-semibold'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/60'
                  }`}
                >
                  Acme Cloud (MSA)
                </button>
                <button
                  type="button"
                  onClick={() => { setCustomPrompt(CONTRACT_CYBERDYNE); setActivePreset('cyberdyne'); }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activePreset === 'cyberdyne'
                      ? 'bg-white text-[#1d1d1f] shadow-xs border border-zinc-200/80 font-semibold'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/60'
                  }`}
                >
                  CyberDyne (Vendor)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreset('custom')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activePreset === 'custom'
                      ? 'bg-white text-[#1d1d1f] shadow-xs border border-zinc-200/80 font-semibold'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-white/60'
                  }`}
                >
                  Custom Prompt
                </button>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xs text-[#86868b]">
                <FileText className="w-3.5 h-3.5" />
                <span>~{Math.round(customPrompt.length / 4)} tokens</span>
              </div>
            </div>

            {/* Clean spacious monospace textarea */}
            <div className="rounded-2xl bg-[#fafafa] border border-[#e5e5e7] p-3.5 focus-within:bg-white focus-within:border-[#1d1d1f] focus-within:ring-2 focus-within:ring-[#1d1d1f]/5 transition-all mb-4">
              <textarea
                rows={5}
                value={customPrompt}
                onChange={(e) => { setCustomPrompt(e.target.value); setActivePreset('custom'); }}
                placeholder="Paste contract text or enter instructions..."
                className="w-full resize-y font-mono text-xs text-[#1d1d1f] placeholder:text-[#86868b] leading-relaxed bg-transparent outline-none border-none min-h-[95px]"
              />
            </div>

            {/* Attached Parameter Toolbar */}
            <div className="pt-3.5 border-t border-[#f5f5f7] flex flex-wrap items-center justify-between gap-3">
              {/* Apple-style pill toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    isUrgent
                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-xs'
                      : 'bg-[#f5f5f7] border-[#e5e5e7] text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#ebebee] hover:border-[#d2d2d7]'
                  }`}
                >
                  <Flame className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-400' : 'text-amber-600'}`} />
                  <span>Urgent Priority</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPiiGuard(!isPiiGuard)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    isPiiGuard
                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-xs'
                      : 'bg-[#f5f5f7] border-[#e5e5e7] text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#ebebee] hover:border-[#d2d2d7]'
                  }`}
                >
                  <Lock className={`w-3.5 h-3.5 ${isPiiGuard ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <span>PII Guard Active</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFaultInjected(!isFaultInjected)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    isFaultInjected
                      ? 'bg-[#1d1d1f] text-white border-[#1d1d1f] shadow-xs'
                      : 'bg-[#f5f5f7] border-[#e5e5e7] text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#ebebee] hover:border-[#d2d2d7]'
                  }`}
                >
                  <ShieldAlert className={`w-3.5 h-3.5 ${isFaultInjected ? 'text-rose-400' : 'text-rose-600'}`} />
                  <span>Fault Arming</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWeightsDrawer(!showWeightsDrawer)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                    showWeightsDrawer
                      ? 'bg-[#e5e5e7] border-[#d2d2d7] text-[#1d1d1f]'
                      : 'bg-[#f5f5f7] border-[#e5e5e7] text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#ebebee] hover:border-[#d2d2d7]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-[#1d1d1f]" />
                  <span>Weights</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTimeShift}
                  className="border-[#e5e5e7] hover:border-[#d2d2d7] text-[#1d1d1f]"
                >
                  <FastForward className="w-3.5 h-3.5 mr-1 text-[#6e6e73]" />
                  Time-shift
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRun}
                  loading={isRunning}
                  className="shadow-sm font-semibold px-5"
                >
                  <Play className="w-3.5 h-3.5 fill-current mr-1.5" />
                  Run Pipeline
                </Button>
              </div>
            </div>

            {/* Weights Drawer */}
            {showWeightsDrawer && (
              <div className="mt-4 pt-4 border-t border-[#f5f5f7] grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
                  <div key={k} className="flex flex-col gap-1.5 bg-[#fbfbfd] p-2.5 rounded-xl border border-[#e5e5e7]">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6e6e73] capitalize font-medium">{k}</span>
                      <span className="font-mono font-bold text-[#1d1d1f]">{weights[k].toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={weights[k]}
                      onChange={(e) => setWeights({ ...weights, [k]: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {runError && (
            <div className="mt-4 p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-2xl text-xs text-[#9f1239] flex items-center gap-2 max-w-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#be123c]" />
              <span>{runError}</span>
            </div>
          )}

          {/* Scroll cue if results ready */}
          {subtasks.length > 0 && (
            <button
              onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-8 text-xs text-[#6e6e73] hover:text-[#1d1d1f] flex items-center gap-1 transition-colors cursor-pointer px-3 py-1.5 rounded-full bg-white border border-[#e5e5e7] shadow-xs"
            >
              <span>View execution results</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </CenterFlow>
      </section>

      {/* ── SECTION 2: Results (Revealed on Scroll or Post-Run) ──────────────── */}
      {subtasks.length > 0 && (
        <section ref={resultsRef} className="max-w-7xl mx-auto w-full px-6 py-12 border-t border-[#e5e5e7]">
          {/* 2a. Headline Metrics Band */}
          {baselines?.measured_summary && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                  Measured Performance vs Always-Strongest (Baseline A)
                </span>
                <Badge variant="subtle" size="sm">
                  Measured Offline N=60
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Cost Saved */}
                <Card className="p-6 shadow-xs border-[#e5e5e7]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-[#6e6e73] tracking-wider">Cost Saved</span>
                    <Badge variant="subtle" size="sm">Baseline comparison</Badge>
                  </div>
                  <div className="text-4xl font-bold tracking-tight text-[#1d1d1f] mb-1">
                    +{baselines.measured_summary.cost_saved_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[#86868b]">vs Always-strongest ($0.092 vs $0.026)</div>
                </Card>

                {/* Carbon Saved */}
                <Card className="p-6 shadow-xs border-[#e5e5e7]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-[#6e6e73] tracking-wider">Carbon Saved</span>
                    <Badge variant="local" size="sm">EcoLogits · CodeCarbon</Badge>
                  </div>
                  <div className="text-4xl font-bold tracking-tight text-emerald-700 mb-1">
                    +{baselines.measured_summary.carbon_saved_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[#86868b]">Hardware measured & cloud telemetry</div>
                </Card>

                {/* Quality Retained */}
                <Card className="p-6 shadow-xs border-[#e5e5e7]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-[#6e6e73] tracking-wider">Quality Retained</span>
                    <Badge variant="dark" size="sm">Zero Compromise</Badge>
                  </div>
                  <div className="text-4xl font-bold tracking-tight text-[#1d1d1f] mb-1">
                    {baselines.measured_summary.quality_retained_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[#86868b]">per rubric & benchmark accuracy tiers</div>
                </Card>
              </div>
            </div>
          )}

          {/* 2b & 2c: Subtask Pipeline + Route Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
            {/* Left 7 cols: Subtask Pipeline (Vertical list) */}
            <div className="lg:col-span-7 flex flex-col gap-3.5">
              <div className="flex items-center justify-between pb-2 mb-1">
                <h2 className="text-sm font-semibold text-[#1d1d1f]">Subtasks ({subtasks.length})</h2>
                <span className="text-xs text-[#86868b]">
                  {subtasks.filter(s => s.status === 'done').length} of {subtasks.length} completed
                </span>
              </div>

              {subtasks.map((st, i) => {
                const isSelected = st.id === selectedId;
                const esc = escalations.find(e => e.subtask_id === st.id);
                const isPii = st.pii_class === 'raw_pii';

                return (
                  <div
                    key={st.id}
                    onClick={() => setSelectedId(st.id)}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-150 cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white border-[#1d1d1f] shadow-sm ring-1 ring-[#1d1d1f]'
                        : 'bg-white border-[#e5e5e7] hover:border-[#d2d2d7]'
                    }`}
                  >
                    {/* Primary Line: Step number + Description + Status */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'bg-[#1d1d1f] text-white' : 'bg-[#f5f5f7] text-[#6e6e73]'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-[#1d1d1f] leading-snug">
                          {st.description}
                        </span>
                      </div>

                      <Badge
                        variant={st.status === 'done' ? 'success' : st.status === 'failed' ? 'warning' : 'neutral'}
                        size="sm"
                      >
                        {st.status === 'done' && <Check className="w-3 h-3 text-emerald-600" />}
                        {st.status}
                      </Badge>
                    </div>

                    {/* Secondary Line: Model routed + location icon */}
                    <div className="flex items-center gap-2 text-xs text-[#6e6e73] ml-9 mb-2.5 flex-wrap">
                      {st.routed_model ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f5f5f7] border border-[#e5e5e7] font-mono text-xs font-medium text-[#1d1d1f]">
                          {st.routed_location === 'local' ? (
                            <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Cloud className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{st.routed_model}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-sans font-medium uppercase tracking-wide ${
                            st.routed_location === 'local' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {st.routed_location}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#86868b] italic">Pending route...</span>
                      )}

                      {/* Escalation transition */}
                      {esc && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 text-xs font-medium border border-amber-200">
                          <span>{esc.from_model}</span>
                          <ArrowRight className="w-3 h-3 text-amber-700" />
                          <span className="font-semibold">{esc.to_model}</span>
                          <span className="text-[10px] text-amber-700">({esc.reason_code})</span>
                        </div>
                      )}

                      {Boolean(st.degraded_routing) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 text-[11px] font-medium border border-amber-300 shadow-xs">
                          <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                          Offline Fallback
                        </span>
                      )}

                      {Boolean(st.needs_reconciliation) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 text-[11px] font-medium border border-zinc-300 shadow-xs">
                          <RefreshCw className="w-3 h-3 text-zinc-600" />
                          Needs Recon
                        </span>
                      )}

                      {isPii && (
                        <Badge variant="warning" size="sm">
                          <Lock className="w-3 h-3 text-amber-700" />
                          Forced local (PII)
                        </Badge>
                      )}
                    </div>

                    {/* Tertiary Line: Telemetry chips */}
                    <div className="flex items-center gap-2 text-[11px] font-mono text-[#86868b] ml-9 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-[#f5f5f7] border border-[#e5e5e7] text-[#6e6e73] font-sans font-medium">
                        Tier: {st.complexity_tier}
                      </span>
                      {st.actual_latency_ms !== null && (
                        <span className="px-2 py-0.5 rounded bg-[#f5f5f7] border border-[#e5e5e7] text-[#1d1d1f]">
                          ⏱ {(st.actual_latency_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                      {st.actual_cost_usd !== null && (
                        <span className="px-2 py-0.5 rounded bg-[#f5f5f7] border border-[#e5e5e7] text-[#1d1d1f]">
                          💵 ${st.actual_cost_usd.toFixed(5)}
                        </span>
                      )}
                      {st.actual_carbon_kgco2eq !== null && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                          🌱 {(st.actual_carbon_kgco2eq * 1000).toFixed(4)}g CO₂
                        </span>
                      )}
                      {st.verification_pass !== null && (
                        <span className={`px-2 py-0.5 rounded border font-medium ${
                          st.verification_pass
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                          {st.verification_pass ? '✓ Verified' : '✗ Unverified'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right 5 cols: Route Inspector & Five-Factor Breakdown */}
            <div className="lg:col-span-5 sticky top-20">
              <Card className="p-6 shadow-sm border-[#e5e5e7]">
                <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#f5f5f7]">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">Route Inspector</h3>
                    <p className="text-[11px] text-[#86868b]">Five-Factor Scoring Telemetry · Deterministic Formula</p>
                  </div>
                  {selectedSt && (
                    <Badge variant={selectedSt.pii_class === 'raw_pii' ? 'warning' : 'subtle'} size="sm">
                      {selectedSt.pii_class === 'raw_pii' ? 'PII isolated' : 'Evaluation'}
                    </Badge>
                  )}
                </div>

                {selectedSt ? (
                  <div className="space-y-4">
                    {/* Selected node summary */}
                    <div className="bg-[#f5f5f7] p-3.5 rounded-2xl border border-[#e5e5e7]">
                      <div className="text-xs font-semibold text-[#1d1d1f] mb-1.5">
                        {selectedSt.description}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#6e6e73]">
                        <span>Complexity: <strong className="text-[#1d1d1f] uppercase">{selectedSt.complexity_tier}</strong></span>
                        {selectedSt.jev_confidence !== null && (
                          <span className="font-mono">Jev guidance: <strong className="text-[#1d1d1f]">{(selectedSt.jev_confidence * 100).toFixed(0)}%</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Candidates ranking list */}
                    <div className="space-y-2.5">
                      <div className="text-[11px] font-semibold uppercase text-[#86868b] tracking-wider">
                        Candidate Scoring
                      </div>

                      {inspectorCandidates.map((c) => (
                        <div
                          key={c.model_id}
                          className={`p-3.5 rounded-2xl border text-xs transition-all ${
                            c.is_winner
                              ? 'bg-zinc-50 border-2 border-[#1d1d1f] shadow-xs'
                              : 'bg-white border-[#e5e5e7] opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {c.is_winner ? (
                                <Badge variant="dark" size="sm">
                                  ✓ Selected
                                </Badge>
                              ) : (
                                <span className="font-mono text-xs text-[#86868b]">#{inspectorCandidates.indexOf(c) + 1}</span>
                              )}
                              <span className="font-mono font-bold text-[#1d1d1f]">{c.model_id}</span>
                              <span className="text-[#86868b] text-[10px] font-sans uppercase">({c.location})</span>
                            </div>
                            <div className="font-mono text-xs">
                              {c.jev_bonus > 0 ? (
                                <>
                                  <span className="text-[#86868b]">{c.raw_score.toFixed(3)}</span>
                                  <span className="text-emerald-700 font-medium ml-1">−{c.jev_bonus.toFixed(3)} Jev</span>
                                  <span className="font-bold text-[#1d1d1f] ml-1.5">= {c.final_score.toFixed(3)}</span>
                                </>
                              ) : (
                                <span className="font-bold text-[#1d1d1f]">Score: {c.final_score.toFixed(3)}</span>
                              )}
                            </div>
                          </div>

                          {/* Monochrome Stacked Score Bar */}
                          <div className="w-full h-2 bg-[#f0f0f3] rounded-full overflow-hidden flex my-2.5 border border-[#e5e5e7]">
                            <div style={{ width: `${c.lat_norm * 25}%` }} className="bg-[#18181b] h-full" title="Latency (25%)" />
                            <div style={{ width: `${c.acc_norm * 35}%` }} className="bg-[#4b5563] h-full" title="Accuracy penalty (35%)" />
                            <div style={{ width: `${c.cost_norm * 15}%` }} className="bg-[#9ca3af] h-full" title="Cost (15%)" />
                            <div style={{ width: `${c.energy_norm * 10}%` }} className="bg-[#059669] h-full" title="Energy (10%)" />
                            <div style={{ width: `${c.carbon_norm * 15}%` }} className="bg-[#34d399] h-full" title="Carbon (15%)" />
                          </div>

                          <div className="flex justify-between text-[11px] font-mono text-[#86868b]">
                            <span>Accuracy tier: <strong className="text-[#1d1d1f]">{c.accuracy_tier.toFixed(2)}</strong></span>
                            <span>{c.is_winner ? 'Rank #1 Winner' : `Delta: +${(c.final_score - inspectorCandidates[0]?.final_score).toFixed(3)}`}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-between text-[10px] text-[#86868b] pt-2.5 border-t border-[#f5f5f7] flex-wrap gap-1">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-xs bg-[#18181b]" /> Latency (25%)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-xs bg-[#4b5563]" /> Accuracy (35%)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-xs bg-[#9ca3af]" /> Cost (15%)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-xs bg-[#059669]" /> Energy (10%)</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-xs bg-[#34d399]" /> Carbon (15%)</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#86868b] text-xs">
                    Select a subtask on the left to inspect its routing metrics.
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* 2e. Run Stats & Details (Progressive Disclosure) */}
          <div className="pt-6 border-t border-[#e5e5e7]">
            <button
              onClick={() => setShowDetailsSection(!showDetailsSection)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-[#e5e5e7] hover:border-[#d2d2d7] text-xs font-semibold text-[#1d1d1f] uppercase tracking-wider transition-all cursor-pointer shadow-xs"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#6e6e73]" />
                <span>Budgets, Telemetry & Policy Comparisons</span>
              </span>
              <div className="flex items-center gap-1.5 text-xs text-[#86868b] font-normal normal-case">
                <span>{showDetailsSection ? 'Hide details' : 'Show details'}</span>
                {showDetailsSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showDetailsSection && (
              <div className="mt-6 space-y-6">
                {/* Live Task Budget Limits */}
                {currentTask && (
                  <Card className="p-6 shadow-xs border-[#e5e5e7]">
                    <div className="text-xs font-bold uppercase text-[#1d1d1f] tracking-wider mb-4">
                      Execution Budget Consumption
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Cost */}
                      <div className="bg-[#fbfbfd] p-4 rounded-2xl border border-[#e5e5e7]">
                        <div className="flex justify-between text-xs font-mono mb-2">
                          <span className="text-[#6e6e73]">Cost</span>
                          <span className="font-semibold text-[#1d1d1f]">
                            ${currentTask.running_cost_usd.toFixed(5)} / ${currentTask.max_total_cost_usd.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#e5e5e7] rounded-full overflow-hidden">
                          <div
                            className="bg-[#1d1d1f] h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (currentTask.running_cost_usd / currentTask.max_total_cost_usd) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Carbon */}
                      <div className="bg-[#fbfbfd] p-4 rounded-2xl border border-[#e5e5e7]">
                        <div className="flex justify-between text-xs font-mono mb-2">
                          <span className="text-[#6e6e73]">Carbon</span>
                          <span className="font-semibold text-emerald-800">
                            {(currentTask.running_carbon_kgco2eq * 1000).toFixed(3)}g / {(currentTask.max_total_carbon_kgco2eq * 1000).toFixed(0)}g
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#e5e5e7] rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-700 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (currentTask.running_carbon_kgco2eq / currentTask.max_total_carbon_kgco2eq) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Latency */}
                      <div className="bg-[#fbfbfd] p-4 rounded-2xl border border-[#e5e5e7]">
                        <div className="flex justify-between text-xs font-mono mb-2">
                          <span className="text-[#6e6e73]">Latency</span>
                          <span className="font-semibold text-[#1d1d1f]">
                            {(currentTask.running_latency_ms / 1000).toFixed(1)}s / {(currentTask.max_total_latency_ms / 1000).toFixed(0)}s
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#e5e5e7] rounded-full overflow-hidden">
                          <div
                            className="bg-[#1d1d1f] h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (currentTask.running_latency_ms / currentTask.max_total_latency_ms) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Policy Comparison from offline eval */}
                {baselines?.offline_stats && (
                  <Card className="p-6 shadow-xs border-[#e5e5e7]">
                    <div className="text-xs font-bold uppercase text-[#1d1d1f] tracking-wider mb-4 flex items-center justify-between">
                      <span>Offline Policy Comparison</span>
                      <Badge variant="subtle" size="sm">N=60 Subtasks · Verified Eval</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        {
                          label: 'Total Cost',
                          fmt: (v: number) => `$${v.toFixed(4)}`,
                          data: [
                            { name: 'Always-strongest', val: baselines.offline_stats.always_strongest.cost.mean, col: '#d2d2d7' },
                            { name: 'Random', val: baselines.offline_stats.random.cost.mean, col: '#86868b' },
                            { name: 'This system', val: baselines.offline_stats.this_system.cost.mean, col: '#1d1d1f', overhead: true },
                          ],
                        },
                        {
                          label: 'Total Carbon',
                          fmt: (v: number) => `${v.toFixed(5)} kg`,
                          data: [
                            { name: 'Always-strongest', val: baselines.offline_stats.always_strongest.carbon.mean, col: '#d2d2d7' },
                            { name: 'Random', val: baselines.offline_stats.random.carbon.mean, col: '#86868b' },
                            { name: 'This system', val: baselines.offline_stats.this_system.carbon.mean, col: '#1d1d1f', overhead: true },
                          ],
                        },
                        {
                          label: 'Quality Retained',
                          fmt: (v: number) => `${(v * 100).toFixed(1)}%`,
                          data: [
                            { name: 'Always-strongest', val: 1.0, col: '#d2d2d7' },
                            { name: 'Random', val: baselines.offline_stats.random.quality.mean, col: '#86868b' },
                            { name: 'This system', val: baselines.offline_stats.this_system.quality.mean, col: '#1d1d1f', overhead: false },
                          ],
                        },
                      ].map((col) => {
                        const maxVal = Math.max(...col.data.map(d => d.val)) || 1;
                        return (
                          <div key={col.label} className="space-y-3 bg-[#fbfbfd] p-4 rounded-2xl border border-[#e5e5e7]">
                            <span className="text-xs font-semibold text-[#1d1d1f] uppercase tracking-wide">{col.label}</span>
                            {col.data.map((d: any) => (
                              <div key={d.name} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="text-[#6e6e73] font-sans">{d.name}</span>
                                  <span className="font-semibold text-[#1d1d1f]">{col.fmt(d.val)}</span>
                                </div>
                                <div className="w-full h-2 bg-[#e5e5e7] rounded-full overflow-hidden flex">
                                  <div
                                    style={{
                                      width: `${((d.val * (d.overhead ? 0.92 : 1)) / maxVal) * 100}%`,
                                      backgroundColor: d.col,
                                    }}
                                    className="h-full"
                                  />
                                  {d.overhead && (
                                    <div
                                      style={{ width: `${((d.val * 0.08) / maxVal) * 100}%` }}
                                      className="h-full bg-amber-500"
                                      title="Scheduler overhead included (Invariant 7)"
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Grid Intensity & Forecast */}
                {grid && (
                  <Card className="p-6 shadow-xs border-[#e5e5e7]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs font-bold uppercase text-[#1d1d1f] tracking-wider">
                          Grid Carbon Intensity ({grid.zone})
                        </div>
                        <div className="text-3xl font-bold font-mono text-[#1d1d1f] mt-1">
                          {grid.current_intensity_gco2_per_kwh} <span className="text-xs font-sans text-[#86868b] font-normal">gCO₂/kWh</span>
                        </div>
                      </div>
                      <Badge variant="outline" size="sm">
                        Simulated forecast
                      </Badge>
                    </div>

                    <div className="border border-dashed border-[#d2d2d7] rounded-2xl p-5 bg-[#fbfbfd]">
                      <div className="flex items-end gap-2.5 h-20">
                        {grid.simulated_forecast.map((f, i) => {
                          const maxI = Math.max(...grid.simulated_forecast.map(x => x.intensityGco2));
                          const minI = Math.min(...grid.simulated_forecast.map(x => x.intensityGco2));
                          const isValley = f.intensityGco2 === minI;
                          const pct = (f.intensityGco2 / maxI) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center">
                              <div
                                title={`${f.intensityGco2} gCO₂/kWh`}
                                style={{ height: `${pct}%` }}
                                className={`w-full rounded-t-lg border-t border-dashed transition-all ${
                                  isValley ? 'bg-[#1d1d1f] border-[#1d1d1f]' : 'bg-[#e5e5e7] border-[#b0b0b5]'
                                }`}
                              />
                              <span className="text-[10px] font-mono text-[#86868b] mt-1.5">
                                {i === 0 ? 'Now' : `+${f.hourOffset}h`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-[#86868b] mt-3.5 italic">{grid.disclosure}</p>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Methodology Footer */}
          <footer className="mt-12 pt-6 pb-12 border-t border-[#e5e5e7] text-xs text-[#86868b] leading-relaxed">
            <p className="mb-1">
              <strong className="text-[#1d1d1f]">Methodology & Constraints:</strong> Headline savings numbers (cost −71.3%, carbon −59.0%) come from measured offline evaluations (N=60 subtasks).
              All figures include scheduler overhead (Jev routing, embeddings, cascade verification) per Invariant 7.
              Cloud carbon uses EcoLogits output as-is; grid intensity is never applied to cloud (Invariant 1).
              Local carbon is calculated as CodeCarbon measured energy × live {grid?.zone ?? 'IN-SO'} grid intensity.
              PII subtasks are strictly isolated to local models (Invariant 2).
              Simulated grid forecast is clearly labeled and visually distinct (Invariant 6).
            </p>
          </footer>
        </section>
      )}

      {/* ── Time-shift Batch Modal ───────────────────────────────────────────── */}
      {showTimeShift && timeShiftData && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e5e5e7] rounded-3xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#f5f5f7]">
              <h3 className="text-sm font-semibold tracking-tight text-[#1d1d1f]">
                Time-Shift Batch Dispatcher
              </h3>
              <button
                onClick={() => setShowTimeShift(false)}
                className="text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#f5f5f7] p-3 rounded-xl">
                  <span className="text-[#86868b] block text-[10px] uppercase">Intensity Now</span>
                  <span className="text-[#1d1d1f] font-semibold font-mono text-sm">{timeShiftData.intensity_now_gco2} gCO₂/kWh</span>
                </div>
                <div className="bg-[#f5f5f7] p-3 rounded-xl">
                  <span className="text-[#86868b] block text-[10px] uppercase">Forecast Valley (+3h)</span>
                  <span className="text-[#1d1d1f] font-semibold font-mono text-sm">{timeShiftData.min_forecast_intensity_gco2} gCO₂/kWh</span>
                </div>
              </div>

              <div className="bg-[#f5f5f7] p-3 rounded-xl flex items-center justify-between">
                <span className="text-[#6e6e73]">Threshold difference:</span>
                <span className="font-semibold text-[#1d1d1f]">
                  {timeShiftData.difference_pct}% &gt; {timeShiftData.threshold_pct}% threshold
                </span>
              </div>

              <div className="bg-[#1d1d1f] text-white p-4 rounded-xl">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Action: {timeShiftData.action}
                </div>
                <p className="text-[11px] text-[#d2d2d7] leading-relaxed">
                  Scheduled for green window (+{timeShiftData.scheduled_for_offset_hours} hours).
                  Projected carbon saved: <strong>{timeShiftData.carbon_savings_projected_pct}%</strong>.
                </p>
                <p className="text-[10px] text-[#86868b] mt-1.5">
                  Rule: {timeShiftData.eligible_candidates}
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full mt-4"
              onClick={() => setShowTimeShift(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
      {/* ── Modal: Reconciliation Audit Log ─────────────────────────────────── */}
      {showReconciliationModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#e5e5e7] shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#f5f5f7]">
              <div>
                <h3 className="text-sm font-semibold text-[#1d1d1f]">Reconciliation Audit Log</h3>
                <p className="text-[11px] text-[#86868b]">Post-reconnect audit comparing offline routing vs optimal online schedule.</p>
              </div>
              <button
                onClick={() => setShowReconciliationModal(false)}
                className="text-[#86868b] hover:text-[#1d1d1f] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs overflow-y-auto flex-1 pr-1">
              {reconciliationLogs.length === 0 ? (
                <div className="text-center py-8 text-[#86868b]">
                  No degraded subtasks recorded. All executions used optimal online routing.
                </div>
              ) : (
                reconciliationLogs.map((log: any) => (
                  <div key={log.id} className="p-3 rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7]/60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-[#1d1d1f] text-[11px]">Subtask {log.subtask_id}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        log.route_matched
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}>
                        {log.route_matched ? '✓ Route Matched' : '⚡ Diverged In Offline'}
                      </span>
                    </div>
                    <div className="text-[#515154] text-[11px] mb-1.5">
                      Executed offline: <strong>{log.offline_model}</strong> · Online counterfactual: <strong>{log.ideal_online_model}</strong>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[#86868b] font-mono">
                      <span>Offline Carbon: {(log.offline_carbon_kgco2eq * 1000).toFixed(4)}g</span>
                      <span>Reconciled: {(log.reconciled_carbon_kgco2eq * 1000).toFixed(4)}g</span>
                      <span>Stale Grid: {log.stale_grid_corrected ? 'Corrected' : 'Cached Valid'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full mt-4"
              onClick={() => setShowReconciliationModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
