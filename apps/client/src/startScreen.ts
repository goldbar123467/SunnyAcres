/**
 * Start screen — title, pitch, countdown placeholder, Play / Continue / New
 * game CTAs, How to play CTA, footer.
 */

import { openIntroPopups } from './introPopups.js';
import { getAppVersion } from './version.js';

export function renderStartScreen(opts: {
  hasSave: boolean;
  onPlay: () => void;
  onNewGame: () => void;
}): void {
  document.body.classList.add('start-screen-mode');
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="sun" aria-hidden="true">☀️</div>
    <main class="start-screen">
      <h1 class="start-title">Sunny Acres</h1>
      <p class="start-pitch">Farm. Trade. Win the season.</p>
      <div class="start-countdown">Next season reset: TBD</div>
      <div class="start-ctas">
        <div class="start-cta-row">
          ${
            opts.hasSave
              ? `<button class="btn cta-primary" id="cta-continue">Continue</button>
                 <button class="btn cta-secondary" id="cta-new">New game</button>`
              : `<button class="btn cta-primary" id="cta-play">Play</button>`
          }
        </div>
        <div class="start-cta-row">
          <button class="btn cta-secondary" id="cta-howto">How to play</button>
        </div>
      </div>
    </main>
    <footer class="start-footer">
      <span>v${getAppVersion()}</span>
      <a id="footer-rules" href="#">Rules</a>
      <span class="start-server-status" title="Server status (Phase 5)">Offline</span>
    </footer>
  `;

  document.getElementById('cta-play')?.addEventListener('click', opts.onPlay);
  document.getElementById('cta-continue')?.addEventListener('click', opts.onPlay);
  document.getElementById('cta-new')?.addEventListener('click', () => {
    if (confirm('Start a brand-new game? Your save will be replaced when you start playing.')) {
      opts.onNewGame();
    }
  });
  document.getElementById('cta-howto')?.addEventListener('click', () => {
    openIntroPopups('review');
  });
  document.getElementById('footer-rules')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Placeholder; static rules page lands in Phase 5.
  });
}

export function teardownStartScreen(): void {
  document.body.classList.remove('start-screen-mode');
}
