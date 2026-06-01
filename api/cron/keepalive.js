/**
 * Daily production health probe.
 *
 * Verifies that the Supabase service-role credentials are still valid
 * and that the auth admin API is reachable. If this probe ever returns
 * non-200 in Vercel's cron logs it means the SDK call broke, the service
 * role key was rotated without updating env vars, or the project URL
 * drifted — all of which would silently break the rest of the app.
 *
 * Scheduled by vercel.json -> crons[] (12:00 UTC daily).
 * Guarded by CRON_SECRET so the probe can't be invoked by arbitrary
 * callers — only Vercel's scheduler holds the matching bearer token.
 */

import { getSupabaseAdminClient } from '../_supabase.js';

export default async function handler(req, res) {
  // Vercel's cron scheduler sends `Authorization: Bearer <CRON_SECRET>`
  // when CRON_SECRET is defined in the project's env vars.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${expected}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error: 'supabase admin client not configured',
      hint: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Vercel env',
    });
  }

  try {
    // perPage=1 keeps the response payload minimal — we only care that
    // the round-trip to the auth admin API succeeded, not the result.
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      ts: new Date().toISOString(),
      auth_admin_reachable: true,
      sample_size: Array.isArray(data?.users) ? data.users.length : 0,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
}
