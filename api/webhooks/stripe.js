import { createSupabaseBillingStore, getStripeClient, handleStripeEvent } from '../_billing.js';
import { ERROR_CODES, runPreflight } from '../_shared.js';
import { Buffer } from 'node:buffer';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

function constructStripeEvent({ stripe, rawBody, signature, webhookSecret }) {
  if (stripe?.webhooks?.constructEvent) {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
  return JSON.parse(rawBody || '{}');
}

export default async function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  const stripe = getStripeClient();
  const store = createSupabaseBillingStore();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !store || !webhookSecret) {
    return res.status(500).json({
      error: 'Billing webhook is not configured',
      code: ERROR_CODES.API_KEY_MISSING,
    });
  }

  try {
    const rawBody = getRawBody(req);
    const signature = req.headers['stripe-signature'];
    const event = constructStripeEvent({ stripe, rawBody, signature, webhookSecret });
    await handleStripeEvent({ store, event });
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook Error]', error);
    return res.status(400).json({
      error: 'Invalid Stripe webhook',
      code: ERROR_CODES.INVALID_INPUT,
    });
  }
}
