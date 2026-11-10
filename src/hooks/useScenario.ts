'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ScenarioInputs } from '../lib/calculations';

const DEFAULT_INPUTS: ScenarioInputs = {
  timeOfDay: new Date().getHours(),
  powerFactor: 0.82,
  peakShiftPct: 0,
  bearingWear: 35,
};

export function useScenario() {
  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULT_INPUTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial data fetch
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const updateInput = useCallback(<K extends keyof ScenarioInputs>(
    key: K,
    value: ScenarioInputs[K]
  ) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetInputs = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
  }, []);

  return { inputs, updateInput, resetInputs, isLoading };
}
