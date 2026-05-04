import { ERROR_CODES, runPreflight } from '../_shared.js';

export default function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: 'Authentication service is not configured',
      code: ERROR_CODES.API_KEY_MISSING,
    });
  }

  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
}
