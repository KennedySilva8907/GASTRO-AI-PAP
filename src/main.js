/**
 * Home page entry point — GastroAI landing page.
 * Handles navigation transitions, AI info modal, food animations, and mouse effects.
 */
import { createFoodParticles } from './shared/animations.js';
import { navigateTo, revealPage } from './shared/transitions.js';
import { initAccountBar } from './auth/session.js';
import { startHomeVideo } from './home-video.js';
import { initTitleRepel } from './home-title.js';
import { initEmbers } from './home-embers.js';

// Play entry reveal if arriving from a sub-page
revealPage();

// ===== INITIALIZATION =====

window.addEventListener('load', () => {
  startHomeVideo(document.querySelector('.home-video__media'));
});

initTitleRepel(document.querySelector('.container'));
initEmbers();

// DOMContentLoaded — set up navigation and AI info modal
document.addEventListener('DOMContentLoaded', () => {
  initAccountBar();

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
      navigateTo('chat/chatbot.html', e, { entryAnchor: '#back-button' });
    });
  }

  if (recipesButton) {
    recipesButton.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('recipes/receitas.html', e, { entryAnchor: '#back-button' });
    });
  }

  if (desafioButton) {
    desafioButton.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('challenges/desafio.html', e, { entryAnchor: '#back-button' });
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
