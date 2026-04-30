/**
 * Sunny Acres — frozen v1 catalog.
 *
 * Source of truth for every item / crop / animal / building number. All
 * business code MUST import from this module; no magic numbers anywhere
 * else. Sourced from phase1.md §"v1 frozen catalog" tables (which were
 * lifted verbatim from sunny-acres.html).
 *
 * Note: HTML's `sellPrice` is renamed to `settlementFloor` on items. Same
 * value, semantic role for Phase 5 settlement.
 */

import type { AnimalId, BuildingId, CropId, ItemId, RecipeId } from './types.js';

/** A tradable item. */
export interface ItemDef {
  readonly id: ItemId;
  readonly name: string;
  readonly emoji: string;
  /**
   * Per-item floor used by Phase 5 end-of-season pricing for items that
   * never trade. In Phase 1 the truck-order sell flow reads this as the
   * effective sell price; the truck flow goes away in Phase 4.
   */
  readonly settlementFloor: number;
  /** Single-player only; stripped in Phase 4. */
  readonly unlockLevel: number;
  /** XP reference value (used by truck-order reward formula). */
  readonly xpRef: number;
}

/** A crop you plant on a plot. */
export interface CropDef {
  readonly id: CropId;
  readonly name: string;
  readonly emoji: string;
  readonly seedCost: number;
  /** Grow time in seconds. */
  readonly growTime: number;
  /** Units harvested per ready plot. */
  readonly yield: number;
  readonly xpOnHarvest: number;
  readonly unlockLevel: number;
}

/** An owned animal that produces a single product on a cooldown. */
export interface AnimalDef {
  readonly id: AnimalId;
  readonly name: string;
  readonly emoji: string;
  readonly cost: number;
  readonly productId: ItemId;
  /** Cooldown in seconds. */
  readonly cooldown: number;
  readonly unlockLevel: number;
}

/** A recipe a building can run. v1 buildings have exactly one recipe each. */
export interface RecipeDef {
  readonly id: RecipeId;
  readonly buildingId: BuildingId;
  readonly input: Readonly<Partial<Record<ItemId, number>>>;
  readonly outputId: ItemId;
  /** Craft time in seconds. */
  readonly time: number;
  readonly xpOnCraft: number;
}

/** An owned building that runs recipes. */
export interface BuildingDef {
  readonly id: BuildingId;
  readonly name: string;
  readonly emoji: string;
  readonly cost: number;
  readonly unlockLevel: number;
  /** The recipe this building runs. v1 = one recipe per building. */
  readonly recipeId: RecipeId;
}

// ─────────────────────────────────────────────────────────────────────────
// Items (8 tradables)
// ─────────────────────────────────────────────────────────────────────────

export const ITEMS = Object.freeze({
  wheat: Object.freeze({
    id: 'wheat',
    name: 'Wheat',
    emoji: '🌾',
    settlementFloor: 4,
    unlockLevel: 1,
    xpRef: 1,
  }),
  carrot: Object.freeze({
    id: 'carrot',
    name: 'Carrot',
    emoji: '🥕',
    settlementFloor: 12,
    unlockLevel: 2,
    xpRef: 3,
  }),
  corn: Object.freeze({
    id: 'corn',
    name: 'Corn',
    emoji: '🌽',
    settlementFloor: 25,
    unlockLevel: 3,
    xpRef: 6,
  }),
  tomato: Object.freeze({
    id: 'tomato',
    name: 'Tomato',
    emoji: '🍅',
    settlementFloor: 55,
    unlockLevel: 4,
    xpRef: 12,
  }),
  egg: Object.freeze({
    id: 'egg',
    name: 'Egg',
    emoji: '🥚',
    settlementFloor: 8,
    unlockLevel: 2,
    xpRef: 2,
  }),
  milk: Object.freeze({
    id: 'milk',
    name: 'Milk',
    emoji: '🥛',
    settlementFloor: 18,
    unlockLevel: 3,
    xpRef: 5,
  }),
  bread: Object.freeze({
    id: 'bread',
    name: 'Bread',
    emoji: '🍞',
    settlementFloor: 18,
    unlockLevel: 2,
    xpRef: 4,
  }),
  butter: Object.freeze({
    id: 'butter',
    name: 'Butter',
    emoji: '🧈',
    settlementFloor: 60,
    unlockLevel: 3,
    xpRef: 8,
  }),
}) satisfies Readonly<Record<ItemId, ItemDef>>;

/** Stable ordering for inventory and shop display. */
export const ITEM_ORDER: readonly ItemId[] = Object.freeze([
  'wheat',
  'carrot',
  'corn',
  'tomato',
  'egg',
  'milk',
  'bread',
  'butter',
]);

// ─────────────────────────────────────────────────────────────────────────
// Crops
// ─────────────────────────────────────────────────────────────────────────

