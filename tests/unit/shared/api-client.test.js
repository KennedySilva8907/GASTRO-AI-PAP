import { describe, expect, it, vi } from 'vitest';
import { UserFacingError } from '../../../src/shared/errors.js';
import { fetchWithAuth } from '../../../src/shared/api-client.js';

describe('fetchWithAuth', () => {
  it('adds the Supabase access token to protected API requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    await fetchWithAuth(
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      },
      async () => ({ access_token: 'token-123' })
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
        }),
      })
    );
  });

  it('throws a user-facing error when no session is available', async () => {
    await expect(fetchWithAuth('/api/chat', {}, async () => null)).rejects.toBeInstanceOf(
      UserFacingError
    );
  });
});
