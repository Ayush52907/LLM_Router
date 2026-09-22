'use client';

import React from 'react';
import { Lock, Cloud, HardDrive, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export interface DagNode {
  id: string;
  description: string;
  type: string;
  complexity: string;
  piiClass?: string | null;
  routedModel?: string | null;
  routedLocation?: 'cloud' | 'local' | null;
  status: 'queued' | 'routing' | 'executing' | 'verifying' | 'done' | 'failed';
  escalated?: boolean;
  originalModel?: string | null;
}

interface DagCanvasProps {
  nodes: DagNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

export const DagCanvas: React.FC<DagCanvasProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
}) => {
  return (
    <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          Live Workflow DAG Canvas
        </h2>
        <span className="text-[11px] text-slate-400 font-mono">
          5 subtasks · auto-decomposed
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {nodes.map((node, index) => {
          const isSelected = selectedNodeId === node.id;
          const isPii = node.piiClass === 'raw_pii' || node.id.includes('parties');

          return (
            <div
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              className={`relative cursor-pointer transition-all duration-200 p-3 rounded-lg border text-left ${
                isSelected
                  ? 'border-sky-400 bg-slate-800/90 shadow-md shadow-sky-500/10 ring-1 ring-sky-400'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              {/* Header: Node step number & title */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] flex items-center justify-center font-mono font-bold text-slate-300">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 line-clamp-1">
                    {node.description}
                  </span>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-1">
                  {node.status === 'queued' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      queued
                    </span>
                  )}
                  {node.status === 'routing' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 font-mono animate-pulse">
                      routing
                    </span>
                  )}
                  {node.status === 'executing' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      executing
                    </span>
                  )}
                  {node.status === 'verifying' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono animate-pulse">
                      verifying
                    </span>
                  )}
                  {node.status === 'done' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono flex items-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5" />
                      done
                    </span>
                  )}
                  {node.status === 'failed' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                      failed
                    </span>
                  )}
                </div>
              </div>

              {/* Tags & Badges */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {/* PII Forced Local Lock */}
                {isPii && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-700">
                    <Lock className="w-2.5 h-2.5" />
                    🔒 forced local
                  </span>
                )}

                {/* Complexity Tier */}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {node.complexity}
                </span>

                {/* Routed Model & Location Badge */}
                {node.routedModel && (
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                      node.routedLocation === 'local'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        : 'bg-blue-950/80 text-blue-300 border-blue-700'
                    }`}
                  >
                    {node.routedLocation === 'local' ? (
                      <HardDrive className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Cloud className="w-2.5 h-2.5 text-blue-400" />
                    )}
                    {node.routedModel}
                  </span>
                )}

                {/* Escalation Badge */}
                {node.escalated && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700 animate-pulse">
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                    {node.originalModel || 'small'} → {node.routedModel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
