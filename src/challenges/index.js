/**
 * Challenges page entry point.
 * Orchestrates level selection, countdown, recipe fetching, timer, and UI updates.
 */

import { foodImages as sharedFoodImages } from '../shared/constants.js';
import { handleAsyncError } from '../shared/errors.js';
import { createTimer, formatTime } from './timer.js';
import { getRecipe } from './recipe-api.js';
import {
  displayIngredients,
  displayInstructions,
  displayTips,
  createPauseButton,
  updatePauseButton,
  ensureFontAwesome,
  ensureDotLottie,
  showConfirmDialog,
} from './ui.js';

// Extended food images for challenges (adds more variety)
const challengesFoodImages = [
  ...sharedFoodImages,
  'https://cdn-icons-png.flaticon.com/512/2515/2515263.png',
  'https://cdn-icons-png.flaticon.com/512/1147/1147805.png',
  'https://cdn-icons-png.flaticon.com/512/3075/3075977.png',
  'https://cdn-icons-png.flaticon.com/512/3075/3075929.png',
  'https://cdn-icons-png.flaticon.com/512/2965/2965567.png',
  'https://cdn-icons-png.flaticon.com/512/1147/1147801.png',
  'https://cdn-icons-png.flaticon.com/512/1147/1147803.png',
  'https://cdn-icons-png.flaticon.com/512/2515/2515183.png',
  'https://cdn-icons-png.flaticon.com/512/3075/3075975.png',
  'https://cdn-icons-png.flaticon.com/512/1147/1147802.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046751.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046767.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046786.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046781.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046782.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046754.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046761.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046766.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046772.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046800.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046757.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046759.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046785.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046793.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046764.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046778.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046776.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046789.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046790.png',
  'https://cdn-icons-png.flaticon.com/512/1046/1046795.png',
];

// Preparation times per difficulty level (minutes)
const PREPARATION_TIMES = {
  principiante: 20,
  intermedio: 45,
  avancado: 60,
  extremo: 90,
};

// Global state
let currentTimer = null;
let mainContainer = null;
let backgroundAnimation = null;
let foodElements = [];

/**
 * Initializes the challenges page.
 */
function init() {
  try {
    mainContainer = document.getElementById('main-container');
    backgroundAnimation = document.querySelector('.background-animation');

    initFoodAnimation();
    setupChallengeButtons();
    ensureFontAwesome();
    ensureDotLottie();
  } catch (error) {
    handleAsyncError(error, 'Erro ao iniciar os desafios.');
  }
}

/**
 * Creates a single food item for background animation.
 */
function createFoodItem() {
  const foodItem = document.createElement('div');
  foodItem.classList.add('food-item');

  const randomImage = challengesFoodImages[Math.floor(Math.random() * challengesFoodImages.length)];
  const posX = Math.floor(Math.random() * 100);
  const duration = Math.random() * 10 + 10;
  const rotation = Math.random() * 360;
  const fixedSize = 40;

  foodItem.style.width = `${fixedSize}px`;
  foodItem.style.height = `${fixedSize}px`;
  foodItem.style.left = `${posX}%`;
  foodItem.style.top = `-${fixedSize}px`;
  foodItem.style.backgroundImage = `url('${randomImage}')`;
  foodItem.style.backgroundSize = 'contain';
  foodItem.style.backgroundRepeat = 'no-repeat';
  foodItem.style.backgroundPosition = 'center';
  foodItem.style.animation = `fall ${duration}s linear`;
  foodItem.style.opacity = '0.5';
  foodItem.style.transform = `rotate(${rotation}deg)`;

  backgroundAnimation.appendChild(foodItem);

  foodItem.addEventListener('animationend', function () {
    if (foodItem.parentNode === backgroundAnimation) {
      backgroundAnimation.removeChild(foodItem);

      const index = foodElements.indexOf(foodItem);
      if (index > -1) {
        foodElements.splice(index, 1);
      }

      const newItem = createFoodItem();
      foodElements.push(newItem);
    }
  });

  return foodItem;
}

/**
 * Initializes food animation background.
 */
function initFoodAnimation() {
  backgroundAnimation.textContent = '';
  foodElements = [];

  const totalFoodItems = 25;

  for (let i = 0; i < totalFoodItems; i++) {
    const foodItem = createFoodItem();

    if (i > 0) {
      const initialProgress = Math.random() * 100;
      const computedStyle = window.getComputedStyle(foodItem);
      const duration = parseFloat(computedStyle.animationDuration) || 15;
      foodItem.style.animationDelay = `-${(initialProgress * duration) / 100}s`;
    }

    foodElements.push(foodItem);
  }
}

