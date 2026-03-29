/**
 * UI rendering functions for challenges page.
 * Handles recipe display, overlays, loading states, and timer UI.
 */

/**
 * Shows the loading overlay with animation.
 */
export function showLoadingOverlay() {
  const existingOverlay = document.querySelector('.loading-overlay');
  if (existingOverlay) {
    existingOverlay.classList.add('loading-overlay--active');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay loading-overlay--active';

  const loadingText = document.createElement('span');
  loadingText.textContent = 'A carregar a sua receita';

  const dots = document.createElement('span');
  dots.className = 'dots';
  dots.textContent = '...';

  overlay.appendChild(loadingText);
  overlay.appendChild(dots);
  document.body.appendChild(overlay);

  let dotsCount = 0;
  const dotsInterval = setInterval(() => {
    const dotsElement = overlay.querySelector('.dots');
    if (!dotsElement) {
      clearInterval(dotsInterval);
      return;
    }
    dotsCount = (dotsCount + 1) % 4;
    dotsElement.textContent = '.'.repeat(dotsCount);
  }, 500);

  overlay.dataset.dotsInterval = dotsInterval;
}

/**
 * Hides the loading overlay.
 */
export function hideLoadingOverlay() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) {
    if (overlay.dataset.dotsInterval) {
      clearInterval(parseInt(overlay.dataset.dotsInterval));
    }
    overlay.classList.remove('loading-overlay--active');
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
  }
}

/**
 * Displays ingredient list with category support.
 * @param {Object} recipe - Recipe object with ingredients array
 * @returns {HTMLElement} Formatted ingredients list
 */
export function displayIngredients(recipe) {
  const ingredientsList = document.createElement('ul');
  ingredientsList.className = 'ingredients-list';

  if (Array.isArray(recipe.ingredients)) {
    recipe.ingredients.forEach((ingredient) => {
      if (ingredient?.trim()) {
        if (ingredient.startsWith('__CATEGORY__')) {
          const categoryName = ingredient.replace('__CATEGORY__', '').trim();
          const categoryItem = document.createElement('li');
          categoryItem.className = 'ingredient-category';
          categoryItem.style.fontWeight = 'bold';
          categoryItem.style.fontSize = '1.1em';
          categoryItem.style.color = '#333';
          categoryItem.style.listStyleType = 'none';
          categoryItem.style.marginTop = '20px';
          categoryItem.style.marginBottom = '10px';
          categoryItem.textContent = categoryName;
          ingredientsList.appendChild(categoryItem);
        } else {
          const item = document.createElement('li');
          item.style.marginLeft = '20px';
          item.style.marginBottom = '5px';
          item.textContent = ingredient.trim();
          ingredientsList.appendChild(item);
        }
      }
    });
  }

  return ingredientsList;
}

/**
 * Displays instructions list with time highlighting.
 * @param {Array} instructions - Array of instruction strings
 * @returns {HTMLElement} Formatted instructions list
 */
export function displayInstructions(instructions) {
  const instructionsList = document.createElement('ol');
  instructionsList.className = 'instructions-list';

  const processedInstructions = Array.isArray(instructions) ? instructions : [instructions];

  processedInstructions.forEach((instruction) => {
    if (instruction?.trim()) {
      const item = document.createElement('li');
      const timeMatch = instruction.match(/\((\d+)[\s]*(minutos?|mins?|m)\)/i);

      if (timeMatch) {
        const textPart = instruction.replace(/\(\d+[\s]*(minutos?|mins?|m)\)/i, '').trim();
        const timePart = timeMatch[0];

        const textSpan = document.createElement('span');
        textSpan.textContent = textPart + ' ';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'instruction-time';
        timeSpan.textContent = timePart;
        timeSpan.style.fontSize = '0.9em';
        timeSpan.style.color = '#ff6d00';
        timeSpan.style.fontWeight = 'bold';

        item.appendChild(textSpan);
        item.appendChild(timeSpan);
      } else {
        item.textContent = instruction.trim();
      }

      instructionsList.appendChild(item);
    }
  });

  return instructionsList;
}

/**
 * Displays chef tips list.
 * @param {Array} tips - Array of tip strings
 * @returns {HTMLElement} Formatted tips list
 */
