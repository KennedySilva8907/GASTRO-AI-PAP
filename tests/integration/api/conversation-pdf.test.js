import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const OWNER = { id: 'user-owner', email: 'kennedy@example.com' };
const OWNER_TOKEN = 'Bearer token-owner';
const ATTACKER_TOKEN = 'Bearer token-attacker';
const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';

let state;

function buildStore() {
  return {
    getOwned: vi.fn(async ({ conversationId, userId }) => {
      if (conversationId !== state.conversation.id) return null;
      if (userId !== OWNER.id) return null;
      return state.conversation;
    }),
    listMessages: vi.fn(async () => state.messages),
  };
}

async function createTestApp() {
  vi.resetModules();

  vi.doMock('../../../api/_auth.js', () => ({
    authenticateRequest: vi.fn(async (req) => {
      if (req.headers.authorization === OWNER_TOKEN) return { ok: true, user: OWNER };
      if (req.headers.authorization === ATTACKER_TOKEN) {
        return { ok: true, user: { id: 'someone-else', email: 'x@example.com' } };
      }
      return {
        ok: false,
        status: 401,
        body: { error: 'Authentication required', code: 'ERR_AUTH_001' },
      };
    }),
  }));

  vi.doMock('../../../api/_conversations.js', async () => {
    const actual = await vi.importActual('../../../api/_conversations.js');
    return { ...actual, createConversationStore: () => state.store };
  });

  const pdfModule = await import('../../../api/conversations/[id]/pdf.js');

  const app = express();
  app.use(express.json());
  app.all('/api/conversations/:id/pdf', (req, res) => {
    req.query = { ...req.query, id: req.params.id };
    return pdfModule.default(req, res);
  });
  return app;
}

function asBuffer(response) {
  return response.buffer().parse((res, callback) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  });
}

describe('exporting a conversation as PDF', () => {
  let app;

  beforeEach(async () => {
    state = {
      conversation: {
        id: CONVERSATION_ID,
        title: 'Risoto de cogumelos à moda',
        created_at: '2026-09-20T14:30:00.000Z',
        updated_at: '2026-09-20T14:41:00.000Z',
      },
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Como faço um risoto cremoso?',
          created_at: '2026-09-20T14:32:00.000Z',
        },
        {
          id: 'm2',
          role: 'model',
          content: '## Ingredientes\n\n- 320 g de arroz\n- 1 L de caldo\n\n**Dica:** mexe sempre.',
          created_at: '2026-09-20T14:33:00.000Z',
        },
      ],
      store: null,
    };
    state.store = buildStore();
    app = await createTestApp();
  });

  it('serves a real pdf', async () => {
    const res = await asBuffer(
      request(app)
        .get(`/api/conversations/${CONVERSATION_ID}/pdf`)
        .set('Authorization', OWNER_TOKEN)
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('sends it as a download with a readable file name', async () => {
    const res = await asBuffer(
      request(app)
        .get(`/api/conversations/${CONVERSATION_ID}/pdf`)
        .set('Authorization', OWNER_TOKEN)
    );

    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('risoto-de-cogumelos-a-moda');
    expect(res.headers['content-disposition']).toMatch(/\d{4}-\d{2}-\d{2}\.pdf/);
  });

  it('never caches it', async () => {
    const res = await asBuffer(
      request(app)
        .get(`/api/conversations/${CONVERSATION_ID}/pdf`)
        .set('Authorization', OWNER_TOKEN)
    );

    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('refuses to export someone else conversation', async () => {
    const res = await request(app)
      .get(`/api/conversations/${CONVERSATION_ID}/pdf`)
      .set('Authorization', ATTACKER_TOKEN);

    expect(res.status).toBe(404);
    expect(state.store.listMessages).not.toHaveBeenCalled();
  });

  it('refuses without a token', async () => {
    const res = await request(app).get(`/api/conversations/${CONVERSATION_ID}/pdf`);

    expect(res.status).toBe(401);
  });

  it('refuses an id that is not a conversation id, without touching the database', async () => {
    const res = await request(app)
      .get('/api/conversations/nao-e-uuid/pdf')
      .set('Authorization', OWNER_TOKEN);

    expect(res.status).toBe(404);
    expect(state.store.getOwned).not.toHaveBeenCalled();
  });

  it('refuses to export a conversation with nothing in it', async () => {
    state.messages = [];

    const res = await request(app)
      .get(`/api/conversations/${CONVERSATION_ID}/pdf`)
      .set('Authorization', OWNER_TOKEN);

    expect(res.status).toBe(400);
  });

  it('refuses any method other than GET', async () => {
    const res = await request(app)
      .post(`/api/conversations/${CONVERSATION_ID}/pdf`)
      .set('Authorization', OWNER_TOKEN);

    expect(res.status).toBe(405);
  });
});
