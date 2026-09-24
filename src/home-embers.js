import { prefersReducedMotion } from './shared/transitions.js';

const PER_MOVE = 3;
const MAX_EMBERS = 300;

export function spawnEmbers(x, y, random = Math.random) {
  return Array.from({ length: PER_MOVE }, () => ({
    x: x + (random() - 0.5) * 8,
    y: y + (random() - 0.5) * 8,
    vx: (random() - 0.5) * 80,
    vy: -50 - random() * 90,
    life: 0,
    max: 0.6 + random() * 0.6,
    size: 1.2 + random() * 2,
    flicker: random() * 6,
  }));
}

export function stepEmber(ember, dt) {
  ember.life += dt;
  if (ember.life >= ember.max) return false;

  ember.vx *= 0.98;
  ember.vy -= 20 * dt;
  ember.x += ember.vx * dt;
  ember.y += ember.vy * dt;
  return true;
}

export function initEmbers(doc = document, win = window) {
  if (prefersReducedMotion(win)) return false;
  if (!win.matchMedia?.('(pointer: fine)')?.matches) return false;

  const canvas = doc.createElement('canvas');
  canvas.className = 'embers';
  canvas.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const embers = [];
  let running = false;
  let last = 0;

  function resize() {
    const ratio = Math.min(2, win.devicePixelRatio || 1);
    canvas.width = win.innerWidth * ratio;
    canvas.height = win.innerHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, win.innerWidth, win.innerHeight);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = embers.length - 1; i >= 0; i--) {
      const ember = embers[i];
      if (!stepEmber(ember, dt)) {
        embers.splice(i, 1);
        continue;
      }

      const age = ember.life / ember.max;
      const alpha = (1 - age) * (0.6 + 0.4 * Math.sin(now / 40 + ember.flicker));
      const radius = ember.size * (1 - age * 0.5) * 4;
      const x = ember.x + Math.sin(now / 90 + ember.flicker) * 1.5;
      const glow = ctx.createRadialGradient(x, ember.y, 0, x, ember.y, radius);
      glow.addColorStop(0, `rgba(255, 244, 214, ${alpha})`);
      glow.addColorStop(0.25, `rgba(255, 170, 40, ${alpha * 0.9})`);
      glow.addColorStop(1, 'rgba(255, 90, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, ember.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (embers.length) {
      win.requestAnimationFrame(frame);
      return;
    }
    running = false;
  }

  resize();
  win.addEventListener('resize', resize);
  win.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || embers.length > MAX_EMBERS) return;
    embers.push(...spawnEmbers(event.clientX, event.clientY));
    if (running) return;
    running = true;
    last = win.performance?.now() ?? 0;
    win.requestAnimationFrame(frame);
  });

  return true;
}
