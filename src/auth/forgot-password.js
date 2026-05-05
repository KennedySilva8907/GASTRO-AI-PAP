import { getSupabaseClient } from './client.js';

function setFeedback(el, kind, message) {
  el.textContent = message;
  el.className = `auth-feedback auth-feedback--${kind}`;
  el.hidden = false;
}

async function init() {
  const form = document.getElementById('forgot-form');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('submit-btn');
  const feedback = document.getElementById('feedback');

  let supabase;
  try {
    supabase = await getSupabaseClient();
  } catch {
    setFeedback(feedback, 'err', 'Falha ao carregar serviço de autenticação.');
    submitBtn.disabled = true;
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.hidden = true;

    const email = emailInput.value.trim();
    if (!email) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'A enviar…';

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;

      setFeedback(
        feedback,
        'ok',
        'Se a conta existir, vais receber um link em segundos. Verifica também a pasta de spam.'
      );
      submitBtn.textContent = 'Link enviado ✓';
    } catch {
      setFeedback(feedback, 'err', 'Não foi possível enviar o link. Tenta novamente.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar link de recuperação';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
