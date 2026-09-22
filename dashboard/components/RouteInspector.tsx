'use client';

import React from 'react';
import { Award, ShieldCheck, Zap, DollarSign, Clock, Leaf, Play } from 'lucide-react';

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
  onRunCandidate?: (modelId: string) => void;
  isExecutingModel?: string | null;
}

export const RouteInspector: React.FC<RouteInspectorProps> = ({
  selectedNodeTitle,
  complexity,
  piiForced,
  candidates,
  onRunCandidate,
  isExecutingModel,
}) => {
  return (
    <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-[#262626] pb-2.5 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white" />
          Route Inspector (Five-Factor Breakdown)
        </h2>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
          Not a black box
        </span>
      </div>

      <div className="mb-3 bg-[#121212] p-3 rounded-lg border border-[#262626] text-left">
        <div className="text-xs font-medium text-neutral-200 truncate">
          {selectedNodeTitle || 'Select a DAG node to inspect route scoring'}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-neutral-400 font-mono">
            Complexity: <strong className="text-neutral-200">{complexity}</strong>
          </span>
          {piiForced && (
            <span className="text-[10px] text-neutral-300 font-medium font-mono">
              • [PII Override: Cloud eliminated]
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {candidates.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-xs font-mono">
            Evaluating candidates…
          </div>
        ) : (
          candidates.map((c) => (
            <div
              key={c.model_id}
              className={`p-3 rounded-lg border text-left transition-all ${
                c.is_winner
                  ? 'bg-[#181818] border-white shadow-sm ring-1 ring-white/50'
                  : 'bg-[#121212] border-[#262626] opacity-75 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 font-mono text-xs">
                <div className="flex items-center gap-2">
                  {c.is_winner && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-black px-1.5 py-0.2 rounded">
                      Selected
                    </span>
                  )}
                  <span className="font-semibold text-neutral-100">{c.model_id}</span>
                  <span className="text-neutral-500 text-[10px] uppercase">({c.location})</span>
                </div>

                <div className="text-right">
                  <span className="text-white font-bold">{c.final_score.toFixed(3)}</span>
                  {c.jev_bonus > 0 && (
                    <span className="text-[10px] text-neutral-400 ml-1">
                      (−{c.jev_bonus.toFixed(3)} Jev)
                    </span>
                  )}
                </div>
              </div>

              {/* 5-Factor Horizontal Stacked Bar (Monochrome contrast) */}
              <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden flex my-2">
                <div style={{ width: `${c.lat_norm * 25}%` }} className="bg-white h-full" title="Latency (25%)" />
                <div style={{ width: `${c.acc_norm * 35}%` }} className="bg-neutral-400 h-full" title="Accuracy penalty (35%)" />
                <div style={{ width: `${c.cost_norm * 15}%` }} className="bg-neutral-600 h-full" title="Cost (15%)" />
                <div style={{ width: `${c.energy_norm * 10}%` }} className="bg-neutral-700 h-full" title="Energy (10%)" />
                <div style={{ width: `${c.carbon_norm * 15}%` }} className="bg-neutral-800 h-full" title="Carbon (15%)" />
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mt-1 pt-1 border-t border-[#222]">
                <span>Tier: {c.accuracy_tier.toFixed(2)}</span>
                {onRunCandidate && (
                  <button
                    type="button"
                    disabled={Boolean(isExecutingModel)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunCandidate(c.model_id);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium flex items-center gap-1 transition-all cursor-pointer ${
                      c.is_winner
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-[#222] text-neutral-300 hover:bg-[#333] hover:text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    {isExecutingModel === c.model_id ? 'Running…' : `Run API`}
                  </button>
                )}
                <span className="text-neutral-500">
                  Raw: {c.raw_score.toFixed(3)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2.5 border-t border-[#262626] mt-2 flex-wrap gap-1 font-mono">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white" /> Lat (25%)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-neutral-400" /> Acc (35%)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-neutral-600" /> Cost (15%)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-neutral-700" /> Energy (10%)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-neutral-800" /> Carbon (15%)</span>
      </div>
    </div>
  );
};
