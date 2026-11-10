'use client';

import React from 'react';
import {
  Receipt,
  Coins,
  AlertCircle,
  TrendingDown,
  ArrowDown,
  ArrowUp,
  Sparkles,
  Wallet,
} from 'lucide-react';
import type { FinancialBreakdown } from '../lib/calculations';

interface FinancialPanelProps {
  financials: FinancialBreakdown;
  isLoading: boolean;
}

function formatJD(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MetricRow({
  icon: Icon,
  label,
  value,
  subtitle,
  colorClass,
  isNegative,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subtitle: string;
  colorClass: string;
  isNegative?: boolean;
  highlight?: boolean;
}) {
  const colorMap: Record<string, { icon: string; bg: string; text: string; border: string }> = {
    slate: {
      icon: 'text-slate-400',
      bg: 'bg-slate-800/40',
      text: 'text-white',
      border: 'border-slate-800/60',
    },
    red: {
      icon: 'text-red-400',
      bg: 'bg-red-500/5',
      text: 'text-red-400',
      border: 'border-red-500/20',
    },
    emerald: {
      icon: 'text-emerald-400',
      bg: 'bg-emerald-500/5',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
    },
    amber: {
      icon: 'text-amber-400',
      bg: 'bg-amber-500/5',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
    },
  };

  const colors = colorMap[colorClass] || colorMap.slate;

  return (
    <div
      className={`flex items-center justify-between p-3.5 rounded-lg ${colors.bg} border ${colors.border} ${
        highlight ? 'ring-1 ring-emerald-500/20' : ''
      } transition-all duration-200 hover:scale-[1.01]`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md ${colors.bg}`}>
          <Icon className={`w-4 h-4 ${colors.icon}`} />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-300">{label}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isNegative !== undefined && (
          <div
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${
              isNegative ? 'bg-red-500/10' : 'bg-emerald-500/10'
            }`}
          >
            {isNegative ? (
              <ArrowUp className="w-2.5 h-2.5 text-red-400" />
            ) : (
              <ArrowDown className="w-2.5 h-2.5 text-emerald-400" />
            )}
          </div>
        )}
        <div className="text-right">
          <span className={`text-base font-bold font-mono tabular-nums ${colors.text}`}>
            {formatJD(value)}
          </span>
          <span className="text-[10px] text-slate-600 ml-1">JD</span>
        </div>
      </div>
    </div>
  );
}

export default function FinancialPanel({
  financials,
  isLoading,
}: FinancialPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5 animate-pulse">
        <div className="h-4 w-48 bg-slate-800 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const totalSavings =
    financials.savedByPeakShift + financials.savingIfPFCorrected;
  const savingsPct =
    financials.billCurrentHabits > 0
      ? (totalSavings / financials.billCurrentHabits) * 100
      : 0;

  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800/60 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            Financial Impact — Monthly
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Baseline: 500,000 kWh/mo · 25% peak · 30% partial · 45% off-peak
          </p>
        </div>
        {totalSavings > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
              Save {savingsPct.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <MetricRow
          icon={Receipt}
          label="Electricity Bill (Current Habits)"
          value={financials.billCurrentHabits}
          subtitle="Based on current time-of-use distribution"
          colorClass="slate"
        />

        <MetricRow
          icon={Coins}
          label="Saved by Peak → Off-Peak Shift"
          value={financials.savedByPeakShift}
          subtitle="Billed at 59 fils instead of 79 fils"
          colorClass="emerald"
          isNegative={false}
        />

        <MetricRow
          icon={AlertCircle}
          label="Power Factor Penalty (Current)"
          value={financials.pfPenaltyAmount}
          subtitle="EMRC stepped penalty on total bill"
          colorClass={financials.pfPenaltyAmount > 0 ? 'red' : 'slate'}
          isNegative={financials.pfPenaltyAmount > 0}
        />

        <MetricRow
          icon={TrendingDown}
          label="Saving if Power Factor Corrected"
          value={financials.savingIfPFCorrected}
          subtitle="Target PF ≥ 0.90 eliminates penalty"
          colorClass={financials.savingIfPFCorrected > 0 ? 'amber' : 'slate'}
          isNegative={false}
        />
      </div>

      {/* Total optimized bill */}
      <div className="mt-4 pt-4 border-t border-slate-800/60">
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20">
          <div>
            <p className="text-xs font-semibold text-emerald-400">
              Optimized Monthly Bill
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              After load shifting + PF correction
            </p>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold font-mono tabular-nums text-emerald-400">
              {formatJD(financials.totalOptimizedBill)}
            </span>
            <span className="text-xs text-slate-500 ml-1">JD/mo</span>
          </div>
        </div>
      </div>

      {/* Annual projection */}
      <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800/20">
        <span className="text-[10px] text-slate-500">Annual savings potential:</span>
        <span className="text-xs font-bold font-mono tabular-nums text-emerald-400">
          {formatJD(totalSavings * 12)} JD/yr
        </span>
      </div>
    </div>
  );
}
