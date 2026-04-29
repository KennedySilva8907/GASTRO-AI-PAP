/**
 * UI rendering helpers for Desafios V2 (Pass de Chef).
 * Builds DOM subtrees and returns handles back to index.js for state updates.
 */

function clearRoot(root) {
  while (root.firstChild) root.removeChild(root.firstChild);
}

/**
 * Renders the countdown screen (5 → 0) and returns its root element.
 */
export function renderCountdown(root, { levelLabel }) {
  clearRoot(root);

  const stage = document.createElement('section');
  stage.className = 'pass-stage';
  stage.dataset.screen = 'countdown';

  const countdown = document.createElement('div');
  countdown.className = 'pass-countdown';

  const kicker = document.createElement('div');
  kicker.className = 'pass-countdown__kicker';
  kicker.textContent = `Nível ${levelLabel}`;

  const number = document.createElement('div');
  number.className = 'pass-countdown__number';
  number.textContent = '5';

  const sub = document.createElement('p');
  sub.className = 'pass-countdown__sub';
  sub.textContent = 'Prepara-te. O temporizador arranca a zero.';

  const loading = document.createElement('div');
  loading.className = 'pass-countdown__loading';
  const loadingText = document.createElement('span');
  loadingText.textContent = 'A gerar a receita';
  const dots = document.createElement('span');
  dots.className = 'dots';
  dots.textContent = '.';
  loading.appendChild(loadingText);
  loading.appendChild(dots);

  countdown.appendChild(kicker);
  countdown.appendChild(number);
  countdown.appendChild(sub);
  countdown.appendChild(loading);

  stage.appendChild(countdown);
  root.appendChild(stage);

  return stage;
}

/**
 * Renders the service screen (Tela B) and returns handles to all elements
 * that will be updated during the challenge.
 */
export function renderServiceScreen(root, { levelLabel, recipe, totalSteps, totalMinutes }) {
  clearRoot(root);

  const stage = document.createElement('section');
  stage.className = 'pass-stage';
  stage.dataset.screen = 'service';

  stage.appendChild(buildServiceHeader({ levelLabel, recipe, totalMinutes, totalSteps }));

  const grid = document.createElement('div');
  grid.className = 'pass-service__grid';

  const hud = buildHud({ levelLabel, totalSteps });
  const recipeCol = document.createElement('div');
  recipeCol.className = 'service-recipe';

  recipeCol.appendChild(buildRecipeHead(recipe));

  const panelsMount = document.createElement('div');
  panelsMount.className = 'service-panels';
  recipeCol.appendChild(panelsMount);

  recipeCol.appendChild(buildStepStage());

  grid.appendChild(hud.root);
  grid.appendChild(recipeCol);
  stage.appendChild(grid);
  root.appendChild(stage);

  return {
    panelsMount,
    timerMinutes: hud.minutes,
    timerSeconds: hud.seconds,
    timerElapsed: hud.elapsed,
    timerDigits: hud.digits,
    timerProgress: hud.progressBar,
    pauseButton: hud.pauseButton,
    trackerProgress: stage.querySelector('.step-tracker__progress'),
    trackerCount: stage.querySelector('.step-tracker__count'),
    chips: stage.querySelector('.step-chips'),
    stepCurrent: stage.querySelector('.step-current'),
    stepTag: stage.querySelector('.step-current__tag'),
    stepNumber: stage.querySelector('.step-current__number'),
    stepBody: stage.querySelector('.step-current__body'),
    next: stage.querySelector('.step-next'),
    prevButton: stage.querySelector('[data-action="prev"]'),
    nextButton: stage.querySelector('[data-action="next"]'),
    finishButton: stage.querySelector('[data-action="finish"]'),
  };
}

function buildServiceHeader({ levelLabel, recipe, totalMinutes, totalSteps }) {
  const header = document.createElement('header');
  header.className = 'pass-service__header';

  const main = document.createElement('div');
  const kicker = document.createElement('span');
  kicker.className = 'pass-kicker';
  kicker.textContent = `Nível ${levelLabel}`;

  const h1 = document.createElement('h1');
  h1.className = 'pass-service__title';
  const emphasis = splitTitleWithEmphasis(recipe.name);
  h1.appendChild(document.createTextNode(emphasis.before));
  if (emphasis.emphasis) {
    const em = document.createElement('em');
    em.textContent = emphasis.emphasis;
    h1.appendChild(em);
  }
  if (emphasis.after) h1.appendChild(document.createTextNode(emphasis.after));

  main.appendChild(kicker);
  main.appendChild(h1);

  if (recipe.description) {
    const desc = document.createElement('p');
    desc.className = 'pass-service__desc';
    desc.textContent = recipe.description;
    main.appendChild(desc);
  }

  const meta = document.createElement('div');
  meta.className = 'pass-service__meta';
  [`Tempo · ${totalMinutes} min`, `${totalSteps} etapas`].forEach((text) => {
    const span = document.createElement('span');
    span.textContent = text;
    meta.appendChild(span);
  });
  main.appendChild(meta);

  header.appendChild(main);
  return header;
}

