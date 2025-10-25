import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../supabase/client'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initializedRef = useRef(false)
  const currentUserIdRef = useRef(null)

  useEffect(() => {
    // Timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
    }, 10000) // 10 seconds timeout

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔐 Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          setLoading(false)
          return
        }

        if (session?.user) {
          console.log('👤 User found:', session.user.id)
          setUser(session.user)
          // Fetch profile and wait for it to complete
          await fetchUserProfile(session.user.id).catch(error => {
            console.error('Initial profile fetch failed:', error)
            setProfile(null)
          })
        } else {
          console.log('❌ No session found')
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        console.log('✅ Setting loading to false')
        clearTimeout(loadingTimeout)
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event)

        // Skip INITIAL_SESSION if we already initialized
        if (event === 'INITIAL_SESSION' && initializedRef.current) {
          return
        }

        if (event === 'INITIAL_SESSION') {
          initializedRef.current = true
        }

        try {
          if (session?.user) {
            // Skip if same user to prevent duplicate fetches
            if (currentUserIdRef.current === session.user.id) {
              console.log('Same user, skipping duplicate fetch')
              return
            }

            currentUserIdRef.current = session.user.id
            setUser(session.user)
            await fetchUserProfile(session.user.id).catch(error => {
              console.error('Profile fetch failed:', error)
              setProfile(null)
            })
          } else {
            currentUserIdRef.current = null
            setUser(null)
            setProfile(null)
          }
        } catch (error) {
          console.error('Error in auth state change:', error)
        } finally {
          clearTimeout(loadingTimeout)
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(loadingTimeout)
    }
  }, [])

  const fetchUserProfile = async (userId) => {
    try {
      console.log('📝 Fetching profile for user:', userId)

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      )

      const fetchPromise = supabase
        .rpc('get_user_profile', { user_id: userId })
        .single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise])

      if (error) {
        console.error('❌ Error fetching user profile:', error)
        setProfile(null)
      } else {
        console.log('✅ Profile fetched:', data)
        setProfile(data)
      }
    } catch (error) {
      console.error('❌ Error in fetchUserProfile:', error)
      setProfile(null)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName
        }
      }
    })

    if (data.user && !error) {
      // Create user profile ngay lập tức
      try {
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          full_name: fullName,
          role: 'user',
          current_level: 1,
          xp: 0,
          streak_count: 0
        })
        
        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }
      } catch (profileError) {
        console.error('Error creating user profile:', profileError)
      }
    }

    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setUser(null)
      setProfile(null)
    }
    return { error }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: 'No user logged in' }

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      setProfile(data)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const isAdmin = () => {
    // Check both profile role and user metadata as fallback
    return profile?.role === 'admin' || user?.user_metadata?.role === 'admin'
  }

  const isTeacher = () => {
    return profile?.role === 'teacher'
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isAdmin,
    isTeacher,
    fetchUserProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
