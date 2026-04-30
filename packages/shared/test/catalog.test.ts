import { describe, expect, it } from 'vitest';
import {
  ANIMALS,
  BUILDINGS,
  CROPS,
  ITEMS,
  ITEM_ORDER,
  RECIPES,
  STARTING,
  xpToNext,
} from '../src/index.js';

describe('catalog', () => {
  it('every item id resolves to a definition', () => {
    for (const id of ITEM_ORDER) {
      expect(ITEMS[id]).toBeDefined();
      expect(ITEMS[id].id).toBe(id);
    }
  });

  it('settlementFloor matches the frozen v1 table', () => {
    expect(ITEMS.wheat.settlementFloor).toBe(4);
    expect(ITEMS.carrot.settlementFloor).toBe(12);
    expect(ITEMS.corn.settlementFloor).toBe(25);
    expect(ITEMS.tomato.settlementFloor).toBe(55);
    expect(ITEMS.egg.settlementFloor).toBe(8);
    expect(ITEMS.milk.settlementFloor).toBe(18);
    expect(ITEMS.bread.settlementFloor).toBe(18);
    expect(ITEMS.butter.settlementFloor).toBe(60);
  });

  it('crop tables match the frozen v1 numbers', () => {
    expect(CROPS.wheat).toMatchObject({
      seedCost: 2,
      growTime: 10,
      yield: 2,
      xpOnHarvest: 1,
      unlockLevel: 1,
    });
    expect(CROPS.carrot).toMatchObject({
      seedCost: 5,
      growTime: 25,
      yield: 2,
      xpOnHarvest: 3,
      unlockLevel: 2,
    });
    expect(CROPS.corn).toMatchObject({
      seedCost: 10,
      growTime: 45,
      yield: 2,
      xpOnHarvest: 6,
      unlockLevel: 3,
    });
    expect(CROPS.tomato).toMatchObject({
      seedCost: 20,
      growTime: 90,
      yield: 2,
      xpOnHarvest: 12,
      unlockLevel: 4,
    });
  });

  it('animal tables match the frozen v1 numbers', () => {
    expect(ANIMALS.chicken).toMatchObject({ cost: 50, productId: 'egg', cooldown: 30 });
    expect(ANIMALS.cow).toMatchObject({ cost: 250, productId: 'milk', cooldown: 75 });
  });

  it('building costs match the frozen v1 numbers', () => {
    expect(BUILDINGS.bakery.cost).toBe(150);
    expect(BUILDINGS.dairy.cost).toBe(400);
  });

  it('recipes map to the right buildings and times', () => {
    expect(RECIPES.bread).toMatchObject({
      buildingId: 'bakery',
      outputId: 'bread',
      time: 20,
      xpOnCraft: 4,
    });
    expect(RECIPES.bread.input.wheat).toBe(2);
    expect(RECIPES.butter).toMatchObject({
      buildingId: 'dairy',
      outputId: 'butter',
      time: 30,
      xpOnCraft: 8,
    });
    expect(RECIPES.butter.input.milk).toBe(1);
  });

  it('STARTING constants honor day-0 defaults from phase1.md', () => {
    expect(STARTING.cash).toBe(50);
    expect(STARTING.seeds.wheat).toBe(5);
    expect(STARTING.feed.chicken).toBe(0);
    expect(STARTING.feed.cow).toBe(0);
  });

  it('catalog roots are frozen', () => {
    expect(Object.isFrozen(ITEMS)).toBe(true);
    expect(Object.isFrozen(CROPS)).toBe(true);
    expect(Object.isFrozen(ANIMALS)).toBe(true);
    expect(Object.isFrozen(BUILDINGS)).toBe(true);
    expect(Object.isFrozen(RECIPES)).toBe(true);
    expect(Object.isFrozen(STARTING)).toBe(true);
    expect(Object.isFrozen(STARTING.seeds)).toBe(true);
    expect(Object.isFrozen(STARTING.feed)).toBe(true);
  });

  it('every item def is itself frozen', () => {
    for (const id of ITEM_ORDER) {
      expect(Object.isFrozen(ITEMS[id])).toBe(true);
    }
  });

  it('xp curve matches HTML', () => {
    expect(xpToNext(1)).toBe(10);
    expect(xpToNext(2)).toBe(30);
    expect(xpToNext(3)).toBe(80);
    expect(xpToNext(4)).toBe(200);
    expect(xpToNext(5)).toBe(400);
    expect(xpToNext(6)).toBe(600);
  });
});
