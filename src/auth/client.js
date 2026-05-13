import { API_ENDPOINTS } from '../shared/constants.js';

// Validate that a `redirect` query/sessionStorage value is a same-origin path.
// Without this, an attacker could send "/auth/login?redirect=https://evil.com"
// in a phishing email — after legitimate login the user lands on the attacker's
// site (open redirect → credential phishing).
//
// Rules:
//   - must start with "/" (relative path)
//   - must NOT start with "//" (protocol-relative URL → cross-origin)
//   - must NOT contain "\" (Windows-style separator browsers may treat as "/")
//   - falls back to "/" on anything else
export function sanitizeRedirect(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.includes('\\')) return '/';
  return raw;
}

let authConfig = null;
let supabaseClient = null;

export async function getAuthConfig() {
  if (authConfig) return authConfig;

  const response = await fetch(API_ENDPOINTS.authConfig);
  if (!response.ok) {
    throw new Error('Unable to load auth configuration');
  }

  authConfig = await response.json();
  return authConfig;
}

async function loadSupabaseSDK() {
  if (globalThis.supabase?.createClient) return globalThis.supabase.createClient;
  // Fallback: ESM CDN if the UMD <script> tag failed to load
  const mod = await import('https://esm.sh/@supabase/supabase-js@2');
  return mod.createClient;
}

export async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const config = await getAuthConfig();
  const createClient = await loadSupabaseSDK();

  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  return supabaseClient;
}
