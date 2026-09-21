import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchWithAuth = vi.fn();
vi.mock('../../../src/shared/api-client.js', () => ({ fetchWithAuth }));

const {
  listConversations,
  createConversation,
  loadConversation,
  deleteConversation,
  requestTitle,
  ConversationLimitError,
} = await import('../../../src/chat/conversations-api.js');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('conversations browser client', () => {
  beforeEach(() => {
    fetchWithAuth.mockReset();
  });

  it('returns the list of conversations', async () => {
    fetchWithAuth.mockResolvedValue(jsonResponse(200, { conversations: [{ id: 'c1' }] }));

    await expect(listConversations()).resolves.toEqual([{ id: 'c1' }]);
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/conversations');
  });

  it('returns an empty list when the body has no conversations key', async () => {
    fetchWithAuth.mockResolvedValue(jsonResponse(200, {}));

    await expect(listConversations()).resolves.toEqual([]);
  });

  it('throws a user-facing error when the list fails', async () => {
    fetchWithAuth.mockResolvedValue(jsonResponse(500, {}));

    await expect(listConversations()).rejects.toMatchObject({ name: 'UserFacingError' });
  });

  it('creates a conversation with POST', async () => {
    fetchWithAuth.mockResolvedValue(jsonResponse(201, { conversation: { id: 'c-new' } }));

    await expect(createConversation()).resolves.toEqual({ id: 'c-new' });
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/conversations', { method: 'POST' });
  });

  it('throws ConversationLimitError carrying the conversations on 409', async () => {
    fetchWithAuth.mockResolvedValue(
      jsonResponse(409, {
        code: 'ERR_CONVERSATION_LIMIT',
        limit: 3,
        conversations: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      })
    );

    await expect(createConversation()).rejects.toBeInstanceOf(ConversationLimitError);
  });

  it('keeps the limit and the conversations on the thrown error', async () => {
    fetchWithAuth.mockResolvedValue(
      jsonResponse(409, {
        code: 'ERR_CONVERSATION_LIMIT',
        limit: 3,
        conversations: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      })
    );

    try {
      await createConversation();
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.limit).toBe(3);
      expect(error.conversations).toHaveLength(3);
    }
  });

  it('loads a conversation with its messages', async () => {
    fetchWithAuth.mockResolvedValue(
      jsonResponse(200, { conversation: { id: 'c1' }, messages: [{ id: 'm1' }] })
    );

    const result = await loadConversation('c1');

    expect(result.messages).toHaveLength(1);
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/conversations/c1');
  });

  it('treats 204 from delete as success', async () => {
    fetchWithAuth.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });

    await expect(deleteConversation('c1')).resolves.toBe(true);
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/conversations/c1', { method: 'DELETE' });
  });

  it('asks for a title with PATCH', async () => {
    fetchWithAuth.mockResolvedValue(jsonResponse(200, { title: 'Risoto de cogumelos' }));

    await expect(requestTitle('c1')).resolves.toBe('Risoto de cogumelos');
    expect(fetchWithAuth).toHaveBeenCalledWith('/api/conversations/c1', { method: 'PATCH' });
  });

  it('returns null instead of throwing when the title call fails', async () => {
    fetchWithAuth.mockResolvedValue(jsonResponse(500, {}));

    await expect(requestTitle('c1')).resolves.toBeNull();
  });

  it('survives a response body that is not json', async () => {
    fetchWithAuth.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(listConversations()).resolves.toEqual([]);
  });
});
