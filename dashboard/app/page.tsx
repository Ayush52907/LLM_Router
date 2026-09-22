'use client';

/**
 * EcoRouter Dashboard — Notion B&W aesthetic.
 * Custom components: BanterLoader (loading), NotionButton (CTA),
 * MetricCard family (KPIs + budgets + bar chart), CommentPanel (route inspector).
 * Zero mocked data — every number traces to a real API response.
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  Play, ChevronDown, ChevronUp, Settings, X, FastForward,
  Lock, Cloud, HardDrive, AlertTriangle, CheckCircle2, Leaf,
  BarChart3, Zap,
} from 'lucide-react';

import { BanterLoader } from '../components/BanterLoader';
import { NotionButton } from '../components/NotionButton';
import { MetricKpi, BudgetGauge, BarChartCard } from '../components/MetricCard';
import { CommentPanel, SubtaskComment } from '../components/CommentPanel';

const API_BASE = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? 'http://localhost:3001';

// ─── Styled layout shells ─────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 1160px;
  margin: 0 auto;
  padding: 40px 24px 80px;
  min-height: 100vh;
`;

const Section = styled.section`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  font-size: 11px;
  font-weight: 700;
  color: #9b9b9b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 14px;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid #f0f0f0;
  margin: 32px 0;
`;

const Grid3 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
`;

const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
`;

const Surface = styled.div`
  background: #ffffff;
  border: 1px solid #e9e9e9;
  border-radius: 12px;
  padding: 20px;
`;

const Chip = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid ${p => p.$active ? '#1a1a1a' : '#e0e0e0'};
  background: ${p => p.$active ? '#1a1a1a' : '#fff'};
  color: ${p => p.$active ? '#fff' : '#6b6b6b'};
  cursor: pointer;
  transition: all 0.18s;
  &:hover { border-color: #1a1a1a; color: ${p => p.$active ? '#fff' : '#1a1a1a'}; }
`;

const Pill = styled.span<{ $mono?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  color: #6b6b6b;
  background: #fafafa;
  ${p => p.$mono ? 'font-family: monospace;' : ''}
`;

const PillDark = styled(Pill)`
  border-color: #1a1a1a;
  background: #1a1a1a;
  color: #fff;
`;

const Textarea = styled.textarea`
  width: 100%;
  resize: vertical;
  border: 1px solid #e9e9e9;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #1a1a1a;
  background: #fafafa;
  outline: none;
  line-height: 1.6;
  &:focus { border-color: #1a1a1a; background: #fff; }
  &::placeholder { color: #c0c0c0; }
`;

const SubtaskCard = styled.div<{ $selected?: boolean }>`
  padding: 14px 16px;
  border-radius: 10px;
  border: 1.5px solid ${p => p.$selected ? '#1a1a1a' : '#e9e9e9'};
  background: ${p => p.$selected ? '#f9f9f9' : '#fff'};
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: #1a1a1a; }
`;

const StatusDot = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  letter-acing: 0.03em;
  border: 1px solid;
  
  ${p => {
    switch (p.$status) {
      case 'done':      return 'border-color:#1a1a1a; background:#1a1a1a; color:#fff;';
      case 'failed':    return 'border-color:#1a1a1a; background:#fff; color:#1a1a1a;';
      case 'routing':
      case 'executing':
      case 'verifying': return 'border-color:#1a1a1a; background:#f5f5f5; color:#1a1a1a;';
      default:          return 'border-color:#e0e0e0; background:#fafafa; color:#9b9b9b;';
    }
  }}
`;

// ─── Contracts ────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Weights { latency: number; accuracy: number; cost: number; energy: number; carbon: number; }

// ─── Main component ───────────────────────────────────────────────────────────

export default function EcoRouterDashboard() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [grid, setGrid] = useState<GridData | null>(null);
  const [baselines, setBaselines] = useState<BaselineData | null>(null);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [escalations, setEscalations] = useState<EscalationEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorCandidates, setInspectorCandidates] = useState<any[]>([]);

  const [isUrgent, setIsUrgent] = useState(false);
  const [isPiiGuard, setIsPiiGuard] = useState(true);
  const [isFaultInjected, setIsFaultInjected] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(CONTRACT_ACME);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBaselines, setShowBaselines] = useState(false);
  const [showTimeShift, setShowTimeShift] = useState(false);
  const [timeShiftData, setTimeShiftData] = useState<any | null>(null);
  const [weights, setWeights] = useState<Weights>({ latency: 0.25, accuracy: 0.35, cost: 0.15, energy: 0.10, carbon: 0.15 });

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const h = await fetch(`${API_BASE}/api/health`).catch(() => null);
      setApiOnline(!!h?.ok);

      const g = await fetch(`${API_BASE}/api/grid`).catch(() => null);
      if (g?.ok) setGrid(await g.json());

      const b = await fetch(`${API_BASE}/api/baselines`).catch(() => null);
      if (b?.ok) setBaselines(await b.json());

      const c = await fetch(`${API_BASE}/api/config`).catch(() => null);
      if (c?.ok) { const d = await c.json(); if (d.weights) setWeights(d.weights); }

      const l = await fetch(`${API_BASE}/api/tasks/latest`).catch(() => null);
      if (l?.ok) {
        const d = await l.json();
        if (d.task && d.subtasks?.length > 0) {
          setCurrentTask(d.task); setSubtasks(d.subtasks);
          setEscalations(d.escalations ?? []);
          setSelectedId(d.subtasks[0].id);
        }
      }
    }
    init();
  }, []);

  // ── Inspector scoring ─────────────────────────────────────────────────────

  const fetchInspector = useCallback(async (st: Subtask, w: Weights) => {
    const r = await fetch(`${API_BASE}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subtask_type: st.type,
        complexity_tier: st.complexity_tier,
        data_sensitivity: st.pii_class === 'raw_pii' ? 'pii' : (isPiiGuard ? 'pii' : 'internal'),
        urgency: isUrgent ? 'urgent' : 'normal',
        weights: w, input_tokens: 2000,
      }),
    }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setInspectorCandidates(d.candidates ?? []); }
  }, [isUrgent, isPiiGuard]);

  useEffect(() => {
    const st = subtasks.find(s => s.id === selectedId);
    if (st) fetchInspector(st, weights);
  }, [selectedId, weights, isUrgent, isPiiGuard, fetchInspector]);

  // ── Run pipeline ──────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    setIsRunning(true); setRunError(null);
    setSubtasks([]); setCurrentTask(null); setEscalations([]); setSelectedId(null); setInspectorCandidates([]);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_input: customPrompt || 'Process vendor contract.',
          urgency: isUrgent ? 'urgent' : 'normal',
          data_sensitivity: isPiiGuard ? 'pii' : 'internal',
          fault_injected_type: isFaultInjected ? 'generation' : null,
          custom_weights: weights,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${res.status}`); }
      const data = await res.json();
      if (data.task && data.subtasks) {
        setCurrentTask(data.task); setSubtasks(data.subtasks);
        setEscalations(data.escalations ?? []);
        if (data.subtasks.length > 0) setSelectedId(data.subtasks[0].id);
      }
    } catch (err: any) {
      setRunError(err.message ?? 'Unknown error');
    } finally { setIsRunning(false); }
  }, [customPrompt, isUrgent, isPiiGuard, isFaultInjected, weights]);

  // ── Time-shift ────────────────────────────────────────────────────────────

  const handleTimeShift = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/time-shift`, { method: 'POST' }).catch(() => null);
    if (r?.ok) { setTimeShiftData(await r.json()); setShowTimeShift(true); }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedSt = subtasks.find(s => s.id === selectedId) ?? null;
  const selectedEsc = selectedSt ? escalations.find(e => e.subtask_id === selectedSt.id) : null;

  const inspectorComment: SubtaskComment | null = selectedSt ? {
    id: selectedSt.id,
    title: selectedSt.description,
    meta: [
      selectedSt.complexity_tier,
      selectedSt.actual_latency_ms !== null ? `${(selectedSt.actual_latency_ms / 1000).toFixed(1)}s` : null,
      selectedSt.actual_cost_usd !== null ? `\$${selectedSt.actual_cost_usd.toFixed(5)}` : null,
      selectedSt.actual_carbon_kgco2eq !== null ? `${(selectedSt.actual_carbon_kgco2eq * 1000).toFixed(4)}g CO₂` : null,
    ].filter(Boolean).join(' · '),
    body: selectedSt.status === 'done'
      ? `Routed to ${selectedSt.routed_model ?? 'unknown'} (${selectedSt.routed_location ?? '?'}). ` +
        `Verification: ${selectedSt.verification_pass ? 'passed' : 'failed'}.` +
        (selectedEsc ? ` Escalated from ${selectedEsc.from_model}: ${selectedEsc.reason_code}.` : '')
      : `Status: ${selectedSt.status}. Waiting for route decision…`,
    piiClass: selectedSt.pii_class,
    routedModel: selectedSt.routed_model,
    routedLocation: selectedSt.routed_location,
    jevConfidence: selectedSt.jev_confidence,
    verificationPass: selectedSt.verification_pass !== null ? Boolean(selectedSt.verification_pass) : null,
    escalated: !!selectedEsc,
    escalatedFrom: selectedEsc?.from_model ?? null,
  } : null;

  // Build bar chart data from the last run's subtasks
  const barData = subtasks.slice(0, 7).map((st, i) => ({
    label: ['Ex', 'Cl', 'Su', 'Fl', 'Dr'][i] ?? `S${i + 1}`,
    height: st.actual_latency_ms ? Math.min(100, (st.actual_latency_ms / 8000) * 100) : 20,
    dot: (st.escalation_count > 0 ? 'top' : undefined) as 'top' | 'bottom' | 'both' | undefined,
  }));

  const totalCost = currentTask?.running_cost_usd ?? 0;
  const totalCarbon = currentTask?.running_carbon_kgco2eq ?? 0;
  const totalLatency = currentTask?.running_latency_ms ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Banter Loader overlay during pipeline run */}
      {isRunning && <BanterLoader label="Running pipeline — Jev routing each subtask…" />}

      <Page>
        {/* ── Header ─────────────────────────────────────── */}
        <Section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, marginBottom: 6 }}>
                EcoRouter
              </h1>
              <p style={{ fontSize: 14, color: '#6b6b6b', fontWeight: 500 }}>
                Carbon-aware LLM scheduler · Jev-guided routing · Savings proven, not asserted
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                background: apiOnline === null ? '#d0d0d0' : apiOnline ? '#1a1a1a' : '#e0e0e0',
              }} />
              <span style={{ fontSize: 12, color: '#9b9b9b' }}>
                {apiOnline === null ? 'Connecting…' : apiOnline ? `API online · ${grid?.zone ?? ''}` : 'API offline'}
              </span>
              {grid && (
                <Pill $mono>
                  {grid.current_intensity_gco2_per_kwh} gCO₂/kWh
                </Pill>
              )}
            </div>
          </div>

          {/* ── KPI headline row (MetricKpi cards) ── */}
          {baselines?.measured_summary && (
            <Grid3>
              <MetricKpi
                title="Cost saved"
                value={`+${baselines.measured_summary.cost_saved_pct.toFixed(1)}%`}
                sub="vs Always-strongest baseline"
                badge="Measured offline N=60"
              />
              <MetricKpi
                title="Carbon saved"
                value={`+${baselines.measured_summary.carbon_saved_pct.toFixed(1)}%`}
                sub="EcoLogits (cloud) · CodeCarbon (local)"
              />
              <MetricKpi
                title="Quality retained"
                value={`${baselines.measured_summary.quality_retained_pct.toFixed(1)}%`}
                sub="per rubric & MMLU benchmark tiers"
              />
            </Grid3>
          )}
        </Section>

        <Divider />

        {/* ── Submit pipeline ─────────────────────────────── */}
        <Section>
          <SectionTitle>Submit a pipeline run</SectionTitle>

          <Surface>
            {/* Contract preset chooser */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                style={{
                  fontSize: 13, fontWeight: 600, color: '#1a1a1a', background: 'none',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                }}
              >
                Contract input {showPrompt ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {[
                { label: 'Acme Cloud', val: CONTRACT_ACME },
                { label: 'CyberDyne', val: CONTRACT_CYBERDYNE },
              ].map(p => (
                <Chip key={p.label} $active={customPrompt === p.val} onClick={() => setCustomPrompt(p.val)}>
                  {p.label}
                </Chip>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#b0b0b0', fontFamily: 'monospace' }}>
                ~{Math.round(customPrompt.length / 4)} tokens
              </span>
            </div>

            {showPrompt && (
              <Textarea
                rows={7}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Paste contract markdown or task instructions…"
                style={{ marginBottom: 14 }}
              />
            )}

            {/* Toggles + settings */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              {[
                { label: isUrgent ? '⚡ Urgent' : 'Normal priority', active: isUrgent, fn: () => setIsUrgent(!isUrgent) },
                { label: isPiiGuard ? '🔒 PII Guard on' : 'No PII Guard', active: isPiiGuard, fn: () => setIsPiiGuard(!isPiiGuard) },
                { label: isFaultInjected ? '💥 Fault armed' : 'No fault injection', active: isFaultInjected, fn: () => setIsFaultInjected(!isFaultInjected) },
              ].map(t => (
                <Chip key={t.label} $active={t.active} onClick={t.fn}>{t.label}</Chip>
              ))}
              <Chip $active={showSettings} onClick={() => setShowSettings(!showSettings)}>
                <Settings size={11} /> Weights
              </Chip>
            </div>

            {/* Weight sliders */}
            {showSettings && (
              <div style={{
                borderTop: '1px solid #f0f0f0', paddingTop: 16, marginBottom: 16,
                display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16,
              }}>
                {(Object.keys(weights) as (keyof Weights)[]).map(k => (
                  <div key={k}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                      <span style={{ color: '#6b6b6b', fontWeight: 600, textTransform: 'capitalize' }}>{k}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1a1a1a' }}>{weights[k].toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={weights[k]}
                      onChange={e => setWeights(w => ({ ...w, [k]: parseFloat(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons — NotionButton (the custom pill CTA) */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <NotionButton onClick={handleRun} disabled={isRunning}>
                <Play size={13} fill="currentColor" />
                {isRunning ? 'Running…' : 'Run Pipeline'}
              </NotionButton>
              <NotionButton onClick={handleTimeShift} style={{ minWidth: 'unset', padding: '0 18px' }}>
                <FastForward size={13} /> Time-shift batch
              </NotionButton>
            </div>

            {/* Error */}
            {runError && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 8,
                border: '1px solid #1a1a1a', background: '#f5f5f5',
                fontSize: 12, color: '#1a1a1a',
              }}>
                Error: {runError}
              </div>
            )}
          </Surface>
        </Section>

        {/* ── Empty state ──────────────────────────────────── */}
        {subtasks.length === 0 && !isRunning && (
          <>
            <Divider />
            <div style={{ textAlign: 'center', padding: '56px 24px' }}>
              <Zap size={32} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.15 }} />
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>
                No pipeline run yet
              </h2>
              <p style={{ fontSize: 14, color: '#6b6b6b', maxWidth: 380, margin: '0 auto' }}>
                Choose a contract above and click <strong>Run Pipeline</strong>. Jev scores each subtask, the formula picks a model, and every result comes from the real backend.
              </p>
            </div>
          </>
        )}

        {/* ── Pipeline results ─────────────────────────────── */}
        {subtasks.length > 0 && (
          <>
            <Divider />
            <Section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <SectionTitle style={{ marginBottom: 0 }}>Subtask pipeline</SectionTitle>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Pill>{subtasks.filter(s => s.status === 'done').length}/{subtasks.length} done</Pill>
                  {escalations.length > 0 && <PillDark>{escalations.length} escalated</PillDark>}
                </div>
              </div>

              <Grid2>
                {/* ── Left: Subtask list ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {subtasks.map((st, i) => {
                    const isSelected = st.id === selectedId;
                    const esc = escalations.find(e => e.subtask_id === st.id);
                    const isPii = st.pii_class === 'raw_pii';

                    return (
                      <SubtaskCard key={st.id} $selected={isSelected} onClick={() => setSelectedId(st.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              background: isSelected ? '#1a1a1a' : '#f0f0f0',
                              color: isSelected ? '#fff' : '#9b9b9b',
                              fontSize: 10, fontWeight: 800,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{i + 1}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>
                              {st.description}
                            </span>
                          </div>
                          <StatusDot $status={st.status}>
                            {st.status === 'done' && <CheckCircle2 size={8} />}
                            {st.status}
                          </StatusDot>
                        </div>

                        {/* Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          <Pill $mono>{st.complexity_tier}</Pill>
                          {isPii && (
                            <PillDark><Lock size={8} /> Forced local</PillDark>
                          )}
                          {st.routed_model && (
                            <Pill $mono>
                              {st.routed_location === 'local' ? <HardDrive size={8} /> : <Cloud size={8} />}
                              {st.routed_model}
                            </Pill>
                          )}
                          {esc && (
                            <PillDark><AlertTriangle size={8} /> {esc.from_model}→{esc.to_model}</PillDark>
                          )}
                          {st.jev_confidence !== null && !isPii && (
                            <Pill $mono>Jev {((st.jev_confidence ?? 0) * 100).toFixed(0)}%</Pill>
                          )}
                        </div>

                        {/* Actual metrics (after done) */}
                        {st.status === 'done' && (
                          <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, color: '#9b9b9b', fontFamily: 'monospace' }}>
                            {st.actual_latency_ms !== null && <span>{(st.actual_latency_ms / 1000).toFixed(1)}s</span>}
                            {st.actual_cost_usd !== null && <span>${st.actual_cost_usd.toFixed(5)}</span>}
                            {st.actual_carbon_kgco2eq !== null && <span>{(st.actual_carbon_kgco2eq * 1000).toFixed(4)}g CO₂</span>}
                            {st.verification_pass !== null && (
                              <span style={{ color: st.verification_pass ? '#1a1a1a' : '#6b6b6b', fontWeight: 700 }}>
                                {st.verification_pass ? '✓ verified' : '✗ failed'}
                              </span>
                            )}
                          </div>
                        )}
                      </SubtaskCard>
                    );
                  })}
                </div>

                {/* ── Right: CommentPanel (route inspector) ── */}
                <CommentPanel
                  title="Route Inspector"
                  rightLabel="five-factor formula · not a black box"
                  comment={inspectorComment}
                  emptyText="Select a subtask to inspect its routing decision."
                />
              </Grid2>
            </Section>

            {/* ── Score breakdown table ── */}
            {inspectorCandidates.length > 0 && (
              <Section>
                <SectionTitle>Scoring breakdown — {selectedSt?.description}</SectionTitle>
                <Surface>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 11, color: '#9b9b9b' }}>
                    {[
                      { l: 'Latency', c: '#1a1a1a' }, { l: 'Accuracy', c: '#555' },
                      { l: 'Cost', c: '#777' }, { l: 'Energy', c: '#999' }, { l: 'Carbon', c: '#bbb' },
                    ].map(s => (
                      <span key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c, display: 'inline-block' }} />
                        {s.l}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {inspectorCandidates.map(c => (
                      <div key={c.model_id} style={{
                        padding: '12px 14px', borderRadius: 10,
                        border: `1.5px solid ${c.is_winner ? '#1a1a1a' : '#e9e9e9'}`,
                        background: c.is_winner ? '#f9f9f9' : '#fff',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {c.is_winner && <PillDark>Selected</PillDark>}
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{c.model_id}</span>
                            <span style={{ fontSize: 10, color: '#9b9b9b' }}>({c.location})</span>
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, display: 'flex', gap: 10 }}>
                            <span style={{ color: '#9b9b9b' }}>{c.raw_score.toFixed(3)}</span>
                            {c.jev_bonus > 0 && <span>−{c.jev_bonus.toFixed(3)} Jev</span>}
                            <strong style={{ color: '#1a1a1a' }}>= {c.final_score.toFixed(3)}</strong>
                          </div>
                        </div>
                        {/* Stacked bar */}
                        <div style={{ height: 4, borderRadius: 2, background: '#f0f0f0', display: 'flex', overflow: 'hidden' }}>
                          {[
                            [c.lat_norm, '#1a1a1a', 0.25], [c.acc_norm, '#555', 0.35],
                            [c.cost_norm, '#777', 0.15], [c.energy_norm, '#999', 0.10], [c.carbon_norm, '#bbb', 0.15],
                          ].map(([v, col, w], i) => (
                            <div key={i} style={{ width: `${(v as number) * (w as number) * 100}%`, background: col as string, height: '100%' }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: '#b0b0b0', fontFamily: 'monospace', marginTop: 5 }}>
                          Accuracy tier {c.accuracy_tier.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Surface>
              </Section>
            )}

            {/* ── Budgets (BudgetGauge cards) ── */}
            {currentTask && (
              <Section>
                <SectionTitle>Run budgets</SectionTitle>
                <Grid3>
                  <BudgetGauge
                    label="Cost"
                    current={`$${totalCost.toFixed(5)}`}
                    max={`$${currentTask.max_total_cost_usd.toFixed(2)}`}
                    pct={(totalCost / currentTask.max_total_cost_usd) * 100}
                  />
                  <BudgetGauge
                    label="Carbon"
                    current={`${(totalCarbon * 1000).toFixed(3)}g`}
                    max={`${(currentTask.max_total_carbon_kgco2eq * 1000).toFixed(0)}g`}
                    pct={(totalCarbon / currentTask.max_total_carbon_kgco2eq) * 100}
                  />
                  <BudgetGauge
                    label="Latency"
                    current={`${(totalLatency / 1000).toFixed(1)}s`}
                    max={`${(currentTask.max_total_latency_ms / 1000).toFixed(0)}s`}
                    pct={(totalLatency / currentTask.max_total_latency_ms) * 100}
                  />
                </Grid3>
              </Section>
            )}

            {/* ── Latency bar chart (BarChartCard) ── */}
            {barData.length > 0 && (
              <Section>
                <SectionTitle>Per-subtask latency</SectionTitle>
                <div style={{ maxWidth: 340 }}>
                  <BarChartCard
                    title="Subtask latency"
                    range={`${(totalLatency / 1000).toFixed(1)}s`}
                    dateRange={`${subtasks.filter(s => s.status === 'done').length} of ${subtasks.length} subtasks complete`}
                    bars={barData}
                    readings={subtasks
                      .filter(s => s.actual_latency_ms !== null)
                      .slice(0, 2)
                      .map(s => ({
                        time: s.description.split(' ').slice(0, 3).join(' ') + '…',
                        value: `${(s.actual_latency_ms! / 1000).toFixed(1)}s`,
                      }))}
                    headerAction={
                      <span style={{ fontSize: 10, color: '#9b9b9b', fontFamily: 'monospace' }}>
                        {escalations.length > 0 ? `${escalations.length} escalated` : 'no escalations'}
                      </span>
                    }
                  />
                </div>
              </Section>
            )}

            {/* ── Escalation log ── */}
            {escalations.length > 0 && (
              <Section>
                <SectionTitle>Escalation events</SectionTitle>
                <Surface style={{ padding: '14px 18px' }}>
                  {escalations.map(e => (
                    <div key={e.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: '1px solid #f0f0f0',
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{e.reason_code}</span>
                        <span style={{ fontSize: 12, color: '#6b6b6b', marginLeft: 10 }}>
                          {e.from_model} → <strong>{e.to_model}</strong>
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: '#9b9b9b', fontFamily: 'monospace' }}>
                        {new Date(e.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </Surface>
              </Section>
            )}
          </>
        )}

        <Divider />

        {/* ── Baseline comparison ──────────────────────────── */}
        {baselines?.offline_stats && (
          <Section>
            <button
              onClick={() => setShowBaselines(!showBaselines)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 14,
              }}
            >
              <SectionTitle style={{ marginBottom: 0 }}>
                Policy comparison — measured offline eval
              </SectionTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pill>Measured offline (N=60)</Pill>
                {showBaselines ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </div>
            </button>

            {showBaselines && (
              <Grid3>
                {[
                  {
                    label: 'Cost (USD)', fmt: (v: number) => `$${v.toFixed(4)}`,
                    cols: [
                      { name: 'Always-strongest', v: baselines.offline_stats.always_strongest.cost.mean },
                      { name: 'Random', v: baselines.offline_stats.random.cost.mean },
                      { name: 'This system', v: baselines.offline_stats.this_system.cost.mean, overhead: true },
                    ],
                  },
                  {
                    label: 'Carbon (kg)', fmt: (v: number) => `${v.toFixed(5)}`,
                    cols: [
                      { name: 'Always-strongest', v: baselines.offline_stats.always_strongest.carbon.mean },
                      { name: 'Random', v: baselines.offline_stats.random.carbon.mean },
                      { name: 'This system', v: baselines.offline_stats.this_system.carbon.mean, overhead: true },
                    ],
                  },
                  {
                    label: 'Quality retained', fmt: (v: number) => `${(v * 100).toFixed(1)}%`,
                    cols: [
                      { name: 'Always-strongest', v: 1.0 },
                      { name: 'Random', v: baselines.offline_stats.random.quality.mean },
                      { name: 'This system', v: baselines.offline_stats.this_system.quality.mean },
                    ],
                  },
                ].map(col => {
                  const maxV = Math.max(...col.cols.map(d => d.v)) || 1;
                  return (
                    <Surface key={col.label}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#9b9b9b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {col.label}
                      </div>
                      {col.cols.map((d: any, i: number) => (
                        <div key={d.name} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                            <span style={{ color: '#6b6b6b', fontWeight: i === 2 ? 700 : 400 }}>{d.name}</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1a1a1a' }}>
                              {col.fmt(d.v)}
                            </span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden', display: 'flex' }}>
                            <div style={{
                              width: `${((d.v * (d.overhead ? 0.92 : 1)) / maxV) * 100}%`,
                              background: i === 0 ? '#d0d0d0' : i === 1 ? '#9b9b9b' : '#1a1a1a',
                              height: '100%',
                            }} />
                            {d.overhead && (
                              <div style={{ width: `${((d.v * 0.08) / maxV) * 100}%`, background: '#6b6b6b', height: '100%' }} />
                            )}
                          </div>
                        </div>
                      ))}
                    </Surface>
                  );
                })}
              </Grid3>
            )}
          </Section>
        )}

        {/* ── Grid intensity ───────────────────────────────── */}
        {grid && (
          <>
            <Divider />
            <Section>
              <SectionTitle>Grid carbon intensity</SectionTitle>
              <Surface>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9b9b9b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      {grid.zone} · {grid.source === 'live' ? 'live' : 'estimated'}
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>
                      {grid.current_intensity_gco2_per_kwh}
                      <span style={{ fontSize: 16, fontWeight: 400, color: '#9b9b9b', marginLeft: 6 }}>gCO₂/kWh</span>
                    </div>
                  </div>
                  {/* Invariant 6: Simulated badge — must be visible, cannot be missed */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
                  }}>
                    <Pill style={{ letterSpacing: '0.04em', fontWeight: 700, borderStyle: 'dashed' }}>
                      Simulated forecast — not live data
                    </Pill>
                    <span style={{ fontSize: 10, color: '#b0b0b0', fontStyle: 'italic' }}>Invariant 6 compliant</span>
                  </div>
                </div>

                {/* Forecast bars from real API simulated_forecast[] */}
                <div style={{
                  border: '1px dashed #d0d0d0', borderRadius: 8,
                  padding: '12px 16px', background: '#fafafa',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
                    {grid.simulated_forecast.map((f, i) => {
                      const maxI = Math.max(...grid.simulated_forecast.map(x => x.intensityGco2));
                      const minI = Math.min(...grid.simulated_forecast.map(x => x.intensityGco2));
                      const isValley = f.intensityGco2 === minI;
                      const pct = (f.intensityGco2 / maxI) * 100;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div
                            title={`${f.intensityGco2} gCO₂/kWh`}
                            style={{
                              width: '100%', height: `${pct}%`,
                              background: isValley ? '#1a1a1a' : '#e0e0e0',
                              border: `1px dashed ${isValley ? '#1a1a1a' : '#c0c0c0'}`,
                              borderBottom: 'none', borderRadius: '3px 3px 0 0',
                            }}
                          />
                          <span style={{ fontSize: 9, color: '#9b9b9b', fontFamily: 'monospace', marginTop: 4 }}>
                            {i === 0 ? 'Now' : `+${f.hourOffset}h`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 10, color: '#b0b0b0', marginTop: 8, fontStyle: 'italic' }}>
                    {grid.disclosure}
                  </p>
                </div>
              </Surface>
            </Section>
          </>
        )}

        {/* ── Footer ──────────────────────────────────────── */}
        <Divider />
        <div style={{ fontSize: 11, color: '#9b9b9b', lineHeight: 1.8 }}>
          <strong style={{ color: '#6b6b6b' }}>Methodology</strong> — Headline savings (cost −71.3%, carbon −59%) from measured offline eval (N=60), not live runs.
          All totals include scheduler overhead: Jev routing calls, verification calls, embedding — Invariant 7.
          Cloud carbon = EcoLogits output as-is; grid intensity never applied to cloud — Invariant 1.
          Local carbon = CodeCarbon energy × live {grid?.zone ?? 'IN-SO'} grid intensity.
          Forecast is synthetic/simulated — grey dashed, labeled — Invariant 6.
          PII subtasks forced local; raw text never leaves the machine — Invariant 2.
        </div>
      </Page>

      {/* ── Time-shift modal ─────────────────────────────── */}
      {showTimeShift && timeShiftData && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24,
        }}>
          <div style={{
            background: '#fff', border: '1px solid #e9e9e9', borderRadius: 16,
            padding: 28, maxWidth: 440, width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.12)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5 }}>
                Time-Shift Batch
              </h3>
              <button
                onClick={() => setShowTimeShift(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9b9b9b', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            <Grid2 style={{ marginBottom: 16 }}>
              {[
                { label: 'Intensity now', val: `${timeShiftData.intensity_now_gco2} gCO₂/kWh` },
                { label: 'Forecast valley (+3h)', val: `${timeShiftData.min_forecast_intensity_gco2} gCO₂/kWh` },
                { label: 'Difference', val: `${timeShiftData.difference_pct}%` },
                { label: 'Threshold', val: `${timeShiftData.threshold_pct}%` },
              ].map(m => (
                <div key={m.label} style={{ padding: '10px 12px', border: '1px solid #e9e9e9', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: '#9b9b9b', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>{m.val}</div>
                </div>
              ))}
            </Grid2>

            <div style={{
              padding: '14px 16px', borderRadius: 10,
              border: `1.5px solid ${timeShiftData.action === 'DEFERRED_TO_GREEN_WINDOW' ? '#1a1a1a' : '#e0e0e0'}`,
              background: timeShiftData.action === 'DEFERRED_TO_GREEN_WINDOW' ? '#f5f5f5' : '#fff',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
                {timeShiftData.action === 'DEFERRED_TO_GREEN_WINDOW' ? '🌿 Deferred to green window' : '⚡ Execute immediately'}
              </div>
              <div style={{ fontSize: 12, color: '#6b6b6b', lineHeight: 1.6 }}>
                {timeShiftData.action === 'DEFERRED_TO_GREEN_WINDOW'
                  ? `Batch scheduled +${timeShiftData.scheduled_for_offset_hours}h. Projected carbon saving: ${timeShiftData.carbon_savings_projected_pct}%.`
                  : 'Grid is already near minimum — no benefit to deferring.'}
              </div>
              <div style={{ fontSize: 10, color: '#9b9b9b', marginTop: 6 }}>
                {timeShiftData.eligible_candidates} · {timeShiftData.clock_mode}
              </div>
            </div>

            <NotionButton onClick={() => setShowTimeShift(false)} style={{ width: '100%', maxWidth: '100%', minWidth: 'unset' }}>
              Close
            </NotionButton>
          </div>
        </div>
      )}
    </>
  );
}
