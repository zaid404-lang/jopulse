'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard,
  Activity,
  LineChart,
  Settings,
  Search,
  Bell,
  Clock,
  Zap,
  DollarSign,
  Heart,
  Gauge,
  Sliders,
  Sparkles,
  Terminal,
  RotateCcw,
  Flame,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Cpu,
  Layers,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot
} from 'recharts';

// ---------------------------------------------------------------------------
// CRITICAL INSTRUCTION - THE BASE COMPONENT (EXTRACTED FROM REFERENCE VIDEO)
// ---------------------------------------------------------------------------
const StatCard = ({ title, value, change, icon: Icon, gradient, isPositive = true }) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/60">{title}</p>
          <h2 className="text-3xl font-bold text-white mt-1 font-mono tracking-tight">{value}</h2>
          <p className={`flex items-center gap-1 text-sm mt-2 ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
            <ArrowUpRight size={16} /> {change}
          </p>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} bg-opacity-20 shadow-lg`}>
          <Icon className="text-white" size={24} />
        </div>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// EMRC Tariff Schedule Definitions (Zarqa Medium-Industry)
// ---------------------------------------------------------------------------
const TARIFF_SEGMENTS = [
  { start: 0, end: 5, band: 'Partial-Peak', rate: 69, color: '#f59e0b', label: '00:00 – 05:00' },
  { start: 5, end: 14, band: 'Off-Peak', rate: 59, color: '#10b981', label: '05:00 – 14:00' },
  { start: 14, end: 17, band: 'Partial-Peak', rate: 69, color: '#f59e0b', label: '14:00 – 17:00' },
  { start: 17, end: 23, band: 'Peak', rate: 79, color: '#ef4444', label: '17:00 – 23:00' },
  { start: 23, end: 24, band: 'Partial-Peak', rate: 69, color: '#f59e0b', label: '23:00 – 24:00' }
];

function getTariffByHour(hour) {
  const h = (hour + 24) % 24;
  for (const s of TARIFF_SEGMENTS) {
    if (h >= s.start && h < s.end) return s;
  }
  return TARIFF_SEGMENTS[0];
}

