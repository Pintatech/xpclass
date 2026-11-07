// Supabase Edge Function for bulk user creation
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

const ROLES = ['user', 'teacher', 'admin']
const MAX_USERS_PER_CALL = 500

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  })

// Supabase errors (PostgrestError) are plain objects, not Error instances, so read .message from any object
const errorMessage = (error: unknown): string =>
  error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error)

type ImportRow = { email: string; name?: string; error?: string; rowNumber?: number }

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // This function runs with the service role key and sets each new account's role, so only a signed-in admin
    // may call it. Supabase's JWT check alone is not enough: the public anon key is a valid JWT too.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: authUser } = token ? await supabaseClient.auth.getUser(token) : { data: { user: null } }
    const callerId = authUser?.user?.id
    if (!callerId) {
      return reply(401, { error: 'Sign in as an admin to create users' })
    }
    const { data: caller } = await supabaseClient.from('users').select('role, is_banned').eq('id', callerId).single()
    if (caller?.role !== 'admin' || caller?.is_banned) {
      return reply(403, { error: 'Only an admin can create users' })
    }

    const { users } = await req.json()
    if (!Array.isArray(users) || users.length > MAX_USERS_PER_CALL) {
      return reply(400, { error: `Send a list of at most ${MAX_USERS_PER_CALL} users` })
    }

    const results: { success: ImportRow[]; failed: ImportRow[] } = {
      success: [],
      failed: []
    }

    for (const user of users) {
      try {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name,
            username: user.username
          }
        })

        if (authError) throw authError

        // Create or update user profile in public.users table
        const profileData: any = {
          id: authData.user.id,
          email: user.email,
          username: user.username,
          full_name: user.full_name,
          real_name: user.real_name || user.full_name,
          role: ROLES.includes(user.role) ? user.role : 'user'
        }

        if (user.avatar_url) {
          profileData.avatar_url = user.avatar_url
        }

        // Use upsert to handle both new users and existing users
        const { error: profileError } = await supabaseClient
          .from('users')
          .upsert(profileData, {
            onConflict: 'id',
            ignoreDuplicates: false
          })

        if (profileError) throw profileError

        // Add to cohort if specified
        if (user.cohort) {
          const { data: cohorts } = await supabaseClient
            .from('cohorts')
            .select('id')
            .eq('name', user.cohort)
            .limit(1)

          if (cohorts && cohorts.length > 0) {
            await supabaseClient
              .from('cohort_members')
              .insert({
                cohort_id: cohorts[0].id,
                student_id: authData.user.id,
                is_active: true
              })
          }
        }

        results.success.push({
          email: user.email,
          name: user.username
        })
      } catch (error) {
        console.error('Error creating user:', user.email, error)
        results.failed.push({
          email: user.email,
          error: errorMessage(error),
          rowNumber: user.rowNumber
        })
      }
    }

    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: errorMessage(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
