// ============================================================================
// Plant Pulse — tariff and billing rules, the single source for the dashboard
// EMRC Medium-Industry Tariff Schedule for Zarqa, Jordan
// ============================================================================

export type Band = 'Off-Peak' | 'Partial-Peak' | 'Peak';

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

// EMRC power-factor surcharge, in percent of the bill
export function getPowerFactorSurchargePct(pf: number): number {
  if (pf >= 0.9) return 0;
  if (pf >= 0.85) return 1.5;
  if (pf >= 0.8) return 3.5;
  if (pf >= 0.75) return 6.5;
  return 12;
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
