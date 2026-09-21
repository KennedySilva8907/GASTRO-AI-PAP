const UNTITLED = 'Conversa nova';
const RADIO_NAME = 'conversation-to-drop';

function oldestFirst(conversations) {
  return [...conversations].sort(
    (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  );
}

function buildChoice(conversation, isOldest) {
  const label = document.createElement('label');
  label.className = 'choice';

  const input = document.createElement('input');
  input.type = 'radio';
  input.name = RADIO_NAME;
  input.value = conversation.id;
  input.checked = isOldest;

  const text = document.createElement('span');
  text.className = 'choice-text';

  const title = document.createElement('span');
  title.className = 'choice-title';
  title.appendChild(document.createTextNode(conversation.title || UNTITLED));

  if (isOldest) {
    const flag = document.createElement('span');
    flag.className = 'choice-flag';
    flag.textContent = 'mais antiga';
    title.appendChild(flag);
  }

  const meta = document.createElement('span');
  meta.className = 'choice-meta';
  meta.textContent = `${conversation.message_count} mensagens`;

  text.append(title, meta);
  label.append(input, text);
  return label;
}

export function askWhichToDelete({ conversations, limit = 3 }) {
  const ordered = oldestFirst(conversations);
  const oldestId = ordered[0]?.id;

  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'limit-dialog-title');

  const kicker = document.createElement('span');
  kicker.className = 'sidebar-kicker';
  kicker.textContent = 'Plano free';

  const heading = document.createElement('h2');
  heading.id = 'limit-dialog-title';
  heading.textContent = `Já tens ${limit} conversas guardadas`;

  const lead = document.createElement('p');
  lead.textContent =
    'Para começar esta, escolhe qual queres apagar. A tua pergunta fica guardada e segue assim que decidires.';

  const choices = document.createElement('div');
  choices.className = 'dialog-choice';
  ordered.forEach((conversation) => {
    choices.appendChild(buildChoice(conversation, conversation.id === oldestId));
  });

  const warning = document.createElement('p');
  warning.className = 'dialog-warning';
  warning.textContent = 'Isto não tem volta — a conversa e as mensagens desaparecem.';

  const actions = document.createElement('div');
  actions.className = 'dialog-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button-ghost';
  cancel.textContent = 'Cancelar';

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'button-danger';
  confirm.textContent = 'Apagar e continuar';

  actions.append(cancel, confirm);
  dialog.append(kicker, heading, lead, choices, warning, actions);
  backdrop.appendChild(dialog);
  document.getElementById('chat-container').appendChild(backdrop);
  confirm.focus();

  return new Promise((resolve) => {
    function close(value) {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      resolve(value);
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') close(null);
    }

    document.addEventListener('keydown', onKeyDown);
    cancel.addEventListener('click', () => close(null));

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(null);
    });

    confirm.addEventListener('click', () => {
      const chosen = dialog.querySelector(`input[name="${RADIO_NAME}"]:checked`);
      close(chosen ? chosen.value : null);
    });
  });
}
