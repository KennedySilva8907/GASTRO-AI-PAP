import { getSupabaseClient } from './client.js';
import { API_ENDPOINTS } from '../shared/constants.js';

let accountBar = null;
let loginDialog = null;
let cachedSession = null;

function createButton(className, text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

export async function getCurrentSession() {
  if (cachedSession) return cachedSession;

  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    cachedSession = data?.session || null;
    return cachedSession;
  } catch {
    return null;
  }
}

export function promptForLogin() {
  if (!loginDialog) return;
  loginDialog.hidden = false;
  loginDialog.querySelector('input[type="email"]')?.focus();
}

async function refreshAccountState() {
  if (!accountBar) return;

  const session = await getCurrentSession();
  const status = accountBar.querySelector('[data-account-status]');
  const loginButton = accountBar.querySelector('[data-account-login]');
  const logoutButton = accountBar.querySelector('[data-account-logout]');
  const upgradeButton = accountBar.querySelector('[data-account-upgrade]');

  if (!session) {
    status.textContent = 'Free: inicia sessão para usar IA';
    loginButton.hidden = false;
    logoutButton.hidden = true;
    upgradeButton.hidden = true;
    return;
  }

  status.textContent = session.user?.email ? `Conta: ${session.user.email}` : 'Conta ativa';
  loginButton.hidden = true;
  logoutButton.hidden = false;
  upgradeButton.hidden = false;
}

async function startCheckout() {
  const session = await getCurrentSession();
  if (!session) {
    promptForLogin();
    return;
  }

  const response = await fetch(API_ENDPOINTS.billingCheckout, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: '{}',
  });
  const data = await response.json();
  if (data?.url) {
    window.location.href = data.url;
  }
}

function createLoginDialog() {
  const dialog = document.createElement('section');
  dialog.className = 'account-dialog';
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="account-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="account-login-title">
      <button type="button" class="account-dialog__close" aria-label="Fechar" data-account-close>&times;</button>
      <p class="account-dialog__kicker">GastroAI V3</p>
      <h2 id="account-login-title">Entra para usar a IA</h2>
      <p>Recebe um link seguro no email e desbloqueia os teus limites Free/Pro.</p>
      <form data-account-form>
        <input type="email" name="email" placeholder="o-teu-email@exemplo.com" required>
        <button type="submit">Enviar magic link</button>
      </form>
      <small data-account-feedback></small>
    </div>
  `;

  dialog.querySelector('[data-account-close]').addEventListener('click', () => {
    dialog.hidden = true;
  });

  dialog.querySelector('[data-account-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = dialog.querySelector('[data-account-feedback]');
    const email = form.elements.email.value.trim();
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    feedback.textContent = error
      ? 'Não foi possível enviar o link. Tenta novamente.'
      : 'Link enviado. Confirma o teu email para entrar.';
  });

  return dialog;
}

export async function initAccountBar() {
  if (accountBar || !document?.body) return accountBar;

  accountBar = document.createElement('aside');
  accountBar.className = 'account-bar';
  accountBar.innerHTML = `
    <span class="account-bar__status" data-account-status>Free: inicia sessão para usar IA</span>
  `;

  const loginButton = createButton('account-bar__button', 'Entrar');
  loginButton.dataset.accountLogin = 'true';
  loginButton.addEventListener('click', promptForLogin);

  const upgradeButton = createButton('account-bar__button account-bar__button--pro', 'Upgrade Pro');
  upgradeButton.dataset.accountUpgrade = 'true';
  upgradeButton.hidden = true;
  upgradeButton.addEventListener('click', startCheckout);

  const logoutButton = createButton('account-bar__button', 'Sair');
  logoutButton.dataset.accountLogout = 'true';
  logoutButton.hidden = true;
  logoutButton.addEventListener('click', async () => {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
    cachedSession = null;
    refreshAccountState();
  });

  accountBar.append(loginButton, upgradeButton, logoutButton);
  loginDialog = createLoginDialog();
  document.body.prepend(accountBar);
  document.body.append(loginDialog);

  const supabase = await getSupabaseClient();
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session;
    refreshAccountState();
  });
  await refreshAccountState();

  return accountBar;
}
