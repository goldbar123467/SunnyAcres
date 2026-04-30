/**
 * Header — coins, level, XP bar. Coin tween + level-up confetti from HTML.
 */

import { LEVEL_UNLOCKS, xpToNext } from '@sunny-acres/shared';
import { getState, scheduleSave } from '../state.js';
import { spawnConfetti, spawnFloatText, showToast } from './juice.js';

let coinTweenRaf: number | null = null;
let displayedCoins = 0;

export function getDisplayedCoins(): number {
  return displayedCoins;
}

export function setDisplayedCoinsFromState(): void {
  displayedCoins = getState().coins;
  const el = document.getElementById('hdr-coins');
  if (el) el.textContent = String(displayedCoins);
}

export function renderHeader(): void {
  const state = getState();
  const lvEl = document.getElementById('hdr-level');
  if (lvEl) lvEl.textContent = String(state.level);
  const need = xpToNext(state.level);
  const pct = Math.max(0, Math.min(100, (state.xp / need) * 100));
  const fill = document.getElementById('hdr-xp-fill') as HTMLElement | null;
  if (fill) fill.style.width = pct + '%';
  const text = document.getElementById('hdr-xp-text');
  if (text) text.textContent = `${state.xp} / ${need} XP`;
  if (coinTweenRaf === null) {
    displayedCoins = state.coins;
    const c = document.getElementById('hdr-coins');
    if (c) c.textContent = String(state.coins);
  }
}

function tweenCoins(from: number, to: number): void {
  if (coinTweenRaf !== null) cancelAnimationFrame(coinTweenRaf);
  const start = performance.now();
  const dur = 480;
  const el = document.getElementById('hdr-coins');
  const wrap = document.getElementById('hdr-coins-wrap');
  if (wrap) {
    wrap.classList.remove('bumping');
    void wrap.offsetWidth;
    wrap.classList.add('bumping');
  }
  function step(now: number): void {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = Math.round(from + (to - from) * eased);
    if (el) el.textContent = String(v);
    displayedCoins = v;
    if (t < 1) {
      coinTweenRaf = requestAnimationFrame(step);
    } else {
      coinTweenRaf = null;
      if (el) el.textContent = String(to);
      displayedCoins = to;
    }
  }
  coinTweenRaf = requestAnimationFrame(step);
}

export function addCoins(n: number, sourceEl: HTMLElement | null): void {
  if (!n) return;
  const state = getState();
  const before = displayedCoins;
  state.coins += n;
  if (state.coins < 0) state.coins = 0;
  if (sourceEl && n > 0) spawnFloatText(sourceEl, `+${n} 💰`, '#f9a825');
  if (sourceEl && n < 0) spawnFloatText(sourceEl, `${n} 💰`, '#b71c1c');
  tweenCoins(before, state.coins);
}

export function addXp(n: number, sourceEl: HTMLElement | null): void {
  if (!n || n <= 0) return;
  const state = getState();
  state.xp += n;
  if (sourceEl) spawnFloatText(sourceEl, `+${n} ⭐`, '#f9a825');
  let didLevel = false;
  while (state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    levelUp();
    didLevel = true;
  }
  if (!didLevel) renderHeader();
  scheduleSave();
}

/**
 * Refresh hooks installed by the game shell at boot. Decouples this module
 * from concrete render imports (which would create import cycles at load
 * time) without paying the dynamic-import code-splitting cost.
 */
const refreshHooks: Array<() => void> = [];

export function registerLevelUpRefresh(fn: () => void): void {
  refreshHooks.push(fn);
}

function levelUp(): void {
  const state = getState();
  state.level += 1;
  spawnConfetti();
  const unlock = LEVEL_UNLOCKS[state.level] ?? 'New goodies await!';
  showToast(`🎉 Level ${state.level}! Unlocked: ${unlock}`);
  renderHeader();
  for (const fn of refreshHooks) fn();
}