export function displayTips(tips) {
  const tipsList = document.createElement('ul');
  tipsList.className = 'tips-list';

  const processedTips = Array.isArray(tips) ? tips : [tips];

  processedTips.forEach((tip) => {
    if (tip?.trim()) {
      const item = document.createElement('li');
      item.className = 'tip-item';
      item.textContent = tip.trim();
      tipsList.appendChild(item);
    }
  });

  return tipsList;
}

/**
 * Updates timer display with formatted time.
 * @param {number} minutes - Minutes remaining
 * @param {number} seconds - Seconds remaining
 * @param {HTMLElement} element - Timer display element
 */
export function updateTimerDisplay(minutes, seconds, element) {
  if (!element) return;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    element.textContent = `${hours}:${mins < 10 ? '0' : ''}${mins}:${seconds < 10 ? '0' : ''}${seconds}`;
  } else {
    element.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  if (minutes < 5) {
    element.classList.add('timer--warning');
  }
  if (minutes < 2) {
    element.classList.add('timer--danger');
  }
}

/**
 * Updates progress bar width and color.
 * @param {number} progress - Progress percentage (0-100)
 * @param {HTMLElement} element - Progress bar element
 */
export function updateProgressBar(progress, element) {
  if (!element) return;

  element.style.width = `${Math.max(0, Math.min(100, progress))}%`;

  if (progress <= 25) {
    element.style.backgroundColor = '#e74c3c';
  } else if (progress <= 50) {
    element.style.backgroundColor = '#f39c12';
  }
}

/**
 * Creates and configures a pause button with icon.
 * @param {Function} onToggle - Callback when button is clicked
 * @returns {HTMLElement} Configured pause button
 */
export function createPauseButton(onToggle) {
  const pauseButton = document.createElement('button');
  pauseButton.className = 'pause-button';
  pauseButton.id = 'pause-button';

  const icon = document.createElement('i');
  icon.className = 'fas fa-pause';
  pauseButton.appendChild(icon);

  pauseButton.addEventListener('click', onToggle);

  return pauseButton;
}

/**
 * Updates pause button state (paused/playing).
 * @param {HTMLElement} button - Pause button element
 * @param {boolean} isPaused - Whether timer is paused
 */
export function updatePauseButton(button, isPaused) {
  if (!button) return;

  button.textContent = '';
  const icon = document.createElement('i');

  if (isPaused) {
    icon.className = 'fas fa-play';
    button.style.backgroundColor = '#4caf50';
    button.classList.add('pause-button--paused');
  } else {
    icon.className = 'fas fa-pause';
    button.style.backgroundColor = '#f39c12';
    button.classList.remove('pause-button--paused');
  }

  button.appendChild(icon);
}

/**
 * Ensures Font Awesome is loaded for icons.
 */
export function ensureFontAwesome() {
  if (!document.getElementById('font-awesome-link')) {
    const fontAwesomeLink = document.createElement('link');
    fontAwesomeLink.id = 'font-awesome-link';
    fontAwesomeLink.rel = 'stylesheet';
    fontAwesomeLink.href =
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(fontAwesomeLink);
  }
}

/**
 * Ensures dotlottie-player is loaded for animations.
 */
export function ensureDotLottie() {
  if (!document.getElementById('dotlottie-player-script')) {
    const lottieScript = document.createElement('script');
    lottieScript.id = 'dotlottie-player-script';
    lottieScript.src =
      'https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs';
    lottieScript.type = 'module';
    document.head.appendChild(lottieScript);
  }
}

/**
 * Shows a confirmation dialog.
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Function} confirmCallback - Callback on confirm
 */
export function showConfirmDialog(title, message, confirmCallback) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';

  const dialogTitle = document.createElement('h3');
  dialogTitle.textContent = title;

  const dialogMessage = document.createElement('p');
  dialogMessage.textContent = message;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'confirm-buttons';

  const confirmButton = document.createElement('button');
  confirmButton.className = 'standardized-button confirm-button';
  confirmButton.textContent = 'Confirmar';
  confirmButton.addEventListener('click', () => {
    document.body.removeChild(overlay);
    if (confirmCallback) confirmCallback();
  });

  const cancelButton = document.createElement('button');
  cancelButton.className = 'standardized-button cancel-button';
  cancelButton.textContent = 'Cancelar';
  cancelButton.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(cancelButton);
  dialog.appendChild(dialogTitle);
  dialog.appendChild(dialogMessage);
  dialog.appendChild(buttonContainer);
  overlay.appendChild(dialog);

  document.body.appendChild(overlay);
}
