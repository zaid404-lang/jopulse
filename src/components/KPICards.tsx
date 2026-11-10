'use client';

import React, { useMemo } from 'react';
import {
  Zap,
  DollarSign,
  Heart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import type { KPIResults } from '../lib/calculations';
import { generateSparkline } from '../lib/calculations';

interface KPICardsProps {
  kpis: KPIResults;
  isLoading: boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-20 bg-slate-800 rounded" />
        <div className="h-6 w-6 bg-slate-800 rounded-md" />
      </div>
      <div className="h-8 w-32 bg-slate-800 rounded mb-3" />
      <div className="h-10 w-full bg-slate-800/50 rounded" />
    </div>
  );
}

function MiniSparkline({
  data,
  color,
  height = 40,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function HealthGauge({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value >= 70 ? '#22c55e' : value >= 40 ? '#f59e0b' : '#ef4444';
  const label =
    value >= 70 ? 'Healthy' : value >= 40 ? 'Warning' : 'Critical';

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        {/* Background ring */}
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="#1e293b"
          strokeWidth="5"
        />
        {/* Value ring */}
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-lg font-bold font-mono tabular-nums"
          style={{ color }}
        >
          {value}%
        </span>
        <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  );
}

export default function KPICards({ kpis, isLoading }: KPICardsProps) {
  const loadSparkline = useMemo(
    () => generateSparkline(kpis.plantLoad, 60),
    [kpis.plantLoad]
  );
  const costSparkline = useMemo(
    () => generateSparkline(kpis.energyCostThisHour, kpis.energyCostThisHour * 0.15),
    [kpis.energyCostThisHour]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const tariffColor = kpis.currentTariff.color;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Plant Load */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5 hover:border-emerald-500/30 transition-all duration-300 group">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Plant Load
          </span>
          <div className="p-1.5 rounded-md bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-2xl font-bold text-white font-mono tabular-nums">
            {kpis.plantLoad.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 mb-1">kW</span>
        </div>
        <div className="flex items-center gap-1 mb-3">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] text-emerald-400 font-medium">Active</span>
          <span className="text-[10px] text-slate-600 ml-1">·</span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm"
            style={{
              color: tariffColor,
              backgroundColor: `${tariffColor}15`,
            }}
          >
            {kpis.currentTariff.label} · {kpis.currentTariff.rate} fils
          </span>
        </div>
        <MiniSparkline data={loadSparkline} color="#22c55e" />
      </div>

      {/* Energy Cost This Hour */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5 hover:border-amber-500/30 transition-all duration-300 group">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Energy Cost / Hour
          </span>
          <div className="p-1.5 rounded-md bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
        </div>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-2xl font-bold text-white font-mono tabular-nums">
            {kpis.energyCostThisHour.toFixed(2)}
          </span>
          <span className="text-xs text-slate-500 mb-1">JD</span>
        </div>
        <div className="flex items-center gap-1 mb-3">
          {kpis.energyCostThisHour > 60 ? (
            <>
              <TrendingUp className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-red-400 font-medium">High rate period</span>
            </>
          ) : (
            <>
              <TrendingDown className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">Efficient rate</span>
            </>
          )}
        </div>
        <MiniSparkline data={costSparkline} color="#f59e0b" />
      </div>

      {/* Main Pump Health */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5 hover:border-blue-500/30 transition-all duration-300 group">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Main Pump Health
          </span>
          <div className="p-1.5 rounded-md bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
            <Heart className="w-3.5 h-3.5 text-blue-400" />
          </div>
        </div>

        {kpis.pumpHealth < 40 && (
          <div className="flex items-center gap-1.5 px-2 py-1 mb-2 rounded-md bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-red-400 font-medium">
              Maintenance required — vibration {kpis.vibrationLevel} mm/s
            </span>
          </div>
        )}

        <HealthGauge value={kpis.pumpHealth} />

        <div className="text-center mt-2">
          <span className="text-[10px] text-slate-500">
            Vibration:{' '}
            <span
              className={`font-mono font-semibold ${
                kpis.vibrationLevel < 3
                  ? 'text-emerald-400'
                  : kpis.vibrationLevel < 6
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {kpis.vibrationLevel}
            </span>{' '}
            mm/s RMS
          </span>
        </div>
      </div>
    </div>
  );
}
