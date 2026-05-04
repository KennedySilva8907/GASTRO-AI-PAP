/**
 * GastroAI page transition system.
 * The page zooms into the clicked button and reopens from the destination button.
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

const EXIT_MS = 560;
const ENTER_MS = 620;
const EASING_IN = 'cubic-bezier(0.32, 0, 0.15, 1)';
const EASING_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const BG = [
  'radial-gradient(circle at 24% 18%, rgba(255, 152, 0, 0.24), transparent 34rem)',
  'radial-gradient(circle at 78% 8%, rgba(255, 208, 138, 0.14), transparent 24rem)',
  'linear-gradient(135deg, #0b0907 0%, #130d08 56%, #080706 100%)',
].join(', ');
const EXIT_SCALE = 1.28;
const ENTER_SCALE = 1.08;
const EXIT_PULL = 0.34;
const ENTER_PULL = 0.18;
const PORTAL_SIZE = 96;
const PORTAL_REST_SCALE = 0.18;
const PORTAL_SELECTOR = '[data-gastro-transition-portal="true"]';

function defaultNavigate(url) {
  window.location.href = url;
}

function resetTransitionStyles(doc = document) {
  doc.body.style.pointerEvents = '';
  doc.body.style.clipPath = '';
  doc.body.style.transition = '';
  doc.body.style.transform = '';
  doc.body.style.transformOrigin = '';
  doc.body.style.opacity = '';
  doc.body.style.willChange = '';
  doc.documentElement.style.background = '';
  doc.querySelector(PORTAL_SELECTOR)?.remove();
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

function getPortalScale(center, win = window) {
  return Number(((maxRadius(center.x, center.y, win) * 2) / PORTAL_SIZE).toFixed(3));
}

function getZoomTransform(center, scale, pull, win = window) {
  if (center.y < win.innerHeight * 0.25) {
    return `scale(${scale})`;
  }

  const dx = Math.round((win.innerWidth / 2 - center.x) * pull);
  const dy = Math.round((win.innerHeight / 2 - center.y) * pull);
  return `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
}

function createTransitionPortal(center, doc = document) {
  doc.querySelector(PORTAL_SELECTOR)?.remove();

  const portal = doc.createElement('div');
  portal.dataset.gastroTransitionPortal = 'true';
  Object.assign(portal.style, {
    position: 'fixed',
    left: `${center.x}px`,
    top: `${center.y}px`,
    width: `${PORTAL_SIZE}px`,
    height: `${PORTAL_SIZE}px`,
    zIndex: '2147483647',
    pointerEvents: 'none',
    opacity: '0',
    borderRadius: '36% 44% 42% 38%',
    background: [
      'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.28), transparent 0.85rem)',
      'radial-gradient(circle at 50% 50%, rgba(255, 208, 138, 0.95), rgba(255, 152, 0, 0.96) 34%, rgba(91, 39, 8, 0.98) 72%)',
      'linear-gradient(135deg, #ffb13b, #e65100)',
    ].join(', '),
    boxShadow: [
      '0 0 0 1px rgba(255, 230, 190, 0.35) inset',
      '0 22px 70px rgba(255, 112, 0, 0.34)',
      '0 0 120px rgba(255, 152, 0, 0.22)',
    ].join(', '),
    transform: `translate(-50%, -50%) scale(${PORTAL_REST_SCALE})`,
    transformOrigin: 'center',
    transition: [
      `transform ${EXIT_MS}ms ${EASING_OUT}`,
      `opacity ${EXIT_MS}ms ${EASING_OUT}`,
      `border-radius ${EXIT_MS}ms ${EASING_OUT}`,
    ].join(', '),
    willChange: 'transform, opacity, border-radius',
  });
  doc.body.appendChild(portal);
  return portal;
}

/**
 * Navigate by zooming into the clicked button.
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

  writeTransitionState({
    entryAnchor: options.entryAnchor ?? null,
    origin,
  });

  document.body.style.pointerEvents = 'none';
  document.documentElement.style.background = BG;
  document.body.style.willChange = 'transform, opacity';
  document.body.style.transformOrigin = `${origin.x}px ${origin.y}px`;
  document.body.style.transition = 'none';
  document.body.style.transform = 'scale(1)';
  document.body.style.opacity = '1';
  const portal = createTransitionPortal(origin);
  void document.body.offsetHeight;

  portal.style.opacity = '1';
  portal.style.borderRadius = '50%';
  portal.style.transform = `translate(-50%, -50%) scale(${getPortalScale(origin)})`;
  document.body.style.transition = [
    `transform ${EXIT_MS}ms ${EASING_IN}`,
    `opacity ${EXIT_MS}ms ${EASING_IN}`,
  ].join(', ');
  document.body.style.transform = getZoomTransform(origin, EXIT_SCALE, EXIT_PULL);
  document.body.style.opacity = '0.38';

  const navTimeout = setTimeout(() => {
    navigate(url);
  }, EXIT_MS);

  setTimeout(() => {
    resetTransitionStyles();
    clearTimeout(navTimeout);
  }, 2500);
}

/**
 * Reveal the page by shrinking the portal back into the destination button.
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

  document.documentElement.style.background = BG;
  document.body.style.pointerEvents = 'none';
  document.body.style.willChange = 'transform, opacity';
  document.body.style.transformOrigin = `${anchor.x}px ${anchor.y}px`;
  document.body.style.transition = 'none';
  document.body.style.transform = getZoomTransform(anchor, ENTER_SCALE, ENTER_PULL);
  document.body.style.opacity = '0';
  const portal = createTransitionPortal(anchor);
  portal.style.opacity = '1';
  portal.style.borderRadius = '50%';
  portal.style.transform = `translate(-50%, -50%) scale(${getPortalScale(anchor)})`;
  void document.body.offsetHeight;

  portal.style.opacity = '0';
  portal.style.borderRadius = '36% 44% 42% 38%';
  portal.style.transform = `translate(-50%, -50%) scale(${PORTAL_REST_SCALE})`;
  document.body.style.transition = [
    `transform ${ENTER_MS}ms ${EASING_OUT}`,
    `opacity ${ENTER_MS}ms ${EASING_OUT}`,
  ].join(', ');
  document.body.style.transform = 'scale(1)';
  document.body.style.opacity = '1';

  setTimeout(() => {
    resetTransitionStyles();
  }, ENTER_MS + 50);
}
