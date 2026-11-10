// ============================================================================
// Plant Pulse — Energy & Machine Health Calculation Engine
// EMRC Medium-Industry Tariff Schedule for Zarqa, Jordan
// ============================================================================

export interface TariffPeriod {
  label: string;
  range: string;
  rate: number; // fils/kWh
  color: string;
  hours: number;
}

export const TARIFF_SCHEDULE: TariffPeriod[] = [
  { label: 'Off-Peak', range: '05:00 – 14:00', rate: 59, color: '#22c55e', hours: 9 },
  { label: 'Partial Peak', range: '14:00 – 17:00', rate: 69, color: '#f59e0b', hours: 3 },
  { label: 'Peak', range: '17:00 – 23:00', rate: 79, color: '#ef4444', hours: 6 },
  { label: 'Partial Peak', range: '23:00 – 05:00', rate: 69, color: '#f59e0b', hours: 6 },
];

export const BASELINE_KWH_MONTH = 500_000;

export function getCurrentTariff(hour: number): TariffPeriod {
  if (hour >= 5 && hour < 14) return TARIFF_SCHEDULE[0];
  if (hour >= 14 && hour < 17) return TARIFF_SCHEDULE[1];
  if (hour >= 17 && hour < 23) return TARIFF_SCHEDULE[2];
  return TARIFF_SCHEDULE[3]; // 23:00–05:00 partial
}

export function getTariffRate(hour: number): number {
  return getCurrentTariff(hour).rate;
}

// Power factor penalty per EMRC steps (same steps as pfPenaltyFor in App.jsx)
export function getPowerFactorPenalty(pf: number): number {
  if (pf >= 0.90) return 0;
  if (pf >= 0.85) return 0.015; // 1.5%
  if (pf >= 0.80) return 0.035; // 3.5%
  if (pf >= 0.75) return 0.065; // 6.5%
  return 0.12;                   // 12%
}

export interface ScenarioInputs {
  timeOfDay: number;       // 0–23
  powerFactor: number;     // 0.60–1.00
  peakShiftPct: number;    // 0–100% of peak load moved to off-peak
  bearingWear: number;     // 0–100%
}

export interface KPIResults {
  plantLoad: number;           // kW
  energyCostThisHour: number;  // JD
  pumpHealth: number;          // 0–100%
  currentTariff: TariffPeriod;
  vibrationLevel: number;
}

export function computeKPIs(inputs: ScenarioInputs): KPIResults {
  const { timeOfDay, powerFactor, peakShiftPct, bearingWear } = inputs;

  const tariff = getCurrentTariff(timeOfDay);

  // Base load varies by time of day (simulating plant activity)
  const baseLoadProfile: Record<string, number> = {
    'Off-Peak': 620,
    'Partial Peak': 780,
    'Peak': 920,
  };
  let baseLoad = baseLoadProfile[tariff.label] || 780;

  // Peak shift reduces peak load proportionally
  if (tariff.label === 'Peak') {
    baseLoad *= (1 - peakShiftPct / 100);
  } else if (tariff.label === 'Off-Peak') {
    // Shifted load adds to off-peak
    baseLoad += (920 * peakShiftPct / 100) * 0.3;
  }

  // Power factor affects apparent load
  const apparentLoad = baseLoad / Math.max(powerFactor, 0.60);
  const plantLoad = Math.round(apparentLoad);

  // Energy cost for this hour in JD (rate is fils, 1 JD = 1000 fils)
  const pfPenalty = getPowerFactorPenalty(powerFactor);
  const rawCost = (plantLoad * tariff.rate) / 1000;
  const energyCostThisHour = rawCost * (1 + pfPenalty);

  // Pump health inversely proportional to bearing wear
  const pumpHealth = Math.max(5, 100 - bearingWear * 0.92 - (bearingWear > 70 ? (bearingWear - 70) * 0.5 : 0));

  // Vibration level increases with bearing wear
  const vibrationLevel = 0.5 + (bearingWear / 100) * 8.5;

  return {
    plantLoad,
    energyCostThisHour: Math.round(energyCostThisHour * 100) / 100,
    pumpHealth: Math.round(pumpHealth),
    currentTariff: tariff,
    vibrationLevel: Math.round(vibrationLevel * 10) / 10,
  };
}

