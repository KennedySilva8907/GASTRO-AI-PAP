/**
 * Challenges page entry point — Pass de Chef V2.
 * Orchestrates menu → countdown → step-by-step service → end screen.
 */

import { handleAsyncError } from '../shared/errors.js';
import { navigateTo, revealPage } from '../shared/transitions.js';

import { createTimer, formatTime } from './timer.js';
import { getRecipe } from './recipe-api.js';
import {
  renderCountdown,
  renderServiceScreen,
  renderEndScreen,
  createConfirmDialog,
  createCollapsiblePanel,
  renderIngredients,
  renderTips,
} from './ui.js';

revealPage();

const PREPARATION_TIMES = {
  principiante: 20,
  intermedio: 45,
  avancado: 60,
  extremo: 90,
};

const LEVEL_LABELS = {
  principiante: 'Principiante',
  intermedio: 'Intermédio',
  avancado: 'Avançado',
  extremo: 'Extremo',
};

const state = {
  level: null,
  recipe: null,
  totalSteps: 0,
  currentStepIndex: 0,
  viewStepIndex: 0,
  startedAt: 0,
  timer: null,
  isPaused: false,
  remainingSeconds: 0,
  totalSeconds: 0,
};

let root = null;

function init() {
  root = document.getElementById('challenge-root');
  if (!root) return;

  wireBackButton();
  wireMenuButtons();
}

function wireBackButton() {
  const backButton = document.getElementById('back-button');
  if (!backButton) return;
  backButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (state.timer) {
      showConfirmDialog({
        kicker: 'Sair',
        title: 'Sair do desafio?',
        message: 'O temporizador para e perdes o progresso.',
        confirmLabel: 'Sair',
        onConfirm: () => {
          stopTimer();
          goHome(event);
        },
      });
      return;
    }
    goHome(event);
  });
}

function goHome(event) {
  navigateTo('../index.html', event, { entryAnchor: '#desafio-button' });
}

function wireMenuButtons() {
  const cards = root.querySelectorAll('.pass-card[data-level]');
  cards.forEach((card) => {
    const start = () => promptStart(card.dataset.level);
    card.addEventListener('click', start);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        start();
      }
    });
  });
}

function promptStart(level) {
  if (!LEVEL_LABELS[level]) return;
  showConfirmDialog({
    kicker: 'Começar',
    title: `Iniciar desafio ${LEVEL_LABELS[level]}?`,
    message: `${PREPARATION_TIMES[level]} minutos. A receita é gerada agora e o temporizador arranca no fim da contagem.`,
    confirmLabel: 'Começar',
    onConfirm: () => startChallenge(level),
  });
}

async function startChallenge(level) {
  try {
    state.level = level;

    const countdownEl = renderCountdown(root, { levelLabel: LEVEL_LABELS[level] });

    const recipePromise = getRecipe(level);
    let recipe = null;
    recipePromise.then((r) => {
      recipe = r;
    });

    await runCountdown(countdownEl);

    if (!recipe) {
      try {
        recipe = await recipePromise;
      } catch (error) {
        handleAsyncError(error, 'Erro ao carregar a receita.');
        return;
      }
    }

    showService(recipe);
  } catch (error) {
    handleAsyncError(error, 'Erro ao iniciar desafio.');
  }
}

function runCountdown(countdownEl) {
  return new Promise((resolve) => {
    let count = 5;
    const numberEl = countdownEl.querySelector('.pass-countdown__number');
    const dotsEl = countdownEl.querySelector('.pass-countdown__loading .dots');

    numberEl.textContent = String(count);
    numberEl.classList.add('pulse');

    let dotsCount = 0;
    const dotsInterval = setInterval(() => {
      if (!dotsEl) return;
      dotsCount = (dotsCount + 1) % 4;
      dotsEl.textContent = '.'.repeat(dotsCount);
    }, 500);

    const tick = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(tick);
        clearInterval(dotsInterval);
        numberEl.style.opacity = '0';
        setTimeout(resolve, 400);
        return;
      }
      numberEl.classList.remove('pulse');
      // force reflow so animation replays
      void numberEl.offsetWidth;
      numberEl.textContent = String(count);
      numberEl.classList.add('pulse');
    }, 1000);
  });
}

