/**
 * Home page entry point — GastroAI landing page.
 * Handles navigation transitions, AI info modal, food animations, and mouse effects.
 */
import { foodImages } from './shared/constants.js';
import { createFoodElement, createFoodParticles } from './shared/animations.js';

/**
 * Disable all navigation buttons during page transitions.
 * Prevents double-clicks during loading animation.
 */
function disableAllButtons() {
  const buttons = [
    document.getElementById('chat-button'),
    document.getElementById('recipes-button'),
    document.getElementById('desafio-button'),
    document.getElementById('ai-button'),
  ];

  buttons.forEach((button) => {
    if (button) {
      button.disabled = true;
      button.style.pointerEvents = 'none';
    }
  });
}

/**
 * Manage the animated page transition to a target URL.
 * Shows food icon loading animation for 4 seconds, then navigates.
 * @param {string} targetUrl - URL to navigate to after transition
 */
function handlePageTransition(targetUrl) {
  const transitionOverlay = document.getElementById('transition-overlay');

  disableAllButtons();
  sessionStorage.setItem('pageTransition', 'forward');

  transitionOverlay.classList.add('slide-in-right');

  setTimeout(() => {
    window.location.href = targetUrl;
  }, 320);
}

/**
 * Initialize the mouse food trail effect.
 * Creates food images that follow the cursor with a throttle.
 */
function initFoodTrail() {
  let canCreateSpark = true;

  document.addEventListener('mousemove', (e) => {
    if (canCreateSpark) {
      const foodSpark = document.createElement('div');
      foodSpark.classList.add('food-spark');
      document.body.appendChild(foodSpark);

      const randomImage = foodImages[Math.floor(Math.random() * foodImages.length)];
      foodSpark.style.backgroundImage = `url('${randomImage}')`;
      foodSpark.style.left = `${e.pageX - 15}px`;
      foodSpark.style.top = `${e.pageY - 15}px`;

      setTimeout(() => foodSpark.remove(), 1000);

      canCreateSpark = false;
      setTimeout(() => { canCreateSpark = true; }, 200);
    }
  });
}

/**
 * Initialize the spark trail effect on mouse movement.
 */
function initSparkTrail() {
  document.addEventListener('mousemove', (e) => {
    const spark = document.createElement('div');
    spark.classList.add('spark');
    document.body.appendChild(spark);

    spark.style.left = `${e.pageX}px`;
    spark.style.top = `${e.pageY}px`;

    setTimeout(() => spark.remove(), 700);
  });
}

// ===== INITIALIZATION =====

// Create food movement container and start animation
const foodMovement = document.createElement('div');
foodMovement.classList.add('food-movement');
document.body.appendChild(foodMovement);
createFoodElement(foodMovement);

// Initialize mouse effects
initFoodTrail();
initSparkTrail();

// DOMContentLoaded — set up navigation and AI info modal
document.addEventListener('DOMContentLoaded', () => {
  // Dynamic copyright year
  const yearEl = document.getElementById('copyright-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Enter animation when returning from sub-page
  const transitionOverlay = document.getElementById('transition-overlay');
  if (transitionOverlay && sessionStorage.getItem('pageTransition') === 'back') {
    sessionStorage.removeItem('pageTransition');
    transitionOverlay.classList.add('slide-out-right');
  }

  // AI info button and panel
  const aiButton = document.getElementById('ai-button');
  const aiInfo = document.getElementById('ai-info');

  if (aiButton && aiInfo) {
    aiButton.addEventListener('click', (e) => {
      aiInfo.classList.toggle('show');
      createFoodParticles(e);
    });

    document.addEventListener('click', (event) => {
      if (!aiButton.contains(event.target) && !aiInfo.contains(event.target)) {
        aiInfo.classList.remove('show');
      }
    });
  }

  // Navigation buttons
  const chatButton = document.getElementById('chat-button');
  const recipesButton = document.getElementById('recipes-button');
  const desafioButton = document.getElementById('desafio-button');

  if (chatButton) {
    chatButton.addEventListener('click', (e) => {
      e.preventDefault();
      handlePageTransition('chat/chatbot.html');
    });
  }

  if (recipesButton) {
    recipesButton.addEventListener('click', (e) => {
      e.preventDefault();
      handlePageTransition('recipes/receitas.html');
    });
  }

  if (desafioButton) {
    desafioButton.addEventListener('click', (e) => {
      e.preventDefault();
      handlePageTransition('challenges/desafio.html');
    });
  }

  // Logo letter animation delays
  const spans = document.querySelectorAll('.logo span');
  const numLetters = spans.length;

  spans.forEach((span, i) => {
    const mappedIndex = i - numLetters / 2;
    span.style.animationDelay = `${mappedIndex * 0.25}s`;
  });
});
