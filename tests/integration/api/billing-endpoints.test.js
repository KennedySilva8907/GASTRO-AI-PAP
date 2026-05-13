import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const AUTH_HEADER = 'Bearer valid-token';

async function createBillingApp() {
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
  vi.doMock('../../../api/_billing.js', () => ({
    // The webhook handler now requires a real-shaped stripe client with
    // webhooks.constructEvent — the legacy JSON.parse fallback was removed
    // because it allowed forged events to bypass HMAC verification.
    getStripeClient: vi.fn(() => ({
      webhooks: {
        constructEvent: vi.fn((rawBody) => JSON.parse(rawBody.toString('utf8'))),
      },
    })),
    createSupabaseBillingStore: vi.fn(() => ({
      getSubscriptionForUser: vi.fn().mockResolvedValue({ stripe_customer_id: 'cus_123' }),
    })),
    createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.test' }),
    createPortalSession: vi.fn().mockResolvedValue({ url: 'https://portal.stripe.test' }),
    handleStripeEvent: vi.fn().mockResolvedValue({ processed: true }),
  }));

  const checkoutModule = await import('../../../api/billing/checkout.js');
  const portalModule = await import('../../../api/billing/portal.js');
  const webhookModule = await import('../../../api/webhooks/stripe.js');

  const app = express();
  // Per-route body parsers — webhook gets raw bytes (HMAC verification),
  // billing endpoints get JSON. Avoid the global json middleware order trap
  // where it re-runs after raw and resets req.body.
  app.all(
    '/api/billing/checkout',
    express.json(),
    (req, res) => checkoutModule.default(req, res)
  );
  app.all(
    '/api/billing/portal',
    express.json(),
    (req, res) => portalModule.default(req, res)
  );
  app.all(
    '/api/webhooks/stripe',
    express.raw({ type: '*/*' }),
    (req, res) => webhookModule.default(req, res)
  );
  return app;
}

describe('V3 billing endpoints', () => {
  let app;
  let savedEnv;

  beforeEach(async () => {
    savedEnv = { ...process.env };
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
    process.env.STRIPE_SUCCESS_URL = 'https://app.test/?billing=success';
    process.env.STRIPE_CANCEL_URL = 'https://app.test/?billing=cancelled';
    process.env.PRODUCTION_URL = 'https://app.test';
    app = await createBillingApp();
  });

  afterEach(() => {
    process.env = savedEnv;
    vi.restoreAllMocks();
  });

  it('returns a Stripe Checkout URL for an authenticated user', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.test');
  });

  it('returns a Stripe Customer Portal URL for an authenticated user', async () => {
    const res = await request(app)
      .post('/api/billing/portal')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://portal.stripe.test');
  });

  it('accepts a Stripe webhook request with a valid signature', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'test-signature')
      .send(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' }));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('rejects a Stripe webhook with an invalid signature with 400', async () => {
    // Regression guard: ensures the legacy JSON.parse fallback is never
    // reintroduced. If constructEvent throws (signature mismatch), the
    // handler must respond 400 — never accept the unverified payload.
    vi.resetModules();
    vi.doMock('../../../api/_auth.js', () => ({ authenticateRequest: vi.fn() }));
    vi.doMock('../../../api/_billing.js', () => ({
      getStripeClient: vi.fn(() => ({
        webhooks: {
          constructEvent: vi.fn(() => {
            throw new Error('Invalid Stripe-Signature');
          }),
        },
      })),
      createSupabaseBillingStore: vi.fn(() => ({})),
      createCheckoutSession: vi.fn(),
      createPortalSession: vi.fn(),
      handleStripeEvent: vi.fn(),
    }));
    const webhookModule = await import('../../../api/webhooks/stripe.js');
    const guarded = express();
    guarded.all(
      '/api/webhooks/stripe',
      express.raw({ type: '*/*' }),
      (req, res) => webhookModule.default(req, res)
    );

    const res = await request(guarded)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'forged-signature')
      .send(JSON.stringify({ id: 'evt_attack', type: 'invoice.paid' }));

    expect(res.status).toBe(400);
  });
});
