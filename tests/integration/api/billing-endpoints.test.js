import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Buffer } from 'node:buffer';

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
    getStripeClient: vi.fn(() => ({})),
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
  app.use('/api/webhooks/stripe', express.raw({ type: '*/*' }));
  app.use(express.json());
  app.all('/api/billing/checkout', (req, res) => checkoutModule.default(req, res));
  app.all('/api/billing/portal', (req, res) => portalModule.default(req, res));
  app.all('/api/webhooks/stripe', (req, res) => webhookModule.default(req, res));
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

  it('accepts a Stripe webhook request', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Stripe-Signature', 'test-signature')
      .send(Buffer.from(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
