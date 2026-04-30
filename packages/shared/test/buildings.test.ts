import { describe, expect, it } from 'vitest';
import { canCraft, isOutputReady, recipeCost, recipeProgress } from '../src/index.js';
import type { BuildingState, Inventory } from '../src/index.js';

const T0 = 1_700_000_000_000;

function emptyInventory(): Inventory {
  return {
    wheat: 0,
    carrot: 0,
    corn: 0,
    tomato: 0,
    egg: 0,
    milk: 0,
    bread: 0,
    butter: 0,
  };
}

describe('buildings', () => {
  it('recipeCost returns the frozen input map', () => {
    expect(recipeCost('bread').wheat).toBe(2);
    expect(recipeCost('butter').milk).toBe(1);
  });

  it('recipeProgress on idle building is 0', () => {
    const idle: BuildingState = { buildingId: 'bakery', startedAt: null };
    expect(recipeProgress(idle, T0)).toBe(0);
    expect(isOutputReady(idle, T0)).toBe(false);
  });

  it('recipeProgress clamps to [0, 1] for an active bakery', () => {
    // Bread takes 20s
    const b: BuildingState = { buildingId: 'bakery', startedAt: T0 };
    expect(recipeProgress(b, T0)).toBe(0);
    expect(recipeProgress(b, T0 + 10_000)).toBeCloseTo(0.5);
    expect(recipeProgress(b, T0 + 20_000)).toBe(1);
    expect(recipeProgress(b, T0 + 100_000)).toBe(1);
  });

  it('isOutputReady toggles at exactly recipe.time for dairy', () => {
    // Butter takes 30s
    const b: BuildingState = { buildingId: 'dairy', startedAt: T0 };
    expect(isOutputReady(b, T0 + 29_999)).toBe(false);
    expect(isOutputReady(b, T0 + 30_000)).toBe(true);
  });

  it('canCraft is false when input is missing', () => {
    const inventory = emptyInventory();
    const state = { inventory, buildings: [] as BuildingState[] };
    expect(canCraft(state, 'bread')).toBe(false);
    expect(canCraft(state, 'butter')).toBe(false);
  });

  it('canCraft is false when input is short', () => {
    const inventory = emptyInventory();
    inventory.wheat = 1; // bread needs 2
    const state = { inventory, buildings: [] as BuildingState[] };
    expect(canCraft(state, 'bread')).toBe(false);
  });

  it('canCraft is true when input is exactly enough', () => {
    const inventory = emptyInventory();
    inventory.wheat = 2;
    inventory.milk = 1;
    const state = { inventory, buildings: [] as BuildingState[] };
    expect(canCraft(state, 'bread')).toBe(true);
    expect(canCraft(state, 'butter')).toBe(true);
  });

  it('canCraft is true when input is more than enough', () => {
    const inventory = emptyInventory();
    inventory.wheat = 99;
    const state = { inventory, buildings: [] as BuildingState[] };
    expect(canCraft(state, 'bread')).toBe(true);
  });
});
