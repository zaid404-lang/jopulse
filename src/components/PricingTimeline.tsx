'use client';

import React from 'react';
import { Sun, Sunset, Moon, Zap } from 'lucide-react';
import { TARIFF_SCHEDULE } from '../lib/calculations';

const TIMELINE_SEGMENTS = [
  { start: 5, end: 14, label: 'Off-Peak', rate: 59, color: 'emerald', icon: Sun },
  { start: 14, end: 17, label: 'Partial Peak', rate: 69, color: 'amber', icon: Sunset },
  { start: 17, end: 23, label: 'Peak', rate: 79, color: 'red', icon: Zap },
  { start: 23, end: 29, label: 'Partial Peak', rate: 69, color: 'amber', icon: Moon },
];

interface PricingTimelineProps {
  currentHour: number;
}

export default function PricingTimeline({ currentHour }: PricingTimelineProps) {
  const totalHours = 24;

  // Normalize hour for the 05:00–05:00 view
  const normalizedHour = currentHour >= 5 ? currentHour : currentHour + 24;

  const colorMap: Record<string, { bg: string; border: string; text: string; dot: string; glow: string }> = {
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
      glow: 'shadow-emerald-500/20',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
      glow: 'shadow-amber-500/20',
    },
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      dot: 'bg-red-400',
      glow: 'shadow-red-500/20',
    },
  };

  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            EMRC Tariff Schedule
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Medium-Industry · Time-of-Use Pricing</p>
        </div>
        <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
          fils / kWh
        </div>
      </div>

      {/* Timeline bar */}
      <div className="relative">
        {/* Background track */}
        <div className="flex rounded-lg overflow-hidden h-12 gap-[1px]">
          {TIMELINE_SEGMENTS.map((seg, i) => {
            const duration = seg.end - seg.start;
            const width = (duration / totalHours) * 100;
            const colors = colorMap[seg.color];
            const Icon = seg.icon;
            const isActive =
              normalizedHour >= seg.start && normalizedHour < seg.end;

            return (
              <div
                key={i}
                className={`relative flex flex-col items-center justify-center ${colors.bg} border ${colors.border} transition-all duration-300 ${
                  isActive
                    ? `ring-1 ring-offset-1 ring-offset-slate-950 ${colors.border} shadow-lg ${colors.glow}`
                    : 'opacity-60 hover:opacity-80'
                }`}
                style={{ width: `${width}%` }}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                  <span className={`text-xs font-bold ${colors.text}`}>
                    {seg.rate}
                  </span>
                  <span className="text-[10px] text-slate-500">fils</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {seg.label}
                </span>

                {isActive && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                    <div className={`w-2 h-2 rounded-full ${colors.dot} animate-pulse`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-2 px-1">
          {[5, 14, 17, 23, 5].map((h, i) => (
            <span key={i} className="text-[10px] font-mono text-slate-600 tabular-nums">
              {String(h % 24).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {/* Current time indicator */}
        <div
          className="absolute top-0 w-0.5 h-12 bg-white/60 transition-all duration-500"
          style={{
            left: `${((normalizedHour - 5) / totalHours) * 100}%`,
          }}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-white text-slate-900 text-[9px] font-bold rounded-sm whitespace-nowrap">
            NOW
          </div>
        </div>
      </div>

      {/* Legend pills */}
      <div className="flex items-center gap-3 mt-4">
        {[
          { label: 'Off-Peak', rate: '59 fils', color: 'emerald' },
          { label: 'Partial', rate: '69 fils', color: 'amber' },
          { label: 'Peak', rate: '79 fils', color: 'red' },
        ].map((item) => {
          const colors = colorMap[item.color];
          return (
            <div
              key={item.label}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/40"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              <span className="text-[10px] font-medium text-slate-400">
                {item.label}
              </span>
              <span className={`text-[10px] font-bold ${colors.text}`}>
                {item.rate}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
