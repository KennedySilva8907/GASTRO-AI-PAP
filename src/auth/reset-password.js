import { getSupabaseClient } from './client.js';

function setFeedback(el, kind, message) {
  el.textContent = message;
  el.className = `auth-feedback auth-feedback--${kind}`;
  el.hidden = false;
}

async function init() {
  const form = document.getElementById('reset-form');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
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

  // Wait for Supabase to process the recovery token from the URL
  await new Promise((resolve) => setTimeout(resolve, 400));

  // The recovery token gives us a temporary session. If absent, the link is invalid/expired.
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    setFeedback(
      feedback,
      'err',
      'Link inválido ou expirado. Pede um novo link de recuperação.'
    );
    submitBtn.disabled = true;
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.hidden = true;

    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (password.length < 6) {
      setFeedback(feedback, 'err', 'A senha precisa de ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setFeedback(feedback, 'err', 'As senhas não coincidem.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'A guardar…';

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setFeedback(feedback, 'ok', 'Senha atualizada! A redirecionar…');
      setTimeout(() => window.location.replace('/'), 1200);
    } catch {
      setFeedback(feedback, 'err', 'Não foi possível guardar a nova senha. Tenta novamente.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar nova senha';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
