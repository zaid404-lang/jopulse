'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion, animate } from 'framer-motion';
import {
  Activity,
  LayoutDashboard,
  LineChart,
  Bell,
  Zap,
  Gauge,
  Stethoscope,
  Waves,
  Timer,
  ShieldCheck,
  Play,
  Pause,
  Sun,
  Moon,
  Plug,
  Wifi,
  WifiOff,
  RefreshCw,
  BatteryCharging,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  CartesianGrid,
} from 'recharts';
import {
  BANDS,
  getTariffByHour,
  getCountdown,
  getPowerFactorSurchargePct,
  loadAt,
  computeFinancials,
  BAND_TONE,
  surchargeTone,
  hourlyCostJd,
  MOTOR_TEMP_WARN_C,
  MOTOR_TEMP_ALARM_C,
  motorTempTone,
  runGapSec,
} from './lib/calculations';

// ---------------------------------------------------------------------------
// Chart colours per theme (SVG attributes can't read CSS variables)
// ---------------------------------------------------------------------------
const PALETTE = {
  // ink for data, safety orange only for "now"; mirrors the tokens in globals.css
  light: { tick: 'rgba(60,60,67,.55)', bar: 'rgba(118,118,128,.22)', barNow: '#007aff', line: '#007aff', crit: '#ff3b30', cursor: 'rgba(118,118,128,.08)', ring: 'rgba(118,118,128,.14)' },
  dark: { tick: 'rgba(235,235,245,.5)', bar: 'rgba(118,118,128,.36)', barNow: '#0a84ff', line: '#0a84ff', crit: '#ff453a', cursor: 'rgba(118,118,128,.16)', ring: 'rgba(118,118,128,.28)' },
};

const STATUS = {
  ok: { color: 'var(--ok)', label: 'Nominal', tone: 'ok' },
  warn: { color: 'var(--warn)', label: 'Attention', tone: 'warn' },
  crit: { color: 'var(--crit)', label: 'Critical', tone: 'crit' },
};

// ---------------------------------------------------------------------------
// Tariff and billing rules live in lib/calculations; only their colours are UI
// ---------------------------------------------------------------------------
const BAND_COLOR = { 'Off-Peak': '#34c759', 'Partial-Peak': '#ff9500', Peak: '#ff3b30' };

