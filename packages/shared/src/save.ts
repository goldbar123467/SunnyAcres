/**
 * Save / load / migrate. No DOM coupling: the storage backend is injected
 * so this module can be unit-tested without browser globals.
 *
 * Persistence keys (canonical):
 *   - `sunny_acres_v1`              — main save (JSON, schema = SaveV1).
 *   - `sunny_acres_intro_dismissed` — `"true"` after first-run completion.
 *   - `farmville_save_v1`           — legacy; read once, migrate, delete (silent).
 */

import { ITEMS, OFFLINE_CAP_MS, SAVE_DEBOUNCE_MS, STARTING } from './catalog.js';
import type {
  AnimalState,
  BuildingState,
  Inventory,
  ItemId,
  PlotState,
  TruckOrder,
} from './types.js';

export const SAVE_KEY = 'sunny_acres_v1';
export const LEGACY_SAVE_KEY = 'farmville_save_v1';
export const INTRO_DISMISSED_KEY = 'sunny_acres_intro_dismissed';

export const CURRENT_SAVE_VERSION = 1 as const;

/** Versioned save root. Discriminated union by `saveVersion`. */
export interface SaveV1 {
  saveVersion: 1;
  coins: number;
  xp: number;
  level: number;
  inventory: Inventory;
  plots: PlotState[];
  animals: AnimalState[];
  buildings: BuildingState[];
  activeOrders: TruckOrder[];
  lastTickAt: number;
  lastTruckSpawnAt: number;
  nextOrderId: number;
  activeTab: 'inventory' | 'shop';
}

/** Future versions (e.g. SaveV2) extend the discriminated union. */
export type Save = SaveV1;

/**
 * The minimal storage shape we need. Matches the synchronous Web Storage API
 * but is a plain interface so tests can pass a mock.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Build a fresh save state. */
export function freshState(now: number = Date.now()): SaveV1 {
  const inventory: Inventory = {
    wheat: 0,
    carrot: 0,
    corn: 0,
    tomato: 0,
    egg: 0,
    milk: 0,
    bread: 0,
    butter: 0,
  };
  const plots: PlotState[] = Array.from({ length: 16 }, () => ({
    cropId: null,
    plantedAt: null,
  }));
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    coins: STARTING.cash,
    xp: 0,
    level: 1,
    inventory,
    plots,
    animals: [],
    buildings: [],
    activeOrders: [],
    lastTickAt: now,
    lastTruckSpawnAt: now,
    nextOrderId: 1,
    activeTab: 'inventory',
  };
}

