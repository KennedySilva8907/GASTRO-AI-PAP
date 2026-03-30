/**
 * GastroAI page transition system.
 * The page collapses into the clicked button and expands from the destination button.
 */

export const TRANSITION_SESSION_KEY = 'gastro-transition-meta';

export function prefersReducedMotion(win = window) {
  return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

export function writeTransitionState(state, storage = sessionStorage) {
  storage.setItem(TRANSITION_SESSION_KEY, JSON.stringify(state));
}

export function readTransitionState(storage = sessionStorage) {
  const raw = storage.getItem(TRANSITION_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    storage.removeItem(TRANSITION_SESSION_KEY);
    return null;
  }
}

export function clearTransitionState(storage = sessionStorage) {
  storage.removeItem(TRANSITION_SESSION_KEY);
}

export function getAnchorCenter(selector, doc = document, win = window) {
  const anchor = selector ? doc.querySelector(selector) : null;

  if (!anchor) {
    return {
      x: Math.round(win.innerWidth / 2),
      y: Math.round(win.innerHeight / 2),
    };
  }

  const rect = anchor.getBoundingClientRect();
  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
}

export function maxRadius(x, y, win = window) {
  return Math.ceil(
    Math.hypot(Math.max(x, win.innerWidth - x), Math.max(y, win.innerHeight - y)),
  ) + 40;
}

const EXIT_MS = 880;
const ENTER_MS = 780;
const EASING_IN = 'cubic-bezier(0.32, 0, 0.15, 1)';
const EASING_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const BG = 'linear-gradient(135deg, #ff9800 0%, #f57c00 45%, #e65100 100%)';

function defaultNavigate(url) {
  window.location.href = url;
}

function resetTransitionStyles(doc = document) {
  doc.body.style.pointerEvents = '';
  doc.body.style.clipPath = '';
  doc.body.style.transition = '';
  doc.body.style.transform = '';
  doc.body.style.filter = '';
  doc.body.style.opacity = '';
  doc.documentElement.style.background = '';
}

function getEventCenter(event, win = window) {
  if (!event?.currentTarget) {
    return {
      x: Math.round(win.innerWidth / 2),
      y: Math.round(win.innerHeight / 2),
    };
  }

  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
}

/**
 * Navigate with a "collapse into button" effect.
 * @param {string} url - destination URL
 * @param {Event} [event] - click event for origin position
 * @param {Object} [options] - transition options
 * @param {string} [options.entryAnchor] - selector to reveal from on the next page
 * @param {(url: string) => void} [options.navigate] - testable navigation override
 */
export function navigateTo(url, event, options = {}) {
  if (prefersReducedMotion()) {
    clearTransitionState();
    resetTransitionStyles();
    (options.navigate ?? defaultNavigate)(url);
    return;
  }

  const navigate = options.navigate ?? defaultNavigate;
  const origin = getEventCenter(event);
  const radius = maxRadius(origin.x, origin.y);

  writeTransitionState({
    entryAnchor: options.entryAnchor ?? null,
    origin,
  });

  document.body.style.pointerEvents = 'none';
  document.documentElement.style.background = BG;
  document.body.style.transition = 'none';
  document.body.style.clipPath = `circle(${radius}px at ${origin.x}px ${origin.y}px)`;
  document.body.style.transform = 'scale(1)';
  document.body.style.filter = 'blur(0px)';
  document.body.style.opacity = '1';
  void document.body.offsetHeight;

  document.body.style.transition = [
    `clip-path ${EXIT_MS}ms ${EASING_IN}`,
    `transform ${EXIT_MS}ms ${EASING_IN}`,
    `filter ${EXIT_MS}ms ${EASING_IN}`,
    `opacity ${EXIT_MS}ms ${EASING_IN}`,
  ].join(', ');
  document.body.style.clipPath = `circle(0px at ${origin.x}px ${origin.y}px)`;
  document.body.style.transform = 'scale(0.965)';
  document.body.style.filter = 'blur(8px)';
  document.body.style.opacity = '0.84';

  const navTimeout = setTimeout(() => {
    navigate(url);
  }, EXIT_MS);

  setTimeout(() => {
    resetTransitionStyles();
    clearTimeout(navTimeout);
  }, 2500);
}

/**
 * Reveal the page by expanding outward from the destination button.
 */
export function revealPage() {
  const hadPreloadClass = document.documentElement.classList.contains('page-entering');
  const state = readTransitionState();
  if (!state) {
    if (hadPreloadClass) {
      document.documentElement.classList.remove('page-entering');
      resetTransitionStyles();
    }
    return;
  }

  clearTransitionState();
  document.documentElement.classList.remove('page-entering');

  if (prefersReducedMotion()) {
    resetTransitionStyles();
    return;
  }

  const anchor = getAnchorCenter(state.entryAnchor);
  const radius = maxRadius(anchor.x, anchor.y);

  document.documentElement.style.background = BG;
  document.body.style.pointerEvents = 'none';
  document.body.style.transition = 'none';
  document.body.style.clipPath = `circle(0px at ${anchor.x}px ${anchor.y}px)`;
  document.body.style.transform = 'scale(0.965)';
  document.body.style.filter = 'blur(8px)';
  document.body.style.opacity = '0.84';
  void document.body.offsetHeight;

  document.body.style.transition = [
    `clip-path ${ENTER_MS}ms ${EASING_OUT}`,
    `transform ${ENTER_MS}ms ${EASING_OUT}`,
    `filter ${ENTER_MS}ms ${EASING_OUT}`,
    `opacity ${ENTER_MS}ms ${EASING_OUT}`,
  ].join(', ');
  document.body.style.clipPath = `circle(${radius}px at ${anchor.x}px ${anchor.y}px)`;
  document.body.style.transform = 'scale(1)';
  document.body.style.filter = 'blur(0px)';
  document.body.style.opacity = '1';

  setTimeout(() => {
    resetTransitionStyles();
  }, ENTER_MS + 50);
}
