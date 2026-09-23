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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-2 h-2 rounded-full bg-[#5B7EFF]" />
          <h1 className="text-xs font-semibold tracking-wider uppercase text-slate-700">
            Headline Impact vs Always-Strongest (Baseline A)
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          {isMeasuredOffline ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-[#5B7EFF] border border-blue-100">
              Measured Offline (N=60)
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
              Live Estimate
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {/* Cost Saved */}
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Cost Saved</div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            +{costSavedPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">vs Always-strongest ($0.092 vs $0.026)</div>
        </div>

        {/* Carbon Saved */}
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Carbon Saved</div>
          <div className="text-2xl font-bold text-[#5B7EFF] tracking-tight">
            +{carbonSavedPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">EcoLogits (cloud) & CodeCarbon (local)</div>
        </div>

        {/* Quality Retained */}
        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Quality Retained</div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {qualityRetainedPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">Gold standard compliance score</div>
        </div>
      </div>

      <div className="text-right mt-2">
        <span className="text-[10px] italic text-slate-400 font-mono">
          * includes scheduler overhead (Jev routing, verification & embeddings)
        </span>
      </div>
    </div>
  );
};
