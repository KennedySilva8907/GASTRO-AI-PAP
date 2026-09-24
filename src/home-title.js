import { prefersReducedMotion } from './shared/transitions.js';

const REACH = 160;
const PUSH = 58;
const SPRING = 0.16;
const DAMPING = 0.74;
const TAP_PUSH = 38;
const HOVER_MARGIN = 30;

export function repelOffset(dx, dy) {
  const distance = Math.hypot(dx, dy);
  const strength = Math.max(0, 1 - distance / REACH) ** 2 * PUSH;
  if (strength === 0) return { x: 0, y: 0 };

  const [ux, uy] = distance < 14 ? [dx >= 0 ? 1 : -1, -0.8] : [dx, dy];
  const length = Math.hypot(ux, uy);
  return { x: (ux / length) * strength, y: (uy / length) * strength };
}

export function initTitleRepel(container, win = window) {
  if (!container || prefersReducedMotion(win)) return false;

  const letters = [...container.querySelectorAll('.logo-letter')];
  if (!letters.length) return false;

  const springs = letters.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  const pointer = { x: 0, y: 0, inside: false };
  let running = false;

  function restingCentre(letter, spring) {
    const box = letter.getBoundingClientRect();
    return { x: box.left + box.width / 2 - spring.x, y: box.top + box.height / 2 - spring.y };
  }

  function frame() {
    let moving = false;

    letters.forEach((letter, i) => {
      const spring = springs[i];
      let target = { x: 0, y: 0 };
      if (pointer.inside) {
        const centre = restingCentre(letter, spring);
        target = repelOffset(centre.x - pointer.x, centre.y - pointer.y);
      }

      spring.vx = (spring.vx + (target.x - spring.x) * SPRING) * DAMPING;
      spring.vy = (spring.vy + (target.y - spring.y) * SPRING) * DAMPING;
      spring.x += spring.vx;
      spring.y += spring.vy;
      if (
        Math.abs(spring.x) + Math.abs(spring.y) + Math.abs(spring.vx) + Math.abs(spring.vy) >
        0.05
      ) {
        moving = true;
      }

      letter.style.transform = `translate(${spring.x.toFixed(2)}px, ${spring.y.toFixed(2)}px) rotate(${(spring.x * 0.35).toFixed(2)}deg)`;
    });

    if (moving || pointer.inside) {
      win.requestAnimationFrame(frame);
      return;
    }

    running = false;
    letters.forEach((letter, i) => {
      letter.style.transform = '';
      Object.assign(springs[i], { x: 0, y: 0, vx: 0, vy: 0 });
    });
  }

  function wake() {
    if (running) return;
    running = true;
    win.requestAnimationFrame(frame);
  }

  win.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const box = container.getBoundingClientRect();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.inside =
      event.clientX >= box.left - HOVER_MARGIN &&
      event.clientX <= box.right + HOVER_MARGIN &&
      event.clientY >= box.top - HOVER_MARGIN &&
      event.clientY <= box.bottom + HOVER_MARGIN;
    if (pointer.inside) wake();
  });

  container.ownerDocument.documentElement.addEventListener('mouseleave', () => {
    pointer.inside = false;
  });

  container.addEventListener('pointerdown', (event) => {
    letters.forEach((letter, i) => {
      const centre = restingCentre(letter, springs[i]);
      const dx = centre.x - event.clientX;
      const dy = centre.y - event.clientY;
      const distance = Math.hypot(dx, dy) || 1;
      springs[i].vx += (dx / distance) * TAP_PUSH;
      springs[i].vy += (dy / distance) * TAP_PUSH - 10;
    });
    wake();
  });

  return true;
}
