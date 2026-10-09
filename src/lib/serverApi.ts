import { supabase } from '@/lib/supabase'

/** Same-origin `/api` routes. Local Vite and production Vercel both serve them. */
export async function serverFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('Authorization')) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (publishable && !headers.has('apikey')) headers.set('apikey', publishable)

  return fetch(path, { ...init, headers })
}
