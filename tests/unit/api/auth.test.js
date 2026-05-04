import { describe, expect, it } from 'vitest';
import { authenticateRequest, getBearerToken } from '../../../api/_auth.js';

describe('getBearerToken', () => {
  it('extracts the token from a Bearer Authorization header', () => {
    expect(getBearerToken({ headers: { authorization: 'Bearer abc.def.ghi' } })).toBe(
      'abc.def.ghi'
    );
  });

  it('returns null when the Authorization header is missing or malformed', () => {
    expect(getBearerToken({ headers: {} })).toBeNull();
    expect(getBearerToken({ headers: { authorization: 'Basic abc' } })).toBeNull();
  });
});

describe('authenticateRequest', () => {
  it('rejects requests without a Supabase access token', async () => {
    const result = await authenticateRequest({ headers: {} });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      error: 'Authentication required',
      code: 'ERR_AUTH_001',
    });
  });
});
