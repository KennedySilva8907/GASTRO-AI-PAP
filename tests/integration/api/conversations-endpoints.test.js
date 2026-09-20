import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const AUTH_HEADER = 'Bearer valid-token';
const TEST_USER = { id: 'user-1', email: 'chef@example.com' };

let storeState;

function buildStore() {
  return {
    listForUser: vi.fn(async () => storeState.conversations),
    create: vi.fn(async () => {
      const created = {
        id: 'conv-new',
        title: null,
        created_at: '2026-09-21T09:00:00.000Z',
        updated_at: '2026-09-21T09:00:00.000Z',
        message_count: 0,
      };
      storeState.conversations.push(created);
      return created;
    }),
  };
}

function resetState() {
  storeState = {
    conversations: [],
    plan: 'free',
    subscription: null,
    store: null,
  };
  storeState.store = buildStore();
}

async function createTestApp() {
  vi.resetModules();

  vi.doMock('../../../api/_auth.js', () => ({
    authenticateRequest: vi.fn(async (req) =>
      req.headers.authorization === AUTH_HEADER
        ? { ok: true, user: TEST_USER }
        : {
            ok: false,
            status: 401,
            body: { error: 'Authentication required', code: 'ERR_AUTH_001' },
          }
    ),
  }));

  vi.doMock('../../../api/_usage.js', () => ({
    createSupabaseUsageStore: () => ({
      getLatestSubscription: vi.fn(async () => storeState.subscription),
    }),
    getPlanFromSubscription: () => storeState.plan,
  }));

  vi.doMock('../../../api/_conversations.js', async () => {
    const actual = await vi.importActual('../../../api/_conversations.js');
    return { ...actual, createConversationStore: () => storeState.store };
  });

  const indexModule = await import('../../../api/conversations/index.js');

  const app = express();
  app.use(express.json());
  app.all('/api/conversations', (req, res) => indexModule.default(req, res));
  return app;
}

describe('conversations list and create', () => {
  let app;

  beforeEach(async () => {
    resetState();
    app = await createTestApp();
  });

  it('rejects a request without a token', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.status).toBe(401);
  });

  it('lists the conversations of the signed-in user', async () => {
    storeState.conversations = [
      {
        id: 'c1',
        title: 'Risoto',
        created_at: 'x',
        updated_at: 'y',
        message_count: 8,
      },
    ];

    const res = await request(app).get('/api/conversations').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].message_count).toBe(8);
  });

  it('creates a conversation when the account is under the limit', async () => {
    const res = await request(app).post('/api/conversations').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(201);
    expect(res.body.conversation.id).toBe('conv-new');
  });

  it('reuses an empty conversation instead of burning another slot', async () => {
    storeState.conversations = [
      {
        id: 'c-empty',
        title: null,
        created_at: 'x',
        updated_at: 'y',
        message_count: 0,
      },
    ];

    const res = await request(app).post('/api/conversations').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(201);
    expect(res.body.conversation.id).toBe('c-empty');
    expect(storeState.store.create).not.toHaveBeenCalled();
  });

  it('answers 409 with the three conversations when a free account is full', async () => {
    storeState.conversations = [
      { id: 'c1', title: 'Risoto', created_at: 'x', updated_at: 'y', message_count: 8 },
      { id: 'c2', title: 'Natal', created_at: 'x', updated_at: 'y', message_count: 12 },
      { id: 'c3', title: 'Vinho', created_at: 'x', updated_at: 'y', message_count: 4 },
    ];

    const res = await request(app).post('/api/conversations').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ERR_CONVERSATION_LIMIT');
    expect(res.body.limit).toBe(3);
    expect(res.body.conversations).toHaveLength(3);
    expect(storeState.store.create).not.toHaveBeenCalled();
  });

  it('lets a pro account past the limit', async () => {
    storeState.plan = 'pro';
    storeState.conversations = [
      { id: 'c1', title: 'a', created_at: 'x', updated_at: 'y', message_count: 1 },
      { id: 'c2', title: 'b', created_at: 'x', updated_at: 'y', message_count: 1 },
      { id: 'c3', title: 'c', created_at: 'x', updated_at: 'y', message_count: 1 },
    ];

    const res = await request(app).post('/api/conversations').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(201);
  });

  it('refuses anything other than GET and POST', async () => {
    const res = await request(app).put('/api/conversations').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(405);
  });
});