export const CROPS = Object.freeze({
  wheat: Object.freeze({
    id: 'wheat',
    name: 'Wheat',
    emoji: '🌾',
    seedCost: 2,
    growTime: 10,
    yield: 2,
    xpOnHarvest: 1,
    unlockLevel: 1,
  }),
  carrot: Object.freeze({
    id: 'carrot',
    name: 'Carrot',
    emoji: '🥕',
    seedCost: 5,
    growTime: 25,
    yield: 2,
    xpOnHarvest: 3,
    unlockLevel: 2,
  }),
  corn: Object.freeze({
    id: 'corn',
    name: 'Corn',
    emoji: '🌽',
    seedCost: 10,
    growTime: 45,
    yield: 2,
    xpOnHarvest: 6,
    unlockLevel: 3,
  }),
  tomato: Object.freeze({
    id: 'tomato',
    name: 'Tomato',
    emoji: '🍅',
    seedCost: 20,
    growTime: 90,
    yield: 2,
    xpOnHarvest: 12,
    unlockLevel: 4,
  }),
}) satisfies Readonly<Record<CropId, CropDef>>;

export const CROP_ORDER: readonly CropId[] = Object.freeze([
  'wheat',
  'carrot',
  'corn',
  'tomato',
]);

// ─────────────────────────────────────────────────────────────────────────
// Animals
// ─────────────────────────────────────────────────────────────────────────

export const ANIMALS = Object.freeze({
  chicken: Object.freeze({
    id: 'chicken',
    name: 'Chicken',
    emoji: '🐔',
    cost: 50,
    productId: 'egg',
    cooldown: 30,
    unlockLevel: 2,
  }),
  cow: Object.freeze({
    id: 'cow',
    name: 'Cow',
    emoji: '🐄',
    cost: 250,
    productId: 'milk',
    cooldown: 75,
    unlockLevel: 3,
  }),
}) satisfies Readonly<Record<AnimalId, AnimalDef>>;

export const ANIMAL_ORDER: readonly AnimalId[] = Object.freeze(['chicken', 'cow']);

// ─────────────────────────────────────────────────────────────────────────
// Recipes & Buildings
// ─────────────────────────────────────────────────────────────────────────

const _RECIPES_RAW: Readonly<Record<RecipeId, RecipeDef>> = Object.freeze({
  bread: Object.freeze({
    id: 'bread',
    buildingId: 'bakery',
    input: Object.freeze({ wheat: 2 }) as Readonly<Partial<Record<ItemId, number>>>,
    outputId: 'bread',
    time: 20,
    xpOnCraft: 4,
  }),
  butter: Object.freeze({
    id: 'butter',
    buildingId: 'dairy',
    input: Object.freeze({ milk: 1 }) as Readonly<Partial<Record<ItemId, number>>>,
    outputId: 'butter',
    time: 30,
    xpOnCraft: 8,
  }),
});

export const RECIPES = _RECIPES_RAW;

export const BUILDINGS = Object.freeze({
  bakery: Object.freeze({
    id: 'bakery',
    name: 'Bakery',
    emoji: '🥖',
    cost: 150,
    unlockLevel: 2,
    recipeId: 'bread',
  }),
  dairy: Object.freeze({
    id: 'dairy',
    name: 'Dairy',
    emoji: '🧈',
    cost: 400,
    unlockLevel: 3,
    recipeId: 'butter',
  }),
}) satisfies Readonly<Record<BuildingId, BuildingDef>>;

export const BUILDING_ORDER: readonly BuildingId[] = Object.freeze(['bakery', 'dairy']);

// ─────────────────────────────────────────────────────────────────────────
// Day-0 starting allowances (declared now, used in Phase 4)
// ─────────────────────────────────────────────────────────────────────────

export const STARTING = Object.freeze({
  cash: 50,
  seeds: Object.freeze({ wheat: 5 } as Readonly<Partial<Record<CropId, number>>>),
  feed: Object.freeze({ chicken: 0, cow: 0 } as Readonly<Record<AnimalId, number>>),
}) as {
  readonly cash: number;
  readonly seeds: Readonly<Partial<Record<CropId, number>>>;
  readonly feed: Readonly<Record<AnimalId, number>>;
};

// ─────────────────────────────────────────────────────────────────────────
// Truck-order constants (HTML parity; replaced by order book in Phase 4)
// ─────────────────────────────────────────────────────────────────────────

export const TRUCK_INTERVAL_MS = 45_000;
export const MAX_TRUCK_ORDERS = 3;
export const TRUCK_COIN_MULTIPLIER = 1.4;
export const TRUCK_XP_MULTIPLIER = 0.8;

// ─────────────────────────────────────────────────────────────────────────
// Save and tick constants (HTML parity)
// ─────────────────────────────────────────────────────────────────────────

export const SAVE_DEBOUNCE_MS = 5_000;
export const OFFLINE_CAP_MS = 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────
// Levels / XP (HTML parity; stripped in Phase 4)
// ─────────────────────────────────────────────────────────────────────────

export function xpToNext(level: number): number {
  if (level === 1) return 10;
  if (level === 2) return 30;
  if (level === 3) return 80;
  if (level === 4) return 200;
  return 200 * (level - 3);
}

export const LEVEL_UNLOCKS: Readonly<Record<number, string>> = Object.freeze({
  2: 'Carrots, Chickens, Bakery',
  3: 'Corn, Cows, Dairy',
  4: 'Tomatoes',
  5: 'New trucks pay more',
  6: 'Bigger orders',
  7: 'More XP per harvest',
  8: 'Festive farm flair',
});
