/**
 * Recipes page entry point.
 * Initializes recipe data from DOM and sets up vertical carousel.
 */

import { VerticalCarousel, ResponsiveModalHandler } from './carousel.js';

/**
 * Load recipe data from DOM elements.
 * Recipe content is embedded in HTML via hidden elements.
 * @returns {Object} Recipe data object
 */
function loadRecipeData() {
  return {
    bacalhau_a_bras: {
      title: 'Bacalhau à Brás',
      content: document.getElementById('recipe-bacalhau_a_bras').innerHTML,
    },
    feijoada: {
      title: 'Feijoada',
      content: document.getElementById('recipe-feijoada').innerHTML,
    },
    carbonara: {
      title: 'Spaghetti alla Carbonara',
      content: document.getElementById('recipe-carbonara').innerHTML,
    },
    ramen: {
      title: 'Ramen Tonkotsu',
      content: document.getElementById('recipe-ramen').innerHTML,
    },
    coq_au_vin: {
      title: 'Coq au Vin',
      content: document.getElementById('recipe-coq_au_vin').innerHTML,
    },
    brisket: {
      title: 'Texas Brisket BBQ',
      content: document.getElementById('recipe-brisket').innerHTML,
    },
    mole_poblano: {
      title: 'Mole Poblano',
      content: document.getElementById('recipe-mole_poblano').innerHTML,
    },
    mapo_tofu: {
      title: 'Mapo Tofu',
      content: document.getElementById('recipe-mapo_tofu').innerHTML,
    },
    butter_chicken: {
      title: 'Butter Chicken',
      content: document.getElementById('recipe-butter_chicken').innerHTML,
    },
    moussaka: {
      title: 'Moussaka',
      content: document.getElementById('recipe-moussaka').innerHTML,
    },
  };
}

/**
 * Initialize carousel when DOM is ready.
 * ES6 modules are deferred by default, so DOM is ready when this runs.
 */
try {
  const recipes = loadRecipeData();
  new VerticalCarousel({}, recipes);
  new ResponsiveModalHandler();

  // Initialize mobile optimizations
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
    }
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
    const transitionOverlay = document.getElementById('transition-overlay');
    const foodIcons = document.querySelectorAll('.food-icon');

    if (backButton && transitionOverlay) {
      backButton.addEventListener('click', (e) => {
        e.preventDefault();
        transitionOverlay.classList.add('active');

        let currentIcon = 0;
        const animationInterval = setInterval(() => {
          foodIcons[currentIcon].classList.add('active');

          setTimeout(() => {
            foodIcons[currentIcon].classList.remove('active');
            currentIcon = (currentIcon + 1) % foodIcons.length;
          }, 400);
        }, 500);

        setTimeout(() => {
          clearInterval(animationInterval);
          document.body.style.animation = 'close-transition 1s ease-in-out forwards';

          setTimeout(() => {
            window.location.href = '../index.html';
          }, 1000);
        }, 4000);
      });
    }
  });
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('[Recipes] Failed to initialize:', error);
}
