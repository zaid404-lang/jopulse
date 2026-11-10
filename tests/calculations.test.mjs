import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeFinancials,
  getPowerFactorPenalty,
  getPowerFactorSurchargePct,
  getTariffByHour,
  getCountdown,
  loadAt,
} from '../src/lib/calculations.ts';

const scenario = (powerFactor, peakShiftPct = 25) => ({
  timeOfDay: 18,
  powerFactor,
  peakShiftPct,
  bearingWear: 0,
});

test('power-factor penalty follows the dashboard stepped assumptions', () => {
  assert.equal(getPowerFactorPenalty(0.90), 0);
  assert.equal(getPowerFactorPenalty(0.85), 0.015);
  assert.equal(getPowerFactorPenalty(0.80), 0.035);
  assert.equal(getPowerFactorPenalty(0.75), 0.065);
  assert.equal(getPowerFactorPenalty(0.74), 0.12);
});

test('optimized monthly bill subtracts both shift savings and PF correction savings', () => {
  const result = computeFinancials(scenario(0.74));
  assert.equal(result.billCurrentHabits, 33500);
  assert.equal(result.savedByPeakShift, 625);
  assert.equal(result.pfPenaltyAmount, 4020);
  assert.equal(result.savingIfPFCorrected, 4020);
  assert.equal(result.totalOptimizedBill, 28855);
});

test('surcharge in percent matches the fraction', () => {
  for (const pf of [0.95, 0.87, 0.82, 0.77, 0.6]) {
    assert.equal(getPowerFactorSurchargePct(pf) / 100, getPowerFactorPenalty(pf));
  }
});

test('tariff bands cover the day at the EMRC boundaries', () => {
  assert.equal(getTariffByHour(4.99).band, 'Partial-Peak');
  assert.equal(getTariffByHour(5).band, 'Off-Peak');
  assert.equal(getTariffByHour(14).band, 'Partial-Peak');
  assert.equal(getTariffByHour(17).band, 'Peak');
  assert.equal(getTariffByHour(23).band, 'Partial-Peak');
  assert.equal(getTariffByHour(24).band, 'Partial-Peak'); // wraps to midnight
});

test('countdown points at the next rate change, across midnight too', () => {
  assert.deepEqual(getCountdown(14.5), { countdownText: '2h 30m', targetBand: 'Peak', targetTime: '17:00' });
  assert.deepEqual(getCountdown(23.5), { countdownText: '5h 30m', targetBand: 'Off-Peak', targetTime: '05:00' });
});

test('shifting peak load moves energy to off-peak instead of losing it', () => {
  const dayKwh = (shift) => Array.from({ length: 24 }, (_, h) => loadAt(h, shift)).reduce((a, b) => a + b, 0);
  // rounding each hour to whole kW can move the total by a few kWh at most
  assert.ok(Math.abs(dayKwh(25) - dayKwh(0)) <= 6);
  assert.ok(loadAt(18, 25) < loadAt(18, 0));
  assert.ok(loadAt(8, 25) > loadAt(8, 0));
});

test('power-factor correction does not reduce the bill when there is no penalty', () => {
  const result = computeFinancials(scenario(0.90, 0));
  assert.equal(result.pfPenaltyAmount, 0);
  assert.equal(result.totalOptimizedBill, result.billCurrentHabits);
});
