import { describe, expect, it } from 'vitest';
import { isProductReady, productionProgress } from '../src/index.js';
import type { AnimalState } from '../src/index.js';

const T0 = 1_700_000_000_000;

describe('animals', () => {
  it('productionProgress clamps to [0, 1]', () => {
    const a: AnimalState = { animalId: 'chicken', lastCollectedAt: T0 }; // 30s
    expect(productionProgress(a, T0)).toBe(0);
    expect(productionProgress(a, T0 + 15_000)).toBeCloseTo(0.5);
    expect(productionProgress(a, T0 + 30_000)).toBe(1);
    expect(productionProgress(a, T0 + 1_000_000)).toBe(1);
    // before lastCollectedAt is also clamped to 0
    expect(productionProgress(a, T0 - 5_000)).toBe(0);
  });

  it('isProductReady on chicken toggles at 30s exactly', () => {
    const a: AnimalState = { animalId: 'chicken', lastCollectedAt: T0 };
    expect(isProductReady(a, T0)).toBe(false);
    expect(isProductReady(a, T0 + 29_999)).toBe(false);
    expect(isProductReady(a, T0 + 30_000)).toBe(true);
    expect(isProductReady(a, T0 + 100_000)).toBe(true);
  });

  it('isProductReady on cow toggles at 75s exactly', () => {
    const a: AnimalState = { animalId: 'cow', lastCollectedAt: T0 };
    expect(isProductReady(a, T0 + 74_999)).toBe(false);
    expect(isProductReady(a, T0 + 75_000)).toBe(true);
  });
});