// ---------------------------------------------------------------------------
// Vibration frequency-domain generator (0 – 1000 Hz)
// ---------------------------------------------------------------------------
function generateVibrationData(bearingWear, isAnomaly) {
  const points = [];
  const wear = bearingWear / 100;
  for (let f = 0; f <= 1000; f += 10) {
    let amp = 0.18 + Math.sin(f * 0.03) * 0.05;
    if (Math.abs(f - 30) <= 10) amp += 1.85 + wear * 0.3; // 1X
    if (Math.abs(f - 60) <= 10) amp += isAnomaly ? 6.2 : 0.8 + wear * 0.85; // 2X
    if (Math.abs(f - 150) <= 10) amp += (isAnomaly ? 3.9 : 1.7) * wear; // BPFO
    if (f >= 420 && f <= 460 && isAnomaly) amp += 1.8;
    if (f >= 780 && f <= 820 && isAnomaly) amp += 1.4;
    points.push({ freq: f, amp: Number(amp.toFixed(3)) });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

// A solid content card. Glass is kept for the floating chrome (Liquid Glass:
// content sits on solid surfaces, controls float on glass).
function Card({ i = 0, id, className = '', alarm = false, children }) {
  return (
    <div
      id={id}
      className={`card ${alarm ? 'alarm' : ''} ${className}`}
      style={{ '--d': `${i * 40}ms` }}
    >
      {children}
    </div>
  );
}

function CardHead({ title, sub, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-[var(--ink-3)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// Smoothly counts from the previous value to the new one
function Num({ value, decimals = 0 }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.45,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return shown.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// One instrument reading: label on top like a meter's nameplate, then the figure
function Kpi({ i, value, decimals = 0, unit, label, sub, badge }) {
  return (
    <Card i={i} className="kpi">
      <div className="kpi__label">
        {label}
        {badge && <span className={`badge ${badge.tone}`}>{badge.text}</span>}
      </div>
      <div className="kpi__value">
        {typeof value === 'number' ? <Num value={value} decimals={decimals} /> : value}
        {unit && <span className="kpi__unit">{unit}</span>}
      </div>
      <div className="kpi__sub">{sub}</div>
    </Card>
  );
}

function Ring({ value, color, track }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-[140px] w-[140px]">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke={track} strokeWidth="14" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="butt"
          strokeDasharray={circ}
          strokeDashoffset={circ - (value / 100) * circ}
          style={{ transition: 'stroke-dashoffset .6s ease, stroke .4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="num text-[30px] font-bold leading-none text-[var(--ink)]">
            <Num value={value} />%
          </div>
          <div className="mt-1 text-[11px] text-[var(--ink-3)]">health</div>
        </div>
      </div>
    </div>
  );
}

// Each menu item scrolls to a section; the section in view lights up its item
const NAV_GROUPS = [
  {
    title: 'Machine',
    items: [
      { name: 'Overview', icon: LayoutDashboard, target: 'sec-top' },
      { name: 'Readings', icon: Plug, target: 'sec-live' },
    ],
  },
  {
    title: 'Plant',
    items: [
      { name: 'Energy use', icon: LineChart, target: 'sec-energy' },
      { name: 'Vibration', icon: Waves, target: 'sec-vibration' },
    ],
  },
  {
    title: 'Act',
    items: [{ name: 'Diagnostics', icon: Stethoscope, target: 'sec-ai', alerts: true }],
  },
];
const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function readStored(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
const readStoredTheme = () => readStored('plant-pulse-theme', ['light', 'dark'], 'light');

// ---------------------------------------------------------------------------
// Live view helpers
// ---------------------------------------------------------------------------
const AMMAN = 'Asia/Amman';

function ammanHourNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: AMMAN }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h + m / 60;
}

const fmtClock = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: AMMAN });
const fmtStamp = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: AMMAN });

function fmtAgo(sec) {
  if (sec < 60) return `${Math.max(0, Math.round(sec))} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h`;
  return `${Math.round(sec / 86400)} d`;
}

// Chart points with a break (null) wherever the device paused longer than gapMs.
// A reading with no neighbour on either side is flagged `solo`, because an area
// chart can't draw a line through a single point.
function buildSeries(rows, key, gapMs) {
  const out = [];
  rows.forEach((r, i) => {
    const t = Date.parse(r.at);
    if (i && t - Date.parse(rows[i - 1].at) > gapMs) out.push({ t: t - 1, v: null });
    out.push({ t, v: r[key] });
  });
  return out.map((p, i) => ({
    ...p,
    solo: p.v !== null && (out[i - 1]?.v ?? null) === null && (out[i + 1]?.v ?? null) === null,
  }));
}

// Recharts dot renderer that only draws lone readings
const soloDot = (color) =>
  function SoloDot({ cx, cy, payload, index }) {
    if (!payload?.solo || cx == null || cy == null) return <g key={`d${index}`} />;
    return <circle key={`d${index}`} cx={cx} cy={cy} r={4.5} fill={color} stroke="var(--shell)" strokeWidth={2} />;
  };


const AI_HEADINGS = ['Status', 'What looks normal', 'What is drifting', 'Failure outlook', 'What to do'];

// Real readings from the ThingSpeak channel, plus an AI model's analysis of them
// The live ThingSpeak cards and AI diagnostics, with the rest of the dashboard
// passed in as children so the whole page is one dashboard.
function LiveView({ P, onStatus, children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiAt, setAiAt] = useState(null);
  const [aiModel, setAiModel] = useState(null);
  const aiRef = useRef(null);

  // the spinner is switched on by the Refresh button; background polls stay quiet
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/thingspeak?results=240', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const readings = useMemo(() => data?.readings ?? [], [data]);
  const s = data?.summary;
  const last = readings[readings.length - 1];
  const ageSec = last ? (now - Date.parse(last.at)) / 1000 : null;
  const interval = s?.medianIntervalSec ?? 20;
  const offlineAfter = runGapSec(s?.medianIntervalSec ?? null);
  const online = ageSec !== null && ageSec < offlineAfter;
  const waiting = online && ageSec > interval * 2 + 15;
  const tariff = getTariffByHour(ammanHourNow());
  const penalty = last?.pf != null ? getPowerFactorSurchargePct(last.pf) : 0;
  const costPerHour = last?.power != null ? hourlyCostJd(last.power / 1000, tariff.rate, penalty) : null;
  // trend as % of the latest running current (the slope already ignores stopped readings)
  const currentTrend = s?.current.slopePerHour != null && s.current.last ? (s.current.slopePerHour / s.current.last) * 100 : null;

  const lastTemp = readings.findLast((r) => r.temperature !== null) ?? null;
  const tempTrend = s?.temperature?.slopePerHour ?? null; // °C per hour while running
  const tempSim = !!data?.temperatureSimulated; // no sensor yet: estimated from current

  // Rule-based checks that run on every refresh (the AI goes deeper on demand)
  const issues = useMemo(() => {
    if (!last) return [];
    const out = [];
    out.push(
      online
        ? { key: 'link', state: 'ok', name: 'Data link', detail: `Last reading ${fmtAgo(ageSec)} ago` }
        : { key: 'link', state: 'crit', name: 'Data link', detail: `No reading for ${fmtAgo(ageSec)}, last at ${fmtStamp(last.at)}` }
    );
    if (last.status !== null) {
      out.push(
        last.status === 1
          ? { key: 'run', state: 'ok', name: 'Machine', detail: 'Reports running' }
          : { key: 'run', state: 'crit', name: 'Machine', detail: `Reports status ${last.status} (not running)` }
      );
    }
    if (last.voltage !== null) {
      const bad = last.voltage < 207 || last.voltage > 253;
      out.push({ key: 'v', state: bad ? 'crit' : 'ok', name: 'Supply voltage', detail: `${last.voltage} V${bad ? ', outside 207–253 V' : ', within ±10%'}` });
    }
    if (last.pf !== null) {
      out.push({
        key: 'pf',
        state: surchargeTone(penalty),
        name: 'Power factor',
        detail: penalty > 0 ? `${last.pf.toFixed(2)}, +${penalty}% EMRC surcharge` : `${last.pf.toFixed(2)}, no surcharge`,
      });
    }
    if (currentTrend !== null && Math.abs(currentTrend) >= 10) {
      out.push({
        key: 'trend',
        state: 'warn',
        name: 'Current trend',
        detail: `${currentTrend > 0 ? 'Rising' : 'Falling'} about ${Math.abs(currentTrend).toFixed(0)}% per hour`,
      });
    }
    if (lastTemp) {
      const t = lastTemp.temperature;
      const state = motorTempTone(t);
      const rising = tempTrend !== null && tempTrend >= 5;
      out.push({
        key: 'temp',
        state: state === 'ok' && rising ? 'warn' : state,
        name: tempSim ? 'Motor temperature (simulated)' : 'Motor temperature',
        detail: `${t.toFixed(1)} °C${state === 'crit' ? `, over the ${MOTOR_TEMP_ALARM_C} °C alarm` : state === 'warn' ? `, over ${MOTOR_TEMP_WARN_C} °C` : ''}${rising ? `, rising ${tempTrend.toFixed(0)} °C an hour` : ''}`,
      });
    }
    if (s?.restarts) {
      out.push({ key: 'restart', state: 'warn', name: 'Restarts', detail: `Energy counter reset ${s.restarts}× in this window` });
    }
    return out;
  }, [last, online, ageSec, penalty, currentTrend, s, lastTemp, tempTrend, tempSim]);

  const issueCount = issues.filter((i) => i.state !== 'ok').length;
  const overall = issues.some((i) => i.state === 'crit') ? 'crit' : issueCount ? 'warn' : 'ok';

  useEffect(() => {
    onStatus({
      issueCount,
      overall,
      online,
      ago: ageSec !== null ? fmtAgo(ageSec) : null,
      channel: data?.channel ? `${data.channel.name}, channel ${data.channel.id}` : null,
      issues: issues.filter((i) => i.state !== 'ok'),
    });
  }, [issueCount, overall, online, ageSec, data, onStatus, issues]);

  const runAi = async () => {
    setAiBusy(true);
    setAiError(null);
    setAiText('');
    try {
      const res = await fetch('/api/diagnose', { method: 'POST' });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setAiModel(res.headers.get('X-Model'));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setAiText((t) => t + chunk);
        if (aiRef.current) aiRef.current.scrollTop = aiRef.current.scrollHeight;
      }
      // only stamp a successful analysis; errors arrive as an "[error]" line
      if (!full.includes('[error]')) setAiAt(Date.now());
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  };

  // a pause longer than this splits the readings into separate runs
  const gapMs = runGapSec(s?.medianIntervalSec ?? null) * 1000;

  // the latest run: everything since the last long pause (a fresh Wokwi session)
  const lastRun = useMemo(() => {
    let start = 0;
    for (let i = 1; i < readings.length; i++) {
      if (Date.parse(readings[i].at) - Date.parse(readings[i - 1].at) > gapMs) start = i;
    }
    return readings.slice(start);
  }, [readings, gapMs]);

  // the hero card shows power for the latest run
  const chartPower = useMemo(() => buildSeries(lastRun, 'power', gapMs), [lastRun, gapMs]);
  const chartTemp = useMemo(() => buildSeries(lastRun, 'temperature', gapMs), [lastRun, gapMs]);

  // without live readings, show why in place of the live cards; the rest of the dashboard still renders
  if (!data && !error) {
    return (
      <>
        <div id="sec-live" className="mt-5 grid scroll-mt-6 place-items-center py-12 text-[13px] text-[var(--ink-3)]">
          Reading the ThingSpeak channel…
        </div>
        {children}
      </>
    );
  }

  if (!data && error) {
    return (
      <>
        <Card i={1} alarm id="sec-live" className="mt-5 scroll-mt-6 p-6">
          <CardHead title="Can't reach ThingSpeak" sub={error} right={<button onClick={load} className="btn-solid !min-h-[34px] !text-[12px]">Try again</button>} />
        </Card>
        {children}
      </>
    );
  }

  if (!readings.length) {
    return (
      <>
        <Card i={1} id="sec-live" className="mt-5 scroll-mt-6 p-6">
          <CardHead title="No readings yet" sub="Start the Wokwi simulation; readings appear here within a few seconds." />
        </Card>
        {children}
      </>
    );
  }

  return (
    <>
      {/* Device strip */}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px]">
        <span className={`badge ${!online ? 'crit' : waiting ? 'warn' : 'ok'}`}>
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {!online ? 'Offline' : waiting ? 'Waiting for next reading' : 'Online'}
        </span>
        <span className="text-[var(--ink-3)]">
          Last reading <span className="num">{fmtStamp(last.at)}</span> · <span className="num">{fmtAgo(ageSec)}</span> ago ·{' '}
          <span className="num">{s.count}</span> readings, one every <span className="num">{s.medianIntervalSec ?? '–'}</span> s
        </span>
        <button
          onClick={() => {
            setRefreshing(true);
            load();
          }}
          className="btn-ghost ml-auto !min-h-[32px] !px-3 !text-[12px]"
          aria-label="Refresh readings"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-[var(--crit)]">Last refresh failed: {error}. Showing the previous readings.</p>}

      {/* Latest readings: power is the one big number, the rest support it */}
      <div id="sec-live" className="mt-3 grid scroll-mt-6 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card i={1} className="flex flex-col p-5 sm:col-span-2 xl:row-span-2">
          <div className="kpi__label">
            {online ? 'Power now' : 'Last power reading'}
            <span className={`badge ${BAND_TONE[tariff.band]}`}>
              {tariff.band}
            </span>
          </div>
          <div className="hero-num">
            {last.power !== null ? <Num value={last.power} decimals={1} /> : '–'}
            <span className="kpi__unit">W</span>
          </div>
          <div className="mt-2 text-[13px] text-[var(--ink-3)]">
            {!online
              ? `Device offline. Taken ${fmtAgo(ageSec)} ago, at ${fmtStamp(last.at)}.`
              : costPerHour !== null
              ? `${(costPerHour * 1000).toFixed(1)} fils an hour at the ${tariff.band.toLowerCase()} rate (${tariff.rate} fils/kWh)`
              : 'No power reading yet'}
          </div>
          {/* the sparkline takes the card's remaining height, so there's no empty band */}
          <div className="relative mt-4 min-h-[96px] flex-1">
            <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPower} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={P.line} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={P.line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" type="number" domain={['dataMin - 60000', 'dataMax + 60000']} hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={P.line}
                  strokeWidth={1.75}
                  fill="url(#heroFill)"
                  connectNulls={false}
                  dot={soloDot(P.line)}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>
        </Card>
        <Kpi
          i={2}
          icon={Zap}
          value={last.voltage ?? '–'}
          decimals={1}
          unit="V"
          label="Voltage"
          sub="Normal 207–253 V"
          badge={last.voltage !== null && (last.voltage < 207 || last.voltage > 253) ? { text: 'Out of range', tone: 'crit' } : undefined}
        />
        <Kpi
          i={3}
          icon={Activity}
          value={last.current ?? '–'}
          decimals={3}
          unit="A"
          label="Current"
          sub={currentTrend !== null ? `${currentTrend >= 0 ? '+' : ''}${currentTrend.toFixed(0)}% an hour` : 'Trend needs more readings'}
          badge={currentTrend !== null && Math.abs(currentTrend) >= 10 ? { text: currentTrend > 0 ? 'Rising' : 'Falling', tone: 'warn' } : undefined}
        />
        <Kpi
          i={4}
          icon={Gauge}
          value={last.pf ?? '–'}
          decimals={2}
          label="Power factor"
          sub="Surcharge-free from 0.90"
          badge={penalty > 0 ? { text: `+${penalty}%`, tone: surchargeTone(penalty) } : undefined}
        />
        <Kpi
          i={5}
          icon={BatteryCharging}
          value={last.energy !== null ? last.energy * 1000 : '–'}
          decimals={1}
          unit="Wh"
          label="Energy since start"
          sub={s.restarts ? `${s.restarts} restarts in view` : 'No restarts in view'}
        />
        <Card i={6} className="flex flex-col gap-4 p-5 sm:col-span-2 md:flex-row xl:col-span-4">
          <div className="md:w-[240px] md:shrink-0">
            <div className="kpi__label">
              {tempSim ? 'Motor temperature (simulated)' : 'Motor temperature'}
              {lastTemp && (
                <span className={`badge ${STATUS[motorTempTone(lastTemp.temperature)].tone}`}>{STATUS[motorTempTone(lastTemp.temperature)].label}</span>
              )}
            </div>
            <div className="kpi__value">
              {lastTemp ? <Num value={lastTemp.temperature} decimals={1} /> : '–'}
              <span className="kpi__unit">°C</span>
            </div>
            <div className="kpi__sub">
              {lastTemp
                ? `${tempSim ? 'Estimated from current until a sensor reports. ' : ''}Warning at ${MOTOR_TEMP_WARN_C} °C, alarm at ${MOTOR_TEMP_ALARM_C} °C${tempTrend !== null ? `. ${tempTrend >= 0 ? '+' : ''}${tempTrend.toFixed(1)} °C an hour` : ''}`
                : 'No temperature yet. Wire the NTC sensor in Wokwi and enable field 6 in ThingSpeak.'}
            </div>
          </div>
          <div className="relative min-h-[110px] flex-1">
            {lastTemp ? (
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartTemp} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={P.line} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={P.line} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" type="number" domain={['dataMin - 60000', 'dataMax + 60000']} hide />
                    <YAxis hide domain={[(d) => Math.min(d - 5, 20), (d) => Math.max(d + 5, MOTOR_TEMP_ALARM_C + 5)]} />
                    <ReferenceLine y={MOTOR_TEMP_WARN_C} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: `${MOTOR_TEMP_WARN_C} °C`, position: 'insideTopRight', fill: 'var(--warn)', fontSize: 11 }} />
                    <ReferenceLine y={MOTOR_TEMP_ALARM_C} stroke={P.crit} strokeDasharray="4 4" label={{ value: `${MOTOR_TEMP_ALARM_C} °C`, position: 'insideTopRight', fill: P.crit, fontSize: 11 }} />
                    <Area type="monotone" dataKey="v" stroke={P.line} strokeWidth={1.75} fill="url(#tempFill)" connectNulls={false} dot={soloDot(P.line)} activeDot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="well grid h-full min-h-[110px] place-items-center px-4 text-center text-[13px] text-[var(--ink-3)]">
                The trend appears here once readings include temperature.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* The simulated energy and vibration panels sit between the live cards and AI diagnostics */}
      {children}

      {/* AI diagnostics (BluesMinds) */}
      <Card i={8} id="sec-ai" className="mt-4 scroll-mt-6 p-5">
        <CardHead
          title="AI diagnostics"
          sub={
            aiAt
              ? `${aiModel ?? 'The model'} read all ${s.count} readings at ${fmtClock(aiAt)}`
              : `The AI reads all ${s.count} readings and looks for early signs of failure`
          }
          right={
            <button onClick={runAi} disabled={aiBusy} className="btn-solid !min-h-[36px] !px-4 !text-[12px]">
              <Stethoscope className="h-3.5 w-3.5" strokeWidth={1.75} />
              {aiBusy ? 'Analysing…' : aiText ? 'Analyse again' : 'Analyse readings'}
            </button>
          }
        />
        <div ref={aiRef} className="well mt-4 max-h-[420px] min-h-[160px] overflow-y-auto p-4 text-[13.5px] leading-relaxed">
          {aiError ? (
            <p className="text-[var(--crit)]">{aiError}</p>
          ) : aiText ? (
            aiText.split('\n').map((line, k) => {
              const t = line.trim();
              if (!t) return <div key={k} className="h-2" />;
              if (AI_HEADINGS.includes(t)) {
                return (
                  <div key={k} className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--sub)] first:mt-0">
                    {t}
                  </div>
                );
              }
              if (t.startsWith('[error]')) return <p key={k} className="text-[var(--crit)]">{t.slice(7).trim()}</p>;
              return (
                <p key={k} className={`text-[var(--ink)] ${t.startsWith('- ') ? 'pl-3 -indent-3' : ''}`}>
                  {t.startsWith('- ') ? `• ${t.slice(2)}` : t}
                </p>
              );
            })
          ) : (
            <div className="grid h-full min-h-[128px] place-items-center text-center text-[var(--ink-3)]">
              {aiBusy ? 'Reading the history…' : 'No analysis yet.'}
            </div>
          )}
          {aiBusy && aiText && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-[var(--accent)] align-middle" />}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main application
// ---------------------------------------------------------------------------
export default function App() {
  const [activeNav, setActiveNav] = useState('Overview');
  const [chartMetric, setChartMetric] = useState('cost');
  const [theme, setTheme] = useState(readStoredTheme);
  const [liveStatus, setLiveStatus] = useState({ issueCount: 0, overall: 'ok', online: false, ago: null, channel: null, issues: [] });
  const [playing, setPlaying] = useState(false);

  // Notifications popover on the bell: closes on outside click or Escape
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  useEffect(() => {
    if (!bellOpen) return undefined;
    const onDown = (e) => {
      if (!bellRef.current?.contains(e.target)) setBellOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setBellOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [bellOpen]);

  // The simulated panels follow the real Amman clock (same "now" as the live cards)
  // until an hour is picked by clicking a bar or Play; pointing at a bar previews its hour.
  const [clockHour, setClockHour] = useState(ammanHourNow);
  const [pinnedHour, setPinnedHour] = useState(null);
  const [previewHour, setPreviewHour] = useState(null);
  const timeOfDay = previewHour ?? pinnedHour ?? clockHour;
  const powerFactor = 0.85;
  const peakShiftPct = 25;
  const bearingWear = 38;
  const anomalyInjected = false;

  const P = PALETTE[theme];

  // Theme lives on <html> so the CSS tokens switch everywhere at once
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('plant-pulse-theme', theme);
    } catch {
      /* storage blocked: the theme just won't persist */
    }
  }, [theme]);

  // "Play the day": one simulated hour per second
  useEffect(() => {
    if (!playing) return undefined;
    const t = setInterval(() => setPinnedHour((h) => ((h ?? ammanHourNow()) + 0.25) % 24), 250);
    return () => clearInterval(t);
  }, [playing]);

  // Real Amman wall clock (the dashboard itself runs on simulated time)
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Amman' }));
      setClockHour(ammanHourNow());
    };
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);

  // Light up the menu item for whichever section sits in the middle of the screen
  useEffect(() => {
    const els = NAV_ITEMS.map((n) => document.getElementById(n.target)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < 120) {
          setActiveNav('Overview');
          return;
        }
        const hit = entries.find((e) => e.isIntersecting);
        if (!hit) return;
        const item = NAV_ITEMS.find((n) => n.target === hit.target.id);
        if (item) setActiveNav(item.name);
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    els.forEach((el) => io.observe(el));
    const onScroll = () => {
      if (window.scrollY < 120) setActiveNav('Overview');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
    // live sections only exist once the first readings arrive, so re-observe then
  }, [liveStatus.channel]);

  const goTo = (item) => {
    setActiveNav(item.name);
    document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Derived metrics
  const currentTariff = useMemo(() => getTariffByHour(timeOfDay), [timeOfDay]);
  const countdown = useMemo(() => getCountdown(timeOfDay), [timeOfDay]);
  const pfPenaltyPct = useMemo(() => getPowerFactorSurchargePct(powerFactor), [powerFactor]);
  const activeLoadKw = useMemo(() => loadAt(timeOfDay, peakShiftPct), [timeOfDay, peakShiftPct]);

  const pumpHealth = useMemo(() => {
    if (anomalyInjected) return 38;
    return Math.max(10, Math.min(99, Math.round(100 - bearingWear * 0.737)));
  }, [bearingWear, anomalyInjected]);

  const vibrationRms = useMemo(() => {
    if (anomalyInjected) return 6.84;
    return Number((1.4 + (bearingWear / 100) * 5.21).toFixed(2));
  }, [bearingWear, anomalyInjected]);
  // ISO 10816-3 zones for a medium pump on a rigid base (mm/s RMS)
  const isoZone = vibrationRms < 1.4 ? 'A' : vibrationRms < 2.8 ? 'B' : vibrationRms < 4.5 ? 'C' : 'D';

  const spectrumData = useMemo(() => generateVibrationData(bearingWear, anomalyInjected), [bearingWear, anomalyInjected]);

  // Hourly load & cost from the same model as the live numbers
  const hourly = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => {
        const load = loadAt(h, peakShiftPct);
        const t = getTariffByHour(h);
        const cost = Number(hourlyCostJd(load, t.rate, pfPenaltyPct).toFixed(2));
        return { h, label: `${h.toString().padStart(2, '0')}`, load, cost, band: t.band };
      }),
    [peakShiftPct, pfPenaltyPct]
  );
  const dayCost = useMemo(() => hourly.reduce((s, p) => s + p.cost, 0), [hourly]);

  // JD a month the power-factor surcharge costs (500,000 kWh/mo baseline)
  const pfPenaltyJd = useMemo(() => Math.round(computeFinancials({ powerFactor, peakShiftPct }).pfPenaltyAmount), [powerFactor, peakShiftPct]);

  // Operator view: is it healthy, what is the bottleneck, what to do
  const checks = useMemo(() => {
    // zone C is "not fit for long-term running", so it can't be shown as nominal
    const pump = anomalyInjected || pumpHealth < 40 || isoZone === 'D' ? 'crit' : pumpHealth < 70 || isoZone === 'C' ? 'warn' : 'ok';
    const pf = surchargeTone(pfPenaltyPct);
    // severity, not price colour: a peak-rate period is worth acting on but is not a fault
    const tariff = BAND_TONE[currentTariff.band] === 'crit' ? 'warn' : 'ok';
    return [
      {
        key: 'pump',
        name: 'Main pump',
        state: pump,
        detail: pump === 'crit' ? `2X harmonic at 59 Hz, ${vibrationRms} mm/s` : `${vibrationRms} mm/s, ISO zone ${isoZone}, ${vibrationRms < 3.5 ? 'under' : 'over'} the 3.5 alarm limit`,
      },
      {
        key: 'pf',
        name: 'Power factor',
        state: pf,
        detail: pfPenaltyPct > 0 ? `${powerFactor.toFixed(2)}, +${pfPenaltyPct}% surcharge` : `${powerFactor.toFixed(2)}, no surcharge`,
      },
      {
        key: 'tariff',
        name: 'Tariff',
        state: tariff,
        detail: `${currentTariff.band}, ${currentTariff.rate} fils until ${countdown.targetTime}`,
      },
    ];
  }, [anomalyInjected, pumpHealth, isoZone, pfPenaltyPct, powerFactor, currentTariff, vibrationRms, countdown]);

  const issueCount = checks.filter((c) => c.state !== 'ok').length;
  const overall = checks.some((c) => c.state === 'crit') ? 'crit' : issueCount ? 'warn' : 'ok';

  const action = useMemo(() => {
    if (checks[0].state === 'crit') return 'Switch duty to standby pump P-101A and send the alignment crew to the coupling.';
    if (checks[1].state !== 'ok')
      return `Bring the capacitor bank online to reach 0.90. That removes ${pfPenaltyJd.toLocaleString()} JD a month.`;
    if (checks[2].state !== 'ok') return `Peak rate until ${countdown.targetTime}. Hold shiftable load until then.`;
    if (checks[0].state === 'warn') return 'Bearing wear is climbing. Book a thermographic check this week.';
    return `Nothing to do. ${countdown.targetBand} starts at ${countdown.targetTime}.`;
  }, [checks, pfPenaltyJd, countdown]);

  // the ring takes the same colour as the pump's status badge
  const pumpColor = STATUS[checks[0].state].color;
  const nowHour = Math.floor(timeOfDay);
  const overallMeta = STATUS[overall];
  // the bell and the Diagnostics badge count live device issues plus the simulated plant's
  const alertCount = liveStatus.issueCount + issueCount;
  // same items the count is made of: live device issues first, then the simulated plant's
  const notifications = [
    ...liveStatus.issues,
    ...checks.filter((c) => c.state !== 'ok').map((c) => ({ ...c, key: `sim-${c.key}`, name: `${c.name} (simulated)` })),
  ];

  return (
    <div className="relative min-h-screen w-full">
      <div className="scene" aria-hidden />

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-6 sm:px-8">
        <div className="flex min-w-0 flex-col">
          {/* Title block: name, numbered section tabs, clock, theme, alerts */}
          <header className="tb">
            <div className="tb-brand">
              <span className="tb-brand__name">Plant Pulse</span>
              <span className="tb-brand__sub">Zarqa Line A</span>
            </div>

            <nav className="tb-nav" aria-label="Sections">
              {NAV_ITEMS.map((item) => {
                const on = activeNav === item.name;
                return (
                  <button key={item.name} onClick={() => goTo(item)} aria-current={on ? 'true' : undefined} className="tb-tab">
                    {item.name}
                    {item.alerts && alertCount > 0 && <span className="tb-tab__count num">{alertCount}</span>}
                    {on && (
                      <motion.span layoutId="tabActive" className="tb-tab__bar" transition={{ type: 'spring', stiffness: 460, damping: 38 }} />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="tb-tools">
              <span className="tb-clock num" title="Amman time">
                {clock || '--:--'} <span>Amman</span>
              </span>
              <button
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={() => {
                  const next = theme === 'dark' ? 'light' : 'dark';
                  // flushSync so the whole page is in the new theme before the browser snapshots it
                  const apply = () => {
                    document.documentElement.dataset.theme = next;
                    flushSync(() => setTheme(next));
                  };
                  // cross-fade old page into new; browsers without View Transitions just switch
                  if (document.startViewTransition) document.startViewTransition(apply);
                  else apply();
                }}
                className="tb-btn"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
              </button>
              <div ref={bellRef} className="relative">
                <button
                  aria-label={`${alertCount} notifications`}
                  aria-expanded={bellOpen}
                  aria-haspopup="dialog"
                  className="tb-btn"
                  onClick={() => setBellOpen((o) => !o)}
                >
                  <Bell className="h-4 w-4" strokeWidth={1.75} />
                  {alertCount > 0 && <span className="tb-btn__count num">{alertCount}</span>}
                </button>
                {bellOpen && (
                  <div role="dialog" aria-label="Notifications" className="pop">
                    <div className="pop__title">Notifications</div>
                    {notifications.length ? (
                      <ul>
                        {notifications.map((n) => (
                          <li key={n.key} className="pop__row">
                            <span className="dot mt-1.5" style={{ color: STATUS[n.state].color }} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-medium text-[var(--ink)]">{n.name}</div>
                              <div className="text-[11.5px] text-[var(--ink-3)]">{n.detail}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-3 py-4 text-[12.5px] text-[var(--ink-3)]">Nothing needs attention.</div>
                    )}
                    <button
                      className="btn-ghost w-full"
                      onClick={() => {
                        setBellOpen(false);
                        goTo(NAV_ITEMS[NAV_ITEMS.length - 1]);
                      }}
                    >
                      Open AI diagnostics
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="sheet">
            {/* Sheet header: what this is and whether anything is open */}
            <div id="sec-top" className="sheet-head scroll-mt-24">
              <div>
                <h1 className="sheet-title">{liveStatus.channel ?? 'Energy Monitor'}</h1>
                <p className="sheet-sub">
                  <span
                    className="dot live"
                    style={{ color: STATUS[alertCount ? (liveStatus.overall === 'crit' || overall === 'crit' ? 'crit' : 'warn') : 'ok'].color }}
                  />
                  {alertCount ? `${alertCount} open ${alertCount === 1 ? 'item' : 'items'}` : 'No open items'}
                </p>
              </div>
              <div className="flex gap-2">
              {pinnedHour !== null && !playing && (
                <button onClick={() => setPinnedHour(null)} className="btn-ghost">
                  Back to now
                </button>
              )}
              <button onClick={() => setPlaying((p) => !p)} className="btn-ghost" aria-pressed={playing}>
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? 'Pause' : 'Play the day'}
              </button>
              </div>
            </div>

            {/* Live cards first, then the simulated energy and vibration panels, then AI diagnostics */}
            <LiveView P={P} onStatus={setLiveStatus}>

            {/* Energy: hourly chart + pump */}
            <div id="sec-energy" className="mt-5 grid scroll-mt-6 grid-cols-1 gap-4 xl:grid-cols-3">
              <Card i={1} className="p-5 xl:col-span-2">
                <CardHead
                  title="Electricity across the day"
                  sub="Each hour, coloured by its tariff. Tap a bar to jump to it."
                  right={
                    <div className="seg" role="group" aria-label="Chart metric">
                      <button aria-pressed={chartMetric === 'cost'} onClick={() => setChartMetric('cost')}>
                        JD / hour
                      </button>
                      <button aria-pressed={chartMetric === 'load'} onClick={() => setChartMetric('load')}>
                        kW
                      </button>
                    </div>
                  }
                />
                {/* Apple Health style: the headline number sits above the chart */}
                <div className="mt-4">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">Total today</div>
                  <div className="num text-[30px] font-bold leading-tight tracking-tight">
                    <Num value={dayCost} />
                    <span className="ml-1 text-[15px] font-semibold text-[var(--ink-3)]">JD</span>
                  </div>
                </div>
                <div className="mt-2 h-[210px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hourly}
                      barCategoryGap="22%"
                      margin={{ top: 12, right: 0, left: 4, bottom: 0 }}
                      className="cursor-pointer"
                      onMouseMove={(st) => {
                        const p = hourly[Number(st?.activeTooltipIndex)];
                        if (p) setPreviewHour(p.h + 0.5);
                      }}
                      onMouseLeave={() => setPreviewHour(null)}
                      onClick={(st) => {
                        const p = hourly[Number(st?.activeTooltipIndex)];
                        if (p) setPinnedHour(p.h + 0.5); // a click keeps this hour after the pointer leaves
                      }}
                    >
                      <CartesianGrid vertical={false} stroke={P.ring} strokeDasharray="2 4" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={{ stroke: P.ring }}
                        tick={{ fill: P.tick, fontSize: 11 }}
                        interval={5}
                        tickMargin={6}
                      />
                      <YAxis orientation="right" tickLine={false} axisLine={false} tick={{ fill: P.tick, fontSize: 11 }} width={34} tickCount={4} />
                      <ReferenceLine
                        y={hourly.reduce((s, p) => s + p[chartMetric], 0) / hourly.length}
                        stroke={P.tick}
                        strokeDasharray="4 4"
                        label={{ value: 'avg', position: 'insideTopLeft', fill: P.tick, fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }) =>
                          active && payload && payload.length ? (
                            <div className="card px-3 py-2 text-xs" style={{ animation: 'none' }}>
                              <div className="font-semibold">
                                {payload[0].payload.label}:00 · {payload[0].payload.band}
                              </div>
                              <div className="num mt-0.5 text-[var(--ink-2)]">
                                {payload[0].payload.load} kW · {payload[0].payload.cost} JD
                              </div>
                            </div>
                          ) : null
                        }
                      />
                      <Bar
                        dataKey={chartMetric}
                        radius={[5, 5, 5, 5]}
                        maxBarSize={18}
                        isAnimationActive={false}
                      >
                        {/* the current hour is full strength, the rest recede */}
                        {hourly.map((p) => (
                          <Cell key={p.h} fill={BAND_COLOR[p.band] ?? P.bar} fillOpacity={p.h === nowHour ? 1 : theme === 'dark' ? 0.6 : 0.4} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-3)]">
                  {BANDS.map((b) => (
                    <span key={b.band} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: BAND_COLOR[b.band] }} />
                      {b.band} {b.hours} · <span className="num">{b.rate}</span> fils
                    </span>
                  ))}
                </div>
              </Card>

              <Card i={2} alarm={anomalyInjected} className="flex flex-col p-5">
                <CardHead
                  title="Main pump P-101B"
                  sub="Drive end · 1770 RPM"
                  right={<span className={`badge ${STATUS[checks[0].state].tone}`}>{STATUS[checks[0].state].label}</span>}
                />
                <div className="my-4">
                  <Ring value={pumpHealth} color={pumpColor} track={P.ring} />
                </div>
                <dl className="rule mt-auto grid grid-cols-3 divide-x border-t pt-3 [&>div]:border-[var(--rule)]">
                  {[
                    { v: vibrationRms.toFixed(2), l: 'mm/s RMS' },
                    { v: `${bearingWear}%`, l: 'bearing wear' },
                    { v: isoZone, l: 'ISO zone' },
                  ].map((b) => (
                    <div key={b.l} className="px-2 text-center">
                      <dd className="num text-[16px] font-bold text-[var(--ink)]">{b.v}</dd>
                      <dt className="text-[10.5px] text-[var(--ink-3)]">{b.l}</dt>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>

            {/* Right-now numbers */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Kpi
                i={3}
                icon={Zap}
                value={activeLoadKw}
                unit="kW"
                label="Plant load"
                sub="Right now"
                badge={{ text: currentTariff.band, tone: BAND_TONE[currentTariff.band] }}
              />
              <Kpi
                i={5}
                icon={Gauge}
                value={powerFactor}
                decimals={2}
                label="Power factor"
                sub="Surcharge-free from 0.90"
                badge={pfPenaltyPct > 0 ? { text: `+${pfPenaltyPct}%`, tone: surchargeTone(pfPenaltyPct) } : undefined}
              />
              <Kpi i={6} icon={Timer} value={countdown.countdownText} label="Until the rate changes" sub={`${countdown.targetBand} at ${countdown.targetTime}`} />
            </div>

            {/* Vibration + what needs attention */}
            <div id="sec-vibration" className="mt-4 grid scroll-mt-6 grid-cols-1 gap-4 xl:grid-cols-3">
              <Card i={9} alarm={anomalyInjected} className="p-5 xl:col-span-2">
                <CardHead
                  title="Vibration spectrum"
                  sub="Main pump motor, 0 – 1000 Hz"
                  right={
                    <span className={`badge ${anomalyInjected ? 'crit' : 'info'}`}>
                      {anomalyInjected ? '2X peak at 59 Hz' : '1X peak at 29.5 Hz'}
                    </span>
                  }
                />
                <div className={`spec mt-3 h-[230px] ${anomalyInjected ? 'is-alarm' : ''}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spectrumData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="specFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={P.line} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={P.line} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="specFillRed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={P.crit} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={P.crit} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="freq"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: P.tick, fontSize: 10 }}
                        ticks={[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]}
                        interval="preserveStartEnd"
                        minTickGap={18}
                        unit=" Hz"
                      />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: P.tick, fontSize: 10 }} domain={[0, 8]} />
                      <Tooltip
                        cursor={{ stroke: P.tick, strokeDasharray: '3 3' }}
                        content={({ active, payload }) =>
                          active && payload && payload.length ? (
                            <div className="card px-3 py-2 text-xs" style={{ animation: 'none' }}>
                              <div className="num font-semibold">{payload[0].payload.freq} Hz</div>
                              <div className="num text-[var(--ink-2)]">{payload[0].payload.amp} mm/s</div>
                            </div>
                          ) : null
                        }
                      />
                      <ReferenceLine
                        y={3.5}
                        stroke={P.crit}
                        strokeDasharray="5 5"
                        label={{ value: 'Alarm limit, 3.5 mm/s', position: 'insideTopRight', fill: P.crit, fontSize: 10 }}
                      />
                      {anomalyInjected && (
                        <ReferenceDot x={60} y={6.2} r={5} fill={P.crit} stroke="#fff" strokeWidth={2} className="fade-in-late" />
                      )}
                      {/* blue and red copies of the same trace; CSS cross-fades them */}
                      <Area
                        type="monotone"
                        dataKey="amp"
                        className="spec-normal"
                        stroke={P.line}
                        strokeWidth={2}
                        fill="url(#specFill)"
                        isAnimationActive
                        animationDuration={600}
                        animationEasing="ease-in-out"
                      />
                      <Area
                        type="monotone"
                        dataKey="amp"
                        className="spec-fault"
                        stroke={P.crit}
                        strokeWidth={2}
                        fill="url(#specFillRed)"
                        isAnimationActive
                        animationDuration={600}
                        animationEasing="ease-in-out"
                        activeDot={false}
                        tooltipType="none"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card i={10} alarm={overall === 'crit'} className="flex flex-col p-5">
                <CardHead title="Needs attention" right={<span className={`badge ${overallMeta.tone}`}>{overallMeta.label}</span>} />
                <ul className="mt-2 text-[13px]">
                  {checks.map((c, k) => {
                    const m = STATUS[c.state];
                    return (
                      <li key={c.key} className={`flex items-center gap-3 py-2.5 ${k ? 'rule border-t' : ''}`}>
                        <span className="dot" style={{ color: m.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[var(--ink)]">{c.name}</div>
                          <div className="text-[11.5px] text-[var(--ink-3)]">{c.detail}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-auto rounded-[14px] bg-[var(--solid-bg)] px-4 py-3 text-[var(--solid-fg)]">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                    <p className="text-[13px] leading-relaxed">{action}</p>
                  </div>
                </div>
              </Card>
            </div>

            </LiveView>
          </main>

          <p className="sheet-foot">
            Live readings from ThingSpeak; the energy and vibration panels are simulated. Prices follow the EMRC medium-industry schedule.
          </p>
        </div>
      </div>
    </div>
  );
}
