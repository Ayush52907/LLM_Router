'use client';

import React from 'react';
import { Gauge, AlertOctagon, TrendingDown, Clock, ShieldAlert } from 'lucide-react';

interface RightMiniPanelsProps {
  runningCost: number;
  maxCost: number;
  runningCarbon: number;
  maxCarbon: number;
  runningLatency: number;
  maxLatency: number;
  currentGridIntensity: number;
  localZone: string;
  escalationEvents: Array<{ id: string; reason: string; from: string; to: string; time: string }>;
}

export const RightMiniPanels: React.FC<RightMiniPanelsProps> = ({
  runningCost,
  maxCost,
  runningCarbon,
  maxCarbon,
  runningLatency,
  maxLatency,
  currentGridIntensity,
  localZone,
  escalationEvents,
}) => {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 1. Live Budget Bars */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-3 shadow-lg flex-1">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            Live Workflow Budgets
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Strict Caps</span>
        </div>

        <div className="space-y-2 text-left">
          {/* Cost Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-0.5">
              <span className="text-slate-400">Cost: ${runningCost.toFixed(4)}</span>
              <span className="text-slate-500">Max ${maxCost.toFixed(2)}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, (runningCost / maxCost) * 100)}%` }}
              />
            </div>
          </div>

          {/* Carbon Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-0.5">
              <span className="text-slate-400">Carbon: {runningCarbon.toFixed(5)} kg</span>
              <span className="text-slate-500">Max {maxCarbon.toFixed(3)} kg</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="bg-teal-400 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, (runningCarbon / maxCarbon) * 100)}%` }}
              />
            </div>
          </div>

          {/* Latency Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-0.5">
              <span className="text-slate-400">Latency: {(runningLatency / 1000).toFixed(1)}s</span>
              <span className="text-slate-500">Max {(maxLatency / 1000).toFixed(0)}s</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="bg-sky-400 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, (runningLatency / maxLatency) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid Panel: Real Solid Gauge + Grey Dashed Simulated Forecast */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-3 shadow-lg flex-1 text-left">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-teal-400" />
            Grid Carbon Intensity
          </h3>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-teal-300">
            {localZone}
          </span>
        </div>

        {/* Real Live Gauge */}
        <div className="flex items-baseline justify-between mb-2 bg-slate-900/90 p-2 rounded-lg border border-slate-800">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-medium">Real Current Intensity</div>
            <div className="text-xl font-bold font-mono text-teal-400">
              {currentGridIntensity} <span className="text-xs text-slate-400">gCO₂/kWh</span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Live Real Value
          </span>
        </div>

        {/* Simulated Forecast Curve (PRD Invariant 6: Grey Dashed + Visible Badge) */}
        <div className="border border-dashed border-slate-700 p-2 rounded-lg bg-slate-950/40 relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">6-Hour Forecast Trajectory:</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
              Simulated — not live data
            </span>
          </div>

          <div className="flex items-end justify-between h-8 gap-1 pt-1">
            {[
              { h: 'Now', v: currentGridIntensity, bar: 80 },
              { h: '+1h', v: 610, bar: 75 },
              { h: '+2h', v: 540, bar: 65 },
              { h: '+3h', v: 420, bar: 45, valley: true }, // greenest valley
              { h: '+4h', v: 480, bar: 55 },
              { h: '+5h', v: 590, bar: 70 },
              { h: '+6h', v: 670, bar: 85 },
            ].map((f, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full rounded-t border-t border-dashed ${
                    f.valley
                      ? 'bg-emerald-500/40 border-emerald-400'
                      : 'bg-slate-700/40 border-slate-500'
                  }`}
                  style={{ height: `${f.bar}%` }}
                />
                <span className="text-[8px] font-mono text-slate-500 mt-0.5">{f.h}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Escalation Log */}
      <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-3 shadow-lg flex-1 flex flex-col text-left">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Escalation & Repair Log
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Cascade Cascade</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {escalationEvents.length === 0 ? (
            <div className="text-[11px] text-slate-500 italic py-2 text-center">
              No active escalations. Pipeline running within verification thresholds.
            </div>
          ) : (
            escalationEvents.map((e) => (
              <div key={e.id} className="text-[11px] font-mono bg-slate-900/80 p-1.5 rounded border border-rose-950 flex items-start justify-between gap-1">
                <div>
                  <div className="text-rose-400 font-semibold">{e.reason}</div>
                  <div className="text-slate-400 text-[10px]">
                    {e.from} → <strong className="text-slate-200">{e.to}</strong>
                  </div>
                </div>
                <span className="text-[9px] text-slate-500">{e.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
