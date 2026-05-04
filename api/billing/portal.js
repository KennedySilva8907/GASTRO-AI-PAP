import { authenticateRequest } from '../_auth.js';
import { createPortalSession, createSupabaseBillingStore, getStripeClient } from '../_billing.js';
import { ERROR_CODES, runPreflight } from '../_shared.js';

function getReturnUrl(req) {
  return (
    process.env.PRODUCTION_URL ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
  );
}

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
  if (!stripe || !store) {
    return res.status(500).json({
      error: 'Billing service is not configured',
      code: ERROR_CODES.API_KEY_MISSING,
    });
  }

  try {
    const subscription = await store.getSubscriptionForUser(auth.user.id);
    if (!subscription?.stripe_customer_id) {
      return res.status(404).json({
        error: 'Stripe customer not found',
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const session = await createPortalSession({
      stripe,
      customerId: subscription.stripe_customer_id,
      returnUrl: getReturnUrl(req),
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Portal Error]', error);
    return res.status(500).json({
      error: 'Unable to open billing portal',
      code: ERROR_CODES.INTERNAL,
    });
  }
}
