import { describe, expect, it, vi } from 'vitest';
import {
  createCheckoutSession,
  createPortalSession,
  handleStripeEvent,
} from '../../../api/_billing.js';

describe('createCheckoutSession', () => {
  it('creates a Stripe subscription checkout session for the authenticated user', async () => {
    const stripe = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.test/session' }),
        },
      },
    };

    const session = await createCheckoutSession({
      stripe,
      user: { id: 'user-1', email: 'chef@example.com' },
      priceId: 'price_pro',
      successUrl: 'https://app.test/?billing=success',
      cancelUrl: 'https://app.test/?billing=cancelled',
    });

    expect(session.url).toBe('https://checkout.stripe.test/session');
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        client_reference_id: 'user-1',
        customer_email: 'chef@example.com',
        success_url: 'https://app.test/?billing=success',
        cancel_url: 'https://app.test/?billing=cancelled',
        line_items: [{ price: 'price_pro', quantity: 1 }],
        metadata: { user_id: 'user-1' },
      })
    );
  });
});

describe('createPortalSession', () => {
  it('creates a Stripe customer portal session', async () => {
    const stripe = {
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.test/session' }),
        },
      },
    };

    const session = await createPortalSession({
      stripe,
      customerId: 'cus_123',
      returnUrl: 'https://app.test/',
    });

    expect(session.url).toBe('https://billing.stripe.test/session');
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.test/',
    });
  });
});

describe('handleStripeEvent', () => {
  it('stores subscription state from checkout.session.completed', async () => {
    const store = {
      hasProcessedEvent: vi.fn().mockResolvedValue(false),
      markEventProcessed: vi.fn().mockResolvedValue(undefined),
      upsertSubscription: vi.fn().mockResolvedValue(undefined),
    };

    await handleStripeEvent({
      store,
      event: {
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'user-1',
            customer: 'cus_123',
            subscription: 'sub_123',
          },
        },
      },
    });

    expect(store.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
      })
    );
    expect(store.markEventProcessed).toHaveBeenCalledWith('evt_1', 'checkout.session.completed');
  });

  it('skips events that were already processed', async () => {
    const store = {
      hasProcessedEvent: vi.fn().mockResolvedValue(true),
      markEventProcessed: vi.fn(),
      upsertSubscription: vi.fn(),
    };

    await handleStripeEvent({
      store,
      event: { id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } },
    });

    expect(store.upsertSubscription).not.toHaveBeenCalled();
    expect(store.markEventProcessed).not.toHaveBeenCalled();
  });
});
