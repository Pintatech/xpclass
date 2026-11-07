// Shared checks for the paid AI routes in api/. Files under api/_lib are not routes (Vercel skips "_" paths).
//
// guard() works out who is calling and counts the call:
//   - a signed-in user sends "Authorization: Bearer <access token>" (src/utils/apiFetch.js adds it); the token is
//     checked with Supabase Auth, and the call is counted per user;
//   - anyone else is a guest: counted per IP address, and all guests together per route, so changing IP does not help;
//   - login: true turns guests away (401); staff: true also needs users.role teacher or admin (403).
// The counter is public.api_rate_hit() (migrations/add_api_rate_limits.sql), called with the service role key.
// If the counter cannot be reached (SQL not run yet, Supabase down) the call is let through rather than breaking the
// app; login and staff checks never let a call through on error.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

export const clientIp = (req) => {
  const forwarded = req.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

const bearer = (req) => {
  const header = req.headers.get('authorization') || ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

async function userFromToken(token) {
  if (!token || !SUPABASE_URL || !SERVICE_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ? user : null
  } catch {
    return null
  }
}

async function roleOf(userId) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=role,is_banned`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    })
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0] || null
  } catch {
    return null
  }
}

// true = allowed. Fails open: a missing counter must not take the app down.
async function hit(key, limit, windowSeconds = 3600) {
  if (!SUPABASE_URL || !SERVICE_KEY) return true
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/api_rate_hit`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: windowSeconds })
    })
    if (!res.ok) {
      console.error(`api_rate_hit failed (${res.status}); letting the call through`)
      return true
    }
    return (await res.json()) !== false
  } catch (err) {
    console.error('api_rate_hit unreachable; letting the call through', err)
    return true
  }
}

/**
 * @param {Request} req
 * @param {{ name: string, userPerHour: number, guestPerHour?: number, guestsPerHour?: number,
 *           login?: boolean, staff?: boolean }} rules
 *   guestPerHour: calls per guest IP; guestsPerHour: calls by all guests together.
 * @returns {Promise<{ user: object|null, error?: Response, limited?: boolean }>}
 *   error is set when the call must stop (401/403/429/500); limited is set with a 429.
 */
export async function guard(req, { name, userPerHour, guestPerHour = 0, guestsPerHour = 0, login = false, staff = false }) {
  const needsUser = login || staff
  if (needsUser && (!SUPABASE_URL || !SERVICE_KEY)) {
    return { user: null, error: jsonResponse(500, { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY or the Supabase URL' }) }
  }

  const user = await userFromToken(bearer(req))
  if (needsUser && !user) {
    return { user: null, error: jsonResponse(401, { error: 'Please sign in again' }) }
  }
  if (staff) {
    const row = await roleOf(user.id)
    if (!row || row.is_banned || !['teacher', 'admin'].includes(row.role)) {
      return { user, error: jsonResponse(403, { error: 'Teachers and admins only' }) }
    }
  }

  const tooMany = () => ({ user, limited: true, error: jsonResponse(429, { error: 'Too many requests. Please try again later.' }) })
  if (user) {
    if (!(await hit(`${name}:u:${user.id}`, userPerHour))) return tooMany()
  } else {
    if (!(await hit(`${name}:ip:${clientIp(req)}`, guestPerHour))) return tooMany()
    if (!(await hit(`${name}:guests`, guestsPerHour))) return tooMany()
  }
  return { user }
}

// Reads a JSON body of at most maxChars characters. Returns { body } or { error }.
export async function readJson(req, maxChars) {
  const text = await req.text()
  if (text.length > maxChars) return { error: jsonResponse(413, { error: 'Request too large' }) }
  try {
    return { body: JSON.parse(text) }
  } catch {
    return { error: jsonResponse(400, { error: 'Invalid JSON' }) }
  }
}

export const clamp = (n, lo, hi, fallback) => {
  const v = Number(n)
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback
}

export const supabaseUrl = SUPABASE_URL
