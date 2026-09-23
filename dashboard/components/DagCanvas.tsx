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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5B7EFF]" />
          Live Workflow DAG Canvas
        </h2>
        <span className="text-[11px] text-slate-400 font-mono">
          {nodes.length} subtasks · auto-decomposed
        </span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {nodes.map((node, index) => {
          const isSelected = selectedNodeId === node.id;
          const isPii = node.piiClass === 'raw_pii' || node.id.includes('parties');

          return (
            <div
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              className={`relative cursor-pointer transition-all duration-150 p-3 rounded-xl border text-left ${
                isSelected
                  ? 'border-[#5B7EFF] bg-blue-50/30 shadow-xs ring-1 ring-[#5B7EFF]'
                  : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              {/* Header: Node step number & title */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-[10px] flex items-center justify-center font-mono font-semibold text-slate-700">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 line-clamp-1">
                    {node.description}
                  </span>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-1">
                  {node.status === 'queued' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-mono">
                      queued
                    </span>
                  )}
                  {node.status === 'routing' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#5B7EFF] border border-blue-200 font-mono animate-pulse">
                      routing…
                    </span>
                  )}
                  {node.status === 'executing' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-mono flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      executing
                    </span>
                  )}
                  {node.status === 'verifying' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-mono animate-pulse">
                      verifying
                    </span>
                  )}
                  {node.status === 'done' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono flex items-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                      done
                    </span>
                  )}
                  {node.status === 'failed' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-mono">
                      failed
                    </span>
                  )}
                </div>
              </div>

              {/* Tags & Badges */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {/* PII Forced Local Lock */}
                {isPii && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                    <Lock className="w-2.5 h-2.5" />
                    forced local
                  </span>
                )}

                {/* Complexity Tier */}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                  {node.complexity}
                </span>

                {/* Routed Model & Location Badge */}
                {node.routedModel && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-slate-50 text-slate-700 border-slate-200">
                    {node.routedLocation === 'local' ? (
                      <HardDrive className="w-2.5 h-2.5 text-slate-500" />
                    ) : (
                      <Cloud className="w-2.5 h-2.5 text-blue-500" />
                    )}
                    {node.routedModel}
                  </span>
                )}

                {/* Escalation Badge */}
                {node.escalated && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-2.5 h-2.5" />
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
