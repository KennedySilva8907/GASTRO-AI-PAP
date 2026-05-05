import { API_ENDPOINTS } from '../shared/constants.js';

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