function showService(recipe) {
  state.recipe = recipe;
  state.totalSteps = recipe.instructions.length;
  state.currentStepIndex = 0;
  state.viewStepIndex = 0;
  state.startedAt = Date.now();
  state.totalSeconds = (recipe.totalTime || PREPARATION_TIMES[state.level] || 30) * 60;
  state.remainingSeconds = state.totalSeconds;
  state.isPaused = false;

  const elements = renderServiceScreen(root, {
    levelLabel: LEVEL_LABELS[state.level],
    recipe,
    totalSteps: state.totalSteps,
    totalMinutes: Math.round(state.totalSeconds / 60),
  });

  mountPanels(elements, recipe);
  wireStepActions(elements);
  renderStep(elements);
  startTimer(elements);
}

function mountPanels(elements, recipe) {
  const miseEnPlace = createCollapsiblePanel({
    title: 'Mise en place',
    count: `${recipe.ingredients.filter((i) => !i.startsWith('__CATEGORY__')).length} ingredientes`,
    body: renderIngredients(recipe.ingredients),
    open: true,
  });

  const tips = createCollapsiblePanel({
    title: 'Dicas do Chef',
    count: `${recipe.tips.length} nota${recipe.tips.length === 1 ? '' : 's'}`,
    body: renderTips(recipe.tips),
    open: false,
  });

  elements.panelsMount.appendChild(miseEnPlace);
  elements.panelsMount.appendChild(tips);
}

function wireStepActions(elements) {
  elements.prevButton.addEventListener('click', () => goToStep(state.viewStepIndex - 1, elements));
  elements.nextButton.addEventListener('click', () => goToStep(state.viewStepIndex + 1, elements));
  elements.finishButton.addEventListener('click', () => promptFinish());
  elements.pauseButton.addEventListener('click', () => togglePause(elements));
}

function goToStep(index, elements) {
  if (index < 0 || index >= state.totalSteps) return;
  state.viewStepIndex = index;
  if (index > state.currentStepIndex) {
    state.currentStepIndex = index;
  }
  renderStep(elements, { animate: true });
}

function renderStep(elements, options = {}) {
  const { animate } = options;
  const { viewStepIndex, currentStepIndex, totalSteps, recipe } = state;

  const apply = () => {
    const instruction = recipe.instructions[viewStepIndex] ?? '';
    const isReview = viewStepIndex < currentStepIndex;

    const stepNumber = String(viewStepIndex + 1).padStart(2, '0');
    const stepTotal = String(totalSteps).padStart(2, '0');

    elements.stepCurrent.classList.toggle('is-review', isReview);
    elements.stepTag.textContent = isReview ? 'A rever etapa' : 'Etapa atual';

    elements.stepNumber.replaceChildren(document.createTextNode(stepNumber));
    const sup = document.createElement('sup');
    sup.textContent = `/${stepTotal}`;
    elements.stepNumber.appendChild(sup);

    elements.stepBody.replaceChildren(formatInstructionText(instruction));

    renderTracker(elements);
    renderChips(elements);
    renderNext(elements);
    renderStepActions(elements);
  };

  if (animate) {
    elements.stepCurrent.dataset.fading = 'true';
    setTimeout(() => {
      apply();
      requestAnimationFrame(() => {
        elements.stepCurrent.dataset.fading = 'false';
      });
    }, 200);
  } else {
    elements.stepCurrent.dataset.fading = 'false';
    apply();
  }
}

