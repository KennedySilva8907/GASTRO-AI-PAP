import { getSupabaseClient } from './client.js';

function setFeedback(el, kind, message) {
  el.textContent = message;
  el.className = `auth-feedback auth-feedback--${kind}`;
  el.hidden = false;
}

function describeError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('already registered') || msg.includes('user already')) {
    return 'Já existe uma conta com esse email. Tenta entrar ou recuperar a senha.';
  }
  if (msg.includes('password')) {
    return 'Senha inválida. Usa pelo menos 8 caracteres.';
  }
  if (msg.includes('rate limit')) {
    return 'Demasiadas tentativas. Tenta daqui a uns minutos.';
  }
  return 'Não foi possível criar a conta. Tenta novamente.';
}

async function init() {
  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
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

  // Already authenticated → home
  const { data: existing } = await supabase.auth.getSession();
  if (existing?.session) {
    window.location.replace('/');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.hidden = true;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (!name || name.length < 2) {
      setFeedback(feedback, 'err', 'Indica o teu nome (mínimo 2 caracteres).');
      return;
    }
    if (!email) {
      setFeedback(feedback, 'err', 'Email é obrigatório.');
      return;
    }
    if (password.length < 8) {
      setFeedback(feedback, 'err', 'A senha precisa de ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setFeedback(feedback, 'err', 'As senhas não coincidem.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'A criar conta…';

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;

      // If email confirmation is required, session is null until user clicks the link
      if (!data?.session) {
        setFeedback(
          feedback,
          'ok',
          'Conta criada! Verifica o teu email e clica no link para confirmar.'
        );
        submitBtn.textContent = 'Verifica o teu email';
        return;
      }

      // Auto-login flow (email confirmation disabled in Supabase)
      window.location.replace('/');
    } catch (err) {
      setFeedback(feedback, 'err', describeError(err));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar conta';
    }
  });

  googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    feedback.hidden = true;
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setFeedback(feedback, 'err', 'Não foi possível abrir o login Google.');
      googleBtn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
