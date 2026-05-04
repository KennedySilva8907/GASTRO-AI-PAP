import Stripe from 'stripe';
import { getSupabaseAdminClient } from './_supabase.js';

let stripeClient = null;

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export function createSupabaseBillingStore(supabase = getSupabaseAdminClient()) {
  if (!supabase) return null;

  return {
    async getSubscriptionForUser(userId) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id,stripe_subscription_id,status,current_period_end,price_id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async hasProcessedEvent(eventId) {
      const { data, error } = await supabase
        .from('stripe_events')
        .select('id')
        .eq('id', eventId)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    },

    async markEventProcessed(eventId, eventType) {
      const { error } = await supabase.from('stripe_events').insert({
        id: eventId,
        event_type: eventType,
      });

      if (error) throw error;
    },

    async upsertSubscription({
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      status,
      priceId,
      currentPeriodEnd,
    }) {
      const { error } = await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          status,
          price_id: priceId,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_subscription_id' }
      );

      if (error) throw error;
    },
  };
}

export async function createCheckoutSession({
  stripe,
  user,
  priceId,
  successUrl,
  cancelUrl,
  customerId,
}) {
  const payload = {
    mode: 'subscription',
    client_reference_id: user.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { user_id: user.id },
    subscription_data: {
      metadata: { user_id: user.id },
    },
  };

  if (customerId) {
    payload.customer = customerId;
  } else {
    payload.customer_email = user.email;
  }

  return stripe.checkout.sessions.create(payload);
}

export async function createPortalSession({ stripe, customerId, returnUrl }) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

function secondsToIso(seconds) {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

function subscriptionPayloadFromObject(subscription) {
  return {
    userId: subscription.metadata?.user_id,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items?.data?.[0]?.price?.id || null,
    currentPeriodEnd: secondsToIso(subscription.current_period_end),
  };
}

export async function handleStripeEvent({ store, event }) {
  const activeStore = store || createSupabaseBillingStore();
  if (!activeStore) {
    throw new Error('Billing store is not configured');
  }

  if (await activeStore.hasProcessedEvent(event.id)) {
    return { processed: false };
  }

  const object = event.data.object;

  if (event.type === 'checkout.session.completed') {
    await activeStore.upsertSubscription({
      userId: object.client_reference_id || object.metadata?.user_id,
      stripeCustomerId: object.customer,
      stripeSubscriptionId: object.subscription,
      status: 'active',
      priceId: null,
      currentPeriodEnd: null,
    });
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const payload = subscriptionPayloadFromObject(object);
    if (payload.userId) {
      await activeStore.upsertSubscription(payload);
    }
  }

  await activeStore.markEventProcessed(event.id, event.type);
  return { processed: true };
}
