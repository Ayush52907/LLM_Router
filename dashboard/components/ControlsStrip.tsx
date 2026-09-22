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
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
  onRunSelectedModel?: () => void;
  isModelRunning?: boolean;
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
  selectedModel = 'auto',
  onSelectModel,
  onRunSelectedModel,
  isModelRunning = false,
}) => {
  return (
    <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-left">
      {/* 1. Sliders section */}
      <div className="flex flex-wrap items-center gap-3 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-300">
          <Sliders className="w-3.5 h-3.5 text-neutral-400" />
          Weights:
        </div>

        {/* Latency */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-neutral-400">Lat:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.latency}
            onChange={(e) => onWeightChange('latency', parseFloat(e.target.value))}
            className="w-16 accent-white cursor-pointer"
          />
          <span className="text-white font-bold">{weights.latency.toFixed(2)}</span>
        </div>

        {/* Accuracy */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-neutral-400">Acc:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.accuracy}
            onChange={(e) => onWeightChange('accuracy', parseFloat(e.target.value))}
            className="w-16 accent-white cursor-pointer"
          />
          <span className="text-white font-bold">{weights.accuracy.toFixed(2)}</span>
        </div>

        {/* Cost */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-neutral-400">Cost:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.cost}
            onChange={(e) => onWeightChange('cost', parseFloat(e.target.value))}
            className="w-16 accent-white cursor-pointer"
          />
          <span className="text-white font-bold">{weights.cost.toFixed(2)}</span>
        </div>

        {/* Energy */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-neutral-400">Energy:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.energy}
            onChange={(e) => onWeightChange('energy', parseFloat(e.target.value))}
            className="w-16 accent-white cursor-pointer"
          />
          <span className="text-white font-bold">{weights.energy.toFixed(2)}</span>
        </div>

        {/* Carbon */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-neutral-400">Carbon:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.carbon}
            onChange={(e) => onWeightChange('carbon', parseFloat(e.target.value))}
            className="w-16 accent-white cursor-pointer"
          />
          <span className="text-white font-bold">{weights.carbon.toFixed(2)}</span>
        </div>
      </div>

      {/* 2. Toggles & Actions */}
      <div className="flex items-center gap-2">
        {/* Urgent toggle */}
        <button
          onClick={onToggleUrgent}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
            isUrgent
              ? 'bg-white text-black border-white'
              : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white hover:border-neutral-500'
          }`}
          title="Toggles w_lat=0.70 per PRD §7.1"
        >
          <Flame className="w-3.5 h-3.5" />
          Urgent
        </button>

        {/* PII Toggle */}
        <button
          onClick={onTogglePii}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
            isPiiEnabled
              ? 'bg-neutral-200 text-black border-neutral-300'
              : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white hover:border-neutral-500'
          }`}
          title="T3 Canary PII Isolation Toggle"
        >
          <Lock className="w-3.5 h-3.5" />
          PII Guard
        </button>

        {/* Fault Injection Toggle */}
        <button
          onClick={onToggleFaultInjection}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
            isFaultInjected
              ? 'bg-neutral-800 text-white border-neutral-600'
              : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white hover:border-neutral-500'
          }`}
          title="T5 Verification Fault Injection Toggle"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Fault Test
        </button>

        {/* Time-shift Batch Scenario Button */}
        <button
          onClick={onRunTimeShift}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#121212] text-neutral-300 border border-[#262626] hover:border-neutral-500 hover:text-white transition-colors"
          title="Runs Phase 7 Time-shift Scenario (200 contracts)"
        >
          <FastForward className="w-3.5 h-3.5" />
          Time-shift
        </button>

        {/* Model Selection Dropdown */}
        {onSelectModel && (
          <div className="flex items-center gap-1">
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="bg-[#121212] border border-[#262626] text-neutral-200 text-xs rounded-md px-2 py-1 focus:border-white focus:outline-none font-mono cursor-pointer hover:border-neutral-500 transition-colors"
              title="Select candidate model for direct API call or choose Auto for full router dispatch"
            >
              <option value="auto">Auto (Optimal Router)</option>
              <option value="gemini-3.6-flash">gemini-3.6-flash (Cloud · 0.82)</option>
              <option value="gemini-pro-latest">gemini-pro-latest (Cloud · 0.94)</option>
              <option value="phi3:latest">phi3:latest (Local · 0.58)</option>
              <option value="deepseek-coder:6.7b">deepseek-coder:6.7b (Local · 0.67)</option>
            </select>
          </div>
        )}

        {/* Run Selected Model Button (when specific model selected) */}
        {onRunSelectedModel && selectedModel !== 'auto' && (
          <button
            onClick={onRunSelectedModel}
            disabled={isModelRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-neutral-200 text-black hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title={`Executes direct API call to ${selectedModel} and displays output`}
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            {isModelRunning ? 'Calling API…' : `Run ${selectedModel}`}
          </button>
        )}

        {/* Run Pipeline Button */}
        <button
          onClick={onRunDemoTask}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-white text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          title="Executes the full carbon- and latency-aware routing pipeline across all subtasks"
        >
          <Play className="w-3.5 h-3.5 fill-black" />
          {isRunning ? 'Executing Pipeline…' : 'Run Pipeline'}
        </button>
      </div>
    </div>
  );
};
