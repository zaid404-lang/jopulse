import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateTemperature } from '../src/lib/thingspeak.ts';

const row = (min, current) => ({
  at: new Date(Date.UTC(2026, 10, 9, 18, 0) + min * 60000).toISOString(),
  current,
  status: current > 0 ? 1 : 0,
  temperature: null,
});

test('simulated motor temperature heats while running and cools after a long stop', () => {
  // 20 min at full load, then a 60 min gap, then one more reading
  const rows = [...Array.from({ length: 41 }, (_, i) => row(i * 0.5, 0.7)), row(80, 0.7)];
  simulateTemperature(rows);
  const temps = rows.map((r) => r.temperature);
  assert.equal(temps[0], 30); // starts at ambient
  for (let i = 1; i < 41; i++) assert.ok(temps[i] >= temps[i - 1]); // only rises while running
  assert.ok(temps[40] > 45 && temps[40] <= 52); // approaches 30 + 22 at full load
  assert.ok(temps[41] < 32); // cooled back near ambient during the hour off
});
