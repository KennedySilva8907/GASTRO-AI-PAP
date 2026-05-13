import { ERROR_CODES, runPreflight } from '../_shared.js';
import { rateLimit, send429 } from '../_rate-limit.js';

// Cache the public config response (Supabase URL + anon key are public by design)
// for 1 hour at the CDN to reduce repeated hits to this endpoint.
const CACHE_TTL_SECONDS = 3600;

export default function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  // Rate-limit: 60 requests per minute per IP. Generous because every page
  // load fetches this once, but tight enough to block enumeration loops.
  const limit = rateLimit(req, { scope: 'auth-config', max: 60, windowMs: 60_000 });
  if (!limit.allowed) {
    return send429(res, limit.retryAfterSeconds);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: 'Authentication service is not configured',
      code: ERROR_CODES.API_KEY_MISSING,
    });
  }

  res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}, immutable`);
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
}
