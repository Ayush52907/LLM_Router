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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 text-left shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5B7EFF]" />
          Policy Comparison: Work vs Scheduler Overhead (PRD §6 & §9)
        </h3>
        <span className="text-[11px] text-slate-400 font-mono">
          Baseline A (Always-strongest) vs Baseline B (Random) vs This System
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Cost ($) */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-slate-500 uppercase font-medium">Total Cost</span>
            <span className="text-slate-900 font-bold">${thisSystem.cost.toFixed(4)}</span>
          </div>

          <div className="space-y-2 text-[10px] font-mono">
            {/* Always-strongest */}
            <div>
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>Always-strongest</span>
                <span>${alwaysStrongest.cost.toFixed(4)}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-slate-400 h-full rounded-full"
                  style={{ width: `${(alwaysStrongest.cost / maxCost) * 100}%` }}
                />
              </div>
            </div>

            {/* Random */}
            <div>
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>Random</span>
                <span>${randomPolicy.cost.toFixed(4)}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-slate-300 h-full rounded-full"
                  style={{ width: `${(randomPolicy.cost / maxCost) * 100}%` }}
                />
              </div>
            </div>

            {/* This System (split into Work and Overhead!) */}
            <div>
              <div className="flex justify-between text-slate-900 font-semibold mb-0.5">
                <span>This System (Work + Overhead)</span>
                <span>${thisSystem.cost.toFixed(4)}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                {/* Work segment */}
                <div
                  className="bg-[#5B7EFF] h-full"
                  style={{ width: `${((thisSystem.cost * (1 - overheadPct)) / maxCost) * 100}%` }}
                  title="Direct inference cost"
                />
                {/* Overhead segment */}
                <div
                  className="bg-indigo-300 h-full"
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
            <span className="text-slate-500 uppercase font-medium">Total Carbon</span>
            <span className="text-slate-900 font-bold">{thisSystem.carbon.toFixed(5)} kg</span>
          </div>

          <div className="space-y-2 text-[10px] font-mono">
            {/* Always-strongest */}
            <div>
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>Always-strongest</span>
                <span>{alwaysStrongest.carbon.toFixed(5)} kg</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-slate-400 h-full rounded-full"
                  style={{ width: `${(alwaysStrongest.carbon / maxCarbon) * 100}%` }}
                />
              </div>
            </div>

            {/* Random */}
            <div>
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>Random</span>
                <span>{randomPolicy.carbon.toFixed(5)} kg</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-slate-300 h-full rounded-full"
                  style={{ width: `${(randomPolicy.carbon / maxCarbon) * 100}%` }}
                />
              </div>
            </div>

            {/* This System */}
            <div>
              <div className="flex justify-between text-slate-900 font-semibold mb-0.5">
                <span>This System (Work + Overhead)</span>
                <span>{thisSystem.carbon.toFixed(5)} kg</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-[#5B7EFF] h-full"
                  style={{ width: `${((thisSystem.carbon * (1 - overheadPct)) / maxCarbon) * 100}%` }}
                />
                <div
                  className="bg-indigo-300 h-full"
                  style={{ width: `${((thisSystem.carbon * overheadPct) / maxCarbon) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Quality Retained */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-slate-500 uppercase font-medium">Quality Retained</span>
            <span className="text-slate-900 font-bold">{(thisSystem.quality * 100).toFixed(1)}%</span>
          </div>

          <div className="space-y-2 text-[10px] font-mono">
            <div>
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>Always-strongest (100% benchmark)</span>
                <span>100%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-slate-400 h-full w-full rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-500 mb-0.5">
                <span>Random (erratic quality)</span>
                <span>{(randomPolicy.quality * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-slate-300 h-full rounded-full"
                  style={{ width: `${randomPolicy.quality * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-900 font-semibold mb-0.5">
                <span>This System</span>
                <span>{(thisSystem.quality * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${thisSystem.quality * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visible Overhead Segment Legend */}
      <div className="flex items-center justify-end gap-5 mt-4 pt-2.5 border-t border-slate-100 text-[10px] font-mono text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#5B7EFF]" />
          Direct Task Work
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-300" />
          Scheduler Overhead (Jev routing + cascade check)
        </span>
      </div>
    </div>
  );
};
