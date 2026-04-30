import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  INTRO_DISMISSED_KEY,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  clearIntroDismissed,
  freshState,
  isIntroDismissed,
  load,
  makeDebouncedSaver,
  markIntroDismissed,
  wipe,
  writeSave,
} from '../src/index.js';
import type { SaveV1, StorageLike } from '../src/index.js';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  has(key: string): boolean {
    return this.map.has(key);
  }
  size(): number {
    return this.map.size;
  }
}

const T0 = 1_700_000_000_000;

describe('save', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('load returns null when no save exists', () => {
    expect(load(storage, T0)).toBeNull();
  });

  it('round-trips a fresh state', () => {
    const fresh = freshState(T0);
    writeSave(storage, fresh);
    const loaded = load(storage, T0);
    expect(loaded).not.toBeNull();
    expect(loaded?.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(loaded?.coins).toBe(fresh.coins);
    expect(loaded?.plots.length).toBe(16);
    expect(loaded?.inventory.wheat).toBe(0);
  });

  it('round-trips a populated state', () => {
    const populated: SaveV1 = freshState(T0);
    populated.coins = 1234;
    populated.xp = 17;
    populated.level = 3;
    populated.inventory.wheat = 5;
    populated.inventory.bread = 2;
    populated.plots[0] = { cropId: 'wheat', plantedAt: T0 + 1_000 };
    populated.plots[3] = { cropId: 'tomato', plantedAt: T0 + 2_000 };
    populated.animals.push({ animalId: 'chicken', lastCollectedAt: T0 + 500 });
    populated.buildings.push({ buildingId: 'bakery', startedAt: T0 + 700 });
    populated.activeOrders.push({
      id: 7,
      items: [{ itemId: 'wheat', qty: 3 }],
      coinReward: 17,
      xpReward: 4,
      spawnedAt: T0,
    });
    populated.nextOrderId = 8;
    populated.activeTab = 'shop';

    writeSave(storage, populated);
    const loaded = load(storage, T0);
    expect(loaded).toEqual(populated);
  });

  it('migrates a legacy farmville_save_v1 fixture and deletes the legacy key', () => {
    const legacy = {
      saveVersion: 1,
      coins: 137,
      xp: 22,
      level: 2,
      inventory: { wheat: 4, carrot: 1, corn: 0, tomato: 0, egg: 2, milk: 0, bread: 0, butter: 0 },
      plots: [
        { cropId: 'wheat', plantedAt: T0 - 5_000 },
        { cropId: null, plantedAt: 0 },
        ...Array.from({ length: 14 }, () => ({ cropId: null, plantedAt: 0 })),
      ],
      animals: [{ id: 'chicken', startedAt: T0 - 12_000 }],
      buildings: [{ id: 'bakery', recipeStartedAt: T0 - 3_000, currentRecipe: 'bread' }],
      activeOrders: [
        {
          id: 3,
          items: [{ itemId: 'wheat', qty: 2 }],
          coinReward: 11,
          xpReward: 2,
          spawnedAt: T0 - 8_000,
        },
      ],
      lastTickAt: T0 - 1_000,
      lastTruckSpawnAt: T0 - 4_000,
      nextOrderId: 4,
      activeTab: 'inventory',
    };
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacy));

    const loaded = load(storage, T0);
    expect(loaded).not.toBeNull();
    expect(loaded?.saveVersion).toBe(1);
    expect(loaded?.coins).toBe(137);
    expect(loaded?.xp).toBe(22);
    expect(loaded?.level).toBe(2);
    expect(loaded?.inventory.wheat).toBe(4);
    expect(loaded?.inventory.egg).toBe(2);
    // Plots should be migrated (16 long), with first plot occupied
    expect(loaded?.plots.length).toBe(16);
    expect(loaded?.plots[0]?.cropId).toBe('wheat');
    expect(loaded?.plots[0]?.plantedAt).toBe(T0 - 5_000);
    expect(loaded?.plots[1]?.cropId).toBeNull();
    expect(loaded?.plots[1]?.plantedAt).toBeNull();
    // Animals should be migrated to {animalId, lastCollectedAt}
    expect(loaded?.animals).toHaveLength(1);
    expect(loaded?.animals[0]).toEqual({ animalId: 'chicken', lastCollectedAt: T0 - 12_000 });
    // Buildings should be migrated to {buildingId, startedAt}
    expect(loaded?.buildings).toHaveLength(1);
    expect(loaded?.buildings[0]).toEqual({ buildingId: 'bakery', startedAt: T0 - 3_000 });
    // Truck order preserved
    expect(loaded?.activeOrders).toHaveLength(1);
    expect(loaded?.activeOrders[0]?.id).toBe(3);
    // Legacy key removed (silent)
    expect(storage.has(LEGACY_SAVE_KEY)).toBe(false);
    // Modern key now present
    expect(storage.has(SAVE_KEY)).toBe(true);
  });

  it('clamps offline catch-up timestamps to 1 hour', () => {
    const ancient = freshState(T0 - 10 * 60 * 60 * 1000);
    storage.setItem(SAVE_KEY, JSON.stringify(ancient));
    const loaded = load(storage, T0);
    expect(loaded).not.toBeNull();
    // 1 hour cap
    expect(T0 - (loaded?.lastTickAt ?? 0)).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(T0 - (loaded?.lastTruckSpawnAt ?? 0)).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('deletes a malformed legacy save without surfacing errors', () => {
    storage.setItem(LEGACY_SAVE_KEY, '{not json');
    const loaded = load(storage, T0);
    expect(loaded).toBeNull();
    expect(storage.has(LEGACY_SAVE_KEY)).toBe(false);
  });

  it('wipe removes both modern and legacy keys', () => {
    storage.setItem(SAVE_KEY, JSON.stringify(freshState(T0)));
    storage.setItem(LEGACY_SAVE_KEY, '{}');
    wipe(storage);
    expect(storage.has(SAVE_KEY)).toBe(false);
    expect(storage.has(LEGACY_SAVE_KEY)).toBe(false);
  });

  it('intro flag helpers round-trip', () => {
    expect(isIntroDismissed(storage)).toBe(false);
    markIntroDismissed(storage);
    expect(isIntroDismissed(storage)).toBe(true);
    expect(storage.getItem(INTRO_DISMISSED_KEY)).toBe('true');
    clearIntroDismissed(storage);
    expect(isIntroDismissed(storage)).toBe(false);
  });

  it('debounced saver coalesces rapid writes', () => {
    vi.useFakeTimers();
    try {
      const saver = makeDebouncedSaver(storage, 100);
      const s = freshState(T0);
      s.coins = 1;
      saver(s);
      s.coins = 2;
      saver(s);
      // Not yet flushed
      expect(storage.getItem(SAVE_KEY)).toBeNull();
      vi.advanceTimersByTime(100);
      const written = JSON.parse(storage.getItem(SAVE_KEY) ?? '{}');
      expect(written.coins).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounced saver flush() forces immediate write', () => {
    const saver = makeDebouncedSaver(storage, 5_000);
    const s = freshState(T0);
    s.coins = 99;
    saver(s);
    saver.flush();
    const written = JSON.parse(storage.getItem(SAVE_KEY) ?? '{}');
    expect(written.coins).toBe(99);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
