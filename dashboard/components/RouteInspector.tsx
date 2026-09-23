'use client';

import React from 'react';
import { Award, ShieldCheck, Zap, DollarSign, Clock, Leaf } from 'lucide-react';

interface CandidateBreakdown {
  model_id: string;
  location: 'cloud' | 'local';
  accuracy_tier: number;
  raw_score: number;
  jev_bonus: number;
  final_score: number;
  lat_norm: number;
  acc_norm: number;
  cost_norm: number;
  energy_norm: number;
  carbon_norm: number;
  is_winner: boolean;
}

interface RouteInspectorProps {
  selectedNodeTitle: string;
  complexity: string;
  piiForced: boolean;
  candidates: CandidateBreakdown[];
}

export const RouteInspector: React.FC<RouteInspectorProps> = ({
  selectedNodeTitle,
  complexity,
  piiForced,
  candidates,
}) => {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5B7EFF]" />
          Route Inspector (Five-Factor Breakdown)
        </h2>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          Not a black box
        </span>
      </div>

      <div className="mb-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-left">
        <div className="text-xs font-semibold text-slate-800 truncate">
          {selectedNodeTitle || 'Select a DAG node to inspect route scoring'}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-slate-500 font-mono">
            Complexity: <strong className="text-slate-800">{complexity}</strong>
          </span>
          {piiForced && (
            <span className="text-[10px] text-purple-700 font-medium font-mono">
              • [PII Override: Cloud eliminated]
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {candidates.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-mono">
            Evaluating candidates…
          </div>
        ) : (
          candidates.map((c) => (
            <div
              key={c.model_id}
              className={`p-3 rounded-xl border text-left transition-all ${
                c.is_winner
                  ? 'bg-blue-50/20 border-[#5B7EFF] shadow-xs ring-1 ring-[#5B7EFF]'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 font-mono text-xs">
                <div className="flex items-center gap-2">
                  {c.is_winner && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#0F172A] text-white px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                  <span className="font-semibold text-slate-800">{c.model_id}</span>
                  <span className="text-slate-400 text-[10px] uppercase">({c.location})</span>
                </div>

                <div className="text-right">
                  <span className="text-slate-900 font-bold">{c.final_score.toFixed(3)}</span>
                  {c.jev_bonus > 0 && (
                    <span className="text-[10px] text-[#5B7EFF] ml-1">
                      (−{c.jev_bonus.toFixed(3)} Jev)
                    </span>
                  )}
                </div>
              </div>

              {/* 5-Factor Horizontal Stacked Bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex my-2">
                <div style={{ width: `${c.lat_norm * 25}%` }} className="bg-[#5B7EFF] h-full" title="Latency (25%)" />
                <div style={{ width: `${c.acc_norm * 35}%` }} className="bg-indigo-500 h-full" title="Accuracy penalty (35%)" />
                <div style={{ width: `${c.cost_norm * 15}%` }} className="bg-amber-500 h-full" title="Cost (15%)" />
                <div style={{ width: `${c.energy_norm * 10}%` }} className="bg-emerald-500 h-full" title="Energy (10%)" />
                <div style={{ width: `${c.carbon_norm * 15}%` }} className="bg-rose-500 h-full" title="Carbon (15%)" />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Tier: {c.accuracy_tier.toFixed(2)}</span>
                <span className="text-slate-400">
                  Raw: {c.raw_score.toFixed(3)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2.5 border-t border-slate-100 mt-2 flex-wrap gap-1 font-mono">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#5B7EFF]" /> Lat (25%)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Acc (35%)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Cost (15%)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Energy (10%)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Carbon (15%)</span>
      </div>
    </div>
  );
};
