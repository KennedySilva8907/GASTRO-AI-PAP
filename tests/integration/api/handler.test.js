import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const AUTH_HEADER = 'Bearer valid-token';
const TEST_USER = { id: 'user-1', email: 'chef@example.com' };

let mockUsageResult;
let conversationState;

/**
 * Creates a test Express app wrapping the Vercel serverless handlers.
 * IMPORTANT: We use dynamic import so each test suite gets a fresh module.
 * The handlers read process.env.GROQ_API_KEY inside the handler function
 * (not at module level), so env changes between tests work correctly.
 */
async function createTestApp() {
  vi.resetModules();
  vi.doMock('../../../api/_auth.js', () => ({
    authenticateRequest: vi.fn(async (req) => {
      if (req.headers.authorization === AUTH_HEADER) {
        return { ok: true, user: TEST_USER };
      }
      return {
        ok: false,
        status: 401,
        body: { error: 'Authentication required', code: 'ERR_AUTH_001' },
      };
    }),
  }));
  vi.doMock('../../../api/_usage.js', () => ({
    checkAndIncrementUsage: vi.fn(
      async ({ feature }) =>
        mockUsageResult ?? {
          allowed: true,
          plan: 'free',
          usage: { feature, used: 1, limit: 10, remaining: 9 },
        }
    ),
  }));

  vi.doMock('../../../api/_conversations.js', async () => {
    const actual = await vi.importActual('../../../api/_conversations.js');
    return {
      ...actual,
      createConversationStore: () => conversationState.store,
    };
  });

  const chatModule = await import('../../../api/chat.js');
  const geminiModule = await import('../../../api/gemini.js');
  const app = express();
  app.use(express.json());
  app.all('/api/chat', (req, res) => chatModule.default(req, res));
  app.all('/api/gemini', (req, res) => geminiModule.default(req, res));
  return app;
}