/** Splits "Risotto ai Funghi Porcini" into a first word + emphasis on last couple of words. */
function splitTitleWithEmphasis(name) {
  const trimmed = (name || '').trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    return { before: trimmed, emphasis: '', after: '' };
  }
  if (words.length === 2) {
    return { before: words[0] + ' ', emphasis: words[1], after: '' };
  }
  const emphasisWordCount = Math.min(2, Math.max(1, Math.floor(words.length / 3)));
  const before = words.slice(0, words.length - emphasisWordCount).join(' ') + ' ';
  const emphasis = words.slice(words.length - emphasisWordCount).join(' ');
  return { before, emphasis, after: '' };
}

function buildHud({ levelLabel, totalSteps }) {
  const hud = document.createElement('aside');
  hud.className = 'service-hud';

  const meta = document.createElement('div');
  meta.className = 'service-hud__meta';
  const metaLeft = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = levelLabel.toUpperCase();
  metaLeft.appendChild(document.createTextNode('Nível · '));
  metaLeft.appendChild(strong);
  const metaRight = document.createElement('span');
  metaRight.textContent = `${totalSteps} etapas`;
  meta.appendChild(metaLeft);
  meta.appendChild(metaRight);

  const timerDisplay = document.createElement('div');
  timerDisplay.className = 'timer-display';

  const timerLabel = document.createElement('div');
  timerLabel.className = 'timer-label';
  timerLabel.textContent = 'Tempo restante';

  const digits = document.createElement('div');
  digits.className = 'timer-digits';

  const minutes = document.createElement('span');
  minutes.textContent = '00';
  const sep = document.createElement('span');
  sep.className = 'sep';
  sep.textContent = ':';
  const seconds = document.createElement('span');
  seconds.textContent = '00';

  digits.appendChild(minutes);
  digits.appendChild(sep);
  digits.appendChild(seconds);

  timerDisplay.appendChild(timerLabel);
  timerDisplay.appendChild(digits);

  const progress = document.createElement('div');
  progress.className = 'timer-progress';
  const progressBar = document.createElement('div');
  progressBar.className = 'timer-progress__bar';
  progressBar.style.width = '100%';
  progress.appendChild(progressBar);

  const stats = document.createElement('div');
  stats.className = 'timer-stats';
  const elapsedStat = buildStat('Decorrido', '00:00');
  stats.appendChild(elapsedStat.root);

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'timer-pause';
  pauseButton.textContent = 'Pausar ❚❚';

  hud.appendChild(meta);
  hud.appendChild(timerDisplay);
  hud.appendChild(progress);
  hud.appendChild(stats);
  hud.appendChild(pauseButton);

  return {
    root: hud,
    minutes,
    seconds,
    digits,
    progressBar,
    elapsed: elapsedStat.value,
    pauseButton,
  };
}

function buildStat(label, value) {
  const stat = document.createElement('div');
  stat.className = 'timer-stat';
  const labelEl = document.createElement('div');
  labelEl.className = 'timer-stat__label';
  labelEl.textContent = label;
  const valueEl = document.createElement('div');
  valueEl.className = 'timer-stat__value';
  valueEl.textContent = value;
  stat.appendChild(labelEl);
  stat.appendChild(valueEl);
  return { root: stat, value: valueEl };
}

function buildRecipeHead(recipe) {
  const head = document.createElement('div');
  head.className = 'service-recipe__head';

  const tag = document.createElement('span');
  tag.className = 'service-recipe__tag';
  tag.textContent = 'Receita';

  const name = document.createElement('h2');
  name.className = 'service-recipe__name';
  const emphasis = splitTitleWithEmphasis(recipe.name);
  name.appendChild(document.createTextNode(emphasis.before));
  if (emphasis.emphasis) {
    const em = document.createElement('em');
    em.textContent = emphasis.emphasis;
    name.appendChild(em);
  }

  const sub = document.createElement('p');
  sub.className = 'service-recipe__sub';
  sub.textContent = recipe.description || '';

  head.appendChild(tag);
  head.appendChild(name);
  head.appendChild(sub);
  return head;
}

