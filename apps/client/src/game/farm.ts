/**
 * Farm — 16-plot grid, plant/harvest UI. Visual parity with sunny-acres.html.
 */

import { CROPS, CROP_ORDER, growProgress, isReady } from '@sunny-acres/shared';
import type { CropId, PlotState } from '@sunny-acres/shared';
import { getState, scheduleSave } from '../state.js';
import { addXp, renderHeader } from './header.js';
import { showTooltip, spawnFloatText, spawnSparkles } from './juice.js';
import { renderInventory } from './inventory.js';
import { renderOrders } from './truckOrders.js';
import { renderShopIfActive } from './shop.js';

const tileEls: HTMLElement[] = [];

export function initFarm(): void {
  const grid = document.getElementById('farm-grid');
  if (!grid) return;
  grid.innerHTML = '';
  tileEls.length = 0;
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset['idx'] = String(i);
    el.dataset['state'] = '';
    el.addEventListener('click', () => onTileClick(i));
    grid.appendChild(el);
    tileEls.push(el);
  }
}

export function renderFarm(): void {
  for (let i = 0; i < 16; i++) renderTile(i);
}

function getStage(plot: PlotState, now: number): 'sprout' | 'growing' | 'growing-late' | 'ready' {
  const p = growProgress(plot, now);
  if (p >= 1) return 'ready';
  if (p >= 0.66) return 'growing-late';
  if (p >= 0.33) return 'growing';
  return 'sprout';
}

export function renderTile(idx: number): void {
  const plot = getState().plots[idx];
  const el = tileEls[idx];
  if (!el || !plot) return;
  if (!plot.cropId || plot.plantedAt === null) {
    if (el.dataset['state'] !== 'empty') {
      el.dataset['state'] = 'empty';
      el.className = 'tile';
      el.innerHTML = '';
    }
    return;
  }
  const def = CROPS[plot.cropId];
  const now = Date.now();
  const stage = getStage(plot, now);
  const stateKey = plot.cropId + ':' + stage;
  if (el.dataset['state'] !== stateKey) {
    el.dataset['state'] = stateKey;
    let emoji: string;
    if (stage === 'ready') emoji = def.emoji;
    else if (stage === 'growing-late' || stage === 'growing') emoji = '🌿';
    else emoji = '🌱';
    el.className = `tile tile-planted stage-${stage}`;
    const progBar =
      stage !== 'ready'
        ? `<div class="tile-progress"><div class="tile-progress-fill"></div></div>`
        : '';
    el.innerHTML = `<span class="tile-sprite">${emoji}</span>${progBar}`;
    if (stage === 'sprout') {
      const sp = el.querySelector('.tile-sprite');
      if (sp) sp.classList.add('tile-plant-pop');
    }
  }
  if (stage !== 'ready') {
    const fill = el.querySelector<HTMLElement>('.tile-progress-fill');
    if (fill) fill.style.width = (growProgress(plot, now) * 100).toFixed(1) + '%';
  }
}

function onTileClick(idx: number): void {
  const state = getState();
  const plot = state.plots[idx];
  if (!plot) return;
  if (!plot.cropId || plot.plantedAt === null) {
    openSeedPicker(idx);
    return;
  }
  const def = CROPS[plot.cropId];
  if (isReady(plot, Date.now())) {
    harvestPlot(idx);
  } else {
    const remaining = Math.ceil((def.growTime * 1000 - (Date.now() - plot.plantedAt)) / 1000);
    const tile = tileEls[idx];
    if (tile) showTooltip(tile, `${def.emoji} ${remaining}s left`);
  }
}

function plantCrop(plotIdx: number, cropId: CropId): void {
  const state = getState();
  const plot = state.plots[plotIdx];
  if (!plot || plot.cropId) return;
  const def = CROPS[cropId];
  if (state.level < def.unlockLevel) return;
  if (state.coins < def.seedCost) {
    const tile = tileEls[plotIdx];
    if (tile) showTooltip(tile, `Need ${def.seedCost} 💰`);
    return;
  }
  state.coins -= def.seedCost;
  plot.cropId = cropId;
  plot.plantedAt = Date.now();
  const tile = tileEls[plotIdx];
  if (tile) tile.dataset['state'] = '';
  renderTile(plotIdx);
  renderHeader();
  renderShopIfActive();
  scheduleSave();
}

function harvestPlot(plotIdx: number): void {
  const state = getState();
  const plot = state.plots[plotIdx];
  if (!plot || !plot.cropId || plot.plantedAt === null) return;
  if (!isReady(plot, Date.now())) return;
  const def = CROPS[plot.cropId];
  state.inventory[def.id] = (state.inventory[def.id] ?? 0) + def.yield;
  const tile = tileEls[plotIdx];
  if (tile) {
    spawnSparkles(tile, 6);
    spawnFloatText(tile, `+${def.yield} ${def.emoji}`, '#558b2f');
    addXp(def.xpOnHarvest, tile);
  } else {
    addXp(def.xpOnHarvest, null);
  }
  plot.cropId = null;
  plot.plantedAt = null;
  if (tile) tile.dataset['state'] = '';
  renderTile(plotIdx);
  renderInventory();
  renderOrders();
  scheduleSave();
}

function openSeedPicker(plotIdx: number): void {
  closeSeedPicker();
  const state = getState();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'seed-modal';
  const modal = document.createElement('div');
  modal.className = 'modal';
  let cards = '';
  for (const id of CROP_ORDER) {
    const c = CROPS[id];
    const locked = state.level < c.unlockLevel;
    const unaffordable = state.coins < c.seedCost;
    let cls = 'seed-card';
    if (locked) cls += ' locked';
    else if (unaffordable) cls += ' unaffordable';
    cards += `
      <div class="${cls}" ${locked ? '' : `data-pick="${id}"`}>
        <div class="seed-card-em">${c.emoji}</div>
        <div class="seed-card-name">${c.name}</div>
        <div class="seed-card-meta">
          ${locked ? `🔒 Unlocks at Lv ${c.unlockLevel}` : `💰 ${c.seedCost} · ⏱ ${c.growTime}s · +${c.yield}`}
        </div>
      </div>
    `;
  }
  modal.innerHTML = `
    <div class="modal-title">🌱 Plant a seed</div>
    <div class="seed-grid">${cards}</div>
    <div style="display:flex;justify-content:flex-end">
      <button class="btn" id="seed-cancel">Cancel</button>
    </div>
  `;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  modal.querySelectorAll<HTMLElement>('[data-pick]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset['pick'] as CropId | undefined;
      if (!id) return;
      const c = CROPS[id];
      if (state.level < c.unlockLevel) return;
      if (state.coins < c.seedCost) {
        card.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-6px)' },
            { transform: 'translateX(6px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 220 },
        );
        return;
      }
      closeSeedPicker();
      plantCrop(plotIdx, id);
    });
  });
  modal.querySelector('#seed-cancel')?.addEventListener('click', closeSeedPicker);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSeedPicker();
  });
}

function closeSeedPicker(): void {
  const m = document.getElementById('seed-modal');
  if (m) m.remove();
}
