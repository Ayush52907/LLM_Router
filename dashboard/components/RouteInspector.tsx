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
    <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400" />
          Route Inspector (Five-Factor Breakdown)
        </h2>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
          Not a black box
        </span>
      </div>

      <div className="mb-3 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-left">
        <div className="text-xs font-semibold text-slate-200 truncate">
          {selectedNodeTitle || 'Select a DAG node to inspect route scoring'}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-slate-400 font-mono">
            Complexity: <strong className="text-slate-300">{complexity}</strong>
          </span>
          {piiForced && (
            <span className="text-[10px] text-amber-400 font-bold">
              • [PII Override: Cloud eliminated]
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 mb-3 px-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-sky-500" /> Latency
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-indigo-500" /> Accuracy
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-500" /> Cost
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-amber-500" /> Energy
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-teal-400" /> Carbon
        </span>
      </div>

      {/* Candidates List */}
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {candidates.map((c) => (
          <div
            key={c.model_id}
            className={`p-2.5 rounded-lg border transition-all text-left ${
              c.is_winner
                ? 'bg-slate-800/90 border-teal-500/80 shadow-sm shadow-teal-500/20 ring-1 ring-teal-500/40'
                : 'bg-slate-900/50 border-slate-800 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {c.is_winner && <Award className="w-3.5 h-3.5 text-teal-400" />}
                <span className="text-xs font-bold font-mono text-slate-200">
                  {c.model_id}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({c.location})
                </span>
              </div>
              <div className="text-[11px] font-mono flex items-center gap-2">
                <span className="text-slate-400">Raw: {c.raw_score.toFixed(3)}</span>
                {c.jev_bonus > 0 && (
                  <span className="text-teal-400 font-semibold">
                    -Jev({c.jev_bonus.toFixed(3)})
                  </span>
                )}
                <span className={`font-bold ${c.is_winner ? 'text-teal-300' : 'text-slate-300'}`}>
                  = {c.final_score.toFixed(3)}
                </span>
              </div>
            </div>

            {/* Stacked Bar Score Visualization */}
            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden flex">
              <div
                style={{ width: `${c.lat_norm * 20}%` }}
                className="bg-sky-500 h-full"
                title={`Latency component: ${(c.lat_norm * 0.25).toFixed(3)}`}
              />
              <div
                style={{ width: `${c.acc_norm * 25}%` }}
                className="bg-indigo-500 h-full"
                title={`Accuracy penalty: ${(c.acc_norm * 0.35).toFixed(3)}`}
              />
              <div
                style={{ width: `${c.cost_norm * 15}%` }}
                className="bg-emerald-500 h-full"
                title={`Cost component: ${(c.cost_norm * 0.15).toFixed(3)}`}
              />
              <div
                style={{ width: `${c.energy_norm * 10}%` }}
                className="bg-amber-500 h-full"
                title={`Energy component: ${(c.energy_norm * 0.10).toFixed(3)}`}
              />
              <div
                style={{ width: `${c.carbon_norm * 15}%` }}
                className="bg-teal-400 h-full"
                title={`Carbon component: ${(c.carbon_norm * 0.15).toFixed(3)}`}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5">
              <span>Tier: {c.accuracy_tier.toFixed(2)}</span>
              {c.is_winner && (
                <span className="text-teal-400 font-semibold uppercase tracking-wider">
                  ★ Selected Route
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
