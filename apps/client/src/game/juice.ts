/**
 * Juice — sparkles, float text, confetti, toast, tooltip. Ported from
 * sunny-acres.html. Pure DOM; lives in the client only.
 */

let activeTooltip: HTMLElement | null = null;

export function spawnSparkles(sourceEl: HTMLElement, count: number): void {
  const r = sourceEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    const choices = ['✨', '⭐', '🌟'];
    const pick = choices[Math.floor(Math.random() * choices.length)];
    s.textContent = pick ?? '✨';
    s.style.left = cx - 11 + 'px';
    s.style.top = cy - 11 + 'px';
    document.body.appendChild(s);
    const angle = Math.PI * 2 * (i / count) + Math.random() * 0.6 - 0.3;
    const dist = 36 + Math.random() * 32;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const anim = s.animate(
      [
        { transform: 'translate(0,0) scale(0.6) rotate(0)', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy - 14}px) scale(1.2) rotate(${(Math.random() * 200 - 100).toFixed(0)}deg)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(${dx * 1.1}px, ${dy + 12}px) scale(0.4) rotate(${(Math.random() * 360 - 180).toFixed(0)}deg)`,
          opacity: 0,
        },
      ],
      { duration: 700 + Math.random() * 200, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
    anim.onfinish = () => s.remove();
  }
}

export function spawnFloatText(sourceEl: HTMLElement, text: string, color?: string): void {
  const r = sourceEl.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float-text';
  f.textContent = text;
  f.style.color = color ?? '#558b2f';
  document.body.appendChild(f);
  const fr = f.getBoundingClientRect();
  const startX = r.left + r.width / 2 - fr.width / 2 + (Math.random() * 20 - 10);
  const startY = r.top + 4;
  f.style.left = startX + 'px';
  f.style.top = startY + 'px';
  const anim = f.animate(
    [
      { transform: 'translateY(0) scale(1)', opacity: 1 },
      { transform: 'translateY(-22px) scale(1.12)', opacity: 1, offset: 0.4 },
      { transform: 'translateY(-58px) scale(0.95)', opacity: 0 },
    ],
    { duration: 1100, easing: 'cubic-bezier(.22,.61,.36,1)' },
  );
  anim.onfinish = () => f.remove();
}

export function spawnConfetti(): void {
  const colors = ['#f9a825', '#7cb342', '#90caf9', '#e57373', '#ffab91', '#fff59d', '#ce93d8'];
  for (let i = 0; i < 32; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    const color = colors[Math.floor(Math.random() * colors.length)] ?? '#f9a825';
    c.style.background = color;
    const startX = window.innerWidth / 2 + (Math.random() * 240 - 120);
    const startY = window.innerHeight / 2 - 80;
    c.style.left = startX + 'px';
    c.style.top = startY + 'px';
    c.style.width = 6 + Math.random() * 8 + 'px';
    c.style.height = 10 + Math.random() * 12 + 'px';
    document.body.appendChild(c);
    const dx = (Math.random() * 2 - 1) * 320;
    const dy = 380 + Math.random() * 220;
    const rot = Math.random() * 720 - 360;
    const dur = 1400 + Math.random() * 800;
    const anim = c.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        {
          transform: `translate(${dx * 0.5}px, ${dy * 0.4}px) rotate(${rot * 0.5}deg)`,
          opacity: 1,
          offset: 0.4,
        },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: dur, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
    anim.onfinish = () => c.remove();
  }
}

export function showTooltip(el: HTMLElement, text: string): void {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
  const r = el.getBoundingClientRect();
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.textContent = text;
  document.body.appendChild(tip);
  const tipRect = tip.getBoundingClientRect();
  let left = r.left + r.width / 2 - tipRect.width / 2;
  let top = r.top - tipRect.height - 8;
  left = Math.max(6, Math.min(window.innerWidth - tipRect.width - 6, left));
  if (top < 6) top = r.bottom + 8;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
  activeTooltip = tip;
  setTimeout(() => {
    if (tip.parentNode) tip.remove();
    if (activeTooltip === tip) activeTooltip = null;
  }, 1500);
}

export function showToast(text: string): void {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4100);
}
