import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const AUTH_HEADER = 'Bearer valid-token';

async function createAuthApp() {
  vi.resetModules();
  vi.doMock('../../../api/_auth.js', () => ({
    authenticateRequest: vi.fn(async (req) => {
      if (req.headers.authorization === AUTH_HEADER) {
        return { ok: true, user: { id: 'user-1', email: 'chef@example.com' } };
      }
      return {
        ok: false,
        status: 401,
        body: { error: 'Authentication required', code: 'ERR_AUTH_001' },
      };
    }),
  }));
  vi.doMock('../../../api/_usage.js', () => ({
    PLAN_LIMITS: {
      free: { chat: 10, challenge_recipe: 3 },
      pro: { chat: 100, challenge_recipe: 30 },
    },
    createSupabaseUsageStore: vi.fn(() => ({
      ensureProfile: vi.fn().mockResolvedValue(undefined),
      getLatestSubscription: vi.fn().mockResolvedValue(null),
      getUsageWindow: vi.fn().mockResolvedValue({
        count: 2,
        window_started_at: '2026-05-04T00:00:00.000Z',
        window_expires_at: '2099-01-01T00:00:00.000Z',
      }),
    })),
    getPlanFromSubscription: vi.fn(() => 'free'),
  }));

  const configModule = await import('../../../api/auth/config.js');
  const sessionModule = await import('../../../api/auth/session.js');
  const app = express();
  app.use(express.json());
  app.all('/api/auth/config', (req, res) => configModule.default(req, res));
  app.all('/api/auth/session', (req, res) => sessionModule.default(req, res));
  return app;
}

describe('V3 auth endpoints', () => {
  let app;
  let savedEnv;

  beforeEach(async () => {
    savedEnv = { ...process.env };
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    app = await createAuthApp();
  });

  afterEach(() => {
    process.env = savedEnv;
    vi.restoreAllMocks();
  });

  it('returns public Supabase browser configuration', async () => {
    const res = await request(app).get('/api/auth/config').set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
    });
  });

  it('returns the authenticated user plan and usage summary', async () => {
    const res = await request(app)
      .post('/api/auth/session')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('chef@example.com');
    expect(res.body.plan).toBe('free');
    expect(res.body.usage.chat.used).toBe(2);
    expect(res.body.usage.chat.limit).toBe(10);
  });
});
