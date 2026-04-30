/**
 * Truck-order system, ported verbatim from sunny-acres.html for the
 * Phase 1 exit test ("fulfill an order"). Replaced wholesale by the
 * order book in Phase 4.
 */

import {
  ITEMS,
  ITEM_ORDER,
  MAX_TRUCK_ORDERS,
  TRUCK_COIN_MULTIPLIER,
  TRUCK_INTERVAL_MS,
  TRUCK_XP_MULTIPLIER,
  type ItemId,
  type SaveV1,
  type TruckOrder,
} from '@sunny-acres/shared';

import { addCoins, addXp } from './header.js';
import { getState, scheduleSave } from '../state.js';
import { spawnFloatText, spawnSparkles } from './juice.js';
import { renderInventory } from './inventory.js';

/** All eight items have an HTML-defined unlockLevel. We mirror it here. */
const ITEM_UNLOCK_LEVEL: Readonly<Record<ItemId, number>> = Object.freeze({
  wheat: 1,
  carrot: 2,
  egg: 2,
  bread: 2,
  corn: 3,
  milk: 3,
  butter: 3,
  tomato: 4,
});

/** Compute reward + items for a fresh truck order. Pure-ish; pulls level. */
export function spawnTruck(state: SaveV1): TruckOrder | null {
  if (state.activeOrders.length >= MAX_TRUCK_ORDERS) return null;
  const pool: ItemId[] = ITEM_ORDER.filter((id) => state.level >= ITEM_UNLOCK_LEVEL[id]);
  if (pool.length === 0) return null;
  const numItems = Math.min(
    pool.length,
    1 + Math.floor(Math.random() * Math.min(3, Math.max(1, state.level))),
  );
  const chosen: ItemId[] = [];
  const poolCopy = [...pool];
  for (let i = 0; i < numItems && poolCopy.length > 0; i++) {
    const idx = Math.floor(Math.random() * poolCopy.length);
    const picked = poolCopy.splice(idx, 1)[0];
    if (picked) chosen.push(picked);
  }
  const items = chosen.map((itemId) => {
    const maxQ = Math.min(8, 2 + Math.floor(state.level / 2));
    const qty = 1 + Math.floor(Math.random() * maxQ);
    return { itemId, qty };
  });
  let coinSum = 0;
  let xpSum = 0;
  for (const it of items) {
    const def = ITEMS[it.itemId];
    coinSum += def.settlementFloor * it.qty;
    xpSum += def.xpRef * it.qty;
  }
  const coinReward = Math.ceil(coinSum * TRUCK_COIN_MULTIPLIER);
  const xpReward = Math.ceil(xpSum * TRUCK_XP_MULTIPLIER);
  const order: TruckOrder = {
    id: state.nextOrderId++,
    items,
    coinReward,
    xpReward,
    spawnedAt: Date.now(),
  };
  state.activeOrders.push(order);
  return order;
}

/** Run the "spawn pending trucks" loop until caught up. */
export function catchUpTrucks(state: SaveV1): boolean {
  let spawned = false;
  while (
    Date.now() - state.lastTruckSpawnAt >= TRUCK_INTERVAL_MS &&
    state.activeOrders.length < MAX_TRUCK_ORDERS
  ) {
    const order = spawnTruck(state);
    if (!order) break;
    state.lastTruckSpawnAt += TRUCK_INTERVAL_MS;
    spawned = true;
  }
  return spawned;
}

export function renderOrders(): void {
  const list = document.getElementById('orders-list');
  const count = document.getElementById('orders-count');
  if (!list || !count) return;
  const state = getState();
  count.textContent = `${state.activeOrders.length}/${MAX_TRUCK_ORDERS}`;
  list.innerHTML = '';
  if (state.activeOrders.length === 0) {
    list.innerHTML =
      '<div class="orders-empty">A truck rolls up every 45 seconds. Stay busy!</div>';
    return;
  }
  for (const order of state.activeOrders) {
    const card = document.createElement('div');
    card.className = 'order-card';
    const itemsHtml = order.items
      .map((it) => {
        const def = ITEMS[it.itemId];
        const have = state.inventory[it.itemId] ?? 0;
        const cls = have >= it.qty ? 'have' : 'short';
        return `<span class="order-item ${cls}"><span class="em">${def.emoji}</span>×${it.qty} <span style="opacity:.6;font-size:11px">(${Math.min(have, it.qty)}/${it.qty})</span></span>`;
      })
      .join('');
    const canFulfill = order.items.every(
      (it) => (state.inventory[it.itemId] ?? 0) >= it.qty,
    );
    card.innerHTML = `
      <div class="order-truck-row">
        <div class="order-truck-emoji">🚚</div>
        <div class="order-truck-label">Truck Order</div>
      </div>
      <div class="order-items">${itemsHtml}</div>
      <div class="order-rewards">
        <span class="order-reward-chip">💰 +${order.coinReward}</span>
        <span class="order-reward-chip">⭐ +${order.xpReward}</span>
      </div>
      <div class="order-actions">
        <button class="btn primary" data-fulfill="${order.id}" ${canFulfill ? '' : 'disabled'}>${canFulfill ? 'Fulfill' : 'Need more'}</button>
        <button class="btn danger tiny" data-dismiss="${order.id}" title="Dismiss">✕</button>
      </div>
    `;
    list.appendChild(card);
  }
  list.querySelectorAll<HTMLButtonElement>('[data-fulfill]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = parseInt(b.dataset['fulfill'] ?? '0', 10);
      fulfillOrder(id, b);
    });
  });
  list.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = parseInt(b.dataset['dismiss'] ?? '0', 10);
      dismissOrder(id);
    });
  });
}

function fulfillOrder(orderId: number, sourceEl: HTMLElement | null): void {
  const state = getState();
  const order = state.activeOrders.find((o) => o.id === orderId);
  if (!order) return;
  for (const it of order.items) {
    if ((state.inventory[it.itemId] ?? 0) < it.qty) return;
  }
  for (const it of order.items) {
    state.inventory[it.itemId] -= it.qty;
  }
  state.activeOrders = state.activeOrders.filter((o) => o.id !== orderId);
  if (sourceEl) {
    spawnSparkles(sourceEl, 8);
    spawnFloatText(sourceEl, `+${order.coinReward} 💰`, '#558b2f');
  }
  addCoins(order.coinReward, null);
  addXp(order.xpReward, sourceEl);
  renderOrders();
  renderInventory();
  scheduleSave();
}

function dismissOrder(orderId: number): void {
  const state = getState();
  state.activeOrders = state.activeOrders.filter((o) => o.id !== orderId);
  renderOrders();
  scheduleSave();
}