/**
 * Sets up challenge button event listeners.
 */
function setupChallengeButtons() {
  const challengeButtons = document.querySelectorAll('.challenge-button');

  challengeButtons.forEach((button) => {
    button.addEventListener('click', function () {
      const level = this.getAttribute('data-level');

      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = '';

        showConfirmDialog(
          'Iniciar Desafio',
          `Tem certeza que deseja iniciar um desafio de nível ${level}?`,
          () => {
            startChallenge(level);
          }
        );
      }, 200);
    });
  });
}

/**
 * Starts the challenge with countdown and recipe fetch.
 */
async function startChallenge(level) {
  try {
    mainContainer.textContent = '';

    const countdownContainer = createCountdownUI();
    mainContainer.appendChild(countdownContainer);

    let recipe = null;
    const recipePromise = getRecipe(level);

    await runCountdown(countdownContainer, recipePromise, (fetchedRecipe) => {
      recipe = fetchedRecipe;
    });

    if (!recipe) {
      try {
        recipe = await recipePromise;
      } catch (error) {
        handleAsyncError(error, 'Erro ao aguardar a receita');
        return;
      }
    }

    showRecipe(level, recipe);
  } catch (error) {
    handleAsyncError(error, 'Erro ao iniciar desafio');
  }
}

/**
 * Creates countdown UI elements.
 */
function createCountdownUI() {
  const countdownContainer = document.createElement('div');
  countdownContainer.className = 'countdown-container';

  const countdownText = document.createElement('h2');
  countdownText.className = 'countdown-text gradient-text';
  countdownText.textContent = 'O seu desafio começa em';

  const countdownNumber = document.createElement('div');
  countdownNumber.className = 'countdown-number';
  countdownNumber.textContent = '5';

  const preparingText = document.createElement('h3');
  preparingText.className = 'preparing-text';
  preparingText.textContent = 'Prepare-se...';

  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';

  const loadingText = document.createElement('span');
  loadingText.textContent = 'A carregar a sua receita';

  const dots = document.createElement('span');
  dots.className = 'dots';
  dots.textContent = '...';

  loadingIndicator.appendChild(loadingText);
  loadingIndicator.appendChild(dots);

  countdownContainer.appendChild(countdownText);
  countdownContainer.appendChild(countdownNumber);
  countdownContainer.appendChild(preparingText);
  countdownContainer.appendChild(loadingIndicator);

  return countdownContainer;
}

/**
 * Runs the countdown animation.
 */
async function runCountdown(countdownContainer, recipePromise, onRecipeReady) {
  return new Promise((resolve) => {
    let count = 5;
    const countdownNumber = countdownContainer.querySelector('.countdown-number');
    const dotsElement = countdownContainer.querySelector('.dots');

    let dotsCount = 0;
    const dotsInterval = setInterval(() => {
      dotsCount = (dotsCount + 1) % 4;
      dotsElement.textContent = '.'.repeat(dotsCount);
    }, 500);

    recipePromise.then((recipe) => {
      onRecipeReady(recipe);
    });

    const countdownInterval = setInterval(() => {
      count--;
      countdownNumber.textContent = count;

      if (count === 0) {
        clearInterval(countdownInterval);
        clearInterval(dotsInterval);

        countdownContainer.classList.add('fade-out');

        setTimeout(() => {
          resolve();
        }, 1000);
      }
    }, 1000);
  });
}

/**
 * Displays the recipe with timer and UI.
 */
function showRecipe(level, recipe) {
  mainContainer.textContent = '';

  if (currentTimer) {
    currentTimer.stop();
  }

  const recipeContainer = createRecipeUI(level, recipe);
  mainContainer.appendChild(recipeContainer);

  setTimeout(() => {
    recipeContainer.classList.add('active');
  }, 100);

  startRecipeTimer(level, recipe);
}

/**
 * Creates the recipe UI container.
 */
function createRecipeUI(level, recipe) {
  const recipeContainer = document.createElement('div');
  recipeContainer.className = 'recipe-container fade-in';

  const header = createRecipeHeader(level, recipe);
  const progressSection = createProgressSection();
  const ingredientsSection = createIngredientsSection(recipe);
  const instructionsSection = createInstructionsSection(recipe);
  const tipsSection = createTipsSection(recipe);
  const buttonsContainer = createRecipeButtons(level);

  recipeContainer.appendChild(header);
  recipeContainer.appendChild(progressSection);
  recipeContainer.appendChild(ingredientsSection);
  recipeContainer.appendChild(instructionsSection);
  recipeContainer.appendChild(tipsSection);
  recipeContainer.appendChild(buttonsContainer);

  return recipeContainer;
}

