import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
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

  useEffect(() => {
    // Listen for auth changes - handles initial session automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event)

        try {
          if (session?.user) {
            setUser(session.user)
            // INITIAL_SESSION: Fired on page load with existing session
            // TOKEN_REFRESHED: Fired after user signs in successfully
            if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
              await fetchUserProfile(session.user.id)
            }
          } else {
            setUser(null)
            setProfile(null)
          }
        } catch (error) {
          console.error('❌ Error in auth state change:', error)
        } finally {
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId) => {
    try {
      console.log('📝 Fetching profile for user:', userId)

      // Add timeout to prevent infinite hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout after 5s')), 5000)
      )

      const fetchPromise = supabase
        .from('users')
        .select('id, email, full_name, role, xp, gems, level, streak_count, last_activity_date, avatar_url, active_title, active_frame_ratio, active_background_url, active_bowl_url, name_changed_at')
        .eq('id', userId)
        .single()

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise])

      if (error) {
        console.error('❌ Error fetching user profile:', error)
        console.error('❌ Error details:', JSON.stringify(error))
        // Don't set profile to null - keep existing profile data
      } else {
        console.log('✅ Profile fetched:', data)
        setProfile(data)
      }
    } catch (error) {
      console.error('❌ Error in fetchUserProfile:', error)
      console.error('❌ Error type:', error.message)
      // Don't set profile to null - keep existing profile data
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (!error && data.user) {
      window.location.reload()
    }

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
        .select('id, email, full_name, role, xp, gems, level, streak_count, last_activity_date, avatar_url, active_title, active_frame_ratio, active_background_url, active_bowl_url, name_changed_at')
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
