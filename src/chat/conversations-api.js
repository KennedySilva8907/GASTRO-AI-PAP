import { fetchWithAuth } from '../shared/api-client.js';
import { API_ENDPOINTS } from '../shared/constants.js';
import { UserFacingError } from '../shared/errors.js';

export class ConversationLimitError extends Error {
  constructor({ limit, conversations } = {}) {
    super('Saved conversation limit reached');
    this.name = 'ConversationLimitError';
    this.limit = limit;
    this.conversations = conversations || [];
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function listConversations() {
  const response = await fetchWithAuth(API_ENDPOINTS.conversations);

  if (!response.ok) {
    throw new UserFacingError('List conversations failed', 'Não consegui carregar as conversas.');
  }

  const data = await readJson(response);
  return data.conversations || [];
}

export async function createConversation() {
  const response = await fetchWithAuth(API_ENDPOINTS.conversations, { method: 'POST' });

  if (response.status === 409) {
    throw new ConversationLimitError(await readJson(response));
  }

  if (!response.ok) {
    throw new UserFacingError(
      'Create conversation failed',
      'Não consegui começar uma conversa nova.'
    );
  }

  const data = await readJson(response);
  return data.conversation;
}

export async function loadConversation(id) {
  const response = await fetchWithAuth(`${API_ENDPOINTS.conversations}/${id}`);

  if (!response.ok) {
    throw new UserFacingError('Load conversation failed', 'Não consegui abrir essa conversa.');
  }

  return readJson(response);
}

export async function deleteConversation(id) {
  const response = await fetchWithAuth(`${API_ENDPOINTS.conversations}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new UserFacingError('Delete conversation failed', 'Não consegui apagar essa conversa.');
  }

  return true;
}

export async function requestTitle(id) {
  const response = await fetchWithAuth(`${API_ENDPOINTS.conversations}/${id}`, {
    method: 'PATCH',
  });

  if (!response.ok) return null;

  const data = await readJson(response);
  return data.title || null;
}
