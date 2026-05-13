import { getCurrentSession, promptForLogin } from '../auth/session.js';
import { UserFacingError } from './errors.js';

export async function fetchWithAuth(url, options = {}, sessionProvider = getCurrentSession) {
  const session = await sessionProvider();
  const token = session?.access_token;

  if (!token) {
    promptForLogin();
    const error = new UserFacingError(
      'Authentication required',
      'Inicia sessão para usar esta funcionalidade de IA.'
    );
    error.requiresAuth = true;
    throw error;
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
