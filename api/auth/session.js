import { authenticateRequest } from '../_auth.js';
import { ERROR_CODES, runPreflight } from '../_shared.js';
import { PLAN_LIMITS, createSupabaseUsageStore, getPlanFromSubscription } from '../_usage.js';
import { rateLimit, send429 } from '../_rate-limit.js';

async function buildUsageSummary({ store, userId, plan }) {
  const now = new Date();
  const entries = await Promise.all(
    Object.keys(PLAN_LIMITS[plan]).map(async (feature) => {
      const window = await store.getUsageWindow({ userId, feature });
      const limit = PLAN_LIMITS[plan][feature];
      const used =
        window && now < new Date(window.window_expires_at) ? window.count : 0;
      return [feature, { used, limit, remaining: Math.max(0, limit - used) }];
    })
  );

  return Object.fromEntries(entries);
}

export default async function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  // Rate-limit by IP — this endpoint runs DB queries on every call, so
  // 30 req/min keeps an authenticated client comfortable but blocks
  // automated polling that would inflate Supabase costs.
  const limit = rateLimit(req, { scope: 'auth-session', max: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    return send429(res, limit.retryAfterSeconds);
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.body);
  }

  const store = createSupabaseUsageStore();
  if (!store) {
    return res.status(500).json({
      error: 'Usage service is not configured',
      code: ERROR_CODES.API_KEY_MISSING,
    });
  }

  try {
    await store.ensureProfile({ userId: auth.user.id, email: auth.user.email });
    const subscription = await store.getLatestSubscription(auth.user.id);
    const plan = getPlanFromSubscription(subscription);
    const usage = await buildUsageSummary({ store, userId: auth.user.id, plan });

    return res.status(200).json({
      user: { id: auth.user.id, email: auth.user.email },
      plan,
      usage,
    });
  } catch (error) {
    // Sanitize: log only the message + code, never the full error object
    // (Supabase/Stripe error objects can leak query hints, IDs, stack traces).
    console.error('[Auth Session Error]', { message: error?.message, code: error?.code });
    return res.status(500).json({
      error: 'Unable to load session',
      code: ERROR_CODES.INTERNAL,
    });
  }
}
