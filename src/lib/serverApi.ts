import { supabase } from '@/lib/supabase'

/** Local dev uses the Vite `/api` middleware. Production calls the Supabase Edge Function. */
export async function serverFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('Authorization')) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (publishable && !headers.has('apikey')) headers.set('apikey', publishable)

  const url = import.meta.env.DEV
    ? path
    : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api${path.replace(/^\/api/, '')}`

  return fetch(url, { ...init, headers })
}
