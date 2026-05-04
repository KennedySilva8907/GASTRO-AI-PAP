import { authenticateRequest } from '../_auth.js';
import { createCheckoutSession, createSupabaseBillingStore, getStripeClient } from '../_billing.js';
import { ERROR_CODES, runPreflight } from '../_shared.js';

export default async function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.body);
  }

  const stripe = getStripeClient();
  const store = createSupabaseBillingStore();
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  const successUrl = process.env.STRIPE_SUCCESS_URL;
  const cancelUrl = process.env.STRIPE_CANCEL_URL;

  if (!stripe || !store || !priceId || !successUrl || !cancelUrl) {
    return res.status(500).json({
      error: 'Billing service is not configured',
      code: ERROR_CODES.API_KEY_MISSING,
    });
  }

  try {
    const subscription = await store.getSubscriptionForUser(auth.user.id);
    const session = await createCheckoutSession({
      stripe,
      user: auth.user,
      priceId,
      successUrl,
      cancelUrl,
      customerId: subscription?.stripe_customer_id,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Checkout Error]', error);
    return res.status(500).json({
      error: 'Unable to start checkout',
      code: ERROR_CODES.INTERNAL,
    });
  }
}
