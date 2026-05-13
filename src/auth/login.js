import { getSupabaseClient, sanitizeRedirect } from './client.js';

const REDIRECT_KEY = 'gastro-auth-redirect';

function setFeedback(el, kind, message) {
  el.textContent = message;
  el.className = `auth-feedback auth-feedback--${kind}`;
  el.hidden = false;
}

function describeError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'Email ou senha incorretos.';
  }
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return 'Confirma o teu email antes de entrar. Verifica a caixa de entrada.';
  }
  if (msg.includes('rate limit')) {
    return 'Demasiadas tentativas. Tenta novamente daqui a uns minutos.';
  }
  return 'Não foi possível entrar. Tenta novamente.';
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const redirect = sanitizeRedirect(params.get('redirect'));
  sessionStorage.setItem(REDIRECT_KEY, redirect);

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const googleBtn = document.getElementById('google-btn');
  const feedback = document.getElementById('feedback');

  let supabase;
  try {
    supabase = await getSupabaseClient();
  } catch {
    setFeedback(feedback, 'err', 'Falha ao carregar serviço de autenticação.');
    submitBtn.disabled = true;
    googleBtn.disabled = true;
    return;
  }

  // Already authenticated → go straight to redirect target
  const { data: existing } = await supabase.auth.getSession();
  if (existing?.session) {
    window.location.replace(redirect);
    return;
  }

  // Email + password login
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.hidden = true;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'A entrar…';

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      window.location.replace(redirect);
    } catch (err) {
      setFeedback(feedback, 'err', describeError(err));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  });

  // Google OAuth
  googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    feedback.hidden = true;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      // OAuth redirects automatically — no further code runs
    } catch {
      setFeedback(feedback, 'err', 'Não foi possível abrir o login Google.');
      googleBtn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
