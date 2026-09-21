import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const OWNER = { id: 'user-owner', email: 'dono@example.com' };
const ATTACKER = { id: 'user-attacker', email: 'intruso@example.com' };
const OWNER_TOKEN = 'Bearer token-owner';
const ATTACKER_TOKEN = 'Bearer token-attacker';

let state;

function buildStore() {
  return {
    listForUser: vi.fn(async (userId) =>
      state.conversations.filter((conversation) => conversation.user_id === userId)
    ),
    getOwned: vi.fn(async ({ conversationId, userId }) => {
      const found = state.conversations.find(
        (conversation) => conversation.id === conversationId && conversation.user_id === userId
      );
      return found || null;
    }),
    listMessages: vi.fn(async () => state.messages),
    setTitle: vi.fn(async ({ title }) => {
      state.titleWritten = title;
    }),
    remove: vi.fn(async ({ conversationId, userId }) => {
      const before = state.conversations.length;
      state.conversations = state.conversations.filter(
        (conversation) => !(conversation.id === conversationId && conversation.user_id === userId)
      );
      return state.conversations.length < before;
    }),
    create: vi.fn(async (userId) => {
      const created = {
        id: 'new',
        user_id: userId,
        title: null,
        created_at: 'x',
        updated_at: 'y',
        message_count: 0,
      };
      state.conversations.push(created);
      return created;
    }),
    appendMessage: vi.fn(async () => {}),
  };
}

async function createTestApp() {
  vi.resetModules();

  vi.doMock('../../../api/_auth.js', () => ({
    authenticateRequest: vi.fn(async (req) => {
      const header = req.headers.authorization;
      if (header === OWNER_TOKEN) return { ok: true, user: OWNER };
      if (header === ATTACKER_TOKEN) return { ok: true, user: ATTACKER };
      return {
        ok: false,
        status: 401,
        body: { error: 'Authentication required', code: 'ERR_AUTH_001' },
      };
    }),
  }));

  vi.doMock('../../../api/_usage.js', () => ({
    createSupabaseUsageStore: () => ({ getLatestSubscription: vi.fn(async () => null) }),
    getPlanFromSubscription: () => 'free',
    checkAndIncrementUsage: vi.fn(async () => ({
      allowed: true,
      plan: 'free',
      usage: { feature: 'chat', used: 1, limit: 10, remaining: 9 },
    })),
  }));

  vi.doMock('../../../api/_conversations.js', async () => {
    const actual = await vi.importActual('../../../api/_conversations.js');
    return { ...actual, createConversationStore: () => state.store };
  });

  const indexModule = await import('../../../api/conversations/index.js');
  const detailModule = await import('../../../api/conversations/[id].js');
  const chatModule = await import('../../../api/chat.js');

  const app = express();
  app.use(express.json());
  app.all('/api/conversations', (req, res) => indexModule.default(req, res));
  app.all('/api/conversations/:id', (req, res) => {
    req.query = { ...req.query, id: req.params.id };
    return detailModule.default(req, res);
  });
  app.all('/api/chat', (req, res) => chatModule.default(req, res));
  return app;
}

describe('someone else cannot reach your conversations', () => {
  let app;

  beforeEach(async () => {
    state = {
      conversations: [
        {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          user_id: OWNER.id,
          title: 'Receita de familia',
          created_at: 'x',
          updated_at: 'y',
          message_count: 2,
        },
      ],
      messages: [{ id: 'm1', role: 'user', content: 'segredo', created_at: 'x' }],
      titleWritten: null,
      store: null,
    };
    state.store = buildStore();
    process.env.GROQ_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'resposta' } }] }),
    }));
    app = await createTestApp();
  });

  it('reading it answers 404 and leaks no message', async () => {
    const res = await request(app)
      .get('/api/conversations/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', ATTACKER_TOKEN);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('segredo');
    expect(JSON.stringify(res.body)).not.toContain('Receita de familia');
  });

  it('answers 404 and not 403, so the id is never confirmed', async () => {
    const existing = await request(app)
      .get('/api/conversations/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', ATTACKER_TOKEN);
    const invented = await request(app)
      .get('/api/conversations/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
      .set('Authorization', ATTACKER_TOKEN);

    expect(existing.status).toBe(invented.status);
    expect(existing.body).toEqual(invented.body);
  });

  it('deleting it changes nothing', async () => {
    const res = await request(app)
      .delete('/api/conversations/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', ATTACKER_TOKEN);

    expect(res.status).toBe(404);
    expect(state.conversations).toHaveLength(1);
  });

  it('renaming it changes nothing', async () => {
    const res = await request(app)
      .patch('/api/conversations/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', ATTACKER_TOKEN);

    expect(res.status).toBe(404);
    expect(state.titleWritten).toBeNull();
  });

  it('writing a message into it changes nothing and never calls the model', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', ATTACKER_TOKEN)
      .send({ message: 'entra ai', conversationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });

    expect(res.status).toBe(404);
    expect(state.store.appendMessage).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('listing shows only your own conversations', async () => {
    const res = await request(app).get('/api/conversations').set('Authorization', ATTACKER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(0);
  });

  it('the owner still gets in', async () => {
    const res = await request(app)
      .get('/api/conversations/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
      .set('Authorization', OWNER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.messages[0].content).toBe('segredo');
  });
});

describe('no token, no data', () => {
  let app;

  beforeEach(async () => {
    state = { conversations: [], messages: [], titleWritten: null, store: null };
    state.store = buildStore();
    app = await createTestApp();
  });

  it('refuses to list', async () => {
    expect((await request(app).get('/api/conversations')).status).toBe(401);
  });

  it('refuses to create', async () => {
    expect((await request(app).post('/api/conversations')).status).toBe(401);
  });

  it('refuses to read one', async () => {
    expect(
      (await request(app).get('/api/conversations/ffffffff-ffff-4fff-8fff-ffffffffffff')).status
    ).toBe(401);
  });

  it('refuses to delete', async () => {
    expect(
      (await request(app).delete('/api/conversations/ffffffff-ffff-4fff-8fff-ffffffffffff')).status
    ).toBe(401);
  });

  it('refuses to rename', async () => {
    expect(
      (await request(app).patch('/api/conversations/ffffffff-ffff-4fff-8fff-ffffffffffff')).status
    ).toBe(401);
  });
});

describe('a malformed id is refused before it reaches the database', () => {
  let app;

  beforeEach(async () => {
    state = { conversations: [], messages: [], titleWritten: null, store: null };
    state.store = buildStore();
    process.env.GROQ_API_KEY = 'test-key';
    app = await createTestApp();
  });

  it('answers 404, the same as a conversation that is not yours', async () => {
    const res = await request(app)
      .get('/api/conversations/nao-e-uuid')
      .set('Authorization', OWNER_TOKEN);

    expect(res.status).toBe(404);
  });

  it('never queries the database with it', async () => {
    await request(app).get('/api/conversations/nao-e-uuid').set('Authorization', OWNER_TOKEN);

    expect(state.store.getOwned).not.toHaveBeenCalled();
  });

  it('refuses a filter expression the same way', async () => {
    const res = await request(app)
      .delete('/api/conversations/' + encodeURIComponent("' or 1=1--"))
      .set('Authorization', OWNER_TOKEN);

    expect(res.status).toBe(404);
    expect(state.store.remove).not.toHaveBeenCalled();
  });

  it('refuses it on the chat endpoint too, without calling the model', async () => {
    globalThis.fetch = vi.fn();

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', OWNER_TOKEN)
      .send({ message: 'ola', conversationId: 'nao-e-uuid' });

    expect(res.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
