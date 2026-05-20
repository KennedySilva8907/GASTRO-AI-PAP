import { getSupabaseClient, sanitizeRedirect } from './client.js';
import { initials } from './initials.js';
import { API_ENDPOINTS } from '../shared/constants.js';

const REDIRECT_KEY = 'gastro-auth-redirect';

let accountBar = null;
let avatarEls = null;
let cachedSession = null;
let cachedUser = null;
let cachedPlan = null;

// Fetch fresh user data from Supabase (forces a server roundtrip) so
// user_metadata.avatar_url updates show up after signOut + signIn.
// session.user is captured at JWT issue time and goes stale.
async function refreshCachedUser(supabase) {
  try {
    const { data } = await supabase.auth.getUser();
    cachedUser = data?.user || null;
  } catch {
    cachedUser = null;
  }
}

function createButton(className, text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

/**
 * Build the mini avatar (32px circle) shown at the start of the account-bar.
 * Renders the user photo when available, with initials as the always-present
 * fallback layer for failed loads, non-Google accounts, and not-yet-uploaded.
 */
function createMiniAvatar() {
  const wrap = document.createElement('span');
  wrap.className = 'account-bar__avatar';
  wrap.setAttribute('aria-hidden', 'true');

  const initialsSpan = document.createElement('span');
  initialsSpan.className = 'account-bar__avatar-initials';
  initialsSpan.textContent = '?';

  const img = document.createElement('img');
  img.className = 'account-bar__avatar-img';
  img.alt = '';
  img.hidden = true;
  // If the photo URL 404s or loads broken, revert to initials automatically
  img.addEventListener('error', () => {
    img.hidden = true;
    img.removeAttribute('src');
    initialsSpan.hidden = false;
  });

  wrap.append(initialsSpan, img);
  return { wrap, img, initialsSpan };
}

function updateMiniAvatar(avatarEls, session) {
  if (!avatarEls) return;
  const { img, initialsSpan } = avatarEls;

  const meta = session?.user?.user_metadata || {};
  // Priority: our custom upload first, then OAuth photos.
  // custom_avatar is namespaced so OAuth providers can't overwrite it.
  const photo = meta.custom_avatar || meta.avatar_url || meta.picture;
  const name = meta.name || meta.full_name || '';
  const email = session?.user?.email || '';

  initialsSpan.textContent = initials(name || email);

  if (photo) {
    img.src = photo;
    img.hidden = false;
    initialsSpan.hidden = true;
  } else {
    img.hidden = true;
    img.removeAttribute('src');
    initialsSpan.hidden = false;
  }
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
  // Same-origin path only — sanitize even though we built it from window.location
  // to defend against extension-injected exotic chars or malformed paths.
  const redirect = sanitizeRedirect(window.location.pathname + window.location.search);
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

  // Mini avatar reflects current session (photo / initials / hidden).
  // Pass the fresh user (cachedUser) so newly-uploaded avatars show up
  // after a fresh sign-in instead of staying on initials.
  if (avatarEls) {
    if (session) {
      avatarEls.wrap.hidden = false;
      updateMiniAvatar(avatarEls, { user: cachedUser || session.user });
    } else {
      avatarEls.wrap.hidden = true;
    }
  }

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
  const status = accountBar?.querySelector('[data-account-status]');
  if (!session) {
    promptForLogin();
    return;
  }

  try {
    if (status) status.textContent = 'A abrir Stripe Checkout...';
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
      return;
    }
    if (status) status.textContent = 'Não foi possível abrir o checkout.';
  } catch {
    if (status) status.textContent = 'Erro no checkout. Tenta novamente.';
  }
}

export async function initAccountBar() {
  if (accountBar || !document?.body) return accountBar;

  accountBar = document.createElement('aside');
  accountBar.className = 'account-bar';
  accountBar.setAttribute('aria-label', 'Conta GastroAI');

  // Mini avatar (photo or initials) — clickable, navigates to /auth/account
  avatarEls = createMiniAvatar();
  avatarEls.wrap.addEventListener('click', () => {
    if (cachedSession) window.location.href = '/auth/account';
  });
  accountBar.appendChild(avatarEls.wrap);

  const status = document.createElement('span');
  status.className = 'account-bar__status';
  status.dataset.accountStatus = '';
  status.textContent = 'Inicia sessão para usar IA';
  status.addEventListener('click', () => {
    if (cachedSession) window.location.href = '/auth/account';
  });
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
    if (cachedSession) {
      await refreshCachedUser(supabase);
    }
    supabase.auth.onAuthStateChange(async (_event, session) => {
      cachedSession = session;
      cachedPlan = null;
      if (session) {
        await refreshCachedUser(supabase);
      } else {
        cachedUser = null;
      }
      refreshAccountState();
    });
  } catch {
    // ignore — bar still renders without auth wiring
  }

  // Cross-tab sync: when Supabase writes/clears its session in localStorage from
  // another tab, refresh this tab's account-bar so logout/login propagate.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith('sb-')) {
        cachedSession = null;
        cachedUser = null;
        cachedPlan = null;
        refreshAccountState();
      }
    });
  }

  await refreshAccountState();
  // Insert into <html> instead of <body>. The chat page applies
  // `will-change: transform` on body, which turns body into the containing
  // block for fixed descendants — that breaks position:fixed/top:1rem and
  // the bar rendered at the flex-centered middle of the page. Anchoring to
  // documentElement bypasses any body transform/will-change effect.
  document.documentElement.appendChild(accountBar);
  return accountBar;
}