export interface FinancialBreakdown {
  billCurrentHabits: number;
  savedByPeakShift: number;
  pfPenaltyAmount: number;
  savingIfPFCorrected: number;
  totalOptimizedBill: number;
}

export function computeFinancials(inputs: ScenarioInputs): FinancialBreakdown {
  const { powerFactor, peakShiftPct } = inputs;

  // Baseline distribution: 25% peak, 30% partial, 45% off-peak
  const peakKWh = BASELINE_KWH_MONTH * 0.25;
  const partialKWh = BASELINE_KWH_MONTH * 0.30;
  const offPeakKWh = BASELINE_KWH_MONTH * 0.45;

  // Current bill (in JD, rate in fils → /1000)
  const billCurrentHabits =
    (peakKWh * 79 + partialKWh * 69 + offPeakKWh * 59) / 1000;

  // Peak shift savings: move peakShiftPct of peak kWh to off-peak rate
  const shiftedKWh = peakKWh * (peakShiftPct / 100);
  const savedByPeakShift = (shiftedKWh * (79 - 59)) / 1000;

  // Power factor penalty on total bill
  const pfPenaltyRate = getPowerFactorPenalty(powerFactor);
  const pfPenaltyAmount = billCurrentHabits * pfPenaltyRate;

  // Saving if PF corrected to 0.95+
  const savingIfPFCorrected = pfPenaltyAmount;

  const totalOptimizedBill = billCurrentHabits - savedByPeakShift - savingIfPFCorrected;

  return {
    billCurrentHabits: Math.round(billCurrentHabits * 100) / 100,
    savedByPeakShift: Math.round(savedByPeakShift * 100) / 100,
    pfPenaltyAmount: Math.round(pfPenaltyAmount * 100) / 100,
    savingIfPFCorrected: Math.round(savingIfPFCorrected * 100) / 100,
    totalOptimizedBill: Math.round(totalOptimizedBill * 100) / 100,
  };
}

// Simple seeded pseudo-random number generator (deterministic per seed)
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Generate realistic vibration spectrum data (deterministic)
export function generateVibrationSpectrum(bearingWear: number): { freq: number; amplitude: number; baseline: number }[] {
  const data: { freq: number; amplitude: number; baseline: number }[] = [];
  const wearFactor = bearingWear / 100;
  const rand = seededRandom(Math.floor(bearingWear * 1000 + 42));

  for (let freq = 0; freq <= 1000; freq += 5) {
    // Baseline vibration (healthy machine)
    const baseline = 0.3 + Math.sin(freq * 0.02) * 0.1 + rand() * 0.08;

    // Bearing defect frequencies (BPFO ~148Hz, BPFI ~236Hz, BSF ~97Hz, FTF ~12Hz)
    let amplitude = baseline;

    // Fundamental bearing frequencies amplified by wear
    const defectFreqs = [12, 97, 148, 236, 296, 472, 592];
    for (const df of defectFreqs) {
      const dist = Math.abs(freq - df);
      if (dist < 15) {
        const peak = (1 - dist / 15) * wearFactor * (3.5 + rand() * 1.5);
        amplitude += peak;
      }
    }

    // Harmonic sidebands at high wear
    if (wearFactor > 0.5) {
      const harmonics = [24, 194, 444, 710];
      for (const h of harmonics) {
        const dist = Math.abs(freq - h);
        if (dist < 10) {
          amplitude += (1 - dist / 10) * (wearFactor - 0.5) * 2;
        }
      }
    }

    // Broadband noise increase with wear
    amplitude += wearFactor * 0.3 * rand();

    data.push({
      freq,
      amplitude: Math.round(amplitude * 100) / 100,
      baseline: Math.round(baseline * 100) / 100,
    });
  }

  return data;
}

// Sparkline data generator (deterministic)
export function generateSparkline(current: number, variance: number, points: number = 20): number[] {
  const data: number[] = [];
  const rand = seededRandom(Math.floor(current * 1000 + variance * 100 + 7));
  let value = current - variance * 0.5;
  for (let i = 0; i < points; i++) {
    value += (rand() - 0.48) * variance * 0.3;
    value = Math.max(current - variance, Math.min(current + variance * 0.2, value));
    data.push(Math.round(value * 100) / 100);
  }
  // Ensure last point is near current
  data[data.length - 1] = current;
  return data;
}