function formatInstructionText(instruction) {
  const frag = document.createDocumentFragment();
  const timeMatch = instruction.match(
    /\s*\((\d+(?:\s*-\s*\d+)?)[\s]*(minutos?|mins?|m|segundos?|segs?|seg|horas?|hrs?|h)\)\s*$/i
  );
  if (timeMatch) {
    const text = instruction.slice(0, timeMatch.index).trim();
    frag.appendChild(document.createTextNode(text));
    frag.appendChild(document.createElement('br'));
    const timeEl = document.createElement('span');
    timeEl.className = 'step-current__time';
    timeEl.textContent = timeMatch[0].trim().replace(/[()]/g, '').trim();
    frag.appendChild(timeEl);
  } else {
    frag.appendChild(document.createTextNode(instruction.trim()));
  }
  return frag;
}

function renderTracker(elements) {
  const { totalSteps, viewStepIndex, currentStepIndex } = state;
  const segments = [];
  for (let i = 0; i < totalSteps; i += 1) {
    const span = document.createElement('span');
    if (i < currentStepIndex) span.classList.add('done');
    if (i === viewStepIndex) span.classList.add('current');
    segments.push(span);
  }
  elements.trackerProgress.replaceChildren(...segments);

  elements.trackerCount.replaceChildren(
    document.createTextNode(String(viewStepIndex + 1).padStart(2, '0'))
  );
  const em = document.createElement('em');
  em.textContent = `/${String(totalSteps).padStart(2, '0')}`;
  elements.trackerCount.appendChild(em);
}

function renderChips(elements) {
  const { currentStepIndex, viewStepIndex } = state;
  const chips = [];
  for (let i = 0; i < currentStepIndex; i += 1) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'step-chip';
    if (i === viewStepIndex) chip.classList.add('is-reviewing');
    chip.textContent = `Etapa ${String(i + 1).padStart(2, '0')}`;
    const targetIndex = i;
    chip.addEventListener('click', () => {
      if (state.viewStepIndex === targetIndex) return;
      state.viewStepIndex = targetIndex;
      renderStep(elements, { animate: true });
    });
    chips.push(chip);
  }
  elements.chips.replaceChildren(...chips);
}

function renderNext(elements) {
  const { totalSteps, viewStepIndex, recipe } = state;
  elements.next.classList.remove('is-last');

  if (viewStepIndex >= totalSteps - 1) {
    elements.next.classList.add('is-last');
    elements.next.replaceChildren(
      document.createTextNode('Última etapa — finaliza o serviço quando concluíres.')
    );
    return;
  }

  const nextIndex = viewStepIndex + 1;
  const rawBody = recipe.instructions[nextIndex] || '';
  const previewBody = rawBody.replace(/\s*\(\d+.*?\)\s*$/i, '').trim();

  const label = document.createElement('div');
  label.className = 'step-next__label';
  label.textContent = 'A seguir';

  const number = document.createElement('div');
  number.className = 'step-next__number';
  number.textContent = String(nextIndex + 1).padStart(2, '0');

  const body = document.createElement('div');
  body.className = 'step-next__body';
  body.textContent = previewBody;

  elements.next.replaceChildren(label, number, body);
}

function renderStepActions(elements) {
  const { totalSteps, viewStepIndex } = state;
  elements.prevButton.disabled = viewStepIndex === 0;
  elements.nextButton.disabled = viewStepIndex >= totalSteps - 1;
}

function startTimer(elements) {
  const totalMinutes = state.totalSeconds / 60;

  state.timer = createTimer(totalMinutes, {
    onTick: ({ minutes, seconds, progress, remainingSeconds }) => {
      state.remainingSeconds = remainingSeconds;
      updateTimerDisplay(elements, minutes, seconds, progress);
    },
    onComplete: () => {
      showEnd('timeout');
    },
  });

  state.timer.start();
}

