import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../supabase/client'

const PetContext = createContext(null)

export const usePet = () => {
  const context = useContext(PetContext)
  if (!context) {
    throw new Error('usePet must be used within a PetProvider')
  }
  return context
}

export const PetProvider = ({ children }) => {
  const { user, isAdmin } = useAuth()
  const [activePet, setActivePet] = useState(null)
  const [userPets, setUserPets] = useState([])
  const [allPets, setAllPets] = useState([])
  const [loading, setLoading] = useState(false)
  const [userEnergy, setUserEnergy] = useState(100)

  useEffect(() => {
    if (user) {
      fetchActivePet()
      fetchUserPets()
      fetchUserEnergy()
    }
    fetchAllPets()
  }, [user])

  const fetchUserEnergy = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('energy, energy_last_reset')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const today = new Date().toISOString().split('T')[0]
      if (!data.energy_last_reset || data.energy_last_reset < today) {
        // Auto-reset energy daily
        await supabase
          .from('users')
          .update({ energy: 100, energy_last_reset: today })
          .eq('id', user.id)
        setUserEnergy(100)
      } else {
        setUserEnergy(data.energy ?? 100)
      }
    } catch (error) {
      console.error('Error fetching user energy:', error)
    }
  }

  const fetchAllPets = async () => {
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('is_active', true)
        .order('rarity', { ascending: true })

      if (error) throw error
      setAllPets(data || [])
    } catch (error) {
      console.error('Error fetching all pets:', error)
    }
  }

  const fetchActivePet = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase.rpc('get_active_pet', {
        p_user_id: user.id
      })

      if (error) {
        console.error('Error fetching active pet:', error)
        return
      }

      if (data?.success) {
        setActivePet(data.pet)
      } else {
        setActivePet(null)
      }
    } catch (error) {
      console.error('Error fetching active pet:', error)
    }
  }

  const fetchUserPets = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_pets')
        .select(`
          *,
          pet:pets(*)
        `)
        .eq('user_id', user.id)
        .order('obtained_at', { ascending: false })

      if (error) throw error
      setUserPets(data || [])
    } catch (error) {
      console.error('Error fetching user pets:', error)
    } finally {
      setLoading(false)
    }
  }

  const buyEgg = async (eggItemId, currency = 'gems') => {
    if (!user) return { success: false, error: 'No user logged in' }

    try {
      const { data, error } = await supabase.rpc('buy_egg', {
        p_user_id: user.id,
        p_egg_item_id: eggItemId,
        p_currency: currency
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error buying egg:', error)
      return { success: false, error: error.message }
    }
  }

  const openEgg = async (eggItemId) => {
    if (!user) return { success: false, error: 'No user logged in' }

    try {
      const { data, error } = await supabase.rpc('open_egg', {
        p_user_id: user.id,
        p_egg_item_id: eggItemId
      })

      if (error) throw error

      if (data.success) {
        await fetchUserPets()
        await fetchActivePet()
      }

      return data
    } catch (error) {
      console.error('Error opening egg:', error)
      return { success: false, error: error.message }
    }
  }

  const setActivePetById = async (userPetId) => {
    if (!user) return { success: false, error: 'No user logged in' }

    try {
      const { data, error } = await supabase.rpc('set_active_pet', {
        p_user_id: user.id,
        p_user_pet_id: userPetId
      })

      if (error) throw error

      if (data.success) {
        await fetchActivePet()
        await fetchUserPets()
      }

      return data
    } catch (error) {
      console.error('Error setting active pet:', error)
      return { success: false, error: error.message }
    }
  }

  const feedPet = async (userPetId, itemId = null) => {
    if (!user) return { success: false, error: 'No user logged in' }

    try {
      const { data, error } = await supabase.rpc('feed_pet', {
        p_user_id: user.id,
        p_user_pet_id: userPetId,
        p_item_id: itemId
      })

      if (error) throw error

      if (data.success) {
        await fetchActivePet()
        await fetchUserPets()
      }

      return data
    } catch (error) {
      console.error('Error feeding pet:', error)
      return { success: false, error: error.message }
    }
  }

  const playWithPet = async (userPetId) => {
    if (!user) return { success: false, error: 'No user logged in' }

    try {
      const { data, error } = await supabase.rpc('play_with_pet', {
        p_user_id: user.id,
        p_user_pet_id: userPetId
      })

      if (error) throw error

      if (data.success) {
        await fetchActivePet()
        await fetchUserPets()
      }

      return data
    } catch (error) {
      console.error('Error playing with pet:', error)
      return { success: false, error: error.message }
    }
  }

  const evolvePet = async (userPetId, fruitItemId) => {
    if (!user) return { success: false, error: 'No user logged in' }

    try {
      const { data, error } = await supabase.rpc('evolve_pet', {
        p_user_id: user.id,
        p_user_pet_id: userPetId,
        p_fruit_item_id: fruitItemId
      })

      if (error) throw error

      if (data.success) {
        await fetchActivePet()
        await fetchUserPets()
      }

      return data
    } catch (error) {
      console.error('Error evolving pet:', error)
      return { success: false, error: error.message }
    }
  }

  const updatePetOnActivity = async () => {
    if (!user || !activePet) return

    try {
      const { data, error } = await supabase.rpc('update_pet_on_activity', {
        p_user_id: user.id
      })

      if (error) throw error

      if (data?.success) {
        await fetchActivePet()
      }
    } catch (error) {
      console.error('Error updating pet on activity:', error)
    }
  }

  // Drain user energy (universal energy pool, not per-pet)
  const drainPetEnergy = async (amount = 5) => {
    if (!user) return { success: false, error: 'No user logged in' }

    // Admin bypasses energy check
    if (isAdmin()) return { success: true, newEnergy: userEnergy ?? 100 }

    const currentEnergy = userEnergy ?? 100
    if (currentEnergy < amount) {
      return { success: false, error: 'Pet is too tired', currentEnergy }
    }

    try {
      const newEnergy = Math.max(0, currentEnergy - amount)

      const { error } = await supabase
        .from('users')
        .update({ energy: newEnergy })
        .eq('id', user.id)

      if (error) throw error

      // Update local state immediately for responsive UI
      setUserEnergy(newEnergy)

      return { success: true, newEnergy }
    } catch (error) {
      console.error('Error draining energy:', error)
      return { success: false, error: error.message }
    }
  }

  // Restore user energy (used when feeding pet)
  const restoreUserEnergy = async (amount = 5) => {
    if (!user) return

    try {
      const newEnergy = Math.min(100, (userEnergy ?? 100) + amount)

      const { error } = await supabase
        .from('users')
        .update({ energy: newEnergy })
        .eq('id', user.id)

      if (error) throw error

      setUserEnergy(newEnergy)
      return { success: true, newEnergy }
    } catch (error) {
      console.error('Error restoring energy:', error)
      return { success: false, error: error.message }
    }
  }

  const getActiveBonuses = () => {
    if (!activePet) return []

    // Calculate bonuses based on pet rarity
    const bonuses = []

    // Base rarity bonus
    let rarityBonus = 0
    if (activePet.rarity === 'common') rarityBonus = 5
    if (activePet.rarity === 'uncommon') rarityBonus = 10
    if (activePet.rarity === 'rare') rarityBonus = 15
    if (activePet.rarity === 'epic') rarityBonus = 20
    if (activePet.rarity === 'legendary') rarityBonus = 25

    // Evolution stage bonus (5% per stage)
    const evolutionStage = activePet.evolution_stage || 0
    const evolutionBonus = evolutionStage * 5

    // Total bonus
    const totalBonus = rarityBonus + evolutionBonus

    if (totalBonus > 0) {
      bonuses.push({
        type: 'xp_boost',
        value: totalBonus,
        breakdown: {
          rarity: rarityBonus,
          evolution: evolutionBonus
        }
      })
    }

    return bonuses
  }

  const renamePet = async (newNickname) => {
    if (!activePet) return
    try {
      const { error } = await supabase
        .from('user_pets')
        .update({ nickname: newNickname.trim() || null })
        .eq('id', activePet.id)
      if (error) throw error
      await fetchActivePet()
    } catch (error) {
      console.error('Error renaming pet:', error)
      throw error
    }
  }

  const value = {
    activePet,
    userPets,
    allPets,
    loading,
    userEnergy,
    buyEgg,
    openEgg,
    setActivePetById,
    feedPet,
    playWithPet,
    evolvePet,
    renamePet,
    updatePetOnActivity,
    drainPetEnergy,
    restoreUserEnergy,
    getActiveBonuses,
    fetchActivePet,
    fetchUserPets,
    fetchAllPets,
    fetchUserEnergy
  }

  return (
    <PetContext.Provider value={value}>
      {children}
    </PetContext.Provider>
  )
}
