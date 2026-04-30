/**
 * Inventory tab — sell 1 / sell all per item.
 */

import { ITEMS, ITEM_ORDER } from '@sunny-acres/shared';
import type { ItemId } from '@sunny-acres/shared';
import { getState, scheduleSave } from '../state.js';
import { addCoins } from './header.js';
import { renderOrders } from './truckOrders.js';

export function isInventoryActive(): boolean {
  return getState().activeTab === 'inventory';
}

export function renderInventory(): void {
  const state = getState();
  if (state.activeTab !== 'inventory') return;
  const c = document.getElementById('tab-content');
  if (!c) return;

  const rows: string[] = [];
  for (const id of ITEM_ORDER) {
    const def = ITEMS[id];
    const unlock = def.unlockLevel;
    const count = state.inventory[id] ?? 0;
    if (state.level < unlock && count === 0) continue;
    const locked = state.level < unlock;
    rows.push(`
      <div class="inv-row ${locked ? 'locked' : ''}">
        <span class="inv-emoji">${def.emoji}</span>
        <div style="flex:1;min-width:0">
          <div class="inv-name">${def.name}</div>
          <div class="inv-price">Sell: 💰 ${def.settlementFloor} ea</div>
        </div>
        <span class="inv-count">${count}</span>
        <button class="btn warm tiny" data-sell="${id}" ${count > 0 ? '' : 'disabled'} style="${count > 0 ? '' : 'opacity:.5;cursor:not-allowed'}">Sell 1</button>
        <button class="btn peach tiny" data-sellall="${id}" ${count > 0 ? '' : 'disabled'} style="${count > 0 ? '' : 'opacity:.5;cursor:not-allowed'}">All</button>
      </div>
    `);
  }
  if (rows.length === 0) {
    rows.push('<div class="orders-empty">Harvest something to fill your inventory!</div>');
  }
  c.innerHTML = rows.join('');
  c.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset['sell'] as ItemId | undefined;
      if (id) sellItem(id, 1, b);
    });
  });
  c.querySelectorAll<HTMLButtonElement>('[data-sellall]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset['sellall'] as ItemId | undefined;
      if (id) sellItem(id, getState().inventory[id] ?? 0, b);
    });
  });
}

function sellItem(itemId: ItemId, qty: number, sourceEl: HTMLElement | null): void {
  if (qty <= 0) return;
  const state = getState();
  const have = state.inventory[itemId] ?? 0;
  if (have <= 0) return;
  const sellQty = Math.min(qty, have);
  const def = ITEMS[itemId];
  const gained = def.settlementFloor * sellQty;
  state.inventory[itemId] -= sellQty;
  addCoins(gained, sourceEl);
  renderInventory();
  renderOrders();
  scheduleSave();
}
