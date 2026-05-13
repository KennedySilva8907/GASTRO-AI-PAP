import { getSupabaseClient } from './client.js';
import { API_ENDPOINTS } from '../shared/constants.js';

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function initials(nameOrEmail) {
  const source = (nameOrEmail || '').trim();
  if (!source) return '·';
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function fillUsage(usage, plan) {
  const limits = {
    chat: plan === 'pro' ? 100 : 10,
    challenge_recipe: plan === 'pro' ? 30 : 3,
  };

  const chat = usage?.chat || { used: 0, limit: limits.chat };
  const ch = usage?.challenge_recipe || { used: 0, limit: limits.challenge_recipe };

  setText('chat-count', `${chat.used} / ${chat.limit}`);
  const chatPct = Math.min(100, (chat.used / chat.limit) * 100);
  const chatFill = document.getElementById('chat-fill');
  chatFill.style.width = `${chatPct}%`;
  chatFill.classList.toggle('account-usage__fill--full', chat.used >= chat.limit);

  setText('challenge-count', `${ch.used} / ${ch.limit}`);
  const chPct = Math.min(100, (ch.used / ch.limit) * 100);
  const chFill = document.getElementById('challenge-fill');
  chFill.style.width = `${chPct}%`;
  chFill.classList.toggle('account-usage__fill--full', ch.used >= ch.limit);
}

function showActionError(buttonId, message) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  const label = btn.querySelector('span:first-child');
  if (label) label.textContent = message;
  btn.classList.add('account-action--danger');
  setTimeout(() => {
    btn.disabled = false;
  }, 1500);
}

async function startCheckout(session) {
  const btn = document.getElementById('upgrade-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(API_ENDPOINTS.billingCheckout, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: '{}',
    });
    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
    showActionError('upgrade-btn', 'Não foi possível abrir o checkout. Tenta novamente.');
  } catch {
    showActionError('upgrade-btn', 'Erro de ligação. Tenta novamente.');
  }
}

async function openPortal(session) {
  const btn = document.getElementById('portal-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(API_ENDPOINTS.billingPortal, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: '{}',
    });
    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
    showActionError('portal-btn', 'Não foi possível abrir o portal. Tenta novamente.');
  } catch {
    showActionError('portal-btn', 'Erro de ligação. Tenta novamente.');
  }
}

async function init() {
  let supabase;
  try {
    supabase = await getSupabaseClient();
  } catch {
    window.location.href = '/auth/login';
    return;
  }

  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) {
    window.location.href = '/auth/login?redirect=' + encodeURIComponent('/auth/account');
    return;
  }

  // Fill identity from session metadata
  const name = session.user?.user_metadata?.name || session.user?.user_metadata?.full_name || '';
  const email = session.user?.email || '';
  const display = name || email.split('@')[0] || 'Conta';

  setText('user-name', display);
  setText('user-email', email);
  setText('avatar', initials(name || email));

  // Wire logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  });

  // Fetch plan + usage from server
  try {
    const res = await fetch(API_ENDPOINTS.authSession, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: '{}',
    });
    if (!res.ok) throw new Error('plan fetch failed');
    const payload = await res.json();
    const plan = payload?.plan === 'pro' ? 'pro' : 'free';

    const badge = document.getElementById('plan-badge');
    badge.textContent = plan === 'pro' ? 'Pro' : 'Free';
    badge.classList.toggle('account-plan-badge--pro', plan === 'pro');
    badge.classList.toggle('account-plan-badge--free', plan !== 'pro');

    fillUsage(payload?.usage, plan);

    if (plan === 'pro') {
      const portalBtn = document.getElementById('portal-btn');
      portalBtn.hidden = false;
      portalBtn.addEventListener('click', () => openPortal(session));
    } else {
      const upgradeBtn = document.getElementById('upgrade-btn');
      upgradeBtn.hidden = false;
      upgradeBtn.addEventListener('click', () => startCheckout(session));
    }
  } catch {
    // Show defaults if plan/usage fetch fails — page still functional
    fillUsage(null, 'free');
    const upgradeBtn = document.getElementById('upgrade-btn');
    upgradeBtn.hidden = false;
    upgradeBtn.addEventListener('click', () => startCheckout(session));
  }
}

document.addEventListener('DOMContentLoaded', init);
