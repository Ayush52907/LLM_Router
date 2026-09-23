'use client';

import React from 'react';
import { Play, Flame, Lock, ShieldAlert, FastForward, Sliders } from 'lucide-react';

export interface ScoringWeightsState {
  latency: number;
  accuracy: number;
  cost: number;
  energy: number;
  carbon: number;
}

interface ControlsStripProps {
  weights: ScoringWeightsState;
  onWeightChange: (key: keyof ScoringWeightsState, value: number) => void;
  isUrgent: boolean;
  onToggleUrgent: () => void;
  isPiiEnabled: boolean;
  onTogglePii: () => void;
  isFaultInjected: boolean;
  onToggleFaultInjection: () => void;
  onRunDemoTask: () => void;
  onRunTimeShift: () => void;
  isRunning: boolean;
}

export const ControlsStrip: React.FC<ControlsStripProps> = ({
  weights,
  onWeightChange,
  isUrgent,
  onToggleUrgent,
  isPiiEnabled,
  onTogglePii,
  isFaultInjected,
  onToggleFaultInjection,
  onRunDemoTask,
  onRunTimeShift,
  isRunning,
}) => {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-left">
      {/* 1. Sliders section */}
      <div className="flex flex-wrap items-center gap-4 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
          <Sliders className="w-3.5 h-3.5 text-[#5B7EFF]" />
          Scoring Weights:
        </div>

        {/* Latency */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-500">Lat:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.latency}
            onChange={(e) => onWeightChange('latency', parseFloat(e.target.value))}
            className="w-16 accent-[#5B7EFF] cursor-pointer"
          />
          <span className="text-slate-900 font-bold">{weights.latency.toFixed(2)}</span>
        </div>

        {/* Accuracy */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-500">Acc:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.accuracy}
            onChange={(e) => onWeightChange('accuracy', parseFloat(e.target.value))}
            className="w-16 accent-[#5B7EFF] cursor-pointer"
          />
          <span className="text-slate-900 font-bold">{weights.accuracy.toFixed(2)}</span>
        </div>

        {/* Cost */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-500">Cost:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.cost}
            onChange={(e) => onWeightChange('cost', parseFloat(e.target.value))}
            className="w-16 accent-[#5B7EFF] cursor-pointer"
          />
          <span className="text-slate-900 font-bold">{weights.cost.toFixed(2)}</span>
        </div>

        {/* Energy */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-500">Energy:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.energy}
            onChange={(e) => onWeightChange('energy', parseFloat(e.target.value))}
            className="w-16 accent-[#5B7EFF] cursor-pointer"
          />
          <span className="text-slate-900 font-bold">{weights.energy.toFixed(2)}</span>
        </div>

        {/* Carbon */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-500">Carbon:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.carbon}
            onChange={(e) => onWeightChange('carbon', parseFloat(e.target.value))}
            className="w-16 accent-[#5B7EFF] cursor-pointer"
          />
          <span className="text-slate-900 font-bold">{weights.carbon.toFixed(2)}</span>
        </div>
      </div>

      {/* 2. Toggles & Actions */}
      <div className="flex items-center gap-2">
        {/* Urgent toggle */}
        <button
          onClick={onToggleUrgent}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
            isUrgent
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
          title="Toggles w_lat=0.70 per PRD §7.1"
        >
          <Flame className="w-3.5 h-3.5" />
          Urgent
        </button>

        {/* PII Toggle */}
        <button
          onClick={onTogglePii}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
            isPiiEnabled
              ? 'bg-[#5B7EFF] text-white border-[#5B7EFF]'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
          title="T3 Canary PII Isolation Toggle"
        >
          <Lock className="w-3.5 h-3.5" />
          PII Guard
        </button>

        {/* Fault Injection Toggle */}
        <button
          onClick={onToggleFaultInjection}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
            isFaultInjected
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
          title="T5 Verification Fault Injection Toggle"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Fault Test
        </button>

        {/* Time-shift Batch Scenario Button */}
        <button
          onClick={onRunTimeShift}
          className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
          title="Runs Phase 7 Time-shift Scenario (200 contracts)"
        >
          <FastForward className="w-3.5 h-3.5 text-[#5B7EFF]" />
          Time-shift
        </button>

        {/* Run Demo Task Button */}
        <button
          onClick={onRunDemoTask}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#0F172A] text-white hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          {isRunning ? 'Executing…' : 'Run Pipeline'}
        </button>
      </div>
    </div>
  );
};
