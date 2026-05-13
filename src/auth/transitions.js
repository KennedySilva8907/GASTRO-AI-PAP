/**
 * Smooth fade-out → navigate transitions between auth pages.
 * Any anchor tagged with `data-auth-link` triggers the leaving animation
 * before navigating, so the user perceives a continuous flow.
 */

const LEAVING_CLASS = 'auth-leaving';
const ANIMATION_MS = 260;
// .auth-submit handles its own click animation (Maître seal) — exclude from ripple
const RIPPLE_SELECTOR = '.auth-google, .account-action, .back-button[data-auth-link]';
const SEAL_SELECTOR = '.auth-submit';

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function navigateWithFade(href) {
  if (prefersReducedMotion()) {
    window.location.href = href;
    return;
  }

  document.body.classList.add(LEAVING_CLASS);
  setTimeout(() => {
    window.location.href = href;
  }, ANIMATION_MS);
}

function init() {
  const links = document.querySelectorAll('a[data-auth-link]');
  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      // Allow modifier-key opens (new tab/window) to bypass animation
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      e.preventDefault();
      navigateWithFade(href);
    });
  });

  document.querySelectorAll(RIPPLE_SELECTOR).forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (button.disabled) return;
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'auth-click-orb';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      button.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  });

  // Maître seal — single, isolated click animation on auth-submit
  document.querySelectorAll(SEAL_SELECTOR).forEach((button) => {
    button.addEventListener('pointerdown', () => {
      if (button.disabled) return;
      button.classList.remove('is-clicked');
      void button.offsetWidth;
      button.classList.add('is-clicked');
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
