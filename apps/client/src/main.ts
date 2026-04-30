/**
 * Client entry point. Routes between start screen and the game.
 */

import { isIntroDismissed } from '@sunny-acres/shared';
import { hasSave, loadOrCreate, newGame } from './state.js';
import { renderStartScreen, teardownStartScreen } from './startScreen.js';
import { openIntroPopups } from './introPopups.js';
import { bootGame } from './game/shell.js';

function start(): void {
  // Always begin on the start screen.
  renderStartScreen({
    hasSave: hasSave(),
    onPlay: () => {
      teardownStartScreen();
      loadOrCreate();
      const introDone = isIntroDismissed(window.localStorage);
      if (!introDone) {
        openIntroPopups('first-run', () => {
          bootGame();
        });
      } else {
        bootGame();
      }
    },
    onNewGame: () => {
      teardownStartScreen();
      newGame();
      const introDone = isIntroDismissed(window.localStorage);
      if (!introDone) {
        openIntroPopups('first-run', () => {
          bootGame();
        });
      } else {
        bootGame();
      }
    },
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