/**
 * Creates recipe header with title and level badge.
 */
function createRecipeHeader(level, recipe) {
  const recipeHeader = document.createElement('div');
  recipeHeader.className = 'recipe-header';

  const recipeTitle = document.createElement('h2');
  recipeTitle.className = 'recipe-title gradient-text';
  recipeTitle.textContent = recipe.name;

  const recipeLevel = document.createElement('div');
  recipeLevel.className = `recipe-level ${level}`;
  recipeLevel.textContent = level.charAt(0).toUpperCase() + level.slice(1);

  const recipeDescription = document.createElement('p');
  recipeDescription.className = 'recipe-description';
  recipeDescription.textContent = recipe.description;

  recipeHeader.appendChild(recipeTitle);
  recipeHeader.appendChild(recipeLevel);
  recipeHeader.appendChild(recipeDescription);

  return recipeHeader;
}

/**
 * Creates progress section with timer and pause button.
 */
function createProgressSection() {
  const progressSection = document.createElement('div');
  progressSection.className = 'recipe-progress-section';
  progressSection.style.position = 'relative';

  const progressLabel = document.createElement('div');
  progressLabel.className = 'progress-label';
  progressLabel.textContent = 'Tempo Restante';

  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBar.id = 'recipe-progress';

  const progressControls = document.createElement('div');
  progressControls.className = 'progress-controls';

  const progressTime = document.createElement('div');
  progressTime.className = 'progress-time';
  progressTime.id = 'recipe-time';
  progressTime.textContent = '00:00';

  progressContainer.appendChild(progressBar);
  progressControls.appendChild(progressTime);
  progressSection.appendChild(progressLabel);
  progressSection.appendChild(progressContainer);
  progressSection.appendChild(progressControls);

  return progressSection;
}

/**
 * Creates ingredients section.
 */
function createIngredientsSection(recipe) {
  const section = document.createElement('div');
  section.className = 'recipe-section';

  const title = document.createElement('h3');
  title.className = 'section-title shadow-pulse';
  title.textContent = 'Ingredientes';

  const ingredientsList = displayIngredients(recipe);

  section.appendChild(title);
  section.appendChild(ingredientsList);

  return section;
}

/**
 * Creates instructions section.
 */
function createInstructionsSection(recipe) {
  const section = document.createElement('div');
  section.className = 'recipe-section';

  const title = document.createElement('h3');
  title.className = 'section-title shadow-pulse';
  title.textContent = 'Instruções';

  const instructionsList = displayInstructions(recipe.instructions);

  section.appendChild(title);
  section.appendChild(instructionsList);

  return section;
}

/**
 * Creates tips section.
 */
function createTipsSection(recipe) {
  const section = document.createElement('div');
  section.className = 'recipe-section tips-section';

  const title = document.createElement('h3');
  title.className = 'section-title shadow-pulse';
  title.textContent = 'Dicas do Chef';

  const tipsList = displayTips(recipe.tips);

  section.appendChild(title);
  section.appendChild(tipsList);

  return section;
}

/**
 * Creates recipe action buttons.
 */
function createRecipeButtons(level) {
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'recipe-buttons';

  const finishButton = document.createElement('button');
  finishButton.className = 'finish-challenge-button standardized-button';
  finishButton.textContent = 'Terminei Desafio';
  finishButton.addEventListener('click', () => {
    handleFinishClick(level);
  });

  const newRecipeButton = document.createElement('button');
  newRecipeButton.className = 'new-recipe-button standardized-button';
  newRecipeButton.textContent = 'Nova Receita';
  newRecipeButton.addEventListener('click', () => {
    handleNewRecipeClick(level);
  });

  const backButton = document.createElement('button');
  backButton.className = 'back-button standardized-button';
  backButton.textContent = 'Voltar';
  backButton.addEventListener('click', () => {
    handleBackClick();
  });

  buttonsContainer.appendChild(finishButton);
  buttonsContainer.appendChild(newRecipeButton);
  buttonsContainer.appendChild(backButton);

  return buttonsContainer;
}

/**
 * Handles finish button click.
 */
function handleFinishClick(level) {
  showConfirmDialog('Finalizar Desafio', 'Tem certeza que finalizou o desafio culinário?', () => {
    if (currentTimer) {
      currentTimer.stop();
    }
    showCongratulations(level, true);
  });
}

/**
 * Handles new recipe button click.
 */
function handleNewRecipeClick(level) {
  showConfirmDialog('Nova Receita', 'Tem certeza que deseja gerar uma nova receita?', () => {
    if (currentTimer) {
      currentTimer.stop();
    }
    startChallenge(level);
  });
}

