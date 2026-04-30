/**
 * Shop tab — buy animals + buildings.
 */

import {
  ANIMALS,
  ANIMAL_ORDER,
  BUILDINGS,
  BUILDING_ORDER,
  ITEMS,
  RECIPES,
} from '@sunny-acres/shared';
import { getState, scheduleSave } from '../state.js';
import { renderBarn } from './barn.js';
import { renderProduction } from './production.js';
import { renderHeader, addCoins } from './header.js';
import { showTooltip, spawnFloatText } from './juice.js';
import type { ItemId } from '@sunny-acres/shared';

export function renderShopIfActive(): void {
  if (getState().activeTab === 'shop') renderShop();
}

export function renderShop(): void {
  const c = document.getElementById('tab-content');
  if (!c) return;
  const state = getState();
  const rows: string[] = [];
  for (const id of ANIMAL_ORDER) {
    const a = ANIMALS[id];
    const product = ITEMS[a.productId];
    const locked = state.level < a.unlockLevel;
    const canAfford = state.coins >= a.cost;
    const disabled = locked || !canAfford;
    rows.push(`
      <div class="shop-card ${locked ? 'locked' : ''}">
        <div class="shop-emoji">${a.emoji}</div>
        <div class="shop-info">
          <div class="shop-name">${a.name}</div>
          <div class="shop-desc">Produces ${product.emoji} ${product.name} every ${a.cooldown}s</div>
        </div>
        <div class="shop-cost">
          ${locked ? `<div class="shop-lock">🔒 Lv ${a.unlockLevel}</div>` : `<div class="shop-price">💰 ${a.cost}</div>`}
          <button class="btn primary tiny" data-buy="animal:${id}" ${disabled ? 'disabled' : ''}>${locked ? 'Locked' : 'Buy'}</button>
        </div>
      </div>
    `);
  }
  for (const id of BUILDING_ORDER) {
    const b = BUILDINGS[id];
    const recipe = RECIPES[b.recipeId];
    const out = ITEMS[recipe.outputId];
    const inputDesc = (Object.keys(recipe.input) as ItemId[])
      .map((k) => `${recipe.input[k]} ${ITEMS[k].emoji}`)
      .join(' + ');
    const locked = state.level < b.unlockLevel;
    const canAfford = state.coins >= b.cost;
    const disabled = locked || !canAfford;
    rows.push(`
      <div class="shop-card ${locked ? 'locked' : ''}">
        <div class="shop-emoji">${b.emoji}</div>
        <div class="shop-info">
          <div class="shop-name">${b.name}</div>
          <div class="shop-desc">${inputDesc} → ${out.emoji} ${out.name} (${recipe.time}s)</div>
        </div>
        <div class="shop-cost">
          ${locked ? `<div class="shop-lock">🔒 Lv ${b.unlockLevel}</div>` : `<div class="shop-price">💰 ${b.cost}</div>`}
          <button class="btn primary tiny" data-buy="building:${id}" ${disabled ? 'disabled' : ''}>${locked ? 'Locked' : 'Buy'}</button>
        </div>
      </div>
    `);
  }
  c.innerHTML = rows.join('');
  c.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['buy'] ?? '';
      buyItem(id, btn);
    });
  });
}

function buyItem(id: string, sourceEl: HTMLButtonElement | null): void {
  const state = getState();
  const [kind, key] = id.split(':');
  if (kind === 'animal') {
    const animalId = key as 'chicken' | 'cow' | undefined;
    if (!animalId) return;
    const def = ANIMALS[animalId];
    if (!def) return;
    if (state.level < def.unlockLevel) return;
    if (state.coins < def.cost) {
      if (sourceEl) showTooltip(sourceEl, `Need ${def.cost} 💰`);
      return;
    }
    state.coins -= def.cost;
    state.animals.push({ animalId, lastCollectedAt: Date.now() });
    renderBarn();
    if (sourceEl) spawnFloatText(sourceEl, `-${def.cost} 💰`, '#b71c1c');
  } else if (kind === 'building') {
    const buildingId = key as 'bakery' | 'dairy' | undefined;
    if (!buildingId) return;
    const def = BUILDINGS[buildingId];
    if (!def) return;
    if (state.level < def.unlockLevel) return;
    if (state.coins < def.cost) {
      if (sourceEl) showTooltip(sourceEl, `Need ${def.cost} 💰`);
      return;
    }
    state.coins -= def.cost;
    state.buildings.push({ buildingId, startedAt: null });
    renderProduction();
    if (sourceEl) spawnFloatText(sourceEl, `-${def.cost} 💰`, '#b71c1c');
  } else {
    return;
  }
  // Force coin tween
  addCoins(0, null);
  renderHeader();
  renderShop();
  scheduleSave();
}
