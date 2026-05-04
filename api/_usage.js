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

    async setUsageWindow({ userId, feature, count, windowStartedAt, windowExpiresAt }) {
      const { error } = await supabase.from('daily_usage').upsert(
        {
          user_id: userId,
          feature,
          count,
          window_started_at: windowStartedAt,
          window_expires_at: windowExpiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,feature' }
      );

      if (error) throw error;
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

  const window = await activeStore.getUsageWindow({ userId: user.id, feature });

  let count;
  let windowStartedAt;
  let windowExpiresAt;

  if (!window || now >= new Date(window.window_expires_at)) {
    // Start a fresh 24-hour window
    windowStartedAt = now.toISOString();
    windowExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    count = 0;
  } else {
    count = window.count;
    windowStartedAt = window.window_started_at;
    windowExpiresAt = window.window_expires_at;
  }

  if (count >= limit) {
    return {
      allowed: false,
      status: 429,
      plan,
      usage: {
        feature,
        used: count,
        limit,
        remaining: 0,
      },
      body: {
        error: 'Daily usage limit reached',
        code: 'ERR_RATE_LIMIT_001',
      },
    };
  }

  const nextCount = count + 1;
  await activeStore.setUsageWindow({
    userId: user.id,
    feature,
    count: nextCount,
    windowStartedAt,
    windowExpiresAt,
  });
  await activeStore.insertUsageEvent({
    userId: user.id,
    feature,
    plan,
  });

  return {
    allowed: true,
    plan,
    usage: {
      feature,
      used: nextCount,
      limit,
      remaining: Math.max(0, limit - nextCount),
    },
  };
}