function updateTimerDisplay(elements, minutes, seconds, progress) {
  const totalRemaining = minutes * 60 + seconds;
  const mins = Math.floor(totalRemaining / 60);
  const secs = totalRemaining % 60;

  elements.timerMinutes.textContent = String(mins).padStart(2, '0');
  elements.timerSeconds.textContent = String(secs).padStart(2, '0');

  const elapsed = state.totalSeconds - state.remainingSeconds;
  elements.timerElapsed.textContent = formatTime(elapsed);

  elements.timerProgress.style.width = `${Math.max(0, 100 - progress)}%`;

  const warning = progress >= 75;
  const danger = progress >= 90 || mins < 2;
  elements.timerDigits.classList.toggle('warning', warning && !danger);
  elements.timerDigits.classList.toggle('danger', danger);
  elements.timerProgress.classList.toggle('warning', warning && !danger);
  elements.timerProgress.classList.toggle('danger', danger);
}

function togglePause(elements) {
  if (!state.timer) return;
  state.isPaused = !state.isPaused;
  if (state.isPaused) {
    state.timer.pause();
    elements.pauseButton.classList.add('paused');
    elements.pauseButton.textContent = 'Retomar ▶';
  } else {
    state.timer.resume();
    elements.pauseButton.classList.remove('paused');
    elements.pauseButton.textContent = 'Pausar ❚❚';
  }
}

function stopTimer() {
  if (state.timer) {
    state.timer.stop();
    state.timer = null;
  }
}

function promptFinish() {
  showConfirmDialog({
    kicker: 'Concluir',
    title: 'Marcar como concluído?',
    message: 'Confirma que terminaste.',
    confirmLabel: 'Concluir',
    onConfirm: () => showEnd('completed'),
  });
}

function promptNew() {
  showConfirmDialog({
    kicker: 'Novo desafio',
    title: 'Começar outro?',
    message: 'Nova receita, mesmo nível.',
    confirmLabel: 'Começar',
    onConfirm: () => startChallenge(state.level),
  });
}

function promptMenu() {
  showConfirmDialog({
    kicker: 'Voltar ao menu',
    title: 'Voltar ao menu de níveis?',
    message: 'Voltarás à seleção de níveis. Podes começar outro desafio quando quiseres.',
    confirmLabel: 'Voltar',
    onConfirm: () => location.reload(),
  });
}

function showEnd(kind) {
  stopTimer();

  const stats = buildEndStats(kind);

  renderEndScreen(root, {
    kind,
    kicker: kind === 'completed' ? 'Desafio completo' : 'Tempo esgotado',
    stampPrefix: kind === 'completed' ? 'Bem' : 'Tempo',
    stampAccent: kind === 'completed' ? 'feito.' : 'esgotado.',
    subtitle:
      kind === 'completed'
        ? `${state.recipe.name} — dentro do tempo.`
        : `${state.recipe.name} — ficou pelo caminho.`,
    stats,
    primaryLabel: kind === 'completed' ? 'Novo desafio' : 'Tentar outra vez',
    onPrimary: () => promptNew(),
    onSecondary: () => promptMenu(),
  });
}

function buildEndStats(kind) {
  const elapsed = state.totalSeconds - state.remainingSeconds;
  const remaining = Math.max(0, state.remainingSeconds);
  const completedSteps = kind === 'completed' ? state.totalSteps : state.currentStepIndex + 1;

  return [
    { label: 'Nível', value: LEVEL_LABELS[state.level] },
    { label: 'Tempo usado', value: formatTime(elapsed), emphasis: kind === 'completed' },
    kind === 'completed'
      ? { label: 'Restante', value: formatTime(remaining) }
      : { label: 'Ficou em', value: `Etapa ${String(state.currentStepIndex + 1).padStart(2, '0')}` },
    {
      label: 'Etapas',
      value: `${completedSteps} / ${state.totalSteps}`,
      emphasis: kind === 'timeout',
    },
  ];
}

function showConfirmDialog({ kicker, title, message, confirmLabel, onConfirm }) {
  createConfirmDialog({ kicker, title, message, confirmLabel, onConfirm });
}

document.addEventListener('DOMContentLoaded', init);