/** Strip the legacy "farmville" save shape into the SaveV1 shape. Silent. */
function migrateLegacy(parsedLegacy: unknown, now: number): SaveV1 | null {
  if (!parsedLegacy || typeof parsedLegacy !== 'object') return null;
  // The legacy shape is sunny-acres.html's freshState() output. saveVersion=1,
  // SAVE_KEY=farmville_save_v1. Field shapes are compatible with SaveV1 except:
  //   - Plots use `plantedAt: 0` for empty (we use `plantedAt: null`).
  //   - Animals have shape { id, startedAt }   → { animalId, lastCollectedAt }.
  //   - Buildings have shape { id, recipeStartedAt, currentRecipe }
  //     → { buildingId, startedAt }.
  const src = parsedLegacy as Record<string, unknown>;
  if (typeof src['saveVersion'] !== 'number') return null;

  const fresh = freshState(now);

  // Coins / xp / level
  const coins = typeof src['coins'] === 'number' ? src['coins'] : fresh.coins;
  const xp = typeof src['xp'] === 'number' ? src['xp'] : 0;
  const level = typeof src['level'] === 'number' ? src['level'] : 1;

  // Inventory
  const inv: Inventory = { ...fresh.inventory };
  if (src['inventory'] && typeof src['inventory'] === 'object') {
    const srcInv = src['inventory'] as Record<string, unknown>;
    for (const key of Object.keys(ITEMS) as ItemId[]) {
      const v = srcInv[key];
      if (typeof v === 'number') inv[key] = v;
    }
  }

  // Plots
  const plots: PlotState[] = fresh.plots.map((p) => ({ ...p }));
  if (Array.isArray(src['plots'])) {
    const srcPlots = src['plots'] as unknown[];
    for (let i = 0; i < Math.min(16, srcPlots.length); i++) {
      const raw = srcPlots[i];
      if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>;
        const cropId = (typeof r['cropId'] === 'string' ? r['cropId'] : null) as
          | PlotState['cropId']
          | null;
        const plantedAtRaw = r['plantedAt'];
        const plantedAt =
          cropId && typeof plantedAtRaw === 'number' && plantedAtRaw > 0 ? plantedAtRaw : null;
        plots[i] = { cropId: cropId ?? null, plantedAt };
      }
    }
  }

  // Animals
  const animals: AnimalState[] = [];
  if (Array.isArray(src['animals'])) {
    for (const raw of src['animals'] as unknown[]) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r['id'] === 'string' ? r['id'] : null;
      const startedAt = typeof r['startedAt'] === 'number' ? r['startedAt'] : now;
      if (id === 'chicken' || id === 'cow') {
        animals.push({ animalId: id, lastCollectedAt: startedAt });
      }
    }
  }

  // Buildings
  const buildings: BuildingState[] = [];
  if (Array.isArray(src['buildings'])) {
    for (const raw of src['buildings'] as unknown[]) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r['id'] === 'string' ? r['id'] : null;
      const startedRaw = r['recipeStartedAt'];
      const startedAt =
        typeof startedRaw === 'number' && startedRaw > 0 ? startedRaw : null;
      if (id === 'bakery' || id === 'dairy') {
        buildings.push({ buildingId: id, startedAt });
      }
    }
  }

  // Active orders (legacy shape matches our TruckOrder shape closely)
  const activeOrders: TruckOrder[] = [];
  if (Array.isArray(src['activeOrders'])) {
    for (const raw of src['activeOrders'] as unknown[]) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r['id'] === 'number' ? r['id'] : null;
      const items = Array.isArray(r['items']) ? (r['items'] as unknown[]) : [];
      const coinReward = typeof r['coinReward'] === 'number' ? r['coinReward'] : 0;
      const xpReward = typeof r['xpReward'] === 'number' ? r['xpReward'] : 0;
      const spawnedAt = typeof r['spawnedAt'] === 'number' ? r['spawnedAt'] : now;
      if (id === null) continue;
      const orderItems = items.flatMap((iraw) => {
        if (!iraw || typeof iraw !== 'object') return [];
        const ir = iraw as Record<string, unknown>;
        const itemId = typeof ir['itemId'] === 'string' ? (ir['itemId'] as ItemId) : null;
        const qty = typeof ir['qty'] === 'number' ? ir['qty'] : 0;
        if (!itemId || !(itemId in ITEMS)) return [];
        return [{ itemId, qty }];
      });
      activeOrders.push({ id, items: orderItems, coinReward, xpReward, spawnedAt });
    }
  }

  const nextOrderId = typeof src['nextOrderId'] === 'number' ? src['nextOrderId'] : 1;
  const lastTickAt = typeof src['lastTickAt'] === 'number' ? src['lastTickAt'] : now;
  const lastTruckSpawnAt =
    typeof src['lastTruckSpawnAt'] === 'number' ? src['lastTruckSpawnAt'] : now;

  let activeTab: 'inventory' | 'shop' = 'inventory';
  if (src['activeTab'] === 'shop') activeTab = 'shop';

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    coins,
    xp,
    level,
    inventory: inv,
    plots,
    animals,
    buildings,
    activeOrders,
    lastTickAt,
    lastTruckSpawnAt,
    nextOrderId,
    activeTab,
  };
}

/** Defensive: pad a parsed SaveV1 with any missing fields from a fresh state. */
function backfill(parsed: SaveV1, now: number): SaveV1 {
  const fresh = freshState(now);
  const filled: SaveV1 = {
    saveVersion: CURRENT_SAVE_VERSION,
    coins: typeof parsed.coins === 'number' ? parsed.coins : fresh.coins,
    xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
    level: typeof parsed.level === 'number' ? parsed.level : 1,
    inventory: { ...fresh.inventory, ...(parsed.inventory ?? {}) },
    plots: Array.isArray(parsed.plots) ? parsed.plots : fresh.plots,
    animals: Array.isArray(parsed.animals) ? parsed.animals : [],
    buildings: Array.isArray(parsed.buildings) ? parsed.buildings : [],
    activeOrders: Array.isArray(parsed.activeOrders) ? parsed.activeOrders : [],
    lastTickAt: typeof parsed.lastTickAt === 'number' ? parsed.lastTickAt : now,
    lastTruckSpawnAt:
      typeof parsed.lastTruckSpawnAt === 'number' ? parsed.lastTruckSpawnAt : now,
    nextOrderId: typeof parsed.nextOrderId === 'number' ? parsed.nextOrderId : 1,
    activeTab: parsed.activeTab === 'shop' ? 'shop' : 'inventory',
  };
  // Ensure inventory has every known item key
  for (const k of Object.keys(ITEMS) as ItemId[]) {
    if (typeof filled.inventory[k] !== 'number') filled.inventory[k] = 0;
  }
  // Ensure plots length is exactly 16
  while (filled.plots.length < 16) filled.plots.push({ cropId: null, plantedAt: null });
  if (filled.plots.length > 16) filled.plots.length = 16;
  return filled;
}

