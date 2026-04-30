/**
 * Game shell — the in-game DOM (header + farm + barn + production + side
 * panels). Mirrors the body structure of sunny-acres.html so the verbatim
 * CSS keeps applying.
 */

import { flushSave, scheduleSave, wipeAndReload } from '../state.js';
import { initFarm, renderFarm } from './farm.js';
import { renderBarn, renderAnimals } from './barn.js';
import { renderBuildings, renderProduction } from './production.js';
import { renderInventory } from './inventory.js';
import { renderShop, renderShopIfActive } from './shop.js';
import { registerLevelUpRefresh, renderHeader, setDisplayedCoinsFromState } from './header.js';
import { catchUpTrucks, renderOrders } from './truckOrders.js';
import { getState } from '../state.js';
import { openIntroPopups } from '../introPopups.js';
import { SAVE_DEBOUNCE_MS } from '@sunny-acres/shared';

export function renderGameShell(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="sun" aria-hidden="true">☀️</div>

    <header>
      <div class="logo">
        <span class="logo-mark">🌻</span>
        <span>Sunny Acres</span>
      </div>
      <div class="header-stats">
        <div class="xp-wrap">
          <div class="level-badge">
            <span class="lv-label">LV</span>
            <span class="lv-num" id="hdr-level">1</span>
          </div>
          <div class="xp-bar">
            <div class="xp-bar-fill" id="hdr-xp-fill" style="width: 0%"></div>
            <div class="xp-text" id="hdr-xp-text">0 / 10 XP</div>
          </div>
        </div>
        <div class="stat coins" id="hdr-coins-wrap">
          <span class="stat-icon">💰</span>
          <span id="hdr-coins">50</span>
        </div>
      </div>
    </header>

    <main class="left-col">
      <section class="panel" id="farm-panel">
        <div class="panel-title">
          <span class="panel-emoji">🌱</span>
          <span>The Farm</span>
          <span class="panel-sub">click to plant · click to harvest</span>
        </div>
        <div class="farm-grid" id="farm-grid"></div>
      </section>

      <section class="panel" id="barn-panel">
        <div class="panel-title">
          <span class="panel-emoji">🐔</span>
          <span>Barnyard</span>
          <span class="panel-sub">collect when ready</span>
        </div>
        <div class="row-grid" id="barn-row"></div>
      </section>

      <section class="panel" id="prod-panel">
        <div class="panel-title">
          <span class="panel-emoji">🥖</span>
          <span>Production</span>
          <span class="panel-sub">click to start · click to collect</span>
        </div>
        <div class="row-grid" id="prod-row"></div>
      </section>
    </main>

    <aside class="right-col">
      <section class="orders-panel">
        <div class="panel-title">
          <span class="panel-emoji">🚚</span>
          <span>Truck Orders</span>
          <span class="panel-sub" id="orders-count">0/3</span>
        </div>
        <div class="orders-list" id="orders-list"></div>
      </section>

      <section class="right-tabs-panel">
        <div class="tabs">
          <button class="tab" data-tab="inventory">📦 Inventory</button>
          <button class="tab" data-tab="shop">🏪 Shop</button>
        </div>
        <div class="tab-content" id="tab-content"></div>
      </section>
    </aside>

    <div class="gear-menu">
      <button class="gear-btn" id="gear-btn" aria-label="Menu">⚙</button>
      <div class="gear-dropdown" id="gear-dropdown">
        <button class="gear-item" id="gear-replay-intro">Replay intro</button>
        <button class="gear-item" id="gear-reset">Reset farm</button>
      </div>
    </div>

    <button class="reset-btn" id="reset-btn" title="Wipe save and start fresh">↺ Reset Farm</button>
  `;
}

export function bootGame(): void {
  renderGameShell();
  initFarm();
  setupTabs();
  setupResetButton();
  setupGearMenu();

  // Wire level-up refresh hooks (avoids import cycles in header.ts).
  registerLevelUpRefresh(() => renderBarn());
  registerLevelUpRefresh(() => renderProduction());
  registerLevelUpRefresh(() => renderInventory());
  registerLevelUpRefresh(() => renderShopIfActive());
  registerLevelUpRefresh(() => renderOrders());

  setDisplayedCoinsFromState();
  renderHeader();
  renderFarm();
  renderBarn();
  renderProduction();
  renderOrders();

  // Mark active tab + render its content
  const state = getState();
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((x) => {
    x.classList.toggle('active', x.dataset['tab'] === state.activeTab);
  });
  if (state.activeTab === 'shop') renderShop();
  else renderInventory();

  if (catchUpTrucks(state)) renderOrders();

  // Periodic save fallback (in case rAF is throttled in background tabs).
  setInterval(() => scheduleSave(), SAVE_DEBOUNCE_MS);
  // Save on tab close so latest state survives between rAF beats
  window.addEventListener('beforeunload', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushSave();
  });

  requestAnimationFrame(tick);
}

let lastFrameAt = 0;

function tick(now: number): void {
  renderFarm();
  renderAnimals();
  renderBuildings();

  const state = getState();
  if (catchUpTrucks(state)) renderOrders();

  if (now - lastFrameAt > 1000) {
    lastFrameAt = now;
    if (state.activeTab === 'shop') renderShopIfActive();
  }

  scheduleSave();

  state.lastTickAt = Date.now();
  requestAnimationFrame(tick);
}

function setupTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => {
    b.addEventListener('click', () => {
      const tab = b.dataset['tab'];
      if (tab !== 'inventory' && tab !== 'shop') return;
      const state = getState();
      state.activeTab = tab;
      document.querySelectorAll<HTMLButtonElement>('.tab').forEach((x) => {
        x.classList.toggle('active', x.dataset['tab'] === state.activeTab);
      });
      if (state.activeTab === 'shop') renderShop();
      else renderInventory();
      scheduleSave();
    });
  });
}

function setupResetButton(): void {
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm('Wipe your save and start fresh?')) wipeAndReload();
  });
}

function setupGearMenu(): void {
  const btn = document.getElementById('gear-btn');
  const dropdown = document.getElementById('gear-dropdown');
  if (!btn || !dropdown) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Node)) return;
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('open');
    }
  });
  document.getElementById('gear-replay-intro')?.addEventListener('click', () => {
    dropdown.classList.remove('open');
    openIntroPopups('review');
  });
  document.getElementById('gear-reset')?.addEventListener('click', () => {
    dropdown.classList.remove('open');
    if (confirm('Wipe your save and start fresh?')) wipeAndReload();
  });
}
