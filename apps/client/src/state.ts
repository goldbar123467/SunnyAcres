/**
 * Client-side state hub. Holds the live SaveV1 in memory plus a few
 * UI-only fields (display-only coin tween, last save timestamp).
 *
 * The data shape itself lives in `@sunny-acres/shared`; this module just
 * owns the live mutable instance and the debounced saver.
 */

import {
  freshState,
  load,
  makeDebouncedSaver,
  type SaveV1,
  type StorageLike,
} from '@sunny-acres/shared';

let _state: SaveV1 | null = null;

/** Get the storage backend (browser localStorage; can be swapped in tests). */
function getStorage(): StorageLike {
  // localStorage is the browser's standard Storage; it satisfies StorageLike.
  return window.localStorage;
}

const debouncedSave = makeDebouncedSaver(getStorage());

/** Whether a save is present (used by the start screen to pick CTA copy). */
export function hasSave(): boolean {
  try {
    return getStorage().getItem('sunny_acres_v1') !== null;
  } catch {
    return false;
  }
}

/** Load (with silent legacy migration) or create a fresh state. */
export function loadOrCreate(): SaveV1 {
  const loaded = load(getStorage(), Date.now());
  _state = loaded ?? freshState(Date.now());
  return _state;
}

/** Drop the in-memory state so the next call creates a fresh one. */
export function newGame(): SaveV1 {
  _state = freshState(Date.now());
  return _state;
}

/** Get the in-memory state. Throws if not initialized. */
export function getState(): SaveV1 {
  if (!_state) throw new Error('state not initialized — call loadOrCreate()/newGame() first');
  return _state;
}

/** Schedule a save (debounced). */
export function scheduleSave(): void {
  if (!_state) return;
  _state.lastTickAt = Date.now();
  debouncedSave(_state);
}

/** Force an immediate save (used on tab close, visibility change). */
export function flushSave(): void {
  if (!_state) return;
  _state.lastTickAt = Date.now();
  debouncedSave.flush(_state);
}

/** Wipe and reload to start screen. */
export function wipeAndReload(): void {
  try {
    getStorage().removeItem('sunny_acres_v1');
    getStorage().removeItem('sunny_acres_intro_dismissed');
    getStorage().removeItem('farmville_save_v1');
  } catch {
    // ignore
  }
  window.location.reload();
}