describe('API Handler Integration Tests', () => {
  let app;
  let savedApiKey;

  beforeEach(async () => {
    // Save and set a dummy API key so config check passes by default
    savedApiKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'test-key-12345';
    mockUsageResult = null;
    conversationState = {
      conversation: { id: 'c1', title: null, created_at: 'x', updated_at: 'y' },
      messages: [],
      store: null,
    };
    conversationState.store = {
      getOwned: vi.fn(async ({ conversationId }) =>
        conversationId === conversationState.conversation.id ? conversationState.conversation : null
      ),
      listMessages: vi.fn(async () => conversationState.messages),
      appendMessage: vi.fn(async () => {}),
    };

    app = await createTestApp();

    // Mock global fetch to simulate Groq API responses (OpenAI chat-completions shape)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { role: 'assistant', content: 'Test response from Groq' },
            finish_reason: 'stop',
          },
        ],
      }),
    });

    // Suppress console.error from handler error logging
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore env
    if (savedApiKey !== undefined) {
      process.env.GROQ_API_KEY = savedApiKey;
    } else {
      delete process.env.GROQ_API_KEY;
    }
    vi.restoreAllMocks();
  });

  describe('CORS enforcement', () => {
    it('rejects unknown origins with 403 and ERR_CORS_001', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'https://evil.com')
        .send({ contents: [] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ERR_CORS_001');
    });

    it('accepts requests from http://localhost:3000', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.status).not.toBe(403);
    });

    it('accepts requests from http://localhost:5173', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:5173')
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.status).not.toBe(403);
    });

    it('returns 200 for OPTIONS preflight', async () => {
      const res = await request(app).options('/api/chat').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
    });
  });

  describe('payload validation', () => {
    it('rejects payloads over 50KB with 413 and ERR_PAYLOAD_001', async () => {
      // Create a body that serializes to >50,000 characters
      const largeBody = { contents: [{ text: 'x'.repeat(51000) }] };
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .send(largeBody);

      expect(res.status).toBe(413);
      expect(res.body.code).toBe('ERR_PAYLOAD_001');
    });

    it('rejects malformed chat payloads with 400 and ERR_INPUT_001', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ERR_INPUT_001');
    });
  });

  describe('V3 authentication and usage gates', () => {
    it('requires a Supabase access token before proxying chat requests', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('ERR_AUTH_001');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns 429 when the user has exhausted the daily chat quota', async () => {
      mockUsageResult = {
        allowed: false,
        status: 429,
        body: { error: 'Daily usage limit reached', code: 'ERR_RATE_LIMIT_001' },
      };

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('ERR_RATE_LIMIT_001');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe('routing', () => {
    it('returns 405 with ERR_METHOD_001 for GET on /api/chat', async () => {
      const res = await request(app).get('/api/chat').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(405);
      expect(res.body.code).toBe('ERR_METHOD_001');
    });
  });

  describe('GROQ_API_KEY validation', () => {
    it('returns 500 with ERR_CONFIG_001 when API key is missing', async () => {
      delete process.env.GROQ_API_KEY;

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('ERR_CONFIG_001');
    });
  });

  describe('Groq API proxy', () => {
    it('proxies successful Groq response with 200 wrapped as Gemini envelope', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.status).toBe(200);
      expect(res.body.candidates).toBeDefined();
      expect(res.body.candidates[0].content.parts[0].text).toBe('Test response from Groq');
    });

    it('builds the Groq chat payload on the server with bearer auth', async () => {
      conversationState.messages = [{ role: 'user', content: 'Olá', created_at: 'x' }];

      await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'Como fazer risoto?', conversationId: 'c1' });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = globalThis.fetch.mock.calls[0];
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(options.headers['Authorization']).toBe('Bearer test-key-12345');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('openai/gpt-oss-120b');
      expect(body.messages[0]).toEqual({
        role: 'system',
        content: expect.stringContaining('português de Portugal'),
      });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'Olá' });
      expect(body.messages[2]).toEqual({ role: 'user', content: 'Como fazer risoto?' });
      expect(body.max_tokens).toBe(3072);
      expect(body.temperature).toBe(0.7);
    });

    it('maps history role "model" to "assistant" when forwarding to Groq', async () => {
      conversationState.messages = [
        { role: 'user', content: 'Olá', created_at: 'x' },
        { role: 'model', content: 'Olá! Como posso ajudar?', created_at: 'y' },
      ];

      await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'continua', conversationId: 'c1' });

      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(body.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    });

    it('returns error code ERR_GROQ_001 when upstream returns non-ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('ERR_GROQ_001');
    });

    it('does not expose stack traces in error responses', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused to api.groq.com'));

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.status).toBe(500);
      // Body should NOT contain the raw error message or stack
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('Connection refused');
      expect(bodyStr).not.toContain('at ');
      expect(bodyStr).not.toContain('.js:');
    });

    it('returns generic error message for Groq failures', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'hello', conversationId: 'c1' });

      expect(res.body.error).toBe('An error occurred processing your request');
      expect(res.body.code).toBe('ERR_INTERNAL_001');
    });
  });

  describe('/api/gemini endpoint', () => {
    it('converts Gemini-format request body to Groq and wraps the response', async () => {
      const res = await request(app)
        .post('/api/gemini')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({
          systemInstruction: { parts: [{ text: 'És um chef.' }] },
          contents: [{ role: 'user', parts: [{ text: 'Dá-me uma receita.' }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
        });

      expect(res.status).toBe(200);
      expect(res.body.candidates[0].content.parts[0].text).toBe('Test response from Groq');

      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(body.model).toBe('openai/gpt-oss-120b');
      expect(body.messages).toEqual([
        { role: 'system', content: 'És um chef.' },
        { role: 'user', content: 'Dá-me uma receita.' },
      ]);
      expect(body.temperature).toBe(0.9);
      expect(body.max_tokens).toBe(1024);
    });

    it('returns 405 for GET on /api/gemini', async () => {
      const res = await request(app).get('/api/gemini').set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(405);
      expect(res.body.code).toBe('ERR_METHOD_001');
    });

    it('returns 400 ERR_INPUT_001 when Gemini-format body is empty', async () => {
      const res = await request(app)
        .post('/api/gemini')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ERR_INPUT_001');
    });
  });

  describe('conversation persistence', () => {
    it('rejects a chat request without a conversation id', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'Ola' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ERR_INPUT_001');
    });

    it('answers 404 for a conversation that is not the caller own', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'Ola', conversationId: 'not-mine' });

      expect(res.status).toBe(404);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('does not spend a daily chat when the conversation does not exist', async () => {
      await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'Ola', conversationId: 'not-mine' });

      expect(conversationState.store.listMessages).not.toHaveBeenCalled();
      expect(conversationState.store.appendMessage).not.toHaveBeenCalled();
    });

    it('saves the question before calling the model and the answer after', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'Como faco risoto?', conversationId: 'c1' });

      expect(res.status).toBe(200);
      expect(conversationState.store.appendMessage.mock.calls.map((call) => call[0].role)).toEqual([
        'user',
        'model',
      ]);
      expect(conversationState.store.appendMessage.mock.calls[0][0].content).toBe(
        'Como faco risoto?'
      );
    });

    it('keeps the question when the model call fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });

      await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'Como faco risoto?', conversationId: 'c1' });

      expect(conversationState.store.appendMessage).toHaveBeenCalledTimes(1);
      expect(conversationState.store.appendMessage.mock.calls[0][0].role).toBe('user');
    });

    it('ignores history sent by the client and uses the stored messages', async () => {
      conversationState.messages = [
        { role: 'user', content: 'pergunta guardada', created_at: 'x' },
      ];

      await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({
          message: 'seguinte',
          conversationId: 'c1',
          history: [{ role: 'user', text: 'inventado pelo cliente' }],
        });

      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      const contents = body.messages.map((entry) => entry.content);

      expect(contents).toContain('pergunta guardada');
      expect(contents).not.toContain('inventado pelo cliente');
    });

    it('returns the conversation id so the client can keep using it', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', AUTH_HEADER)
        .send({ message: 'Ola', conversationId: 'c1' });

      expect(res.body.conversationId).toBe('c1');
    });
  });
});
