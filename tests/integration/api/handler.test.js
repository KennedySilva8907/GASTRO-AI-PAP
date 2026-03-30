import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

/**
 * Creates a test Express app wrapping the Vercel serverless handler.
 * IMPORTANT: We use dynamic import so each test suite gets a fresh module.
 * The handler reads process.env.GEMINI_API_KEY inside the handler function
 * (not at module level), so env changes between tests work correctly.
 */
async function createTestApp() {
  const module = await import('../../../api/index.js');
  const handler = module.default;
  const app = express();
  app.use(express.json());
  app.all('/api/*', (req, res) => handler(req, res));
  return app;
}

describe('API Handler Integration Tests', () => {
  let app;
  let savedApiKey;

  beforeEach(async () => {
    // Save and set a dummy API key so config check passes by default
    savedApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key-12345';

    app = await createTestApp();

    // Mock global fetch to simulate Gemini API responses
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Test response from Gemini' }] } }],
      }),
    });

    // Suppress console.error from handler error logging
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore env
    if (savedApiKey !== undefined) {
      process.env.GEMINI_API_KEY = savedApiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
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
        .send({ message: 'hello' });

      expect(res.status).not.toBe(403);
    });

    it('accepts requests from http://localhost:5173', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:5173')
        .send({ message: 'hello' });

      expect(res.status).not.toBe(403);
    });

    it('returns 200 for OPTIONS preflight', async () => {
      const res = await request(app)
        .options('/api/chat')
        .set('Origin', 'http://localhost:3000');

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
        .send({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ERR_INPUT_001');
    });
  });

  describe('routing', () => {
    it('returns 404 with ERR_NOTFOUND_001 for unknown endpoints', async () => {
      const res = await request(app)
        .post('/api/unknown')
        .set('Origin', 'http://localhost:3000')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ERR_NOTFOUND_001');
    });

    it('returns 405 with ERR_METHOD_001 for GET on /api/chat', async () => {
      const res = await request(app)
        .get('/api/chat')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(405);
      expect(res.body.code).toBe('ERR_METHOD_001');
    });
  });

  describe('GEMINI_API_KEY validation', () => {
    it('returns 500 with ERR_CONFIG_001 when API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .send({ message: 'hello' });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('ERR_CONFIG_001');
    });
  });

  describe('Gemini API proxy', () => {
    it('proxies successful Gemini response with 200', async () => {
      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .send({ message: 'hello', history: [{ role: 'user', text: 'previous turn' }] });

      expect(res.status).toBe(200);
      expect(res.body.candidates).toBeDefined();
      expect(res.body.candidates[0].content.parts[0].text).toBe('Test response from Gemini');
    });

    it('builds the Gemini chat payload on the server with header auth', async () => {
      await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .send({ message: 'Como fazer risoto?', history: [{ role: 'user', text: 'Olá' }] });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = globalThis.fetch.mock.calls[0];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
      );
      expect(options.headers['x-goog-api-key']).toBe('test-key-12345');
      expect(options.headers['User-Agent']).toBe('GastroAI-Chat/1.0');

      const body = JSON.parse(options.body);
      expect(body.systemInstruction.parts[0].text).toContain('português de Portugal');
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'Olá' }] },
        { role: 'user', parts: [{ text: 'Como fazer risoto?' }] },
      ]);
      expect(body.generationConfig.maxOutputTokens).toBe(900);
      expect(body.safetySettings[0].category).toBe('HARM_CATEGORY_DANGEROUS_CONTENT');
    });

    it('returns error code ERR_GEMINI_001 when upstream returns non-ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .send({ message: 'hello' });

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('ERR_GEMINI_001');
    });

    it('does not expose stack traces in error responses', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused to googleapis.com'));

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .send({ message: 'hello' });

      expect(res.status).toBe(500);
      // Body should NOT contain the raw error message or stack
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('Connection refused');
      expect(bodyStr).not.toContain('at ');
      expect(bodyStr).not.toContain('.js:');
    });

    it('returns generic error message for Gemini failures', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await request(app)
        .post('/api/chat')
        .set('Origin', 'http://localhost:3000')
        .send({ message: 'hello' });

      expect(res.body.error).toBe('An error occurred processing your request');
      expect(res.body.code).toBe('ERR_INTERNAL_001');
    });
  });

  describe('/api/gemini endpoint', () => {
    it('proxies successful Gemini response via /api/gemini', async () => {
      const res = await request(app)
        .post('/api/gemini')
        .set('Origin', 'http://localhost:3000')
        .send({ contents: [{ role: 'user', parts: [{ text: 'recipe' }] }] });

      expect(res.status).toBe(200);
      expect(res.body.candidates).toBeDefined();
    });

    it('returns 405 for GET on /api/gemini', async () => {
      const res = await request(app)
        .get('/api/gemini')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(405);
      expect(res.body.code).toBe('ERR_METHOD_001');
    });
  });
});
