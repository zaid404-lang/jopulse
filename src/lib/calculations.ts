// ============================================================================
// Plant Pulse — tariff, billing and plant-limit rules: the single source for the
// dashboard, the API routes and the AI prompt
// EMRC Medium-Industry Tariff Schedule for Zarqa, Jordan
// ============================================================================

export type Band = 'Off-Peak' | 'Partial-Peak' | 'Peak';
export type Tone = 'ok' | 'warn' | 'crit';

export interface TariffSegment {
  start: number; // hour, inclusive
  end: number; // hour, exclusive
  band: Band;
  rate: number; // fils/kWh
}

export const TARIFF_SEGMENTS: TariffSegment[] = [
  { start: 0, end: 5, band: 'Partial-Peak', rate: 69 },
  { start: 5, end: 14, band: 'Off-Peak', rate: 59 },
  { start: 14, end: 17, band: 'Partial-Peak', rate: 69 },
  { start: 17, end: 23, band: 'Peak', rate: 79 },
  { start: 23, end: 24, band: 'Partial-Peak', rate: 69 },
];

// One row per band, for legends
export const BANDS: { band: Band; hours: string; rate: number }[] = [
  { band: 'Off-Peak', hours: '05–14', rate: 59 },
  { band: 'Partial-Peak', hours: '14–17, 23–05', rate: 69 },
  { band: 'Peak', hours: '17–23', rate: 79 },
];

export const BASELINE_KWH_MONTH = 500_000;

export function getTariffByHour(hour: number): TariffSegment {
  const h = ((hour % 24) + 24) % 24;
  return TARIFF_SEGMENTS.find((s) => h >= s.start && h < s.end) ?? TARIFF_SEGMENTS[0];
}

// Time until the rate next changes, and what it changes to
export function getCountdown(hour: number): { countdownText: string; targetBand: Band; targetTime: string } {
  const norm = ((hour % 24) + 24) % 24;
  let targetHour: number;
  let targetBand: Band;
  if (norm < 5) [targetHour, targetBand] = [5, 'Off-Peak'];
  else if (norm < 14) [targetHour, targetBand] = [14, 'Partial-Peak'];
  else if (norm < 17) [targetHour, targetBand] = [17, 'Peak'];
  else if (norm < 23) [targetHour, targetBand] = [23, 'Partial-Peak'];
  else [targetHour, targetBand] = [29, 'Off-Peak']; // 23–05 is one partial-peak stretch, next change is 05:00
  const mins = Math.max(1, Math.round((targetHour - norm) * 60));
  return {
    countdownText: `${Math.floor(mins / 60)}h ${(mins % 60).toString().padStart(2, '0')}m`,
    targetBand,
    targetTime: `${(targetHour % 24).toString().padStart(2, '0')}:00`,
  };
}

// Price colour of each band (badges, chart): cheap is fine, peak is red
export const BAND_TONE: Record<Band, Tone> = { 'Off-Peak': 'ok', 'Partial-Peak': 'warn', Peak: 'crit' };

// EMRC power-factor surcharge tiers: at or above minPf, pct of the bill is added
const PF_TIERS = [
  { minPf: 0.9, pct: 0 },
  { minPf: 0.85, pct: 1.5 },
  { minPf: 0.8, pct: 3.5 },
  { minPf: 0.75, pct: 6.5 },
  { minPf: 0, pct: 12 },
];

// EMRC power-factor surcharge, in percent of the bill
export function getPowerFactorSurchargePct(pf: number): number {
  return (PF_TIERS.find((t) => pf >= t.minPf) ?? PF_TIERS[PF_TIERS.length - 1]).pct;
}

// "0.85-0.89 = +1.5%, …, below 0.75 = +12%", for the AI prompt
export function describePfSurcharge(): string {
  return PF_TIERS.slice(1)
    .map((t, i) => {
      const above = PF_TIERS[i].minPf;
      return t.minPf === 0
        ? `below ${above.toFixed(2)} = +${t.pct}%`
        : `${t.minPf.toFixed(2)}-${(above - 0.01).toFixed(2)} = +${t.pct}%`;
    })
    .join(', ');
}

