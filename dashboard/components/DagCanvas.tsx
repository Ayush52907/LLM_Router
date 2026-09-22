'use client';

import React, { useState } from 'react';
import { Lock, Cloud, HardDrive, AlertTriangle, CheckCircle, RefreshCw, FileText, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

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
  output?: string | null;
  prompt?: string | null;
  actualLatencyMs?: number | null;
  actualCostUsd?: number | null;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  return (
    <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-[#262626] pb-2.5 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white" />
          Live Workflow DAG Canvas
        </h2>
        <span className="text-[11px] text-neutral-400 font-mono">
          5 subtasks · auto-decomposed
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
              className={`relative cursor-pointer transition-all duration-150 p-3 rounded-lg border text-left ${
                isSelected
                  ? 'border-white bg-[#1a1a1a] shadow-sm ring-1 ring-white/50'
                  : 'border-[#262626] bg-[#121212] hover:border-neutral-500 hover:bg-[#161616]'
              }`}
            >
              {/* Header: Node step number & title */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-[#222] border border-[#333] text-[10px] flex items-center justify-center font-mono font-semibold text-neutral-200">
                    {index + 1}
                  </span>
                  <span className="text-xs font-medium text-neutral-200 line-clamp-1">
                    {node.description}
                  </span>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-1">
                  {node.status === 'queued' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 font-mono">
                      queued
                    </span>
                  )}
                  {node.status === 'routing' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 text-white border border-neutral-700 font-mono animate-pulse">
                      routing…
                    </span>
                  )}
                  {node.status === 'executing' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-white border border-neutral-600 font-mono flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      executing
                    </span>
                  )}
                  {node.status === 'verifying' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-white border border-neutral-600 font-mono animate-pulse">
                      verifying
                    </span>
                  )}
                  {node.status === 'done' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 text-neutral-200 border border-neutral-700 font-mono flex items-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5 text-white" />
                      done
                    </span>
                  )}
                  {node.status === 'failed' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-700 font-mono">
                      failed
                    </span>
                  )}
                </div>
              </div>

              {/* Tags & Badges */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {/* PII Forced Local Lock */}
                {isPii && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-900 text-neutral-200 border border-neutral-700">
                    <Lock className="w-2.5 h-2.5" />
                    forced local
                  </span>
                )}

                {/* Complexity Tier */}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-neutral-400 border border-neutral-800">
                  {node.complexity}
                </span>

                {/* Routed Model & Location Badge */}
                {node.routedModel && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border bg-neutral-900 text-neutral-200 border-neutral-700">
                    {node.routedLocation === 'local' ? (
                      <HardDrive className="w-2.5 h-2.5 text-neutral-300" />
                    ) : (
                      <Cloud className="w-2.5 h-2.5 text-neutral-400" />
                    )}
                    {node.routedModel}
                  </span>
                )}

                {/* Escalation Badge */}
                {node.escalated && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-900 text-white border border-neutral-600">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {node.originalModel || 'small'} → {node.routedModel}
                  </span>
                )}
              </div>

              {/* Collapsible Output Viewer */}
              {node.output && (
                <div className="mt-2.5 pt-2 border-t border-[#262626]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === node.id ? null : node.id);
                    }}
                    className="flex items-center justify-between w-full text-[11px] font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-neutral-400" />
                      <span>{expandedId === node.id ? 'Hide Output' : 'View Generated Output'}</span>
                    </span>
                    {expandedId === node.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {expandedId === node.id && (
                    <div className="mt-2 p-2.5 rounded bg-[#0d0d0d] border border-[#262626] text-xs font-mono text-neutral-300">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#222] text-[10px] text-neutral-500">
                        <div className="flex items-center gap-2">
                          <span>Model: <strong className="text-neutral-200">{node.routedModel}</strong></span>
                          {node.actualLatencyMs && (
                            <span>· {(node.actualLatencyMs / 1000).toFixed(2)}s</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(node.output || '');
                            setCopiedId(node.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[10px]"
                        >
                          {copiedId === node.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto pr-1 text-[11px] text-neutral-300">
                        {node.output}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
