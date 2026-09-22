'use client';

import React from 'react';

interface PolicyMetrics {
  cost: number;
  carbon: number;
  latency: number;
  quality: number;
}

interface ComparisonChartProps {
  alwaysStrongest: PolicyMetrics;
  randomPolicy: PolicyMetrics;
  thisSystem: PolicyMetrics;
  overheadPct?: number; // Scheduler overhead fraction of thisSystem totals
}

export const ComparisonChart: React.FC<ComparisonChartProps> = ({
  alwaysStrongest,
  randomPolicy,
  thisSystem,
  overheadPct = 0.08, // ~8% scheduler overhead
}) => {
  // Max values for normalization
  const maxCost = Math.max(alwaysStrongest.cost, randomPolicy.cost, thisSystem.cost) || 0.1;
  const maxCarbon = Math.max(alwaysStrongest.carbon, randomPolicy.carbon, thisSystem.carbon) || 0.1;
  const maxLatency = Math.max(alwaysStrongest.latency, randomPolicy.latency, thisSystem.latency) || 100;

  return (
    <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-4 shadow-lg text-left">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Policy Comparison: Work vs Scheduler Overhead (PRD §6 & §9)
        </h3>
        <span className="text-[11px] text-slate-400 font-mono">
          Baseline A (Always-strongest) vs Baseline B (Random) vs This System
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Metric 1: Cost ($) */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-slate-400 uppercase font-semibold">Total Cost</span>
            <span className="text-emerald-400 font-bold">${thisSystem.cost.toFixed(4)}</span>
          </div>

          <div className="space-y-1.5 text-[10px] font-mono">
            {/* Always-strongest */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Always-strongest</span>
                <span>${alwaysStrongest.cost.toFixed(4)}</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(alwaysStrongest.cost / maxCost) * 100}%` }}
                />
              </div>
            </div>

            {/* Random */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Random</span>
                <span>${randomPolicy.cost.toFixed(4)}</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="bg-slate-500 h-full"
                  style={{ width: `${(randomPolicy.cost / maxCost) * 100}%` }}
                />
              </div>
            </div>

            {/* This System (split into Work and Overhead!) */}
            <div>
              <div className="flex justify-between text-emerald-300 font-bold mb-0.5">
                <span>This System (Work + Overhead)</span>
                <span>${thisSystem.cost.toFixed(4)}</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex">
                {/* Work segment */}
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${((thisSystem.cost * (1 - overheadPct)) / maxCost) * 100}%` }}
                  title="Direct inference cost"
                />
                {/* Overhead segment */}
                <div
                  className="bg-amber-400 h-full"
                  style={{ width: `${((thisSystem.cost * overheadPct) / maxCost) * 100}%` }}
                  title="Scheduler overhead (Jev, routing, cascade)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Carbon (kgCO2eq) */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-slate-400 uppercase font-semibold">Total Carbon</span>
            <span className="text-teal-400 font-bold">{thisSystem.carbon.toFixed(5)} kg</span>
          </div>

          <div className="space-y-1.5 text-[10px] font-mono">
            {/* Always-strongest */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Always-strongest</span>
                <span>{alwaysStrongest.carbon.toFixed(5)} kg</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(alwaysStrongest.carbon / maxCarbon) * 100}%` }}
                />
              </div>
            </div>

            {/* Random */}
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Random</span>
                <span>{randomPolicy.carbon.toFixed(5)} kg</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="bg-slate-500 h-full"
                  style={{ width: `${(randomPolicy.carbon / maxCarbon) * 100}%` }}
                />
              </div>
            </div>

            {/* This System */}
            <div>
              <div className="flex justify-between text-teal-300 font-bold mb-0.5">
                <span>This System (Work + Overhead)</span>
                <span>{thisSystem.carbon.toFixed(5)} kg</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex">
                <div
                  className="bg-teal-400 h-full"
                  style={{ width: `${((thisSystem.carbon * (1 - overheadPct)) / maxCarbon) * 100}%` }}
                />
                <div
                  className="bg-amber-400 h-full"
                  style={{ width: `${((thisSystem.carbon * overheadPct) / maxCarbon) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Quality Retained */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-slate-400 uppercase font-semibold">Quality Retained</span>
            <span className="text-sky-400 font-bold">{(thisSystem.quality * 100).toFixed(1)}%</span>
          </div>

          <div className="space-y-1.5 text-[10px] font-mono">
            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Always-strongest (100% benchmark)</span>
                <span>100%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-0.5">
                <span>Random (erratic quality)</span>
                <span>{(randomPolicy.quality * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="bg-slate-500 h-full"
                  style={{ width: `${randomPolicy.quality * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sky-300 font-bold mb-0.5">
                <span>This System</span>
                <span>{(thisSystem.quality * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="bg-sky-400 h-full"
                  style={{ width: `${thisSystem.quality * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visible Overhead Segment Legend */}
      <div className="flex items-center justify-end gap-4 mt-3 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          Direct Task Work
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          Scheduler Overhead (Jev routing + cascade check)
        </span>
      </div>
    </div>
  );
};
