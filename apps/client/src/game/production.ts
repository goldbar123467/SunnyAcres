/**
 * Production — buildings + craft. Wraps `canCraft` / `recipeProgress`.
 */

import {
  BUILDINGS,
  ITEMS,
  RECIPES,
  canCraft,
  isOutputReady,
  recipeProgress,
} from '@sunny-acres/shared';
import type { ItemId } from '@sunny-acres/shared';
import { getState, scheduleSave } from '../state.js';
import { addXp } from './header.js';
import { showTooltip, spawnFloatText, spawnSparkles } from './juice.js';
import { renderInventory } from './inventory.js';
import { renderOrders } from './truckOrders.js';

const buildingEls: HTMLElement[] = [];

export function renderProduction(): void {
  const row = document.getElementById('prod-row');
  if (!row) return;
  row.innerHTML = '';
  buildingEls.length = 0;
  const state = getState();
  if (state.buildings.length === 0) {
    row.innerHTML =
      '<div class="row-empty">No buildings yet — visit the Shop to buy a Bakery (Lv 2).</div>';
    return;
  }
  state.buildings.forEach((_, i) => {
    const el = document.createElement('div');
    el.className = 'build';
    el.dataset['idx'] = String(i);
    el.dataset['state'] = '';
    el.addEventListener('click', () => onBuildingClick(i));
    row.appendChild(el);
    buildingEls.push(el);
    renderBuilding(i);
  });
}

export function renderBuildings(): void {
  const state = getState();
  for (let i = 0; i < state.buildings.length; i++) renderBuilding(i);
}

function renderBuilding(idx: number): void {
  const state = getState();
  const b = state.buildings[idx];
  const el = buildingEls[idx];
  if (!b || !el) return;
  const def = BUILDINGS[b.buildingId];
  const recipe = RECIPES[def.recipeId];

  let stateKey: string;
  let html: string;
  if (b.startedAt !== null) {
    if (isOutputReady(b, Date.now())) {
      stateKey = 'output';
      const out = ITEMS[recipe.outputId];
      html = `<span class="build-sprite">${def.emoji}</span><div class="build-output">${out.emoji}</div>`;
    } else {
      stateKey = 'work';
      html = `<span class="build-sprite">${def.emoji}</span><div class="build-progress"><div class="build-progress-fill"></div></div>`;
    }
  } else {
    const canStart = canCraft(state, def.recipeId);
    stateKey = canStart ? 'idle-ready' : 'idle-dim';
    html = `<span class="build-sprite">${def.emoji}</span><div class="build-start ${canStart ? '' : 'dim'}">▶</div>`;
  }
  if (el.dataset['state'] !== stateKey) {
    el.dataset['state'] = stateKey;
    el.classList.toggle('ready', stateKey === 'output');
    el.innerHTML = html;
  }
  if (stateKey === 'work') {
    const fill = el.querySelector<HTMLElement>('.build-progress-fill');
    if (fill) fill.style.width = (recipeProgress(b, Date.now()) * 100).toFixed(1) + '%';
  }
}

function onBuildingClick(idx: number): void {
  const state = getState();
  const b = state.buildings[idx];
  if (!b) return;
  const def = BUILDINGS[b.buildingId];
  const recipe = RECIPES[def.recipeId];

  if (b.startedAt !== null) {
    if (isOutputReady(b, Date.now())) {
      collectBuilding(idx);
    } else {
      const remainingMs = recipe.time * 1000 - (Date.now() - b.startedAt);
      const remaining = Math.ceil(remainingMs / 1000);
      const el = buildingEls[idx];
      if (el) showTooltip(el, `${ITEMS[recipe.outputId].emoji} ${remaining}s`);
    }
    return;
  }
  startBuilding(idx);
}

function startBuilding(idx: number): void {
  const state = getState();
  const b = state.buildings[idx];
  if (!b || b.startedAt !== null) return;
  const def = BUILDINGS[b.buildingId];
  const recipe = RECIPES[def.recipeId];
  if (!canCraft(state, def.recipeId)) {
    const need = (Object.keys(recipe.input) as ItemId[])
      .map((k) => `${recipe.input[k]} ${ITEMS[k].emoji}`)
      .join(' + ');
    const el = buildingEls[idx];
    if (el) showTooltip(el, `Need ${need}`);
    return;
  }
  for (const k of Object.keys(recipe.input) as ItemId[]) {
    const need = recipe.input[k] ?? 0;
    state.inventory[k] -= need;
  }
  b.startedAt = Date.now();
  const el = buildingEls[idx];
  if (el) el.dataset['state'] = '';
  renderBuilding(idx);
  renderInventory();
  renderOrders();
  scheduleSave();
}

function collectBuilding(idx: number): void {
  const state = getState();
  const b = state.buildings[idx];
  if (!b || b.startedAt === null) return;
  const def = BUILDINGS[b.buildingId];
  const recipe = RECIPES[def.recipeId];
  if (!isOutputReady(b, Date.now())) return;
  const out = ITEMS[recipe.outputId];
  state.inventory[recipe.outputId] = (state.inventory[recipe.outputId] ?? 0) + 1;
  const el = buildingEls[idx];
  if (el) {
    spawnSparkles(el, 6);
    spawnFloatText(el, `+1 ${out.emoji}`, '#5d4037');
    addXp(recipe.xpOnCraft, el);
    el.dataset['state'] = '';
  } else {
    addXp(recipe.xpOnCraft, null);
  }
  b.startedAt = null;
  renderBuilding(idx);
  renderInventory();
  renderOrders();
  scheduleSave();
}
