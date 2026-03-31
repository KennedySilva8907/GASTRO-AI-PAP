/**
 * Recipes page entry point.
 * Boots the cinematic recipes experience (stage, panel, responsive helpers).
 */

import { RecipesExperience } from './carousel.js';
import { navigateTo, revealPage } from '../shared/transitions.js';

// Play entry reveal if arriving from home page
revealPage();

/**
 * Initialize recipes page (stage + floating panel + responsive helpers).
 * ES6 modules are deferred by default, so DOM is ready when this runs.
 */
try {
  new RecipesExperience(document).init();

  // Initialize mobile optimizations
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    document.documentElement.style.webkitOverflowScrolling = 'touch';
  }

  // Performance optimization: disable animations during resize
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');

    let resizeTimer;
    window.addEventListener('resize', () => {
      document.body.classList.add('resize-animation-stopper');
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.body.classList.remove('resize-animation-stopper');
      }, 400);
    });
  });

  // Back button functionality with transition
  document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('back-button');
    if (backButton) {
      backButton.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('../index.html', e, { entryAnchor: '#recipes-button' });
      });
    }
  });
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('[Recipes] Failed to initialize:', error);
}
