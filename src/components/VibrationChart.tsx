'use client';

import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Activity, AlertTriangle, Info } from 'lucide-react';
import { generateVibrationSpectrum } from '../lib/calculations';

interface VibrationChartProps {
  bearingWear: number;
  isLoading: boolean;
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/60 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-slate-400 font-mono mb-1">
        Frequency: {label} Hz
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(3)} mm/s
        </p>
      ))}
    </div>
  );
}

export default function VibrationChart({
  bearingWear,
  isLoading,
}: VibrationChartProps) {
  const [showBaseline, setShowBaseline] = useState(true);

  const data = useMemo(
    () => generateVibrationSpectrum(bearingWear),
    [bearingWear]
  );

  const maxAmplitude = useMemo(
    () => Math.max(...data.map((d) => d.amplitude)),
    [data]
  );

  const severityLevel =
    maxAmplitude < 2 ? 'Good' : maxAmplitude < 4.5 ? 'Satisfactory' : maxAmplitude < 7 ? 'Unsatisfactory' : 'Unacceptable';
  const severityColor =
    maxAmplitude < 2
      ? 'text-emerald-400'
      : maxAmplitude < 4.5
      ? 'text-amber-400'
      : maxAmplitude < 7
      ? 'text-orange-400'
      : 'text-red-400';

  // ISO 10816 vibration severity zones
  const isoZones = [
    { y: 1.8, label: 'ISO Good', color: '#22c55e' },
    { y: 4.5, label: 'ISO Satisfactory', color: '#f59e0b' },
    { y: 7.1, label: 'ISO Unsatisfactory', color: '#ef4444' },
  ];

  if (isLoading) {
    return (
      <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5 animate-pulse">
        <div className="h-4 w-48 bg-slate-800 rounded mb-4" />
        <div className="h-64 bg-slate-800/40 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Vibration Spectrum — Main Pump Motor
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Frequency domain analysis · ISO 10816 classification
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Baseline toggle */}
          <button
            onClick={() => setShowBaseline(!showBaseline)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
              showBaseline
                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                : 'bg-slate-800/40 text-slate-600 border border-slate-800/60'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                showBaseline ? 'bg-slate-400' : 'bg-slate-700'
              }`}
            />
            Baseline
          </button>

          {/* Severity badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/50`}
          >
            {maxAmplitude >= 4.5 && (
              <AlertTriangle className="w-3 h-3 text-red-400" />
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${severityColor}`}>
              {severityLevel}
            </span>
            <span className="text-[10px] text-slate-600">
              Peak: {maxAmplitude.toFixed(1)} mm/s
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="vibGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748b" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="freq"
              tick={{ fontSize: 10, fill: '#475569' }}
              axisLine={{ stroke: '#1e293b' }}
              tickLine={false}
              label={{
                value: 'Frequency (Hz)',
                position: 'insideBottom',
                offset: -5,
                style: { fontSize: 10, fill: '#475569' },
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#475569' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 'auto']}
              label={{
                value: 'Amplitude (mm/s)',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 10, fill: '#475569' },
              }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* ISO reference lines */}
            {isoZones.map((zone) => (
              <ReferenceLine
                key={zone.label}
                y={zone.y}
                stroke={zone.color}
                strokeDasharray="6 4"
                strokeWidth={0.8}
                label={{
                  value: zone.label,
                  position: 'right',
                  style: { fontSize: 8, fill: zone.color },
                }}
              />
            ))}

            {/* Baseline area */}
            {showBaseline && (
              <Area
                type="monotone"
                dataKey="baseline"
                stroke="#475569"
                strokeWidth={1}
                fill="url(#baseGrad)"
                dot={false}
                name="Baseline"
                isAnimationActive={false}
              />
            )}

            {/* Current vibration */}
            <Area
              type="monotone"
              dataKey="amplitude"
              stroke="#3b82f6"
              strokeWidth={1.5}
              fill="url(#vibGrad)"
              dot={false}
              name="Current"
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom annotations */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-blue-500 rounded-full" />
            <span className="text-[10px] text-slate-500">Current</span>
          </div>
          {showBaseline && (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-slate-500 rounded-full" />
              <span className="text-[10px] text-slate-500">Baseline (Healthy)</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t border-dashed border-emerald-500" />
            <span className="text-[10px] text-slate-500">ISO Zones</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-600">
          <Info className="w-3 h-3" />
          Defect frequencies: BPFO 148Hz · BPFI 236Hz · BSF 97Hz · FTF 12Hz
        </div>
      </div>
    </div>
  );
}
