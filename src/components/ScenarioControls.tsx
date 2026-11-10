'use client';

import React, { useCallback } from 'react';
import {
  Clock,
  Gauge,
  ArrowRightLeft,
  Settings2,
  RotateCcw,
  Info,
} from 'lucide-react';
import type { ScenarioInputs } from '../lib/calculations';

interface ScenarioControlsProps {
  inputs: ScenarioInputs;
  onUpdate: <K extends keyof ScenarioInputs>(key: K, value: ScenarioInputs[K]) => void;
  onReset: () => void;
}

function SliderControl({
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  formatValue,
  description,
  colorClass = 'emerald',
}: {
  label: string;
  icon: React.ElementType;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  description: string;
  colorClass?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = formatValue ? formatValue(value) : `${value}`;

  const accentColors: Record<string, { track: string; thumb: string; text: string; bg: string }> = {
    emerald: {
      track: 'from-emerald-500 to-emerald-400',
      thumb: 'border-emerald-400 shadow-emerald-500/30',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    amber: {
      track: 'from-amber-500 to-amber-400',
      thumb: 'border-amber-400 shadow-amber-500/30',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    blue: {
      track: 'from-blue-500 to-blue-400',
      thumb: 'border-blue-400 shadow-blue-500/30',
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    red: {
      track: 'from-red-500 to-red-400',
      thumb: 'border-red-400 shadow-red-500/30',
      text: 'text-red-400',
      bg: 'bg-red-500/10',
    },
  };

  const colors = accentColors[colorClass] || accentColors.emerald;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${colors.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-300">{label}</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-600">{description}</span>
            </div>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/50`}>
          <span className={`text-sm font-mono font-bold ${colors.text} tabular-nums`}>
            {display}
          </span>
          <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
        </div>
      </div>

      {/* Custom slider */}
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1.5 rounded-full bg-slate-800">
          {/* Filled track */}
          <div
            className={`absolute h-full rounded-full bg-gradient-to-r ${colors.track} transition-all duration-150`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Native range input (invisible, for interaction) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-6 opacity-0 cursor-pointer z-10"
        />

        {/* Visual thumb */}
        <div
          className={`absolute w-4 h-4 rounded-full bg-slate-950 border-2 ${colors.thumb} shadow-lg transition-all duration-150 pointer-events-none`}
          style={{ left: `calc(${pct}% - 8px)` }}
        >
          <div className={`absolute inset-1 rounded-full bg-gradient-to-r ${colors.track}`} />
        </div>
      </div>

      {/* Range labels */}
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-slate-700 font-mono tabular-nums">
          {formatValue ? formatValue(min) : min}
        </span>
        <span className="text-[9px] text-slate-700 font-mono tabular-nums">
          {formatValue ? formatValue(max) : max}
        </span>
      </div>
    </div>
  );
}

export default function ScenarioControls({
  inputs,
  onUpdate,
  onReset,
}: ScenarioControlsProps) {
  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Scenario Engine</h3>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-300 rounded-md hover:bg-slate-800/60 transition-all"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      <div className="space-y-5">
        <SliderControl
          label="Time of Day"
          icon={Clock}
          value={inputs.timeOfDay}
          min={0}
          max={23}
          step={1}
          unit="h"
          onChange={(v) => onUpdate('timeOfDay', v)}
          formatValue={(v) => `${String(v).padStart(2, '0')}:00`}
          description="Simulate tariff period"
          colorClass="emerald"
        />

        <SliderControl
          label="Power Factor"
          icon={Gauge}
          value={inputs.powerFactor}
          min={0.6}
          max={1.0}
          step={0.01}
          unit="cos φ"
          onChange={(v) => onUpdate('powerFactor', v)}
          formatValue={(v) => v.toFixed(2)}
          description="EMRC penalty threshold: 0.90"
          colorClass="blue"
        />

        <SliderControl
          label="Peak → Off-Peak Shift"
          icon={ArrowRightLeft}
          value={inputs.peakShiftPct}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => onUpdate('peakShiftPct', v)}
          description="Load shifted to off-peak hours"
          colorClass="amber"
        />

        <SliderControl
          label="Bearing Wear"
          icon={Settings2}
          value={inputs.bearingWear}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => onUpdate('bearingWear', v)}
          description="Main pump bearing condition"
          colorClass="red"
        />
      </div>

      {/* Info note */}
      <div className="mt-5 flex items-start gap-2 p-2.5 rounded-lg bg-slate-800/30 border border-slate-800/40">
        <Info className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Adjust parameters to simulate real-time impact on energy costs, plant efficiency, and
          equipment health. All KPIs update instantly.
        </p>
      </div>
    </div>
  );
}
