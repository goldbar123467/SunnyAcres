/**
 * Barn — animal pens. Cooldown-based collection.
 */

import { ANIMALS, ITEMS, isProductReady, productionProgress } from '@sunny-acres/shared';
import { getState, scheduleSave } from '../state.js';
import { addXp } from './header.js';
import { showTooltip, spawnFloatText, spawnSparkles } from './juice.js';
import { renderInventory } from './inventory.js';
import { renderOrders } from './truckOrders.js';

const animalEls: HTMLElement[] = [];

export function renderBarn(): void {
  const row = document.getElementById('barn-row');
  if (!row) return;
  row.innerHTML = '';
  animalEls.length = 0;
  const state = getState();
  if (state.animals.length === 0) {
    row.innerHTML =
      '<div class="row-empty">No animals yet — visit the Shop to buy a Chicken (Lv 2).</div>';
    return;
  }
  state.animals.forEach((_, i) => {
    const el = document.createElement('div');
    el.className = 'pen';
    el.dataset['idx'] = String(i);
    el.dataset['state'] = '';
    el.addEventListener('click', () => onAnimalClick(i));
    row.appendChild(el);
    animalEls.push(el);
    renderAnimal(i);
  });
}

export function renderAnimals(): void {
  const state = getState();
  for (let i = 0; i < state.animals.length; i++) renderAnimal(i);
}

function renderAnimal(idx: number): void {
  const a = getState().animals[idx];
  const el = animalEls[idx];
  if (!a || !el) return;
  const def = ANIMALS[a.animalId];
  const ready = isProductReady(a, Date.now());
  const stateKey = ready ? 'ready' : 'work';
  if (el.dataset['state'] !== stateKey) {
    el.dataset['state'] = stateKey;
    el.classList.toggle('ready', ready);
    const product = ITEMS[def.productId];
    el.innerHTML = `
      <span class="pen-sprite">${def.emoji}</span>
      ${ready ? `<div class="pen-product">${product.emoji}</div>` : `<div class="pen-progress"><div class="pen-progress-fill"></div></div>`}
    `;
  }
  if (!ready) {
    const fill = el.querySelector<HTMLElement>('.pen-progress-fill');
    if (fill) fill.style.width = (productionProgress(a, Date.now()) * 100).toFixed(1) + '%';
  }
}

function onAnimalClick(idx: number): void {
  const a = getState().animals[idx];
  if (!a) return;
  const def = ANIMALS[a.animalId];
  if (isProductReady(a, Date.now())) {
    collectAnimal(idx);
  } else {
    const remainingMs = def.cooldown * 1000 - (Date.now() - a.lastCollectedAt);
    const remaining = Math.ceil(remainingMs / 1000);
    const el = animalEls[idx];
    if (el) showTooltip(el, `${ITEMS[def.productId].emoji} ${remaining}s`);
  }
}

function collectAnimal(idx: number): void {
  const state = getState();
  const a = state.animals[idx];
  if (!a) return;
  const def = ANIMALS[a.animalId];
  if (!isProductReady(a, Date.now())) return;
  const product = ITEMS[def.productId];
  state.inventory[def.productId] = (state.inventory[def.productId] ?? 0) + 1;
  a.lastCollectedAt = Date.now();
  const el = animalEls[idx];
  if (el) {
    spawnSparkles(el, 5);
    spawnFloatText(el, `+1 ${product.emoji}`, '#558b2f');
    addXp(product.xpRef, el);
    el.dataset['state'] = '';
  } else {
    addXp(product.xpRef, null);
  }
  renderAnimal(idx);
  renderInventory();
  renderOrders();
  scheduleSave();
}
