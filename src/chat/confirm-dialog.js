function confirmDialog({ kicker, heading, body, warning, confirmLabel }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');

  const kickerElement = document.createElement('span');
  kickerElement.className = 'sidebar-kicker';
  kickerElement.textContent = kicker;

  const headingElement = document.createElement('h2');
  headingElement.id = 'confirm-dialog-title';
  headingElement.textContent = heading;

  const bodyElement = document.createElement('p');
  bodyElement.textContent = body;

  const warningElement = document.createElement('p');
  warningElement.className = 'dialog-warning';
  warningElement.textContent = warning;

  const actions = document.createElement('div');
  actions.className = 'dialog-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button-ghost';
  cancel.textContent = 'Cancelar';

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'button-danger';
  confirm.textContent = confirmLabel;

  actions.append(cancel, confirm);
  dialog.append(kickerElement, headingElement, bodyElement, warningElement, actions);
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
      if (event.key === 'Escape') close(false);
    }

    document.addEventListener('keydown', onKeyDown);
    cancel.addEventListener('click', () => close(false));
    confirm.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
    });
  });
}

export function confirmDeleteConversation(title) {
  return confirmDialog({
    kicker: 'Apagar conversa',
    heading: `Apagar "${title}"?`,
    body: 'A conversa e todas as mensagens saem da tua conta.',
    warning: 'Isto não tem volta.',
    confirmLabel: 'Apagar',
  });
}
