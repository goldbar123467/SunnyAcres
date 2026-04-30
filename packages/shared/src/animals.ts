/**
 * Pure animal-production math. No DOM, no side effects.
 */

import { ANIMALS } from './catalog.js';
import type { AnimalState } from './types.js';

/**
 * 0..1 production progress (clamped). 1 means a product is ready to collect.
 */
export function productionProgress(animal: AnimalState, now: number): number {
  const def = ANIMALS[animal.animalId];
  const elapsedSeconds = (now - animal.lastCollectedAt) / 1000;
  const p = elapsedSeconds / def.cooldown;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/** True iff elapsed time since `lastCollectedAt` reaches the cooldown. */
export function isProductReady(animal: AnimalState, now: number): boolean {
  const def = ANIMALS[animal.animalId];
  const elapsedSeconds = (now - animal.lastCollectedAt) / 1000;
  return elapsedSeconds >= def.cooldown;
}
