import { supabase } from '../supabase/client'

// fetch() for the app's own /api routes. Adds the signed-in user's access token, so the server counts the call
// against that user (and lets teachers into teacher-only routes). Guests send no token and are counted per IP.
// See api/_lib/guard.js.
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (token) headers.set('Authorization', `Bearer ${token}`)
  } catch {
    // No session: call as a guest.
  }
  return fetch(path, { ...options, headers })
}
