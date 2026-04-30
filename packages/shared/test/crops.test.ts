import { describe, expect, it } from 'vitest';
import { CROPS, growProgress, growTimeRemaining, harvestYield, isReady } from '../src/index.js';
import type { PlotState } from '../src/index.js';

const T0 = 1_700_000_000_000;

describe('crops', () => {
  it('growTimeRemaining returns 0 for empty plots', () => {
    const plot: PlotState = { cropId: null, plantedAt: null };
    expect(growTimeRemaining(plot, T0)).toBe(0);
    expect(isReady(plot, T0)).toBe(false);
  });

  it('growTimeRemaining decreases as time elapses', () => {
    const plot: PlotState = { cropId: 'wheat', plantedAt: T0 };
    // Wheat = 10s growTime
    expect(growTimeRemaining(plot, T0)).toBeCloseTo(10);
    expect(growTimeRemaining(plot, T0 + 5_000)).toBeCloseTo(5);
    expect(growTimeRemaining(plot, T0 + 9_999)).toBeGreaterThan(0);
    expect(growTimeRemaining(plot, T0 + 10_000)).toBe(0);
    expect(growTimeRemaining(plot, T0 + 20_000)).toBe(0);
  });

  it('isReady toggles at exactly growTime', () => {
    const plot: PlotState = { cropId: 'corn', plantedAt: T0 }; // 45s
    expect(isReady(plot, T0)).toBe(false);
    expect(isReady(plot, T0 + 44_999)).toBe(false);
    expect(isReady(plot, T0 + 45_000)).toBe(true);
    expect(isReady(plot, T0 + 46_000)).toBe(true);
  });

  it('isReady on tomato requires the full 90s', () => {
    const plot: PlotState = { cropId: 'tomato', plantedAt: T0 };
    expect(isReady(plot, T0 + 89_000)).toBe(false);
    expect(isReady(plot, T0 + 90_000)).toBe(true);
  });

  it('harvestYield matches the catalog', () => {
    expect(harvestYield('wheat')).toBe(CROPS.wheat.yield);
    expect(harvestYield('carrot')).toBe(CROPS.carrot.yield);
    expect(harvestYield('corn')).toBe(CROPS.corn.yield);
    expect(harvestYield('tomato')).toBe(CROPS.tomato.yield);
  });

  it('growProgress is clamped to [0, 1]', () => {
    const plot: PlotState = { cropId: 'wheat', plantedAt: T0 };
    expect(growProgress(plot, T0)).toBe(0);
    expect(growProgress(plot, T0 + 5_000)).toBeCloseTo(0.5);
    expect(growProgress(plot, T0 + 10_000)).toBe(1);
    expect(growProgress(plot, T0 + 1_000_000)).toBe(1);
  });

  it('growProgress on empty plot is 0', () => {
    const plot: PlotState = { cropId: null, plantedAt: null };
    expect(growProgress(plot, T0)).toBe(0);
  });
});
