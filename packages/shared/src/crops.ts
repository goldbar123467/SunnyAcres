/**
 * Pure crop math. No DOM, no side effects. Time argument `now` is ms-epoch.
 */

import { CROPS } from './catalog.js';
import type { CropId, PlotState } from './types.js';

/**
 * Seconds remaining until the plot is ready. 0 if ready now or empty.
 * Returns floating-point seconds (callers can `Math.ceil` for display).
 */
export function growTimeRemaining(plot: PlotState, now: number): number {
  if (plot.cropId === null || plot.plantedAt === null) return 0;
  const def = CROPS[plot.cropId];
  const elapsedSeconds = (now - plot.plantedAt) / 1000;
  const remaining = def.growTime - elapsedSeconds;
  return remaining > 0 ? remaining : 0;
}

/** True when the plot has a crop and the elapsed time is at least growTime. */
export function isReady(plot: PlotState, now: number): boolean {
  if (plot.cropId === null || plot.plantedAt === null) return false;
  const def = CROPS[plot.cropId];
  const elapsedSeconds = (now - plot.plantedAt) / 1000;
  return elapsedSeconds >= def.growTime;
}

/** Yield (units harvested) for a given crop. */
export function harvestYield(cropId: CropId): number {
  return CROPS[cropId].yield;
}

/**
 * 0..1 progress to ready, useful for progress-bar fills.
 * Returns 0 for empty plots.
 */
export function growProgress(plot: PlotState, now: number): number {
  if (plot.cropId === null || plot.plantedAt === null) return 0;
  const def = CROPS[plot.cropId];
  const elapsedSeconds = (now - plot.plantedAt) / 1000;
  const p = elapsedSeconds / def.growTime;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}
