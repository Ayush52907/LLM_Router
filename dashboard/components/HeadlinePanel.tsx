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
    <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#262626] pb-2.5 mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-2 h-2 rounded-full bg-white" />
          <h1 className="text-xs font-semibold tracking-wider uppercase text-neutral-300">
            Headline Impact vs Always-Strongest (Baseline A)
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          {isMeasuredOffline ? (
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-neutral-900 text-neutral-200 border border-neutral-700">
              Measured Offline (N=60)
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
              Live Estimate
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        {/* Cost Saved */}
        <div className="bg-[#121212] p-3.5 rounded-lg border border-[#262626]">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-400 mb-1">Cost Saved</div>
          <div className="text-3xl font-bold text-white tracking-tight">
            +{costSavedPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 font-mono">vs Always-strongest ($0.092 vs $0.026)</div>
        </div>

        {/* Carbon Saved */}
        <div className="bg-[#121212] p-3.5 rounded-lg border border-[#262626]">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-400 mb-1">Carbon Saved</div>
          <div className="text-3xl font-bold text-white tracking-tight">
            +{carbonSavedPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 font-mono">EcoLogits (cloud) & CodeCarbon (local)</div>
        </div>

        {/* Quality Retained */}
        <div className="bg-[#121212] p-3.5 rounded-lg border border-[#262626]">
          <div className="text-[11px] uppercase tracking-wider font-medium text-neutral-400 mb-1">Quality Retained</div>
          <div className="text-3xl font-bold text-white tracking-tight">
            {qualityRetainedPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 font-mono">Gold standard compliance score</div>
        </div>
      </div>

      <div className="text-right mt-2">
        <span className="text-[11px] italic text-neutral-400 font-mono">
          * includes scheduler overhead (Jev routing, verification & embeddings)
        </span>
      </div>
    </div>
  );
};
