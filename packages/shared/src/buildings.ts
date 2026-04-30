/**
 * Pure building / recipe math. No DOM, no side effects.
 */

import { BUILDINGS, RECIPES } from './catalog.js';
import type { BuildingState, Inventory, ItemId, RecipeId } from './types.js';

/**
 * Returns a defensive copy of the recipe's input cost map (only entries
 * actually present), so callers can iterate safely.
 */
export function recipeCost(recipeId: RecipeId): Readonly<Partial<Record<ItemId, number>>> {
  const r = RECIPES[recipeId];
  // RECIPES is already frozen; just return the same object.
  return r.input;
}

/**
 * 0..1 progress on the current recipe. 0 if the building is idle
 * (`startedAt === null`).
 */
export function recipeProgress(building: BuildingState, now: number): number {
  if (building.startedAt === null) return 0;
  const def = BUILDINGS[building.buildingId];
  const recipe = RECIPES[def.recipeId];
  const elapsedSeconds = (now - building.startedAt) / 1000;
  const p = elapsedSeconds / recipe.time;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * True iff the building is idle and the inventory has every input item the
 * recipe needs in at least the required quantity.
 */
export function canCraft(
  state: { inventory: Inventory; buildings: readonly BuildingState[] },
  recipeId: RecipeId,
): boolean {
  const recipe = RECIPES[recipeId];
  for (const k of Object.keys(recipe.input) as ItemId[]) {
    const need = recipe.input[k] ?? 0;
    const have = state.inventory[k] ?? 0;
    if (have < need) return false;
  }
  return true;
}

/** True iff a specific building's recipe is ready to collect. */
export function isOutputReady(building: BuildingState, now: number): boolean {
  if (building.startedAt === null) return false;
  const def = BUILDINGS[building.buildingId];
  const recipe = RECIPES[def.recipeId];
  const elapsedSeconds = (now - building.startedAt) / 1000;
  return elapsedSeconds >= recipe.time;
}