// How serious a surcharge is: any surcharge needs attention, the top tiers are critical
export function surchargeTone(pct: number): Tone {
  return pct >= 6.5 ? 'crit' : pct > 0 ? 'warn' : 'ok';
}

// Cost of running a load for one hour, in JD (rate in fils/kWh, 1 JD = 1000 fils)
export function hourlyCostJd(kw: number, rateFils: number, surchargePct: number): number {
  return ((kw * rateFils) / 1000) * (1 + surchargePct / 100);
}

// Motor temperature limits (plant alarm levels, °C)
export const MOTOR_TEMP_WARN_C = 60;
export const MOTOR_TEMP_ALARM_C = 75;
export function motorTempTone(c: number): Tone {
  return c >= MOTOR_TEMP_ALARM_C ? 'crit' : c >= MOTOR_TEMP_WARN_C ? 'warn' : 'ok';
}

// A pause longer than this means the device stopped: it starts a new run, and if it is the
// latest reading the device counts as offline. ThingSpeak's free plan takes one update per 15 s
// and Wokwi can run slow, so allow 3 minutes or 5 sending intervals, whichever is longer.
export function runGapSec(medianIntervalSec: number | null): number {
  return Math.max(180, (medianIntervalSec ?? 20) * 5);
}

// Same surcharge as a fraction (0.015 = 1.5%)
export function getPowerFactorPenalty(pf: number): number {
  return getPowerFactorSurchargePct(pf) / 100;
}

// Simulated plant load in kW (real power; a poor power factor is billed through
// the surcharge above, not by inflating kW)
const PEAK_HOURS = 6; // 17–23
const OFF_PEAK_HOURS = 9; // 05–14
export function loadAt(hour: number, peakShiftPct: number): number {
  const band = getTariffByHour(hour).band;
  // 45% of peak load is shiftable; whatever is shifted runs in off-peak hours instead
  const shiftedKw = 940 * (peakShiftPct / 100) * 0.45;
  if (band === 'Peak') return Math.round(940 - shiftedKw);
  if (band === 'Off-Peak') return Math.round(640 + (shiftedKw * PEAK_HOURS) / OFF_PEAK_HOURS);
  return 790;
}

export interface FinancialBreakdown {
  billCurrentHabits: number;
  savedByPeakShift: number;
  pfPenaltyAmount: number;
  savingIfPFCorrected: number;
  totalOptimizedBill: number;
}

// Monthly bill (JD) for BASELINE_KWH_MONTH and what shifting load and fixing PF save
export function computeFinancials({ powerFactor, peakShiftPct }: { powerFactor: number; peakShiftPct: number }): FinancialBreakdown {
  // Baseline distribution: 25% peak, 30% partial, 45% off-peak
  const peakKWh = BASELINE_KWH_MONTH * 0.25;
  const partialKWh = BASELINE_KWH_MONTH * 0.3;
  const offPeakKWh = BASELINE_KWH_MONTH * 0.45;

  // rates are fils/kWh, 1 JD = 1000 fils
  const billCurrentHabits = (peakKWh * 79 + partialKWh * 69 + offPeakKWh * 59) / 1000;
  const shiftedKWh = peakKWh * (peakShiftPct / 100);
  const savedByPeakShift = (shiftedKWh * (79 - 59)) / 1000;
  const pfPenaltyAmount = billCurrentHabits * getPowerFactorPenalty(powerFactor);
  const savingIfPFCorrected = pfPenaltyAmount;
  const totalOptimizedBill = billCurrentHabits - savedByPeakShift - savingIfPFCorrected;

  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    billCurrentHabits: r2(billCurrentHabits),
    savedByPeakShift: r2(savedByPeakShift),
    pfPenaltyAmount: r2(pfPenaltyAmount),
    savingIfPFCorrected: r2(savingIfPFCorrected),
    totalOptimizedBill: r2(totalOptimizedBill),
  };
}
