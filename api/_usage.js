import { getSupabaseAdminClient } from './_supabase.js';

export const PLAN_LIMITS = {
  free: {
    chat: 10,
    challenge_recipe: 3,
  },
  pro: {
    chat: 100,
    challenge_recipe: 30,
  },
};

const PRO_STATUSES = new Set(['active', 'trialing']);

function isPeriodCurrent(subscription, now = new Date()) {
  if (!subscription?.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > now.getTime();
}

export function getPlanFromSubscription(subscription, now = new Date()) {
  if (!subscription || !PRO_STATUSES.has(subscription.status)) return 'free';
  return isPeriodCurrent(subscription, now) ? 'pro' : 'free';
}

export function createSupabaseUsageStore(supabase = getSupabaseAdminClient()) {
  if (!supabase) return null;

  return {
    async ensureProfile({ userId, email }) {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: userId,
          email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (error) throw error;
    },

    async getLatestSubscription(userId) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status,current_period_end,price_id,stripe_customer_id,stripe_subscription_id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    async getUsageWindow({ userId, feature }) {
      const { data, error } = await supabase
        .from('daily_usage')
        .select('count,window_started_at,window_expires_at')
        .eq('user_id', userId)
        .eq('feature', feature)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    // Atomic check-and-increment via Postgres RPC.
    // Closes the TOCTOU race that previously let parallel requests
    // bypass the daily limit (read 9 → check 9<10 → write 10 twice).
    async atomicCheckAndIncrement({ userId, feature, limit, now }) {
      const { data, error } = await supabase.rpc('check_and_increment_usage', {
        p_user_id: userId,
        p_feature: feature,
        p_limit: limit,
        p_now: now.toISOString(),
      });
      if (error) throw error;
      return data;
    },

    async insertUsageEvent({ userId, feature, plan }) {
      const { error } = await supabase.from('usage_events').insert({
        user_id: userId,
        feature,
        plan,
      });

      if (error) throw error;
    },
  };
}

export async function checkAndIncrementUsage({ store, user, feature, now = new Date() }) {
  const activeStore = store || createSupabaseUsageStore();
  if (!activeStore) {
    return {
      allowed: false,
      status: 500,
      body: {
        error: 'Usage service is not configured',
        code: 'ERR_CONFIG_001',
      },
    };
  }

  await activeStore.ensureProfile({ userId: user.id, email: user.email });

  const subscription = await activeStore.getLatestSubscription(user.id);
  const plan = getPlanFromSubscription(subscription, now);
  const limit = PLAN_LIMITS[plan][feature];

  // Single atomic operation — replaces the previous read/check/write pattern
  // that was vulnerable to TOCTOU race conditions.
  const result = await activeStore.atomicCheckAndIncrement({
    userId: user.id,
    feature,
    limit,
    now,
  });

  if (!result.allowed) {
    return {
      allowed: false,
      status: 429,
      plan,
      usage: {
        feature,
        used: result.count,
        limit,
        remaining: 0,
      },
      body: {
        error: 'Daily usage limit reached',
        code: 'ERR_RATE_LIMIT_001',
      },
    };
  }

  // Log the event separately — count is already committed atomically above.
  // If this fails, we have a slight discrepancy in usage_events, but the
  // rate limit count is still correct (which is the security-critical part).
  try {
    await activeStore.insertUsageEvent({
      userId: user.id,
      feature,
      plan,
    });
  } catch (err) {
    console.error('[Usage Event Log Error]', { message: err?.message });
  }

  return {
    allowed: true,
    plan,
    usage: {
      feature,
      used: result.count,
      limit,
      remaining: Math.max(0, limit - result.count),
    },
  };
}
