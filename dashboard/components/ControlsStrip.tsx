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
    <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-wrap items-center justify-between gap-4 text-left">
      {/* 1. Sliders section */}
      <div className="flex flex-wrap items-center gap-4 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          Weights:
        </div>

        {/* Latency */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-400">Lat:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.latency}
            onChange={(e) => onWeightChange('latency', parseFloat(e.target.value))}
            className="w-16 accent-sky-500 cursor-pointer"
          />
          <span className="w-7 text-sky-400 font-bold">{weights.latency.toFixed(2)}</span>
        </div>

        {/* Accuracy */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-400">Acc:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.accuracy}
            onChange={(e) => onWeightChange('accuracy', parseFloat(e.target.value))}
            className="w-16 accent-indigo-500 cursor-pointer"
          />
          <span className="w-7 text-indigo-400 font-bold">{weights.accuracy.toFixed(2)}</span>
        </div>

        {/* Cost */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-400">Cost:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.cost}
            onChange={(e) => onWeightChange('cost', parseFloat(e.target.value))}
            className="w-16 accent-emerald-500 cursor-pointer"
          />
          <span className="w-7 text-emerald-400 font-bold">{weights.cost.toFixed(2)}</span>
        </div>

        {/* Energy */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-400">Energy:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.energy}
            onChange={(e) => onWeightChange('energy', parseFloat(e.target.value))}
            className="w-16 accent-amber-500 cursor-pointer"
          />
          <span className="w-7 text-amber-400 font-bold">{weights.energy.toFixed(2)}</span>
        </div>

        {/* Carbon */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-400 font-semibold text-teal-300">Carbon:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.carbon}
            onChange={(e) => onWeightChange('carbon', parseFloat(e.target.value))}
            className="w-20 accent-teal-400 cursor-pointer"
            title="Move to 0.50 to test T1 slider flip!"
          />
          <span className="w-7 text-teal-300 font-bold">{weights.carbon.toFixed(2)}</span>
        </div>
      </div>

      {/* 2. Interactive Toggles */}
      <div className="flex items-center gap-2">
        {/* Urgent Toggle */}
        <button
          onClick={onToggleUrgent}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-all ${
            isUrgent
              ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-sm shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
          }`}
        >
          <Flame className="w-3 h-3 text-amber-400" />
          Urgent: {isUrgent ? 'ON (w_lat=0.5)' : 'OFF'}
        </button>

        {/* PII Toggle */}
        <button
          onClick={onTogglePii}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-all ${
            isPiiEnabled
              ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
          }`}
        >
          <Lock className="w-3 h-3 text-emerald-400" />
          PII Guard: {isPiiEnabled ? 'ACTIVE' : 'OFF'}
        </button>

        {/* Fault Injection Toggle (Guaranteed Demo Escalation) */}
        <button
          onClick={onToggleFaultInjection}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-all ${
            isFaultInjected
              ? 'bg-rose-950 text-rose-300 border-rose-600 shadow-sm shadow-rose-500/20 animate-pulse'
              : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          Fault Injection: {isFaultInjected ? 'ARMED' : 'OFF'}
        </button>
      </div>

      {/* 3. Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunTimeShift}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-800/80 transition-all shadow-sm"
        >
          <FastForward className="w-3.5 h-3.5 text-teal-400" />
          Time-Shift Batch (200 docs)
        </button>

        <button
          onClick={onRunDemoTask}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isRunning ? 'Processing...' : 'Run Demo Task'}
        </button>
      </div>
    </div>
  );
};
