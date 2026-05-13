import { createSupabaseBillingStore, getStripeClient, handleStripeEvent } from '../_billing.js';
import { ERROR_CODES, runPreflight } from '../_shared.js';
import { Buffer } from 'node:buffer';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Stripe verifies the HMAC over the EXACT bytes Stripe sent. We must never
// re-serialize a parsed object — JSON.stringify of a parsed body changes
// whitespace and key ordering, breaking signature verification (and silently
// allowing a forged JSON to be accepted if combined with the legacy fallback).
function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  // Some test/runtime environments hand us a Uint8Array — that's still raw bytes
  // (not a parsed object), so it's safe to wrap. We do NOT accept plain objects.
  if (req.body instanceof Uint8Array) return Buffer.from(req.body).toString('utf8');
  // Body is missing, null, or already parsed into an object. Refuse to verify.
  throw new Error('Stripe webhook body unavailable in raw form (bodyParser misconfigured)');
}

// Always require the real Stripe SDK to construct/verify the event.
// The previous JSON.parse fallback was a foot-gun: any path where stripe
// became falsy (config drift, refactor) would let an attacker POST a
// hand-crafted event with status:'active' for any user_id.
function constructStripeEvent({ stripe, rawBody, signature, webhookSecret }) {
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
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
    // Don't leak internals (stack, query hints) to a public webhook receiver.
    console.error('[Stripe Webhook Error]', { message: error?.message });
    return res.status(400).json({
      error: 'Invalid Stripe webhook',
      code: ERROR_CODES.INVALID_INPUT,
    });
  }
}
