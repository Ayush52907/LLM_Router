'use client';

import React from 'react';

interface HeadlinePanelProps {
  costSavedPct: number;
  carbonSavedPct: number;
  qualityRetainedPct: number;
  isMeasuredOffline?: boolean;
}

export const HeadlinePanel: React.FC<HeadlinePanelProps> = ({
  costSavedPct,
  carbonSavedPct,
  qualityRetainedPct,
  isMeasuredOffline = true,
}) => {
  return (
    <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <h1 className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Headline Impact vs Always-Strongest (Baseline A)
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          {isMeasuredOffline ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
              Measured Offline (N=60)
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
              Live Estimate
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 text-center">
        {/* Cost Saved */}
        <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80">
          <div className="text-xs uppercase font-medium text-slate-400 mb-1">Cost Saved</div>
          <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
            +{costSavedPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">vs Always-strongest ($0.092 vs $0.026)</div>
        </div>

        {/* Carbon Saved */}
        <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80">
          <div className="text-xs uppercase font-medium text-slate-400 mb-1">Carbon Saved</div>
          <div className="text-3xl font-extrabold text-teal-400 tracking-tight">
            +{carbonSavedPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">EcoLogits (cloud) & CodeCarbon (local)</div>
        </div>

        {/* Quality Retained */}
        <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80">
          <div className="text-xs uppercase font-medium text-slate-400 mb-1">Quality Retained</div>
          <div className="text-3xl font-extrabold text-sky-400 tracking-tight">
            {qualityRetainedPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">per rubric & MMLU benchmark tiers</div>
        </div>
      </div>

      <div className="text-right mt-2">
        <span className="text-[11px] italic text-slate-400 font-mono">
          * includes scheduler overhead (Jev routing, verification & embeddings)
        </span>
      </div>
    </div>
  );
};