/**
 * Handles back button click.
 */
function handleBackClick() {
  showConfirmDialog(
    'Voltar',
    'Tem certeza que deseja voltar à página inicial? Seu progresso será perdido.',
    () => {
      if (currentTimer) {
        currentTimer.stop();
      }
      location.reload();
    }
  );
}

/**
 * Starts the recipe timer with progress bar.
 */
function startRecipeTimer(level, recipe) {
  const prepTime = recipe.totalTime || PREPARATION_TIMES[level] || 30;
  const progressBar = document.getElementById('recipe-progress');
  const timeDisplay = document.getElementById('recipe-time');
  const progressSection = document.querySelector('.recipe-progress-section');

  let isPaused = false;

  const pauseButton = createPauseButton(() => {
    isPaused = !isPaused;
    if (isPaused) {
      currentTimer.pause();
    } else {
      currentTimer.resume();
    }
    updatePauseButton(pauseButton, isPaused);
  });

  progressSection.appendChild(pauseButton);

  currentTimer = createTimer(prepTime, {
    onTick: ({ minutes, seconds, progress }) => {
      timeDisplay.textContent = formatTime(minutes * 60 + seconds);
      progressBar.style.width = `${100 - progress}%`;

      if (progress >= 75) {
        progressBar.style.backgroundColor = '#e74c3c';
      } else if (progress >= 50) {
        progressBar.style.backgroundColor = '#f39c12';
      }
    },
    onComplete: () => {
      showCongratulations(level, false);
    },
  });

  currentTimer.start();
}

/**
 * Shows congratulations or timeout screen.
 */
function showCongratulations(level, completed) {
  mainContainer.textContent = '';

  if (currentTimer) {
    currentTimer.stop();
  }

  const congratsContainer = document.createElement('div');
  congratsContainer.className = 'congrats-container fade-in';

  const title = document.createElement('h2');
  title.className = completed ? 'congrats-title gradient-text' : 'timeout-title gradient-text';
  title.textContent = completed ? 'Parabéns! Desafio Concluído!' : 'Tempo Esgotado!';

  const message = document.createElement('p');
  message.className = 'congrats-message';

  if (completed) {
    const lottieContainer = document.createElement('div');
    lottieContainer.className = 'lottie-container';

    const lottiePlayer = document.createElement('dotlottie-player');
    lottiePlayer.setAttribute(
      'src',
      'https://lottie.host/15d4805b-6402-467a-9d06-76db89c1c9aa/jA93Oi7HJN.lottie'
    );
    lottiePlayer.setAttribute('background', 'transparent');
    lottiePlayer.setAttribute('speed', '1');
    lottiePlayer.setAttribute('loop', '');
    lottiePlayer.setAttribute('autoplay', '');

    lottieContainer.appendChild(lottiePlayer);
    congratsContainer.appendChild(title);
    congratsContainer.appendChild(lottieContainer);

    const levelName = level.charAt(0).toUpperCase() + level.slice(1);
    message.textContent = `Você completou o desafio culinário de nível ${levelName}! O seu prato certamente ficou delicioso. Você é um verdadeiro chef!`;
  } else {
    const clockIcon = document.createElement('div');
    clockIcon.className = 'clock-icon';

    const icon = document.createElement('i');
    icon.className = 'fas fa-clock';
    clockIcon.appendChild(icon);

    congratsContainer.appendChild(title);
    congratsContainer.appendChild(clockIcon);

    message.textContent =
      'O tempo para completar o desafio terminou, mas não desanime! Algumas das melhores criações culinárias exigem tempo. Tente novamente quando estiver pronto!';
  }

  congratsContainer.appendChild(message);

  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'congrats-buttons';

  const newChallengeButton = document.createElement('button');
  newChallengeButton.className = 'standardized-button';
  newChallengeButton.textContent = 'Novo Desafio';
  newChallengeButton.addEventListener('click', () => {
    showConfirmDialog(
      'Iniciar novo desafio?',
      'Tem certeza que deseja iniciar um novo desafio do mesmo nível?',
      () => {
        startChallenge(level);
      }
    );
  });

  const menuButton = document.createElement('button');
  menuButton.className = 'standardized-button';
  menuButton.textContent = 'Menu de Receitas';
  menuButton.addEventListener('click', () => {
    showConfirmDialog('Voltar ao menu?', 'Tem certeza que deseja voltar ao menu de níveis?', () => {
      location.reload();
    });
  });

  buttonsContainer.appendChild(newChallengeButton);
  buttonsContainer.appendChild(menuButton);

  congratsContainer.appendChild(buttonsContainer);
  mainContainer.appendChild(congratsContainer);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
