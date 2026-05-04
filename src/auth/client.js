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

export async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const config = await getAuthConfig();
  const factory =
    globalThis.supabase?.createClient ||
    (await import('https://esm.sh/@supabase/supabase-js@2')).createClient;

  supabaseClient = factory(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}