/** Cap ancient lastTick / lastTruckSpawn timestamps so catch-up loops are bounded. */
export function clampOfflineCatchup(state: SaveV1, now: number): SaveV1 {
  if (now - state.lastTickAt > OFFLINE_CAP_MS) {
    state.lastTickAt = now - OFFLINE_CAP_MS;
  }
  if (now - state.lastTruckSpawnAt > OFFLINE_CAP_MS) {
    state.lastTruckSpawnAt = now - OFFLINE_CAP_MS;
  }
  return state;
}

/**
 * Load. Returns:
 *  - the parsed SaveV1 from `sunny_acres_v1` if present,
 *  - else a migrated value from `farmville_save_v1` (legacy is then deleted),
 *  - else null (no save).
 *
 * Silent on malformed JSON (returns null in that case, like a fresh user).
 */
export function load(storage: StorageLike, now: number = Date.now()): SaveV1 | null {
  // Primary key
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SaveV1 | null;
      if (parsed && parsed.saveVersion === CURRENT_SAVE_VERSION) {
        return clampOfflineCatchup(backfill(parsed, now), now);
      }
    } catch {
      // fall through to legacy attempt
    }
  }

  // Legacy migration (silent)
  let legacyRaw: string | null = null;
  try {
    legacyRaw = storage.getItem(LEGACY_SAVE_KEY);
  } catch {
    legacyRaw = null;
  }
  if (legacyRaw) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(legacyRaw);
    } catch {
      parsed = null;
    }
    const migrated = parsed ? migrateLegacy(parsed, now) : null;
    // Always remove the legacy key once we've attempted migration, so we don't
    // re-process a malformed legacy blob on every load.
    try {
      storage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      // ignore
    }
    if (migrated) {
      const ready = clampOfflineCatchup(backfill(migrated, now), now);
      // Persist under the new key so subsequent loads use the modern path.
      try {
        storage.setItem(SAVE_KEY, JSON.stringify(ready));
      } catch {
        // ignore
      }
      return ready;
    }
  }

  return null;
}

/** Synchronous write. */
export function writeSave(storage: StorageLike, state: SaveV1): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Wipe both the modern and legacy save keys (and the intro flag). */
export function wipe(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
  try {
    storage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Build a debounced saver. Calling the returned function schedules a write
 * after at most `wait` ms (default = SAVE_DEBOUNCE_MS = 5000). `flush()`
 * forces an immediate write.
 *
 * Uses setTimeout / clearTimeout — these are part of the Node + DOM standard
 * runtime and are not DOM-only, so they're safe in `packages/shared`.
 */
export interface DebouncedSaver {
  (state: SaveV1): void;
  flush(state?: SaveV1): void;
  cancel(): void;
}

export function makeDebouncedSaver(
  storage: StorageLike,
  wait: number = SAVE_DEBOUNCE_MS,
): DebouncedSaver {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let pendingState: SaveV1 | null = null;

  const fn = ((state: SaveV1) => {
    pendingState = state;
    if (pending !== null) return;
    pending = setTimeout(() => {
      if (pendingState) writeSave(storage, pendingState);
      pending = null;
      pendingState = null;
    }, wait);
  }) as DebouncedSaver;

  fn.flush = (state?: SaveV1) => {
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
    const s = state ?? pendingState;
    if (s) writeSave(storage, s);
    pendingState = null;
  };

  fn.cancel = () => {
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
    pendingState = null;
  };

  return fn;
}

/** Read the intro-dismissed flag. */
export function isIntroDismissed(storage: StorageLike): boolean {
  try {
    return storage.getItem(INTRO_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persist the intro-dismissed flag (no review-mode side effects in here). */
export function markIntroDismissed(storage: StorageLike): void {
  try {
    storage.setItem(INTRO_DISMISSED_KEY, 'true');
  } catch {
    // ignore
  }
}

/** Clear the intro-dismissed flag (used by Reset Farm and tests). */
export function clearIntroDismissed(storage: StorageLike): void {
  try {
    storage.removeItem(INTRO_DISMISSED_KEY);
  } catch {
    // ignore
  }
}