function getCountdown(currentHour) {
  const norm = (currentHour + 24) % 24;
  let targetHour = 5;
  let targetBand = 'Off-Peak (59 fils)';

  if (norm < 5) {
    targetHour = 5;
    targetBand = 'Off-Peak (59 fils)';
  } else if (norm < 14) {
    targetHour = 14;
    targetBand = 'Partial-Peak (69 fils)';
  } else if (norm < 17) {
    targetHour = 17;
    targetBand = 'Peak (79 fils)';
  } else if (norm < 23) {
    targetHour = 23;
    targetBand = 'Partial-Peak (69 fils)';
  } else {
    targetHour = 29;
    targetBand = 'Off-Peak (59 fils)';
  }

  const diff = (targetHour - norm) % 24;
  const mins = Math.max(1, Math.round(diff * 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return {
    countdownText: `${h}h ${m.toString().padStart(2, '0')}m`,
    targetBand,
    targetTime: `${(targetHour % 24).toString().padStart(2, '0')}:00`
  };
}

// ---------------------------------------------------------------------------
// Vibration Frequency Domain Data Generator (0 - 1000 Hz)
// ---------------------------------------------------------------------------
function generateVibrationData(bearingWear, isAnomaly) {
  const points = [];
  const wear = bearingWear / 100;
  
  for (let f = 0; f <= 1000; f += 10) {
    let amp = 0.18 + Math.sin(f * 0.03) * 0.05;
    
    // 1X Fundamental running speed (29.5 Hz)
    if (Math.abs(f - 30) <= 10) {
      amp += 1.85 + wear * 0.3;
    }
    // 2X Misalignment Harmonic (59.0 Hz)
    if (Math.abs(f - 60) <= 10) {
      amp += isAnomaly ? 6.2 : (0.8 + wear * 0.85);
    }
    // BPFO Bearing Defect (148 Hz)
    if (Math.abs(f - 150) <= 10) {
      amp += (isAnomaly ? 3.9 : 1.7) * wear;
    }
    // High-frequency friction harmonics during stress
    if (f >= 420 && f <= 460 && isAnomaly) amp += 1.8;
    if (f >= 780 && f <= 820 && isAnomaly) amp += 1.4;

    points.push({
      freq: f,
      amp: Number(amp.toFixed(3)),
      isoLimit: 3.5
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Main Application Component
// ---------------------------------------------------------------------------
export default function App() {
  const [activeNav, setActiveNav] = useState('Overview');

  // Simulation controls state (Default matching video reference values)
  const [timeOfDay, setTimeOfDay] = useState(14.5); // 14:30
  const [powerFactor, setPowerFactor] = useState(0.85); // 0.85
  const [peakShiftPct, setPeakShiftPct] = useState(25); // 25%
  const [bearingWear, setBearingWear] = useState(38);
  const [anomalyInjected, setAnomalyInjected] = useState(false);

  // Terminal state
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaOutput, setOllamaOutput] = useState('');
  const terminalEndRef = useRef(null);

  // Derived real-time metrics
  const currentTariff = useMemo(() => getTariffByHour(timeOfDay), [timeOfDay]);
  const countdown = useMemo(() => getCountdown(timeOfDay), [timeOfDay]);

  // EMRC Stepped PF Penalty
  const pfPenaltyPct = useMemo(() => {
    if (powerFactor >= 0.90) return 0.0;
    if (powerFactor >= 0.85) return 1.5;
    if (powerFactor >= 0.80) return 3.5;
    if (powerFactor >= 0.75) return 6.5;
    return 12.0;
  }, [powerFactor]);

  // Active Load (kW) ~804 kW at 14:30
  const activeLoadKw = useMemo(() => {
    let base = currentTariff.band === 'Peak' ? 940 : currentTariff.band === 'Partial-Peak' ? 790 : 640;
    if (currentTariff.band === 'Peak') {
      base *= (1 - (peakShiftPct / 100) * 0.45);
    } else if (currentTariff.band === 'Off-Peak') {
      base += 250 * (peakShiftPct / 100) * 0.3;
    }
    const apparentMultiplier = 1 + (0.90 - Math.min(0.90, powerFactor)) * 0.35;
    return Math.round(base * apparentMultiplier);
  }, [currentTariff, peakShiftPct, powerFactor]);

  // Hourly Cost (JD) ~56.31 JD at 14:30
  const hourlyCostJd = useMemo(() => {
    const rawCost = (activeLoadKw * currentTariff.rate) / 1000;
    const withPenalty = rawCost * (1 + pfPenaltyPct / 100);
    return Number(withPenalty.toFixed(2));
  }, [activeLoadKw, currentTariff, pfPenaltyPct]);

  // Main Pump Health & Vibration RMS (~72% Health, 3.38 mm/s)
  const pumpHealth = useMemo(() => {
    if (anomalyInjected) return 38;
    return Math.max(10, Math.min(99, Math.round(100 - bearingWear * 0.737)));
  }, [bearingWear, anomalyInjected]);

  const vibrationRms = useMemo(() => {
    if (anomalyInjected) return 6.84;
    return Number((1.4 + (bearingWear / 100) * 5.21).toFixed(2));
  }, [bearingWear, anomalyInjected]);

  // Vibration Spectrum
  const spectrumData = useMemo(() => {
    return generateVibrationData(bearingWear, anomalyInjected);
  }, [bearingWear, anomalyInjected]);

  // Monthly Financial Breakdown (500,000 kWh/mo)
  const financials = useMemo(() => {
    const baselineBill = 33500;
    const peakKwh = 125000;
    const shiftedKwh = peakKwh * (peakShiftPct / 100);
    const peakShiftSavings = Math.round((shiftedKwh * 20) / 1000); // 20 fils = 0.020 JD
    const pfPenalty = Math.round(baselineBill * (pfPenaltyPct / 100));
    const optimizedBill = baselineBill - peakShiftSavings;
    const totalMonthlySavings = peakShiftSavings + pfPenalty;
    const savePercent = Number(((totalMonthlySavings / baselineBill) * 100).toFixed(1));
    const annualRoi = totalMonthlySavings * 12;

    return {
      baselineBill,
      peakShiftSavings,
      pfPenalty,
      optimizedBill,
      savePercent,
      annualRoi
    };
  }, [peakShiftPct, pfPenaltyPct]);

  // Toggle Anomaly Stress Test
  const handleToggleAnomaly = (checked) => {
    setAnomalyInjected(checked);
    if (checked) {
      setPowerFactor(0.73);
      setBearingWear(85);
    } else {
      setPowerFactor(0.85);
      setBearingWear(38);
    }
  };

  // Reset demo
  const handleReset = () => {
    setTimeOfDay(14.5);
    setPowerFactor(0.85);
    setPeakShiftPct(25);
    setBearingWear(38);
    setAnomalyInjected(false);
  };

  // Run AI Failure Prognosis
  const handleRunPrognosis = () => {
    setOllamaLoading(true);
    setOllamaOutput('');

    const diagnosis = anomalyInjected
      ? `[OLLAMA LLM DIAGNOSTIC ENGINE v2.4 - INFERENCE LOG]
================================================================================
ASSET: Main Feed Pump Motor P-101B (Zarqa Line A)
TIMESTAMP: 2026-11-04 14:30:00 AST | EMRC MEDIUM-INDUSTRY REGULATORY TIER

1. VIBRATION FREQUENCY DOMAIN PROGNOSIS (ISO 10816 CLASS D):
   • Severe 2X RPM harmonic peak (59.0 Hz) detected at ${vibrationRms} mm/s RMS.
   • Root Cause: Angular coupling misalignment and motor-to-pump mechanical looseness.
   • Sub-harmonic micro-spalling indicated along SKF 7318 inner raceway (BPFI 236 Hz).
   • Estimated Time-to-Failure (TTF): 36 to 48 continuous operating hours.

2. EMRC TARIFF ARBITRAGE & POWER FACTOR REMEDIATION:
   • Operating at sub-0.75 cos φ incurs an active +6.5% EMRC surcharge (+${financials.pfPenalty} JD/month).
   • Action: Switch Capacitor Bank Stage 3 to restore PF >= 0.90, removing surcharge.
   • Shifting ${peakShiftPct}% load to Off-Peak (05:00-14:00 @ 59 fils) captures ${financials.peakShiftSavings} JD/month.

3. PRESCRIPTIVE WORK ORDER:
   • Immediate: Curtail load or switch duty to standby unit Pump P-101A.
   • Dispatch: Laser alignment team for coupling recalibration (< 0.05 mm tolerance).
   • Lubrication: Grease replenishment with ISO VG 220 synthetic.`
      : `[OLLAMA LLM DIAGNOSTIC ENGINE v2.4 - INFERENCE LOG]
================================================================================
ASSET: Main Feed Pump Motor P-101B (Zarqa Line A)
TIMESTAMP: 2026-11-04 14:30:00 AST | EMRC MEDIUM-INDUSTRY REGULATORY TIER

1. RELIABILITY ASSESSMENT (ISO 10816 CLASS B):
   • Current vibration: ${vibrationRms} mm/s RMS (Healthy operational envelope < 3.5 mm/s).
   • Fundamental 1X running frequency (29.5 Hz) within standard tolerances.
   • Estimated Remaining Useful Life (RUL): > 4,200 operating hours.

2. EMRC TARIFF ARBITRAGE STRATEGY:
   • Active rate band: ${currentTariff.band} (${currentTariff.rate} fils/kWh).
   • Current PF is ${powerFactor.toFixed(2)}. Correcting to >= 0.90 eliminates ${financials.pfPenalty} JD/mo penalty.
   • Shifting ${peakShiftPct}% of peak pumping load saves ${financials.peakShiftSavings} JD/month in TOU arbitrage.
   • Annual Plant Pulse ROI potential: ${financials.annualRoi.toLocaleString()} JD / year.

3. RECOMMENDATIONS:
   • Maintain automated TOU load-scheduling profile on Line A feed cycle.
   • Next scheduled thermographic bearing audit: 180 operating hours.`;

    let i = 0;
    const interval = setInterval(() => {
      i += 8;
      setOllamaOutput(diagnosis.slice(0, i));
      if (terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      if (i >= diagnosis.length) {
        clearInterval(interval);
        setOllamaOutput(diagnosis);
        setOllamaLoading(false);
      }
    }, 15);
  };

  return (
    <div className="relative min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0f172a] via-[#0a192f] to-[#070d18] text-white p-6 overflow-hidden">
      
      {/* ------------------------------------------------------------------- */}
      {/* Ambient Blurred Background Glows (Apple VisionOS Aesthetic)         */}
      {/* ------------------------------------------------------------------- */}
      <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[38rem] h-[38rem] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-[42rem] h-[42rem] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none" />

      {/* ------------------------------------------------------------------- */}
      {/* Master Layout: Left Floating Sidebar + Right Content Area           */}
      {/* ------------------------------------------------------------------- */}
      <div className="relative z-10 flex gap-6 max-w-[1720px] mx-auto min-h-[calc(100vh-3rem)]">

        {/* Floating Glassmorphic Sidebar */}
        <aside className="w-64 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col justify-between shrink-0 hidden lg:flex">
          <div>
            {/* Brand Emblem */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-400 to-cyan-500 p-[1px] shadow-lg shadow-teal-500/20">
                <div className="w-full h-full bg-[#0a192f] rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-teal-300" />
                </div>
              </div>
              <div>
                <h1 className="font-bold text-lg text-white tracking-tight">Plant Pulse</h1>
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">QRCE Pitch Edition</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1.5">
              {[
                { name: 'Overview', icon: LayoutDashboard },
                { name: 'Diagnostics', icon: Activity },
                { name: 'Analytics', icon: LineChart },
                { name: 'Settings', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => setActiveNav(item.name)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/10 text-white shadow-lg shadow-white/5 border border-white/15'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-teal-300' : 'text-white/60'}`} />
                    <span>{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Plant Location Pill */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="text-xs font-semibold text-white">Zarqa Industrial Line A</span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed font-mono">
              EMRC Medium-Industry Tier
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-6 min-w-0">

          {/* Top Header Row (Greeting, Search Bar, Profile) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Good afternoon, Plant Manager
              </h2>
              <p className="text-sm text-white/60 mt-0.5">
                Here's the real-time energy & predictive maintenance telemetry for Zarqa Line A.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Glass Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search assets, sensors..."
                  className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-all w-60 shadow-lg"
                />
              </div>

              {/* Notification Pill */}
              <button className="w-9 h-9 rounded-full bg-white/[0.03] backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all shadow-lg">
                <Bell className="w-4 h-4" />
              </button>

              {/* Profile Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-400 to-cyan-500 p-[1px] shadow-lg">
                <div className="w-full h-full rounded-full bg-[#0f172a] flex items-center justify-center text-xs font-bold text-teal-300">
                  PM
                </div>
              </div>
            </div>
          </div>

          {/* EMRC TOU Bar: Soft, Glass Pill-Shaped Timeline */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full animate-pulse shadow-md"
                style={{ backgroundColor: currentTariff.color }}
              />
              <span className="text-sm font-semibold text-white">
                Active Tariff: <span style={{ color: currentTariff.color }}>{currentTariff.band}</span>
              </span>
              <span className="text-xs text-white/50 font-mono">
                ({currentTariff.rate} fils/kWh)
              </span>
            </div>

            {/* Visual Timeline Capsule */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-white/40">Schedule:</span>
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[11px]">
                  Off-Peak (59 fils)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[11px]">
                  Partial (69 fils)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25 text-[11px]">
                  Peak (79 fils)
                </span>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center gap-2 text-xs font-mono text-white/70">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              <span>Next: {countdown.targetBand} in <strong className="text-white">{countdown.countdownText}</strong></span>
            </div>
          </div>

          {/* --------------------------------------------------------------- */}
          {/* 4 Stat Cards Grid (Using EXACT Reference Component)             */}
          {/* --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Card 1: Plant Active Load */}
            <StatCard
              title="Plant Active Load"
              value={`${activeLoadKw} kW`}
              change="+2.4% vs baseline"
              icon={Zap}
              gradient="from-emerald-400 to-teal-600"
              isPositive={true}
            />

            {/* Card 2: Hourly Energy Cost */}
            <StatCard
              title="Hourly Energy Cost"
              value={`${hourlyCostJd.toFixed(2)} JD`}
              change={`${currentTariff.band} (${currentTariff.rate} fils)`}
              icon={DollarSign}
              gradient="from-amber-400 to-orange-600"
              isPositive={false}
            />

            {/* Card 3: Main Pump Health */}
            <StatCard
              title="Main Pump Health"
              value={`${pumpHealth}%`}
              change={`Vibration: ${vibrationRms} mm/s RMS`}
              icon={Activity}
              gradient="from-cyan-400 to-blue-600"
              isPositive={pumpHealth > 65}
            />

            {/* Card 4: Power Factor (cos φ) */}
            <StatCard
              title="Power Factor (cos φ)"
              value={`${powerFactor.toFixed(2)}`}
              change={powerFactor < 0.88 ? `Penalty Surcharge: +${pfPenaltyPct}%` : 'Target ≥ 0.90 Met'}
              icon={Gauge}
              gradient="from-purple-400 to-indigo-600"
              isPositive={powerFactor >= 0.88}
            />

          </div>

          {/* --------------------------------------------------------------- */}
          {/* Middle Section: Vibration Spectrum Chart (Recharts)             */}
          {/* --------------------------------------------------------------- */}
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-300" />
                  Vibration Spectrum & XAI Oscilloscope (P-101B)
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Frequency Domain Analysis (0 – 1000 Hz) • Drive-End Accelerometer • 1770 RPM
                </p>
              </div>

              {/* XAI Diagnosis Pill */}
              <div className={`px-3.5 py-1.5 rounded-full border text-xs font-mono flex items-center gap-2 shadow-lg ${
                anomalyInjected
                  ? 'bg-red-500/15 border-red-500/35 text-red-300'
                  : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-200'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {anomalyInjected
                    ? 'XAI Alert: 2X Harmonic Coupling Misalignment Detected (59.0 Hz)'
                    : 'XAI Status: Dominant 1X Fundamental (29.5 Hz) within ISO 10816 Zone A'}
                </span>
              </div>
            </div>

            {/* Glowing Cyan Recharts AreaChart with No Rigid SCADA Grid */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spectrumData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="glowingCyanGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="freq"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    interval={10}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    domain={[0, 8]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-white/20 rounded-xl p-3 text-xs shadow-2xl">
                            <div className="font-mono text-cyan-300 font-bold">{d.freq} Hz</div>
                            <div className="text-white mt-1">
                              Amplitude: <span className="font-bold font-mono">{d.amp} mm/s</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Subtle Red Dashed ISO Limit Line */}
                  <ReferenceLine
                    y={3.5}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    label={{
                      value: 'ISO Class C/D (3.5 mm/s)',
                      position: 'insideTopRight',
                      fill: '#ef4444',
                      fontSize: 10,
                      fontFamily: 'monospace'
                    }}
                  />
                  {/* Glowing 2X peak dot during anomaly */}
                  {anomalyInjected && (
                    <ReferenceDot
                      x={60}
                      y={6.2}
                      r={6}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="amp"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#glowingCyanGlow)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-white/40 mt-3 pt-3 border-t border-white/10">
              <span>0 Hz (DC)</span>
              <span>1X Running Speed (29.5 Hz)</span>
              <span className={anomalyInjected ? 'text-red-300 font-bold' : ''}>2X Misalignment (59 Hz)</span>
              <span>BPFO (148 Hz)</span>
              <span>1000 Hz</span>
            </div>
          </motion.div>

          {/* --------------------------------------------------------------- */}
          {/* Bottom Section: Split into 2 Glass Cards (50% / 50%)            */}
          {/* --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Bottom Card 1: VC Pitch Simulator */}
            <motion.div
              whileHover={{ y: -3 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-teal-300" />
                      VC Pitch Simulator
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      Interactive mathematical scenario engine
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-mono text-white/80 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>

                {/* Anomaly Stress Test Toggle */}
                <div className={`mb-5 p-4 rounded-xl border transition-all ${
                  anomalyInjected
                    ? 'bg-red-500/15 border-red-500/35 shadow-lg'
                    : 'bg-white/[0.02] border-white/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${anomalyInjected ? 'bg-red-500/25 text-red-200' : 'bg-white/10 text-white/60'}`}>
                        <Flame className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Inject Anomaly / Stress Test</div>
                        <div className="text-xs text-white/50">Simulates PF degradation to 0.73 & high 2X harmonic vibration</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={anomalyInjected}
                        onChange={(e) => handleToggleAnomaly(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                  </div>
                </div>

                {/* Slender Glass Sliders */}
                <div className="space-y-4">
                  {/* Slider 1: Time of Day */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-white/70 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-teal-300" />
                        Time of Day (TOU Schedule)
                      </span>
                      <span className="font-mono font-bold text-teal-300 text-sm">
                        {Math.floor(timeOfDay).toString().padStart(2, '0')}:{Math.floor((timeOfDay % 1) * 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="23.9"
                      step="0.25"
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 font-mono mt-0.5">
                      <span>00:00 (Partial)</span>
                      <span>12:00 (Off-Peak)</span>
                      <span>19:00 (Peak)</span>
                      <span>23:59</span>
                    </div>
                  </div>

                  {/* Slider 2: Power Factor Correction */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-white/70 flex items-center gap-1.5 font-medium">
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        Power Factor Correction (cos φ)
                      </span>
                      <span className={`font-mono font-bold text-sm ${powerFactor < 0.88 ? 'text-red-300' : 'text-teal-300'}`}>
                        {powerFactor.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.60"
                      max="1.00"
                      step="0.01"
                      value={powerFactor}
                      onChange={(e) => setPowerFactor(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 font-mono mt-0.5">
                      <span className="text-red-300">0.60 (Penalty)</span>
                      <span>0.88 (EMRC Threshold)</span>
                      <span className="text-teal-300">1.00 (Unity)</span>
                    </div>
                  </div>

                  {/* Slider 3: Peak Load Shifted */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-white/70 flex items-center gap-1.5 font-medium">
                        <TrendingDown className="w-3.5 h-3.5 text-cyan-300" />
                        Peak Load Shifted to Off-Peak
                      </span>
                      <span className="font-mono font-bold text-cyan-300 text-sm">
                        {peakShiftPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={peakShiftPct}
                      onChange={(e) => setPeakShiftPct(parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-white/40 font-mono mt-0.5">
                      <span>0% (Standard)</span>
                      <span>50%</span>
                      <span className="text-teal-300">100% Shifted</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant Shift Savings Highlight Pill */}
              <div className="mt-5 p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/70 font-medium">Instant Shift Savings:</span>
                <span className="font-mono text-base font-bold text-emerald-300 tabular-nums">
                  +{financials.peakShiftSavings.toLocaleString()} JD / month
                </span>
              </div>
            </motion.div>

            {/* Bottom Card 2: AI Diagnostics Console & Financial Impact */}
            <motion.div
              whileHover={{ y: -3 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-teal-300" />
                      AI Diagnostics & Financial Impact
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      Local Ollama LLM Prognosis & EMRC 500k kWh Cost Model
                    </p>
                  </div>

                  <button
                    onClick={handleRunPrognosis}
                    disabled={ollamaLoading}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-900 font-bold text-xs shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${ollamaLoading ? 'animate-spin' : ''}`} />
                    <span>{ollamaLoading ? 'Synthesizing...' : 'Run AI Failure Prognosis'}</span>
                  </button>
                </div>

                {/* Soft Frosted Glass Terminal Screen (NO harsh black box) */}
                <div className="h-44 w-full rounded-xl bg-white/[0.02] backdrop-blur-md border border-white/10 p-4 font-mono text-xs overflow-y-auto leading-relaxed shadow-inner">
                  {ollamaOutput ? (
                    <div className="text-emerald-300 whitespace-pre-wrap">
                      {ollamaOutput}
                      <div ref={terminalEndRef} />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center text-white/40 font-mono text-xs">
                      <Terminal className="w-6 h-6 mb-2 opacity-40 text-teal-300" />
                      <p>Click "Run AI Failure Prognosis" to stream LLM diagnostics.</p>
                      <p className="text-[10px] text-white/30 mt-1">
                        Endpoint: http://localhost:11434/api/generate (llama3)
                      </p>
                    </div>
                  )}
                </div>

                {/* Financial Impact Rows */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="text-[11px] text-white/50">Baseline Monthly Bill</div>
                    <div className="font-mono text-base font-bold text-white tabular-nums mt-0.5">
                      {financials.baselineBill.toLocaleString()} JD
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-[11px] text-emerald-300">Optimized Monthly Bill</div>
                    <div className="font-mono text-base font-bold text-emerald-300 tabular-nums mt-0.5">
                      {financials.optimizedBill.toLocaleString()} JD
                    </div>
                  </div>
                </div>
              </div>

              {/* Annual ROI Potential Pill */}
              <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs font-mono">
                <span className="text-white/60">Annual Plant Pulse ROI Potential:</span>
                <span className="font-bold text-emerald-300">
                  {financials.annualRoi.toLocaleString()} JD / year ({financials.savePercent}% saved)
                </span>
              </div>
            </motion.div>

          </div>

        </main>
      </div>
    </div>
  );
}