function buildStepStage() {
  const stage = document.createElement('div');
  stage.className = 'step-stage';

  stage.appendChild(buildTracker());
  const chips = document.createElement('div');
  chips.className = 'step-chips';
  stage.appendChild(chips);
  stage.appendChild(buildCurrentCard());
  const next = document.createElement('div');
  next.className = 'step-next';
  stage.appendChild(next);
  stage.appendChild(buildActions());
  return stage;
}

function buildTracker() {
  const tracker = document.createElement('div');
  tracker.className = 'step-tracker';

  const label = document.createElement('span');
  label.className = 'step-tracker__label';
  label.textContent = 'Progresso';

  const progress = document.createElement('div');
  progress.className = 'step-tracker__progress';

  const count = document.createElement('span');
  count.className = 'step-tracker__count';

  tracker.appendChild(label);
  tracker.appendChild(progress);
  tracker.appendChild(count);
  return tracker;
}

function buildCurrentCard() {
  const card = document.createElement('article');
  card.className = 'step-current';

  const tag = document.createElement('div');
  tag.className = 'step-current__tag';
  tag.textContent = 'Etapa atual';

  const number = document.createElement('div');
  number.className = 'step-current__number';

  const body = document.createElement('div');
  body.className = 'step-current__body';

  card.appendChild(tag);
  card.appendChild(number);
  card.appendChild(body);
  return card;
}

function buildActions() {
  const actions = document.createElement('div');
  actions.className = 'step-actions';

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'step-action';
  prev.dataset.action = 'prev';
  prev.textContent = '❮ Anterior';

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'step-action primary';
  next.dataset.action = 'next';
  next.textContent = 'Próximo ❯';

  const finish = document.createElement('button');
  finish.type = 'button';
  finish.className = 'step-action finish';
  finish.dataset.action = 'finish';
  finish.textContent = 'Concluir';

  actions.appendChild(prev);
  actions.appendChild(next);
  actions.appendChild(finish);
  return actions;
}

/**
 * Renders the end screen (completion or timeout).
 */
export function renderEndScreen(
  root,
  { kind, kicker, stampPrefix, stampAccent, subtitle, stats, primaryLabel, onPrimary, onSecondary }
) {
  clearRoot(root);

  const stage = document.createElement('section');
  stage.className = 'pass-stage';
  stage.dataset.screen = `end-${kind}`;

  const end = document.createElement('div');
  end.className = `service-end${kind === 'timeout' ? ' timeout' : ''}`;

  const kickerEl = document.createElement('div');
  kickerEl.className = 'service-end__kicker';
  kickerEl.textContent = kicker;

  const stamp = document.createElement('h1');
  stamp.className = 'service-end__stamp';
  stamp.appendChild(document.createTextNode(`${stampPrefix} `));
  const em = document.createElement('em');
  em.textContent = stampAccent;
  stamp.appendChild(em);

  const sub = document.createElement('p');
  sub.className = 'service-end__sub';
  sub.textContent = subtitle;

  const statsRow = document.createElement('div');
  statsRow.className = 'service-end__stats';
  stats.forEach((s) => statsRow.appendChild(buildEndStat(s)));

  const actions = document.createElement('div');
  actions.className = 'service-end__actions';

  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'service-end__action';
  primary.textContent = primaryLabel;
  primary.addEventListener('click', onPrimary);

  const secondary = document.createElement('button');
  secondary.type = 'button';
  secondary.className = 'service-end__action outline';
  secondary.textContent = 'Voltar ao menu';
  secondary.addEventListener('click', onSecondary);

  actions.appendChild(primary);
  actions.appendChild(secondary);

  end.appendChild(kickerEl);
  end.appendChild(stamp);
  end.appendChild(sub);
  end.appendChild(statsRow);
  end.appendChild(actions);

  stage.appendChild(end);
  root.appendChild(stage);
}

function buildEndStat({ label, value, emphasis }) {
  const stat = document.createElement('div');
  stat.className = 'service-end__stat';

  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = label;

  const valueEl = document.createElement('div');
  valueEl.className = 'value';
  if (emphasis && typeof value === 'string' && /[\d:]/.test(value)) {
    const parts = value.split(':');
    if (parts.length === 2) {
      const emEl = document.createElement('em');
      emEl.textContent = parts[0];
      valueEl.appendChild(emEl);
      valueEl.appendChild(document.createTextNode(':' + parts[1]));
    } else {
      valueEl.textContent = value;
    }
  } else {
    valueEl.textContent = value;
  }

  stat.appendChild(labelEl);
  stat.appendChild(valueEl);
  return stat;
}

