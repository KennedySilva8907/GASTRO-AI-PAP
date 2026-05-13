/**
 * In-memory rate limiter for serverless handlers.
 *
 * Strategy: fixed window per (IP, endpoint), stored in a Map at module scope.
 *
 * SERVERLESS CAVEAT — be honest about what this protects against:
 *   - Mitigates accidental burst traffic from a single client (browser bug,
 *     fetch-loop in dev tools, single-source DDoS attempt).
 *   - Survives across requests on a warm Vercel runtime instance.
 *   - Resets on cold start (each new instance has its own Map).
 *   - Not distributed — multiple concurrent instances each track
 *     their own buckets, so true 100 req/min cap is per-instance, not global.
 *
 * For production-grade distributed rate limiting, swap this for
 * @upstash/ratelimit + Upstash Redis (works without changing call sites
 * because the public API of rateLimit() matches the signature).
 *
 * Until then, this module gives us enforced-by-default rate limits with
 * minimal infrastructure cost.
 */

const buckets = new Map();
const SWEEP_THRESHOLD = 5_000; // garbage-collect old entries when Map grows past this

function clientKey(req, scope) {
  const fwd = req.headers?.['x-forwarded-for'];
  const ip =
    (typeof fwd === 'string' ? fwd.split(',')[0].trim() : null) ||
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
  return `${scope}:${ip}`;
}

function sweepIfNeeded(now) {
  if (buckets.size <= SWEEP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > bucket.windowMs) {
      buckets.delete(key);
    }
  }
}

/**
 * Check whether the request is within the rate limit and increment the counter.
 * Returns { allowed, remaining, retryAfterSeconds }.
 */
export function rateLimit(req, { scope, max = 30, windowMs = 60_000 } = {}) {
  if (!scope) throw new Error('rateLimit() requires a scope');

  const now = Date.now();
  const key = clientKey(req, scope);
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1, windowMs });
    sweepIfNeeded(now);
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.start + windowMs - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: max - bucket.count, retryAfterSeconds: 0 };
}

// Helper: write 429 response with Retry-After header.
export function send429(res, retryAfterSeconds) {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({
    error: 'Too many requests',
    code: 'ERR_RATE_LIMIT_002',
    retryAfter: retryAfterSeconds,
  });
}

// Test-only helper to reset state between Vitest tests.
export function _resetForTests() {
  buckets.clear();
}
