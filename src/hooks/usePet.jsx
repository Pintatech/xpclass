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
  const { user } = useAuth()
  const [activePet, setActivePet] = useState(null)
  const [userPets, setUserPets] = useState([])
  const [allPets, setAllPets] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchActivePet()
      fetchUserPets()
    }
    fetchAllPets()
  }, [user])

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

  // Drain pet energy (used for tutoring help)
  const drainPetEnergy = async (amount = 5) => {
    if (!user || !activePet) return { success: false, error: 'No active pet' }

    const currentEnergy = activePet.energy ?? 100
    if (currentEnergy < amount) {
      return { success: false, error: 'Pet is too tired', currentEnergy }
    }

    try {
      const newEnergy = Math.max(0, currentEnergy - amount)

      const { error } = await supabase
        .from('user_pets')
        .update({ energy: newEnergy })
        .eq('id', activePet.id)

      if (error) throw error

      // Update local state immediately for responsive UI
      setActivePet(prev => prev ? { ...prev, energy: newEnergy } : null)

      return { success: true, newEnergy }
    } catch (error) {
      console.error('Error draining pet energy:', error)
      return { success: false, error: error.message }
    }
  }

  const getPetHappinessStatus = (happiness) => {
    if (happiness >= 80) return { status: 'happy', emoji: '😊', color: 'text-green-500' }
    if (happiness >= 50) return { status: 'neutral', emoji: '😐', color: 'text-yellow-500' }
    if (happiness >= 20) return { status: 'sad', emoji: '😢', color: 'text-orange-500' }
    return { status: 'very_sad', emoji: '😭', color: 'text-red-500' }
  }

  const getActiveBonuses = () => {
    if (!activePet || activePet.happiness < 70) return []

    // Calculate bonuses based on pet rarity and happiness
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

  const value = {
    activePet,
    userPets,
    allPets,
    loading,
    buyEgg,
    openEgg,
    setActivePetById,
    feedPet,
    playWithPet,
    updatePetOnActivity,
    drainPetEnergy,
    getPetHappinessStatus,
    getActiveBonuses,
    fetchActivePet,
    fetchUserPets,
    fetchAllPets
  }

  return (
    <PetContext.Provider value={value}>
      {children}
    </PetContext.Provider>
  )
}
