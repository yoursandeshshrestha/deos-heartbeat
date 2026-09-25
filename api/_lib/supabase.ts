import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabase as supabaseEnv } from './env.js'

let cached: SupabaseClient | null = null

/** Service-role client for serverless routes. Bypasses RLS. */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached

  const url = supabaseEnv.url()
  const key = supabaseEnv.serviceRoleKey()
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