/**
 * Renders ingredients as a grid list with category support.
 * Returns a <ul> element.
 */
export function renderIngredients(ingredients) {
  const list = document.createElement('ul');
  list.className = 'ingredients-grid';

  ingredients.forEach((raw) => {
    const text = (raw || '').trim();
    if (!text) return;

    if (text.startsWith('__CATEGORY__')) {
      const li = document.createElement('li');
      li.className = 'category';
      li.textContent = text.replace('__CATEGORY__', '').trim();
      list.appendChild(li);
      return;
    }

    const li = document.createElement('li');
    const qtyMatch = text.match(
      /^(.*?)(?:\s+)?(\d+[\d.,/\s]*\s*(?:g|kg|ml|l|un|unidades?|colheres? de (?:sopa|chá|café)|c\.?\s*de\s*sopa|dentes?|ramos?|folhas?|q\.?b\.?)\b.*)$/i
    );
    const namePart = qtyMatch ? qtyMatch[1].trim().replace(/[-:]\s*$/, '').trim() : '';
    if (qtyMatch && namePart) {
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = namePart;
      const qty = document.createElement('span');
      qty.textContent = qtyMatch[2].trim();
      li.appendChild(name);
      li.appendChild(qty);
    } else {
      li.textContent = text;
    }

    list.appendChild(li);
  });

  return list;
}

/**
 * Renders tips as a quoted list.
 */
export function renderTips(tips) {
  const list = document.createElement('ul');
  list.className = 'tips-list';
  tips.forEach((tip) => {
    const text = (tip || '').trim();
    if (!text) return;
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
  return list;
}

/**
 * Builds a collapsible panel (used for mise en place and chef tips).
 */
export function createCollapsiblePanel({ title, count, body, open }) {
  const panel = document.createElement('section');
  panel.className = 'service-panel';
  panel.dataset.open = open ? 'true' : 'false';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'service-panel__toggle';

  const titleEl = document.createElement('span');
  titleEl.textContent = title;

  const right = document.createElement('span');
  right.className = 'service-panel__toggle-right';

  const countEl = document.createElement('span');
  countEl.className = 'service-panel__toggle-count';
  countEl.textContent = count || '';

  const icon = document.createElement('span');
  icon.className = 'service-panel__toggle-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '+';

  right.appendChild(countEl);
  right.appendChild(icon);

  toggle.appendChild(titleEl);
  toggle.appendChild(right);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'service-panel__body';
  const bodyInner = document.createElement('div');
  bodyInner.className = 'service-panel__body-inner';
  bodyInner.appendChild(body);
  bodyWrap.appendChild(bodyInner);

  toggle.addEventListener('click', () => {
    const current = panel.dataset.open === 'true';
    panel.dataset.open = current ? 'false' : 'true';
  });

  panel.appendChild(toggle);
  panel.appendChild(bodyWrap);
  return panel;
}

/**
 * Creates and mounts a confirm dialog. Returns nothing; manages its own lifecycle.
 */
export function createConfirmDialog({ kicker, title, message, confirmLabel, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';

  if (kicker) {
    const kickerEl = document.createElement('div');
    kickerEl.className = 'confirm-dialog__kicker';
    kickerEl.textContent = kicker;
    dialog.appendChild(kickerEl);
  }

  const titleEl = document.createElement('h3');
  titleEl.className = 'confirm-dialog__title';
  titleEl.textContent = title;
  dialog.appendChild(titleEl);

  if (message) {
    const messageEl = document.createElement('p');
    messageEl.className = 'confirm-dialog__message';
    messageEl.textContent = message;
    dialog.appendChild(messageEl);
  }

  const buttons = document.createElement('div');
  buttons.className = 'confirm-dialog__buttons';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'confirm-dialog__button';
  cancel.textContent = 'Cancelar';

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'confirm-dialog__button primary';
  confirm.textContent = confirmLabel || 'Confirmar';

  buttons.appendChild(cancel);
  buttons.appendChild(confirm);
  dialog.appendChild(buttons);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  cancel.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  confirm.addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });
  document.addEventListener('keydown', onKey);

  setTimeout(() => confirm.focus(), 10);
}
