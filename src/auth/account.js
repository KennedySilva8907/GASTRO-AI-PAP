import { getSupabaseClient } from './client.js';
import { API_ENDPOINTS } from '../shared/constants.js';
import { initials } from './initials.js';

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

const AVATAR_BUCKET = 'avatars';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB Supabase bucket limit
const AVATAR_INPUT_MAX_BYTES = 15 * 1024 * 1024; // accept up to 15 MB on input, then compress
const AVATAR_MAX_DIMENSION = 768; // avatars rendered ≤ 3rem; 768px covers retina + future use
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

/**
 * Take any user-supplied image and return a JPEG Blob ≤ 2MB.
 * Resizes down to AVATAR_MAX_DIMENSION on the longest side, then reduces JPEG
 * quality progressively until it fits. Avoids sending the user back with
 * "Imagem demasiado grande" — most phone photos are >2MB.
 */
async function compressImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('decode failed'));
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width > AVATAR_MAX_DIMENSION || height > AVATAR_MAX_DIMENSION) {
    const ratio = Math.min(AVATAR_MAX_DIMENSION / width, AVATAR_MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  // Try qualities 0.92 → 0.5 until under the limit
  for (const quality of [0.92, 0.85, 0.78, 0.7, 0.6, 0.5]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= AVATAR_MAX_BYTES) {
      return blob;
    }
  }

  throw new Error('Could not compress image small enough');
}

function showAvatarImage(url) {
  const img = document.getElementById('avatar-img');
  const initialsEl = document.getElementById('avatar-initials');
  if (!img || !initialsEl) return;
  // If the image fails to load (404, network, broken URL), automatically
  // fall back to initials so the user never sees an empty/broken avatar.
  img.onerror = () => {
    img.hidden = true;
    img.removeAttribute('src');
    initialsEl.hidden = false;
  };
  img.src = url;
  img.hidden = false;
  initialsEl.hidden = true;
}

function showAvatarInitials(text) {
  const img = document.getElementById('avatar-img');
  const initialsEl = document.getElementById('avatar-initials');
  if (!img || !initialsEl) return;
  initialsEl.textContent = text;
  initialsEl.hidden = false;
  img.hidden = true;
  img.removeAttribute('src');
}

function flashAvatarError(message) {
  // Show error in the user-name slot briefly — non-blocking, no alert popup.
  const nameEl = document.getElementById('user-name');
  if (!nameEl) return;
  const original = nameEl.textContent;
  nameEl.textContent = message;
  nameEl.style.color = '#ef9a9a';
  setTimeout(() => {
    nameEl.textContent = original;
    nameEl.style.color = '';
  }, 2400);
}

function wireAvatarUpload(supabase, session) {
  const btn = document.getElementById('avatar-btn');
  const input = document.getElementById('avatar-input');
  if (!btn || !input) return;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      flashAvatarError('Formato inválido. Usa JPG, PNG, WebP, GIF ou BMP.');
      return;
    }
    if (file.size > AVATAR_INPUT_MAX_BYTES) {
      flashAvatarError('Imagem demasiado grande. Máximo 15 MB.');
      return;
    }

    // Optimistic preview from the original file (instant feedback)
    const previewUrl = URL.createObjectURL(file);
    showAvatarImage(previewUrl);
    btn.classList.add('is-uploading');

    try {
      // Resize + compress to ≤2MB so any phone photo works regardless of size
      const blob = await compressImage(file);

      const path = `${session.user.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) {
        // Surface the real Supabase message so misconfigured buckets/policies
        // can be diagnosed instead of always showing a generic "tenta de novo".
        const msg = uploadError.message || '';
        if (/bucket.*not found|404/i.test(msg)) {
          throw new Error('Bucket "avatars" não existe no Supabase.');
        }
        if (/policy|row-level security|rls/i.test(msg)) {
          throw new Error('Falta permissão no bucket. Verifica as policies SQL.');
        }
        if (/payload.*too large|413/i.test(msg)) {
          throw new Error('Imagem ainda demasiado grande depois de comprimir.');
        }
        throw new Error(msg || 'Upload falhou.');
      }

      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('Não foi possível obter o URL público.');

      // Persist under a custom field name. Supabase OAuth providers (Google)
      // overwrite `avatar_url` with the IdP's picture on every sign-in,
      // so storing there means the uploaded photo gets wiped at logout/login.
      // `custom_avatar` is namespaced to us — no provider touches it.
      const { error: updateError } = await supabase.auth.updateUser({
        data: { custom_avatar: publicUrl },
      });
      if (updateError) throw updateError;

      // Swap the local blob preview for the persistent CDN URL
      showAvatarImage(publicUrl);
      URL.revokeObjectURL(previewUrl);
    } catch (err) {
      flashAvatarError(err?.message || 'Não foi possível guardar a foto.');
      // Revert preview — fall back to initials if there's no prior avatar
      URL.revokeObjectURL(previewUrl);
      // Read order: custom upload > Google OAuth photo > Google picture > initials
      const meta = session.user?.user_metadata || {};
      const existing = meta.custom_avatar || meta.avatar_url || meta.picture;
      if (existing) showAvatarImage(existing);
      else showAvatarInitials(document.getElementById('avatar-initials')?.dataset.fallback || '·');
    } finally {
      btn.classList.remove('is-uploading');
    }
  });
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

  // session.user.user_metadata can be stale right after sign-in (the JWT
  // captures it at issue time, doesn't refetch on update). Pull fresh
  // user data from the server so the avatar_url set last session shows up.
  let user = session.user;
  try {
    const { data: fresh } = await supabase.auth.getUser();
    if (fresh?.user) user = fresh.user;
  } catch {
    // ignore — fall back to the session.user we already have
  }

  // Fill identity from (fresh) user metadata
  const name = user?.user_metadata?.name || user?.user_metadata?.full_name || '';
  const email = user?.email || '';
  const display = name || email.split('@')[0] || 'Conta';
  const fallbackInitials = initials(name || email);

  setText('user-name', display);
  setText('user-email', email);

  // Avatar priority: custom upload (our field, immune to OAuth resets) →
  // Google's avatar_url (gets overwritten on every Google sign-in) →
  // Google's picture (same) → initials fallback.
  const meta = user?.user_metadata || {};
  const avatarUrl = meta.custom_avatar || meta.avatar_url || meta.picture;
  const initialsEl = document.getElementById('avatar-initials');
  if (initialsEl) {
    initialsEl.textContent = fallbackInitials;
    initialsEl.dataset.fallback = fallbackInitials;
  }
  if (avatarUrl) {
    showAvatarImage(avatarUrl);
  }

  wireAvatarUpload(supabase, session);

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

// Only register the DOM listener in browser environments. Vitest in Node
// imports this module to reuse `initials()`, where `document` is undefined.
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
