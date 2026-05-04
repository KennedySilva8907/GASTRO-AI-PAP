/**
 * Chat Page Entry Point
 * Initializes Matter.js physics and chat message handling
 */

import { foodImages } from '../shared/constants.js';
import { sanitizeHtml } from '../shared/sanitizer.js';
import { handleAsyncError } from '../shared/errors.js';
import { navigateTo, revealPage } from '../shared/transitions.js';
import { initAccountBar } from '../auth/session.js';
import { initPhysics } from './matter-setup.js';
import { initChatHandlers } from './handlers.js';

// Play entry reveal if arriving from home page
revealPage();

/**
 * Initializes back button functionality with transition animation
 */
function initBackButton() {
  const backButton = document.getElementById('back-button');
  if (!backButton) return;

  backButton.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('../index.html', e, { entryAnchor: '#chat-button' });
  });
}

/**
 * Initializes button click animations
 */
function initButtonAnimations() {
  const submitButton = document.getElementById('submit-button');
  const stopButton = document.getElementById('stop-button');
  const clearButton = document.getElementById('clear-button');

  const addButtonAnimation = (button, animationName) => {
    if (!button) return;

    button.addEventListener('click', () => {
      button.style.animation = `${animationName} 0.5s`;
      setTimeout(() => {
        button.style.animation = '';
      }, 500);
    });
  };

  addButtonAnimation(submitButton, 'pulse');
  addButtonAnimation(stopButton, 'rotate');
  addButtonAnimation(clearButton, 'shake');
}

/**
 * Initializes button tooltips
 */
function initTooltips() {
  const controlButtons = document.querySelectorAll('.control-button');

  controlButtons.forEach((button) => {
    let timeoutId;

    button.addEventListener('mouseenter', () => {
      timeoutId = setTimeout(() => {
        button.classList.add('show-tooltip');
      }, 2000);
    });

    button.addEventListener('mouseleave', () => {
      clearTimeout(timeoutId);
      button.classList.remove('show-tooltip');
    });
  });
}

/**
 * Initializes export button with animation
 */
function initExportButton() {
  const exportButton = document.getElementById('export-button');

  exportButton.addEventListener('click', () => {
    exportButton.style.animation = 'bounce 0.5s';
    setTimeout(() => {
      exportButton.style.animation = '';
    }, 500);
  });

  let timeoutId;
  exportButton.addEventListener('mouseenter', () => {
    timeoutId = setTimeout(() => {
      exportButton.classList.add('show-tooltip');
    }, 2000);
  });

  exportButton.addEventListener('mouseleave', () => {
    clearTimeout(timeoutId);
    exportButton.classList.remove('show-tooltip');
  });
}

/**
 * Initializes chat dragging functionality
 * @param {HTMLElement} chatContainer - Chat container element
 * @param {HTMLElement} chatHeader - Chat header element
 */
function initChatDragging(chatContainer, chatHeader) {
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (chatHeader.contains(e.target)) isDragging = true;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      chatContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }

  function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  chatHeader.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);
}

/**
 * Main initialization function
 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    initAccountBar();

    // Initialize Matter.js physics animation
    const foodContainer = document.getElementById('food-container');
    if (foodContainer) {
      initPhysics(foodContainer, foodImages);
    }

    // Gather DOM element references
    const elements = {
      chatForm: document.getElementById('chat-form'),
      chatMessages: document.getElementById('chat-messages'),
      userInput: document.getElementById('user-input'),
      submitButton: document.querySelector('#chat-form button[type="submit"]'),
      stopButton: document.getElementById('stop-button'),
      clearButton: document.getElementById('clear-button'),
      exportButton: document.getElementById('export-button'),
    };

    const chatContainer = document.getElementById('chat-container');
    const chatHeader = document.getElementById('chat-header');

    // Initialize chat handlers
    initChatHandlers(elements, sanitizeHtml);

    // Initialize UI features
    initBackButton();
    initButtonAnimations();
    initTooltips();
    initExportButton();
    initChatDragging(chatContainer, chatHeader);
  } catch (error) {
    handleAsyncError(error, 'Erro ao iniciar o chat. Recarregue a página.');
  }
});
