import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const AUTH_HEADER = 'Bearer valid-token';
const TEST_USER = { id: 'user-1', email: 'chef@example.com' };

let storeState;

function buildStore() {
  return {
    listForUser: vi.fn(async () => storeState.conversations),
    getOwned: vi.fn(
      async ({ conversationId }) =>
        storeState.conversations.find((conversation) => conversation.id === conversationId) || null
    ),
    listMessages: vi.fn(async () => storeState.messages),
    setTitle: vi.fn(async ({ title }) => {
      storeState.savedTitle = title;
    }),
    remove: vi.fn(async ({ conversationId }) => {
      const before = storeState.conversations.length;
      storeState.conversations = storeState.conversations.filter(
        (conversation) => conversation.id !== conversationId
      );
      return storeState.conversations.length < before;
    }),
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
    messages: [],
    plan: 'free',
    subscription: null,
    savedTitle: null,
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
  const detailModule = await import('../../../api/conversations/[id].js');

  const app = express();
  app.use(express.json());
  app.all('/api/conversations', (req, res) => indexModule.default(req, res));
  app.all('/api/conversations/:id', (req, res) => {
    req.query = { ...req.query, id: req.params.id };
    return detailModule.default(req, res);
  });
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

describe('conversation detail', () => {
  let app;

  beforeEach(async () => {
    resetState();
    storeState.conversations = [
      {
        id: 'c1',
        title: null,
        created_at: '2026-09-20T10:00:00.000Z',
        updated_at: '2026-09-20T10:00:00.000Z',
        message_count: 2,
      },
    ];
    storeState.messages = [
      {
        id: 'm1',
        role: 'user',
        content: 'Como faco risoto?',
        created_at: '2026-09-20T10:00:00.000Z',
      },
      {
        id: 'm2',
        role: 'model',
        content: 'Com paciencia.',
        created_at: '2026-09-20T10:01:00.000Z',
      },
    ];
    process.env.GROQ_API_KEY = 'test-key-12345';
    app = await createTestApp();
  });

  it('returns the conversation with its messages in order', async () => {
    const res = await request(app).get('/api/conversations/c1').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.conversation.id).toBe('c1');
    expect(res.body.messages.map((message) => message.role)).toEqual(['user', 'model']);
  });

  it('answers 404 for a conversation that belongs to someone else', async () => {
    const res = await request(app)
      .get('/api/conversations/not-mine')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it('scopes every lookup to the signed-in user', async () => {
    await request(app).get('/api/conversations/c1').set('Authorization', AUTH_HEADER);

    expect(storeState.store.getOwned).toHaveBeenCalledWith({
      conversationId: 'c1',
      userId: TEST_USER.id,
    });
  });

  it('scopes the delete to the signed-in user too', async () => {
    await request(app).delete('/api/conversations/c1').set('Authorization', AUTH_HEADER);

    expect(storeState.store.remove).toHaveBeenCalledWith({
      conversationId: 'c1',
      userId: TEST_USER.id,
    });
  });

  it('deletes and answers 204', async () => {
    const res = await request(app)
      .delete('/api/conversations/c1')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(204);
    expect(storeState.conversations).toHaveLength(0);
  });

  it('generates a title from the first exchange and cleans it up', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '"Risoto de cogumelos"' } }] }),
    }));

    const res = await request(app).patch('/api/conversations/c1').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Risoto de cogumelos');
    expect(storeState.savedTitle).toBe('Risoto de cogumelos');
  });

  it('falls back to the first question when the model call fails', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));

    const res = await request(app).patch('/api/conversations/c1').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Como faco risoto?');
    expect(storeState.savedTitle).toBe('Como faco risoto?');
  });

  it('leaves an existing title alone', async () => {
    globalThis.fetch = vi.fn();
    storeState.conversations[0].title = 'Ja tenho nome';

    const res = await request(app).patch('/api/conversations/c1').set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Ja tenho nome');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('refuses a method it does not implement', async () => {
    const res = await request(app).put('/api/conversations/c1').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(405);
  });
});
