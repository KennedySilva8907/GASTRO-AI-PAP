import { getSupabaseClient } from './client.js';

const REDIRECT_KEY = 'gastro-auth-redirect';

async function init() {
  const statusEl = document.getElementById('callback-status');
  const subEl = document.getElementById('callback-sub');

  function showError() {
    statusEl.textContent = 'Não foi possível verificar a sessão.';
    subEl.textContent = '';
    const link = document.createElement('a');
    link.href = '/auth/login';
    link.className = 'callback-retry';
    link.textContent = 'Tentar novamente';
    subEl.appendChild(link);
  }

  try {
    const supabase = await getSupabaseClient();

    // Give Supabase a moment to process the URL hash/code
    await new Promise((resolve) => setTimeout(resolve, 600));

    let session = (await supabase.auth.getSession()).data?.session;

    if (!session) {
      // Try explicit code exchange (PKCE flow)
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        session = (await supabase.auth.getSession()).data?.session;
      }
    }

    if (!session) throw new Error('no session');

    statusEl.textContent = 'Sessão iniciada!';
    subEl.textContent = 'A redirecionar…';

    const target = sessionStorage.getItem(REDIRECT_KEY) || '/';
    sessionStorage.removeItem(REDIRECT_KEY);

    setTimeout(() => window.location.replace(target), 500);
  } catch {
    showError();
  }
}

document.addEventListener('DOMContentLoaded', init);
