'use client';

/**
 * MetricCard — clean white card with title + value + bar chart.
 * Adapted from the Heart Rate card (uiverse.io) for B&W Notion theme.
 * Used for: headline KPIs, budget gauges, subtask metrics.
 */

import React from 'react';
import styled from 'styled-components';

// ── Shared card shell ─────────────────────────────────────────────────────────

const CardShell = styled.div`
  background: #ffffff;
  border: 1px solid #e9e9e9;
  border-radius: 12px;
  padding: 18px;
  width: 100%;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const CardTitle = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #6b6b6b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const CardValue = styled.div`
  font-size: 32px;
  font-weight: 800;
  color: #1a1a1a;
  letter-spacing: -1px;
  line-height: 1;
  margin-bottom: 4px;
`;

const CardSub = styled.div`
  font-size: 11px;
  color: #9b9b9b;
  margin-bottom: 14px;
`;

// ── Progress bar variant ──────────────────────────────────────────────────────

const BarTrack = styled.div`
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 12px;
`;

const BarFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${p => Math.min(100, p.$pct)}%;
  background: #1a1a1a;
  border-radius: 2px;
  transition: width 0.5s ease;
`;

interface MetricKpiProps {
  title: string;
  value: string;
  sub?: string;
  badge?: string; // e.g. "Measured Offline (N=60)"
}

export const MetricKpi: React.FC<MetricKpiProps> = ({ title, value, sub, badge }) => (
  <CardShell>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 7px',
          border: '1px solid #1a1a1a', borderRadius: 20,
          color: '#1a1a1a', letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>{badge}</span>
      )}
    </CardHeader>
    <CardValue>{value}</CardValue>
    {sub && <CardSub>{sub}</CardSub>}
  </CardShell>
);

// ── Budget gauge variant (with inline bar) ────────────────────────────────────

interface BudgetGaugeProps {
  label: string;
  current: string;
  max: string;
  pct: number; // 0–100
}

export const BudgetGauge: React.FC<BudgetGaugeProps> = ({ label, current, max, pct }) => (
  <CardShell style={{ padding: '14px 16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <CardTitle>{label}</CardTitle>
      <span style={{ fontSize: 11, color: '#9b9b9b', fontFamily: 'monospace' }}>/ {max}</span>
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', letterSpacing: -0.5, marginTop: 4 }}>{current}</div>
    <BarTrack>
      <BarFill $pct={pct} />
    </BarTrack>
  </CardShell>
);

// ── Mini bar chart variant (7-day pattern) ────────────────────────────────────

interface BarChartEntry {
  label: string;
  height: number; // 0–100 relative
  dot?: 'top' | 'bottom' | 'both';
}

interface BarChartCardProps {
  title: string;
  range: string;
  dateRange?: string;
  bars: BarChartEntry[];
  readings?: Array<{ time: string; value: string }>;
  headerAction?: React.ReactNode;
}

const ChartWrap = styled.div`
  position: relative;
  height: 72px;
  margin: 16px 0;
`;

const ChartRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 100%;
  gap: 4px;
  padding: 0 2px;
`;

const BarWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 1;
`;

const BarBody = styled.div<{ $h: number }>`
  width: 14px;
  height: ${p => p.$h}%;
  background: #1a1a1a;
  border-radius: 4px 4px 2px 2px;
  position: relative;
  transition: height 0.3s ease;
  &:hover { background: #444; }
`;

const Dot = styled.span<{ $pos: 'top' | 'bottom' }>`
  width: 6px;
  height: 6px;
  background: #fff;
  border: 1.5px solid #1a1a1a;
  border-radius: 50%;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  ${p => p.$pos === 'top' ? 'top: -3px;' : 'bottom: -3px;'}
`;

const DayLabel = styled.span`
  font-size: 9px;
  color: #9b9b9b;
  font-weight: 500;
`;

const AvgLine = styled.div`
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  height: 1px;
  background: #e0e0e0;
  z-index: 0;
`;

const ReadingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  &:last-child { border-bottom: none; }
`;

export const BarChartCard: React.FC<BarChartCardProps> = ({
  title, range, dateRange, bars, readings, headerAction,
}) => (
  <CardShell>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {headerAction}
    </CardHeader>
    <CardValue style={{ fontSize: 28 }}>{range}</CardValue>
    {dateRange && <CardSub>{dateRange}</CardSub>}
    <ChartWrap>
      <AvgLine />
      <ChartRow>
        {bars.map((b, i) => (
          <BarWrap key={i}>
            <BarBody $h={b.height}>
              {(b.dot === 'top' || b.dot === 'both') && <Dot $pos="top" />}
              {(b.dot === 'bottom' || b.dot === 'both') && <Dot $pos="bottom" />}
            </BarBody>
            <DayLabel>{b.label}</DayLabel>
          </BarWrap>
        ))}
      </ChartRow>
    </ChartWrap>
    {readings && (
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
        {readings.map((r, i) => (
          <ReadingRow key={i}>
            <span style={{ fontSize: 10, color: '#9b9b9b' }}>{r.time}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{r.value}</span>
          </ReadingRow>
        ))}
      </div>
    )}
  </CardShell>
);
