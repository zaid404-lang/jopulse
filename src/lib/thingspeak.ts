// ============================================================================
// ThingSpeak "Energy Monitor" channel: fetch + summarise
// Server-only: reads the key from the environment, never ships it to the browser.
// ============================================================================

export interface Reading {
  at: string; // ISO 8601 UTC
  entry: number;
  voltage: number | null; // V
  current: number | null; // A
  power: number | null; // W
  energy: number | null; // kWh since the device last started
  status: number | null; // 1 = running (assumed)
  pf: number | null; // power / (voltage * current), derived
  temperature: number | null; // °C, motor temperature (field 6; older readings have none)
}

export interface ChannelInfo {
  id: number;
  name: string;
  fields: Record<string, string>;
  lastEntryId: number | null;
}

interface RawFeed {
  created_at: string;
  entry_id: number;
  field1?: string | null;
  field2?: string | null;
  field3?: string | null;
  field4?: string | null;
  field5?: string | null;
  field6?: string | null;
}

const num = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export class ThingSpeakConfigError extends Error {}

export async function fetchReadings(
  results = 240
): Promise<{ channel: ChannelInfo; readings: Reading[]; temperatureSimulated: boolean }> {
  const id = process.env.THINGSPEAK_CHANNEL_ID;
  const key = process.env.THINGSPEAK_READ_KEY;
  if (!id) throw new ThingSpeakConfigError('THINGSPEAK_CHANNEL_ID is not set in .env.local');

  const url = new URL(`https://api.thingspeak.com/channels/${encodeURIComponent(id)}/feeds.json`);
  url.searchParams.set('results', String(Math.min(Math.max(results, 1), 8000)));
  if (key) url.searchParams.set('api_key', key);

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ThingSpeak responded ${res.status}`);
  const body = await res.json();
  if (body === -1 || !body?.channel) throw new Error('ThingSpeak refused the request (check channel ID and read key)');

  const ch = body.channel;
  const channel: ChannelInfo = {
    id: ch.id,
    name: ch.name ?? 'ThingSpeak channel',
    fields: Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`field${n}`, ch[`field${n}`]]).filter(([, v]) => v)
    ),
    lastEntryId: ch.last_entry_id ?? null,
  };

  const readings: Reading[] = (body.feeds as RawFeed[]).map((f) => {
    const voltage = num(f.field1);
    const current = num(f.field2);
    const power = num(f.field3);
    const apparent = voltage && current ? voltage * current : null;
    return {
      at: f.created_at,
      entry: f.entry_id,
      voltage,
      current,
      power,
      energy: num(f.field4),
      status: num(f.field5),
      temperature: num(f.field6),
      pf: apparent && power !== null ? Number((power / apparent).toFixed(3)) : null,
    };
  });

  // No temperature sensor on the channel yet: estimate it so the dashboard and AI have one
  const temperatureSimulated = !readings.some((r) => r.temperature !== null);
  if (temperatureSimulated) simulateTemperature(readings);
  return { channel, readings, temperatureSimulated };
}

// shortcut: motor temperature estimated from current (first-order heating model), used only
// while field 6 has no data; real sensor readings replace it automatically.
const AMBIENT_C = 30;
const RISE_AT_FULL_LOAD_C = 22; // steady-state rise at FULL_LOAD_A
const FULL_LOAD_A = 0.7;
const THERMAL_TAU_MIN = 8;
const GAP_MIN = 5; // a longer pause means the device (and motor) were off

export function simulateTemperature(readings: Reading[]): void {
  let t = AMBIENT_C;
  let prevAt: number | null = null;
  for (const r of readings) {
    const at = Date.parse(r.at);
    const dtMin = prevAt === null ? 0 : (at - prevAt) / 60000;
    prevAt = at;
    if (dtMin > GAP_MIN) {
      t = AMBIENT_C + (t - AMBIENT_C) * Math.exp(-dtMin / THERMAL_TAU_MIN); // cooled while off
    } else {
      const running = (r.current ?? 0) > 0 && (r.status === null || r.status === 1);
      const load = running ? Math.min((r.current ?? 0) / FULL_LOAD_A, 1.5) : 0;
      const target = AMBIENT_C + RISE_AT_FULL_LOAD_C * load * load; // copper losses grow with I²
      t = target + (t - target) * Math.exp(-dtMin / THERMAL_TAU_MIN);
    }
    r.temperature = Number(t.toFixed(1));
  }
}

// ---------------------------------------------------------------------------
// Summary statistics shared by the dashboard and the AI prompt
// ---------------------------------------------------------------------------
export interface FieldStats {
  last: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  slopePerHour: number | null; // least-squares slope against time
}

export interface Summary {
  count: number;
  firstAt: string | null;
  lastAt: string | null;
  medianIntervalSec: number | null;
  restarts: number; // energy counter went backwards
  stoppedReadings: number; // status != 1
  voltage: FieldStats;
  current: FieldStats;
  power: FieldStats;
  pf: FieldStats;
  temperature: FieldStats;
}

function stats(readings: Reading[], key: 'voltage' | 'current' | 'power' | 'pf' | 'temperature'): FieldStats {
  const pts = readings
    .map((r) => ({ t: Date.parse(r.at) / 3_600_000, v: r[key] }))
    .filter((p): p is { t: number; v: number } => p.v !== null);
  if (!pts.length) return { last: null, min: null, max: null, mean: null, slopePerHour: null };
  const vs = pts.map((p) => p.v);
  const mean = vs.reduce((a, b) => a + b, 0) / vs.length;

  // The trend only uses readings taken while the machine was running and drawing
  // current; otherwise stops and start-up ramps look like drift.
  const running = readings
    .filter((r) => (r.status === null || r.status === 1) && (r.current ?? 0) > 0)
    .map((r) => ({ t: Date.parse(r.at) / 3_600_000, v: r[key] }))
    .filter((p): p is { t: number; v: number } => p.v !== null);
  let slope: number | null = null;
  if (running.length >= 5) {
    const rm = running.reduce((a, p) => a + p.v, 0) / running.length;
    const tm = running.reduce((a, p) => a + p.t, 0) / running.length;
    const cov = running.reduce((a, p) => a + (p.t - tm) * (p.v - rm), 0);
    const varT = running.reduce((a, p) => a + (p.t - tm) ** 2, 0);
    slope = varT > 0 ? cov / varT : null;
  }
  const round = (x: number) => Number(x.toFixed(4));
  return {
    last: vs[vs.length - 1],
    min: Math.min(...vs),
    max: Math.max(...vs),
    mean: round(mean),
    slopePerHour: slope === null ? null : round(slope),
  };
}

export function summarise(readings: Reading[]): Summary {
  const times = readings.map((r) => Date.parse(r.at));
  const gaps = times
    .slice(1)
    .map((t, i) => (t - times[i]) / 1000)
    .sort((a, b) => a - b);
  let restarts = 0;
  for (let i = 1; i < readings.length; i++) {
    const a = readings[i - 1].energy;
    const b = readings[i].energy;
    if (a !== null && b !== null && b < a) restarts++;
  }
  return {
    count: readings.length,
    firstAt: readings[0]?.at ?? null,
    lastAt: readings[readings.length - 1]?.at ?? null,
    medianIntervalSec: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null,
    restarts,
    stoppedReadings: readings.filter((r) => r.status !== null && r.status !== 1).length,
    voltage: stats(readings, 'voltage'),
    current: stats(readings, 'current'),
    power: stats(readings, 'power'),
    pf: stats(readings, 'pf'),
    temperature: stats(readings, 'temperature'),
  };
}
