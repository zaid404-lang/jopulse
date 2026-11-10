import assert from 'node:assert/strict';
import test from 'node:test';
import { computeFinancials, getPowerFactorPenalty } from '../src/lib/calculations.ts';

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

test('power-factor correction does not reduce the bill when there is no penalty', () => {
  const result = computeFinancials(scenario(0.90, 0));
  assert.equal(result.pfPenaltyAmount, 0);
  assert.equal(result.totalOptimizedBill, result.billCurrentHabits);
});
