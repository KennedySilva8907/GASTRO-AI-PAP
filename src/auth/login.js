import { getSupabaseClient } from './client.js';

const REDIRECT_KEY = 'gastro-auth-redirect';

async function init() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '/';
  sessionStorage.setItem(REDIRECT_KEY, redirect);

  try {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      window.location.replace(redirect);
      return;
    }
  } catch {
    // not authenticated — show form
  }

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const submitBtn = document.getElementById('login-submit');
  const feedback = document.getElementById('login-feedback');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'A enviar…';
    feedback.hidden = true;

    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      feedback.textContent =
        'Link enviado! Verifica o teu email e clica no link para entrar.';
      feedback.className = 'login-feedback login-feedback--ok';
      feedback.hidden = false;
      submitBtn.textContent = 'Link enviado ✓';
    } catch {
      feedback.textContent = 'Não foi possível enviar o link. Tenta novamente.';
      feedback.className = 'login-feedback login-feedback--err';
      feedback.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar link mágico';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
