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
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex-1">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-[#5B7EFF]" />
            Live Workflow Budgets
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Strict Caps</span>
        </div>

        <div className="space-y-2.5 text-left">
          {/* Cost Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-slate-600">Cost: ${runningCost.toFixed(4)}</span>
              <span className="text-slate-400">Max ${maxCost.toFixed(2)}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="bg-[#5B7EFF] h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, (runningCost / maxCost) * 100)}%` }}
              />
            </div>
          </div>

          {/* Carbon Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-slate-600">Carbon: {runningCarbon.toFixed(5)} kg</span>
              <span className="text-slate-400">Max {maxCarbon.toFixed(3)} kg</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, (runningCarbon / maxCarbon) * 100)}%` }}
              />
            </div>
          </div>

          {/* Latency Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-slate-600">Latency: {(runningLatency / 1000).toFixed(1)}s</span>
              <span className="text-slate-400">Max {(maxLatency / 1000).toFixed(0)}s</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, (runningLatency / maxLatency) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Live Grid Intensity & Simulated Forecast Gauge */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex-1">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-[#5B7EFF]" />
            Grid Carbon ({localZone})
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
            Real Live
          </span>
        </div>

        <div className="text-left">
          <div className="flex items-baseline gap-1 mb-1.5">
            <span className="text-2xl font-bold text-slate-900 font-mono">{currentGridIntensity}</span>
            <span className="text-[10px] font-mono text-slate-500">gCO₂/kWh</span>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
            <span>Forecast:</span>
            <span className="text-[9px] text-slate-400 italic">Grey-dashed (Invariant 6)</span>
          </div>

          <div className="flex items-end justify-between h-9 gap-1.5 pt-1">
            {[
              { h: 'Now', v: currentGridIntensity, bar: 80 },
              { h: '+1h', v: 610, bar: 75 },
              { h: '+2h', v: 540, bar: 65 },
              { h: '+3h', v: 420, bar: 45, valley: true },
              { h: '+4h', v: 480, bar: 55 },
              { h: '+5h', v: 590, bar: 70 },
              { h: '+6h', v: 670, bar: 85 },
            ].map((f, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full rounded-t border-t-2 border-dashed ${
                    f.valley
                      ? 'bg-[#5B7EFF] border-[#5B7EFF]'
                      : 'bg-slate-200 border-slate-400'
                  }`}
                  style={{ height: `${f.bar}%` }}
                />
                <span className="text-[8px] font-mono text-slate-400 mt-0.5">{f.h}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Escalation Log */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex-1 flex flex-col text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            Escalation & Repair Log
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Cascade</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {escalationEvents.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic py-3 text-center font-mono">
              No escalations. Thresholds satisfied.
            </div>
          ) : (
            escalationEvents.map((e) => (
              <div key={e.id} className="text-[11px] font-mono bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-start justify-between gap-1">
                <div>
                  <div className="text-slate-800 font-semibold">{e.reason}</div>
                  <div className="text-slate-500 text-[10px]">
                    {e.from} → <strong className="text-slate-800">{e.to}</strong>
                  </div>
                </div>
                <span className="text-[9px] text-slate-400">{e.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
