import { getSupabaseClient } from './client.js';

const REDIRECT_KEY = 'gastro-auth-redirect';

async function init() {
  const statusEl = document.getElementById('callback-status');
  const subEl = document.getElementById('callback-sub');

  function showError(msg) {
    statusEl.textContent = msg || 'Não foi possível verificar a sessão.';
    subEl.textContent = '';
    const link = document.createElement('a');
    link.href = '/auth/login';
    link.className = 'callback-retry';
    link.textContent = 'Voltar ao login';
    subEl.appendChild(link);
  }

  let supabase;
  try {
    supabase = await getSupabaseClient();
  } catch {
    showError('Falha ao carregar serviço de autenticação.');
    return;
  }

  // Wait for Supabase to detect & exchange the URL params (OAuth code or recovery token)
  const session = await new Promise((resolve) => {
    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        data.subscription.unsubscribe();
        resolve(sess);
      }
    });

    // Also check the current state in case it's already established
    supabase.auth.getSession().then(({ data: cur }) => {
      if (cur?.session) {
        data.subscription.unsubscribe();
        resolve(cur.session);
      }
    });

    setTimeout(() => {
      data.subscription.unsubscribe();
      resolve(null);
    }, 8000);
  });

  if (!session) {
    showError();
    return;
  }

  // Detect password recovery flow → send to reset-password page
  const isRecovery =
    window.location.hash.includes('type=recovery') ||
    new URLSearchParams(window.location.search).get('type') === 'recovery';

  if (isRecovery) {
    statusEl.textContent = 'Sessão de recuperação ativa';
    subEl.textContent = 'A redirecionar para a página de nova senha…';
    setTimeout(() => window.location.replace('/auth/reset-password'), 600);
    return;
  }

  statusEl.textContent = 'Sessão iniciada!';
  subEl.textContent = 'A redirecionar…';

  const target = sessionStorage.getItem(REDIRECT_KEY) || '/';
  sessionStorage.removeItem(REDIRECT_KEY);

  setTimeout(() => window.location.replace(target), 500);
}

document.addEventListener('DOMContentLoaded', init);
