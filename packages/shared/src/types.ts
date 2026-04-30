/**
 * Sunny Acres — shared types.
 *
 * String-literal unions for every ID. Business code in this package and in
 * apps/client must import these IDs from here; no bare `string` ids.
 */

export type CropId = 'wheat' | 'carrot' | 'corn' | 'tomato';
export type AnimalId = 'chicken' | 'cow';
export type BuildingId = 'bakery' | 'dairy';
export type RecipeId = 'bread' | 'butter';
export type ItemId = CropId | 'egg' | 'milk' | 'bread' | 'butter';

/**
 * One of the 16 farm plots. `cropId === null` means empty.
 * `plantedAt` is a ms-epoch timestamp; null when empty.
 */
export interface PlotState {
  cropId: CropId | null;
  plantedAt: number | null;
}

/**
 * One owned animal in the barn. `lastCollectedAt` is the cooldown anchor:
 * the cooldown is measured from this moment forward.
 */
export interface AnimalState {
  animalId: AnimalId;
  lastCollectedAt: number;
}

/**
 * One owned building in production. `startedAt` is when the current recipe
 * started; null means idle. The building's recipe is implicit (one-recipe
 * buildings in v1; widen later if needed).
 */
export interface BuildingState {
  buildingId: BuildingId;
  startedAt: number | null;
}

/** A truck order line (HTML parity; replaced by the order book in Phase 4). */
export interface TruckOrderItem {
  itemId: ItemId;
  qty: number;
}

/** A truck order (HTML parity). */
export interface TruckOrder {
  id: number;
  items: TruckOrderItem[];
  coinReward: number;
  xpReward: number;
  spawnedAt: number;
}

/** Inventory record: integer counts keyed by ItemId. */
export type Inventory = Record<ItemId, number>;
