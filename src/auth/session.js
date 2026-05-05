import { getSupabaseClient } from './client.js';
import { API_ENDPOINTS } from '../shared/constants.js';

const REDIRECT_KEY = 'gastro-auth-redirect';

let accountBar = null;
let cachedSession = null;
let cachedPlan = null;

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
  if (typeof window === 'undefined') return;
  const redirect = window.location.pathname + window.location.search;
  sessionStorage.setItem(REDIRECT_KEY, redirect);
  window.location.href = `/auth/login?redirect=${encodeURIComponent(redirect)}`;
}

async function fetchPlan(session) {
  if (!session) return null;
  try {
    const res = await fetch(API_ENDPOINTS.authSession, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: '{}',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.plan || null;
  } catch {
    return null;
  }
}

async function refreshAccountState() {
  if (!accountBar) return;

  const session = await getCurrentSession();
  const status = accountBar.querySelector('[data-account-status]');
  const loginButton = accountBar.querySelector('[data-account-login]');
  const logoutButton = accountBar.querySelector('[data-account-logout]');
  const upgradeButton = accountBar.querySelector('[data-account-upgrade]');

  if (!session) {
    status.textContent = 'Inicia sessão para usar IA';
    loginButton.hidden = false;
    logoutButton.hidden = true;
    upgradeButton.hidden = true;
    cachedPlan = null;
    return;
  }

  const email = session.user?.email ?? '';
  // Show plan in status if known
  if (cachedPlan) {
    const label = cachedPlan === 'pro' ? 'Pro' : 'Free';
    status.textContent = email ? `${label} · ${email}` : label;
  } else {
    status.textContent = email ? `Conta: ${email}` : 'Conta ativa';
    // Fetch plan in the background (non-blocking)
    fetchPlan(session).then((plan) => {
      cachedPlan = plan;
      if (!accountBar) return;
      const newLabel = plan === 'pro' ? 'Pro' : 'Free';
      status.textContent = email ? `${newLabel} · ${email}` : newLabel;
      // Hide upgrade button for Pro users
      if (plan === 'pro') upgradeButton.hidden = true;
    });
  }

  loginButton.hidden = true;
  logoutButton.hidden = false;
  upgradeButton.hidden = cachedPlan === 'pro';
}

async function startCheckout() {
  const session = await getCurrentSession();
  if (!session) {
    promptForLogin();
    return;
  }

  try {
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
  } catch {
    // silently ignore — user can retry
  }
}

export async function initAccountBar() {
  if (accountBar || !document?.body) return accountBar;

  accountBar = document.createElement('aside');
  accountBar.className = 'account-bar';
  accountBar.setAttribute('aria-label', 'Conta GastroAI');

  const status = document.createElement('span');
  status.className = 'account-bar__status';
  status.dataset.accountStatus = '';
  status.textContent = 'Inicia sessão para usar IA';
  accountBar.appendChild(status);

  const loginButton = createButton('account-bar__button', 'Entrar');
  loginButton.dataset.accountLogin = 'true';
  loginButton.addEventListener('click', promptForLogin);

  const upgradeButton = createButton('account-bar__button account-bar__button--pro', 'Upgrade Pro');
  upgradeButton.dataset.accountUpgrade = 'true';
  upgradeButton.hidden = true;
  upgradeButton.addEventListener('click', startCheckout);

  const logoutButton = createButton('account-bar__button account-bar__button--muted', 'Sair');
  logoutButton.dataset.accountLogout = 'true';
  logoutButton.hidden = true;
  logoutButton.addEventListener('click', async () => {
    try {
      const supabase = await getSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    cachedSession = null;
    cachedPlan = null;
    window.location.href = '/';
  });

  accountBar.append(loginButton, upgradeButton, logoutButton);

  // Resolve session BEFORE inserting into DOM to avoid a "Inicia sessão" flash
  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    cachedSession = data?.session || null;
    supabase.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
      cachedPlan = null;
      refreshAccountState();
    });
  } catch {
    // ignore — bar still renders without auth wiring
  }

  await refreshAccountState();
  document.body.prepend(accountBar);
  return accountBar;
}
