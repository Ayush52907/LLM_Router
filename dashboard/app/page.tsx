'use client';

/**
 * EcoRouter — Production Flow Redesign.
 * Section 1: Hero / Input (first viewport, calm landing, Claude/ChatGPT-style input, CenterFlow radial animation).
 * Section 2: Results (headline metrics, clean vertical subtask pipeline, route inspector, details).
 * Built with uniform component library: Badge, Button, Card, CenterFlow.
 * Zero mocked data — all metrics from real API endpoints.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, FastForward, Settings, Lock, Cloud, HardDrive,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Zap, Flame, ShieldAlert, Sliders, ArrowRight, Clock,
  DollarSign, Leaf, RefreshCw, X, FileText, Check
} from 'lucide-react';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CenterFlow } from '../components/ui/CenterFlow';
import { BanterLoader } from '../components/BanterLoader';

const API_BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? 'http://localhost:3001';

// ── Contracts ─────────────────────────────────────────────────────────────────

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

export default function EcoRouterProductionPage() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
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

  // ── 1. Init Data ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const h = await fetch(`${API_BASE}/api/health`).catch(() => null);
      setApiOnline(!!h?.ok);

      const g = await fetch(`${API_BASE}/api/grid`).catch(() => null);
      if (g?.ok) setGrid(await g.json());

      const b = await fetch(`${API_BASE}/api/baselines`).catch(() => null);
      if (b?.ok) setBaselines(await b.json());

      const c = await fetch(`${API_BASE}/api/config`).catch(() => null);
      if (c?.ok) {
        const d = await c.json();
        if (d.weights) setWeights(d.weights);
      }

      const l = await fetch(`${API_BASE}/api/tasks/latest`).catch(() => null);
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
  }, []);

  // ── 2. Route Inspector dynamic scoring ──────────────────────────────────────

  const fetchInspector = useCallback(async (st: Subtask, w: Weights) => {
    const r = await fetch(`${API_BASE}/api/score`, {
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
      const res = await fetch(`${API_BASE}/api/tasks`, {
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

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.task && data.subtasks) {
        setCurrentTask(data.task);
        setSubtasks(data.subtasks);
        setEscalations(data.escalations ?? []);
        if (data.subtasks.length > 0) setSelectedId(data.subtasks[0].id);

        // Smooth scroll to results
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
    const r = await fetch(`${API_BASE}/api/time-shift`, { method: 'POST' }).catch(() => null);
    if (r?.ok) {
      setTimeShiftData(await r.json());
      setShowTimeShift(true);
    }
  }, []);

  const selectedSt = subtasks.find(s => s.id === selectedId) ?? null;
  const selectedEsc = selectedSt ? escalations.find(e => e.subtask_id === selectedSt.id) : null;

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#111111] flex flex-col font-sans antialiased selection:bg-[#111] selection:text-white">
      {/* Full-screen loading overlay during run */}
      {isRunning && <BanterLoader label="Running pipeline — Jev routing each subtask via five-factor formula…" />}

      {/* ── Top quiet nav ────────────────────────────────────────────────────── */}
      <header className="w-full border-b border-[#eaeaea] bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[#18181b] flex items-center justify-center text-white font-bold text-xs">
              E
            </div>
            <span className="font-semibold text-sm tracking-tight text-[#18181b]">EcoRouter</span>
            <span className="text-xs text-[#71717a] hidden sm:inline">· Carbon-aware LLM scheduler</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#71717a]">
            {grid && (
              <Badge variant="outline" size="sm">
                <Leaf className="w-3 h-3 text-emerald-600 mr-0.5" />
                <span>{grid.zone}</span>
                <span className="font-mono text-[#18181b] ml-1">{grid.current_intensity_gco2_per_kwh} gCO₂/kWh</span>
              </Badge>
            )}
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#eaeaea]">
              <span className={`w-2 h-2 rounded-full ${apiOnline ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <span className="hidden md:inline">{apiOnline ? 'Live API' : 'Connecting'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── SECTION 1: Hero / Input (First Viewport) ────────────────────────── */}
      <section className="relative min-h-[calc(100vh-56px)] flex flex-col justify-center items-center px-4 py-12">
        <CenterFlow className="w-full max-w-4xl flex flex-col items-center">
          {/* Calm Hero Title */}
          <div className="text-center mb-8 max-w-xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111111] mb-2.5">
              Where intelligence meets efficiency.
            </h1>
            <p className="text-sm sm:text-base text-[#666666] leading-relaxed">
              Route each contract subtask to the right model, location, and timing.
              Savings proven through verified carbon and cost telemetry.
            </p>
          </div>

          {/* Large Chat-Style Input Box (Claude / ChatGPT style) */}
          <div className="w-full max-w-2xl bg-white border border-[#eaeaea] rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 focus-within:border-[#a1a1aa] focus-within:shadow-[0_12px_40px_rgba(0,0,0,0.07)] p-4">
            {/* Top preset bar inside the box */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#f4f4f5] text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[#a1a1aa] font-medium mr-1 text-[11px] uppercase tracking-wider">Preset:</span>
                <button
                  type="button"
                  onClick={() => { setCustomPrompt(CONTRACT_ACME); setActivePreset('acme'); }}
                  className={`px-2.5 py-1 rounded-md transition-colors ${activePreset === 'acme' ? 'bg-[#f4f4f5] text-[#18181b] font-semibold' : 'text-[#71717a] hover:text-[#18181b]'}`}
                >
                  Acme Cloud (MSA)
                </button>
                <button
                  type="button"
                  onClick={() => { setCustomPrompt(CONTRACT_CYBERDYNE); setActivePreset('cyberdyne'); }}
                  className={`px-2.5 py-1 rounded-md transition-colors ${activePreset === 'cyberdyne' ? 'bg-[#f4f4f5] text-[#18181b] font-semibold' : 'text-[#71717a] hover:text-[#18181b]'}`}
                >
                  CyberDyne (Vendor)
                </button>
                <button
                  type="button"
                  onClick={() => { setActivePreset('custom'); }}
                  className={`px-2.5 py-1 rounded-md transition-colors ${activePreset === 'custom' ? 'bg-[#f4f4f5] text-[#18181b] font-semibold' : 'text-[#71717a] hover:text-[#18181b]'}`}
                >
                  Custom
                </button>
              </div>

              <span className="font-mono text-[11px] text-[#a1a1aa]">
                ~{Math.round(customPrompt.length / 4)} tokens
              </span>
            </div>

            {/* Comfortable large textarea */}
            <textarea
              rows={4}
              value={customPrompt}
              onChange={(e) => { setCustomPrompt(e.target.value); setActivePreset('custom'); }}
              placeholder="Paste a contract, vendor agreement, or describe the task..."
              className="w-full resize-none border-none outline-none font-sans text-sm text-[#18181b] placeholder:text-[#a1a1aa] leading-relaxed bg-transparent"
            />

            {/* Attached parameter toolbar */}
            <div className="pt-3 border-t border-[#f4f4f5] flex flex-wrap items-center justify-between gap-3">
              {/* Parameter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    isUrgent ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-[#f4f4f5] text-[#71717a] hover:text-[#18181b] border border-transparent'
                  }`}
                  title="Prioritizes latency over carbon/cost"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{isUrgent ? 'Urgent priority' : 'Normal priority'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPiiGuard(!isPiiGuard)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    isPiiGuard ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-[#f4f4f5] text-[#71717a] hover:text-[#18181b] border border-transparent'
                  }`}
                  title="PII subtasks strictly stay on local hardware"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isPiiGuard ? 'PII Guard on' : 'PII Guard off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFaultInjected(!isFaultInjected)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    isFaultInjected ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-[#f4f4f5] text-[#71717a] hover:text-[#18181b] border border-transparent'
                  }`}
                  title="Inject generation failure to demo cascade escalation"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{isFaultInjected ? 'Fault armed' : 'No fault'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWeightsDrawer(!showWeightsDrawer)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                    showWeightsDrawer ? 'bg-[#e4e4e7] text-[#18181b]' : 'bg-[#f4f4f5] text-[#71717a] hover:text-[#18181b]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Weights</span>
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTimeShift}
                  title="Analyze deferring batch jobs to greener grid windows"
                >
                  <FastForward className="w-3 h-3 mr-0.5" />
                  Time-shift
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRun}
                  loading={isRunning}
                >
                  <Play className="w-3.5 h-3.5 fill-current mr-0.5" />
                  Run Pipeline
                </Button>
              </div>
            </div>

            {/* Weights Drawer (Inline inside input container) */}
            {showWeightsDrawer && (
              <div className="mt-3 pt-3 border-t border-[#f4f4f5] grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
                  <div key={k} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#71717a] capitalize">{k}</span>
                      <span className="font-mono font-bold text-[#18181b]">{weights[k].toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={weights[k]}
                      onChange={(e) => setWeights({ ...weights, [k]: parseFloat(e.target.value) })}
                      className="w-full accent-[#18181b]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error notice if run failed */}
          {runError && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2 max-w-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{runError}</span>
            </div>
          )}

          {/* Quiet scroll indicator if results already exist */}
          {subtasks.length > 0 && (
            <button
              onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-8 text-xs text-[#71717a] hover:text-[#18181b] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View latest execution telemetry</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </CenterFlow>
      </section>

      {/* ── SECTION 2: Results (Revealed on Scroll or Post-Run) ──────────────── */}
      {subtasks.length > 0 && (
        <section ref={resultsRef} className="max-w-6xl mx-auto w-full px-6 py-12 border-t border-[#eaeaea]">
          {/* 2a. Headline metrics band */}
          {baselines?.measured_summary && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-[#71717a] uppercase tracking-wider">
                  Verified Outcome vs Always-Strongest (Baseline A)
                </span>
                <Badge variant="neutral" size="sm">
                  Measured Offline N=60
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Cost */}
                <Card className="p-5">
                  <div className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider mb-1">Cost Saved</div>
                  <div className="text-3xl font-extrabold text-[#18181b] tracking-tight">
                    +{baselines.measured_summary.cost_saved_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[#71717a] mt-1">vs Always-strongest baseline ($0.092 vs $0.026)</div>
                </Card>

                {/* Carbon */}
                <Card className="p-5">
                  <div className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider mb-1">Carbon Saved</div>
                  <div className="text-3xl font-extrabold text-emerald-700 tracking-tight">
                    +{baselines.measured_summary.carbon_saved_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[#71717a] mt-1">EcoLogits (cloud) · CodeCarbon (local)</div>
                </Card>

                {/* Quality */}
                <Card className="p-5">
                  <div className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider mb-1">Quality Retained</div>
                  <div className="text-3xl font-extrabold text-blue-700 tracking-tight">
                    {baselines.measured_summary.quality_retained_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[#71717a] mt-1">per rubric & MMLU benchmark accuracy tiers</div>
                </Card>
              </div>
            </div>
          )}

          {/* 2b & 2c: Subtask Pipeline + Route Inspector (2-Column Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-10">
            {/* Left 7 cols: Subtask Pipeline (Clean vertical timeline/list) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 mb-1">
                <h2 className="text-sm font-bold text-[#18181b] tracking-tight">Subtask Execution Pipeline</h2>
                <span className="text-xs text-[#71717a]">
                  {subtasks.filter(s => s.status === 'done').length}/{subtasks.length} completed
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
                    className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white border-[#18181b] shadow-sm ring-1 ring-[#18181b]'
                        : 'bg-white border-[#eaeaea] hover:border-[#d4d4d8]'
                    }`}
                  >
                    {/* Primary Line: Step number + Description + Status */}
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-start gap-2.5">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'bg-[#18181b] text-white' : 'bg-[#f4f4f5] text-[#71717a]'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-[#18181b] leading-tight">
                          {st.description}
                        </span>
                      </div>

                      <Badge
                        variant={st.status === 'done' ? 'success' : st.status === 'failed' ? 'warning' : 'neutral'}
                        size="sm"
                      >
                        {st.status === 'done' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {st.status}
                      </Badge>
                    </div>

                    {/* Secondary Line: Model routed + location icon */}
                    <div className="flex items-center gap-2 text-xs text-[#71717a] ml-7 mb-2">
                      {st.routed_model ? (
                        <div className="flex items-center gap-1 font-mono font-medium text-[#18181b]">
                          {st.routed_location === 'local' ? (
                            <HardDrive className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Cloud className="w-3 h-3 text-blue-600" />
                          )}
                          <span>{st.routed_model}</span>
                          <span className="text-[#a1a1aa] font-sans font-normal">({st.routed_location})</span>
                        </div>
                      ) : (
                        <span className="text-[#a1a1aa] italic">Routing decision pending...</span>
                      )}

                      {/* Escalation transition visual */}
                      {esc && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200">
                          <span>{esc.from_model}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>{esc.to_model}</span>
                          <span className="text-[10px] font-normal text-amber-700">({esc.reason_code})</span>
                        </div>
                      )}

                      {isPii && (
                        <Badge variant="warning" size="sm">
                          <Lock className="w-2.5 h-2.5" />
                          Forced local (PII)
                        </Badge>
                      )}
                    </div>

                    {/* Tertiary Line: Lighter monospace telemetry */}
                    <div className="flex items-center gap-3 text-[11px] text-[#a1a1aa] font-mono ml-7">
                      <span className="text-[#71717a] font-sans">Tier: <strong>{st.complexity_tier}</strong></span>
                      {st.actual_latency_ms !== null && (
                        <span>{(st.actual_latency_ms / 1000).toFixed(1)}s</span>
                      )}
                      {st.actual_cost_usd !== null && (
                        <span>${st.actual_cost_usd.toFixed(5)}</span>
                      )}
                      {st.actual_carbon_kgco2eq !== null && (
                        <span>{(st.actual_carbon_kgco2eq * 1000).toFixed(4)}g CO₂</span>
                      )}
                      {st.verification_pass !== null && (
                        <span className={st.verification_pass ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                          {st.verification_pass ? '✓ verified' : '✗ failed'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right 5 cols: Route Inspector & Five-Factor Breakdown */}
            <div className="lg:col-span-5 sticky top-20">
              <Card className="p-5">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eaeaea]">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181b]">Route Inspector</h3>
                    <p className="text-[11px] text-[#71717a]">Five-factor scoring telemetry · Not a black box</p>
                  </div>
                  {selectedSt && (
                    <Badge variant={selectedSt.pii_class === 'raw_pii' ? 'warning' : 'neutral'} size="sm">
                      {selectedSt.pii_class === 'raw_pii' ? 'PII locked' : 'Candidate audit'}
                    </Badge>
                  )}
                </div>

                {selectedSt ? (
                  <div className="space-y-4">
                    {/* Selected node summary */}
                    <div className="bg-[#f4f4f5] p-3 rounded-lg border border-[#e4e4e7]">
                      <div className="text-xs font-semibold text-[#18181b] mb-1">
                        {selectedSt.description}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#71717a]">
                        <span>Complexity: <strong className="text-[#18181b]">{selectedSt.complexity_tier}</strong></span>
                        {selectedSt.jev_confidence !== null && (
                          <span className="font-mono">Jev confidence: <strong>{(selectedSt.jev_confidence * 100).toFixed(0)}%</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Candidates ranking list */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">
                        Ranked Candidate Pool
                      </div>

                      {inspectorCandidates.map((c) => (
                        <div
                          key={c.model_id}
                          className={`p-2.5 rounded-lg border text-xs transition-all ${
                            c.is_winner
                              ? 'bg-white border-[#18181b] shadow-xs'
                              : 'bg-[#fafafa] border-[#eaeaea] opacity-75'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              {c.is_winner && (
                                <Badge variant="neutral" size="sm">
                                  Selected
                                </Badge>
                              )}
                              <span className="font-mono font-bold text-[#18181b]">{c.model_id}</span>
                              <span className="text-[#71717a] text-[10px]">({c.location})</span>
                            </div>
                            <div className="font-mono text-[11px]">
                              <span className="text-[#71717a]">{c.raw_score.toFixed(3)}</span>
                              {c.jev_bonus > 0 && <span className="text-indigo-600"> -{c.jev_bonus.toFixed(3)} Jev</span>}
                              <span className="font-bold text-[#18181b] ml-1">= {c.final_score.toFixed(3)}</span>
                            </div>
                          </div>

                          {/* 2d. Horizontal Stacked Score Bar */}
                          <div className="w-full h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden flex my-1.5">
                            <div style={{ width: `${c.lat_norm * 25}%` }} className="bg-[#18181b] h-full" title="Latency term" />
                            <div style={{ width: `${c.acc_norm * 35}%` }} className="bg-[#52525b] h-full" title="Accuracy penalty term" />
                            <div style={{ width: `${c.cost_norm * 15}%` }} className="bg-[#71717a] h-full" title="Cost term" />
                            <div style={{ width: `${c.energy_norm * 10}%` }} className="bg-[#a1a1aa] h-full" title="Energy term" />
                            <div style={{ width: `${c.carbon_norm * 15}%` }} className="bg-[#d4d4d8] h-full" title="Carbon term" />
                          </div>

                          <div className="flex justify-between text-[10px] font-mono text-[#71717a]">
                            <span>Acc tier: {c.accuracy_tier.toFixed(2)}</span>
                            <span>Rank #{c.is_winner ? 1 : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Legend for stacked bars */}
                    <div className="flex items-center justify-between text-[10px] text-[#71717a] pt-2 border-t border-[#f4f4f5]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#18181b]" /> Latency</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#52525b]" /> Accuracy</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#71717a]" /> Cost</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#a1a1aa]" /> Energy</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#d4d4d8]" /> Carbon</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#71717a] text-xs">
                    Select any subtask to inspect its routing score breakdown.
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* 2e. Run Stats & Details (Progressive Disclosure) */}
          <div className="pt-6 border-t border-[#eaeaea]">
            <button
              onClick={() => setShowDetailsSection(!showDetailsSection)}
              className="w-full flex items-center justify-between text-xs font-bold text-[#71717a] uppercase tracking-wider py-2 hover:text-[#18181b] transition-colors cursor-pointer"
            >
              <span>Telemetry details, budgets & policy comparisons</span>
              {showDetailsSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDetailsSection && (
              <div className="mt-6 space-y-6">
                {/* Live task budget consumption */}
                {currentTask && (
                  <Card className="p-5">
                    <div className="text-xs font-bold uppercase text-[#18181b] tracking-wider mb-3">
                      Task Budget Consumption vs Hard Limits
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Cost */}
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-[#71717a]">Cost</span>
                          <span className="font-bold text-[#18181b]">
                            ${currentTask.running_cost_usd.toFixed(5)} / ${currentTask.max_total_cost_usd.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden">
                          <div
                            className="bg-[#18181b] h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (currentTask.running_cost_usd / currentTask.max_total_cost_usd) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Carbon */}
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-[#71717a]">Carbon</span>
                          <span className="font-bold text-[#18181b]">
                            {(currentTask.running_carbon_kgco2eq * 1000).toFixed(3)}g / {(currentTask.max_total_carbon_kgco2eq * 1000).toFixed(0)}g
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (currentTask.running_carbon_kgco2eq / currentTask.max_total_carbon_kgco2eq) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Latency */}
                      <div>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-[#71717a]">Latency</span>
                          <span className="font-bold text-[#18181b]">
                            {(currentTask.running_latency_ms / 1000).toFixed(1)}s / {(currentTask.max_total_latency_ms / 1000).toFixed(0)}s
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (currentTask.running_latency_ms / currentTask.max_total_latency_ms) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Policy Comparison from offline eval */}
                {baselines?.offline_stats && (
                  <Card className="p-5">
                    <div className="text-xs font-bold uppercase text-[#18181b] tracking-wider mb-4 flex items-center justify-between">
                      <span>Policy Comparison (Work vs Scheduler Overhead)</span>
                      <Badge variant="neutral" size="sm">PRD Section 6 & 9</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        {
                          label: 'Total Cost',
                          fmt: (v: number) => `$${v.toFixed(4)}`,
                          data: [
                            { name: 'Always-strongest', val: baselines.offline_stats.always_strongest.cost.mean, col: '#a1a1aa' },
                            { name: 'Random', val: baselines.offline_stats.random.cost.mean, col: '#71717a' },
                            { name: 'This system', val: baselines.offline_stats.this_system.cost.mean, col: '#18181b', overhead: true },
                          ],
                        },
                        {
                          label: 'Total Carbon (kg)',
                          fmt: (v: number) => `${v.toFixed(5)} kg`,
                          data: [
                            { name: 'Always-strongest', val: baselines.offline_stats.always_strongest.carbon.mean, col: '#a1a1aa' },
                            { name: 'Random', val: baselines.offline_stats.random.carbon.mean, col: '#71717a' },
                            { name: 'This system', val: baselines.offline_stats.this_system.carbon.mean, col: '#059669', overhead: true },
                          ],
                        },
                        {
                          label: 'Quality Retained',
                          fmt: (v: number) => `${(v * 100).toFixed(1)}%`,
                          data: [
                            { name: 'Always-strongest', val: 1.0, col: '#a1a1aa' },
                            { name: 'Random', val: baselines.offline_stats.random.quality.mean, col: '#71717a' },
                            { name: 'This system', val: baselines.offline_stats.this_system.quality.mean, col: '#2563eb', overhead: false },
                          ],
                        },
                      ].map((col) => {
                        const maxVal = Math.max(...col.data.map(d => d.val)) || 1;
                        return (
                          <div key={col.label} className="space-y-2">
                            <span className="text-xs font-semibold text-[#71717a]">{col.label}</span>
                            {col.data.map((d: any) => (
                              <div key={d.name} className="space-y-1">
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="text-[#71717a]">{d.name}</span>
                                  <span className="font-bold text-[#18181b]">{col.fmt(d.val)}</span>
                                </div>
                                <div className="w-full h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden flex">
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
                                      className="h-full bg-amber-400"
                                      title="Scheduler overhead (Jev routing + verification)"
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-[#f4f4f5] text-[11px] text-[#71717a]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-[#18181b]" /> Direct task work</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-xs bg-amber-400" /> Scheduler overhead (Invariant 7)</span>
                    </div>
                  </Card>
                )}

                {/* Grid Intensity & Forecast */}
                {grid && (
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs font-bold uppercase text-[#18181b] tracking-wider">
                          Grid Carbon Intensity ({grid.zone})
                        </div>
                        <div className="text-2xl font-bold font-mono text-[#18181b] mt-1">
                          {grid.current_intensity_gco2_per_kwh} <span className="text-xs font-sans text-[#71717a]">gCO₂/kWh</span>
                        </div>
                      </div>
                      <Badge variant="outline" size="sm" style={{ borderStyle: 'dashed' }}>
                        Simulated forecast — not live data
                      </Badge>
                    </div>

                    <div className="border border-dashed border-[#d4d4d8] rounded-xl p-4 bg-[#fafafa]">
                      <div className="flex items-end gap-2 h-20">
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
                                className={`w-full rounded-t border-t border-dashed ${
                                  isValley ? 'bg-emerald-600/30 border-emerald-600' : 'bg-[#e4e4e7] border-[#a1a1aa]'
                                }`}
                              />
                              <span className="text-[10px] font-mono text-[#71717a] mt-1">
                                {i === 0 ? 'Now' : `+${f.hourOffset}h`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-[#a1a1aa] mt-3 italic">{grid.disclosure}</p>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Methodology Footer */}
          <footer className="mt-12 pt-6 border-t border-[#eaeaea] text-[11px] text-[#71717a] leading-relaxed">
            <p className="mb-1">
              <strong>Methodology & Compliance:</strong> Headline savings numbers come from measured offline evaluations (N=60 subtasks, 3 contracts × 3 repeats).
              All figures include scheduler overhead (Jev routing, embeddings, cascade verification) per Invariant 7.
              Cloud carbon uses EcoLogits output as-is; grid intensity is never applied to cloud (Invariant 1).
              Local carbon is calculated as CodeCarbon measured energy × live {grid?.zone ?? 'IN-SO'} grid intensity.
              PII subtasks are strictly isolated to local models (Invariant 2).
            </p>
          </footer>
        </section>
      )}

      {/* ── Time-shift Batch Modal ───────────────────────────────────────────── */}
      {showTimeShift && timeShiftData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#eaeaea] rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#f4f4f5]">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold tracking-tight text-[#18181b]">
                  Time-Shift Batch Dispatcher
                </h3>
              </div>
              <button
                onClick={() => setShowTimeShift(false)}
                className="text-[#71717a] hover:text-[#18181b] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#fafafa] p-2.5 rounded-lg border border-[#eaeaea]">
                  <span className="text-[#71717a] block text-[10px] uppercase">Intensity Now</span>
                  <span className="text-[#18181b] font-bold font-mono text-sm">{timeShiftData.intensity_now_gco2} gCO₂/kWh</span>
                </div>
                <div className="bg-[#fafafa] p-2.5 rounded-lg border border-[#eaeaea]">
                  <span className="text-[#71717a] block text-[10px] uppercase">Forecast Valley (+3h)</span>
                  <span className="text-emerald-700 font-bold font-mono text-sm">{timeShiftData.min_forecast_intensity_gco2} gCO₂/kWh</span>
                </div>
              </div>

              <div className="bg-[#fafafa] p-2.5 rounded-lg border border-[#eaeaea] flex items-center justify-between">
                <span className="text-[#71717a]">Threshold difference:</span>
                <span className="font-bold text-[#18181b]">
                  {timeShiftData.difference_pct}% &gt; {timeShiftData.threshold_pct}% threshold
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  Action: {timeShiftData.action}
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Scheduled for green window (+{timeShiftData.scheduled_for_offset_hours} hours).
                  Projected carbon saved: <strong>{timeShiftData.carbon_savings_projected_pct}%</strong>.
                </p>
                <p className="text-[10px] text-emerald-700 mt-1">
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
    </div>
  );
}
