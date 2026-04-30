/**
 * 4-step intro popup sequence.
 *
 * Copy from phase1.md §6 (option (a) — MP-flavored). The open decision on
 * intro-popup copy remains open: a human reviewer can override by editing
 * this file and the doc.
 *
 * Modes:
 *   - 'first-run': writes `sunny_acres_intro_dismissed=true` on Done or Skip.
 *   - 'review':    no localStorage write (How to play / Replay intro).
 */

import { markIntroDismissed } from '@sunny-acres/shared';

interface IntroStep {
  thumb: string;
  title: string;
  body: string;
}

const STEPS: readonly IntroStep[] = Object.freeze([
  Object.freeze({
    thumb: '🔄',
    title: 'Reset cadence',
    body: 'The world resets every 14 days at 00:00 UTC. At each reset you\'re reshuffled into a new room with 7 other players.',
  }),
  Object.freeze({
    thumb: '🌾',
    title: 'Production loop',
    body: 'Your farm produces goods — crops, eggs, bread. Goods are how you make money.',
  }),
  Object.freeze({
    thumb: '🏆',
    title: 'The win',
    body: 'Highest net worth on day 14 wins the season. Random events will move prices along the way.',
  }),
  Object.freeze({
    thumb: '🔒',
    title: 'Inputs and escrow',
    body: 'You start with seeds, feed, and a little cash. When you place an order, your cash or inventory is held until it fills or you cancel.',
  }),
]);

export type IntroMode = 'first-run' | 'review';

export function openIntroPopups(mode: IntroMode, onClose?: () => void): void {
  let stepIdx = 0;
  let backdrop: HTMLElement | null = null;

  function dismiss(persist: boolean): void {
    if (persist && mode === 'first-run') {
      markIntroDismissed(window.localStorage);
    }
    if (backdrop) {
      backdrop.remove();
      backdrop = null;
    }
    if (onClose) onClose();
  }

  function render(): void {
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.id = 'intro-modal';
      document.body.appendChild(backdrop);
    }
    backdrop.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal intro-modal';
    modal.style.position = 'relative';
    const step = STEPS[stepIdx];
    if (!step) return;
    const isLast = stepIdx === STEPS.length - 1;
    const dots = STEPS.map(
      (_, i) => `<span class="intro-dot ${i === stepIdx ? 'active' : ''}"></span>`,
    ).join('');
    modal.innerHTML = `
      <button class="intro-skip" id="intro-skip" aria-label="${mode === 'first-run' ? 'Skip intro' : 'Close'}">✕</button>
      <div class="intro-thumb" aria-hidden="true">${step.thumb}</div>
      <div class="intro-step-title">${step.title}</div>
      <div class="intro-step-body">${step.body}</div>
      <div class="intro-progress">${dots}</div>
      <div class="intro-footer">
        <button class="btn" id="intro-back" ${stepIdx === 0 ? 'disabled' : ''}>Back</button>
        <button class="btn primary" id="intro-next">${isLast ? 'Done' : 'Next'}</button>
      </div>
    `;
    backdrop.appendChild(modal);
    modal.querySelector<HTMLButtonElement>('#intro-skip')?.addEventListener('click', () => {
      // Skip in first-run = dismissal write. Skip/✕ in review = no write.
      dismiss(mode === 'first-run');
    });
    modal.querySelector<HTMLButtonElement>('#intro-back')?.addEventListener('click', () => {
      if (stepIdx > 0) {
        stepIdx -= 1;
        render();
      }
    });
    modal.querySelector<HTMLButtonElement>('#intro-next')?.addEventListener('click', () => {
      if (isLast) {
        // Done = first-run dismissal write; review = silent close.
        dismiss(mode === 'first-run');
      } else {
        stepIdx += 1;
        render();
      }
    });
  }

  render();
}
