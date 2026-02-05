import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePet } from '../../hooks/usePet'
import { Star, Check, Heart, Calendar, ShoppingBag, Book, X } from 'lucide-react'

const PetInventory = () => {
  const { userPets, allPets, setActivePetById } = usePet()
  const navigate = useNavigate()
  const [selectedPet, setSelectedPet] = useState(null)
  const [message, setMessage] = useState(null)
  const [showPetDex, setShowPetDex] = useState(false)

  // Get list of pet IDs the user owns
  const ownedPetIds = userPets.map(up => up.pet?.id).filter(Boolean)

  const handleSetActive = async (petId) => {
    const result = await setActivePetById(petId)

    if (result.success) {
      setMessage({
        type: 'success',
        text: 'Pet activated successfully! 🎉'
      })
      setSelectedPet(null)
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({
        type: 'error',
        text: result.error || 'Failed to set active pet'
      })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'border-gray-300 bg-gray-50',
      uncommon: 'border-green-300 bg-green-50',
      rare: 'border-blue-300 bg-blue-50',
      epic: 'border-purple-300 bg-purple-50',
      legendary: 'border-yellow-300 bg-yellow-50'
    }
    return colors[rarity] || colors.common
  }

  const getRarityBadgeColor = (rarity) => {
    const colors = {
      common: 'text-gray-700 bg-gray-200',
      uncommon: 'text-green-700 bg-green-200',
      rare: 'text-blue-700 bg-blue-200',
      epic: 'text-purple-700 bg-purple-200',
      legendary: 'text-yellow-700 bg-yellow-200'
    }
    return colors[rarity] || colors.common
  }

  const getRarityGradient = (rarity) => {
    const gradients = {
      common: 'bg-gradient-to-br from-gray-200 to-gray-300',
      uncommon: 'bg-gradient-to-br from-green-200 to-green-600',
      rare: 'bg-gradient-to-br from-blue-200 to-blue-600',
      epic: 'bg-gradient-to-br from-purple-200 to-purple-600',
      legendary: 'bg-gradient-to-br from-yellow-200 to-yellow-600'
    }
    return gradients[rarity] || gradients.common
  }

  const getHappinessColor = (happiness) => {
    if (happiness >= 80) return 'text-green-600'
    if (happiness >= 50) return 'text-yellow-600'
    if (happiness >= 20) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className={`${userPets.length === 0 ? 'max-w-4xl' : 'max-w-6xl'} mx-auto p-6`}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">My Pets</h1>
          <p className="text-gray-600">Manage your pet companions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPetDex(true)}
            className="bg-purple-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-md inline-flex items-center gap-2"
          >
            <Book className="w-5 h-5" />
            Pet Dex
          </button>
          <button
            onClick={() => navigate('/pets/shop')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-md inline-flex items-center gap-2"
          >
            <ShoppingBag className="w-5 h-5" />
            Egg Shop
          </button>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg text-center ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Empty State */}
      {userPets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="text-gray-400 mb-4">
            <span className="text-6xl">🐾</span>
          </div>
          <h3 className="text-xl font-bold text-gray-600 mb-2">No Pets Yet</h3>
          <p className="text-gray-500 mb-6">Pet gain you bonus XP and explain questions to you</p>
        </div>
      ) : (
      /* Pets Grid */
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userPets.map(userPet => {
          const pet = userPet.pet

          return (
            <div
              key={userPet.id}
              className={`border-2 rounded-xl p-6 transition-all cursor-pointer hover:shadow-lg ${getRarityColor(pet.rarity)} ${
                userPet.is_active ? `ring-4 ${
                  pet.rarity === 'common' ? 'ring-gray-400' :
                  pet.rarity === 'uncommon' ? 'ring-green-400' :
                  pet.rarity === 'rare' ? 'ring-blue-400' :
                  pet.rarity === 'epic' ? 'ring-purple-400' : 'ring-yellow-400'
                }` : ''
              }`}
              onClick={() => setSelectedPet(userPet)}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRarityBadgeColor(pet.rarity)}`}>
                  {pet.rarity.toUpperCase()}
                </span>
                {userPet.is_active && (
                  <div className="flex items-center gap-1 text-purple-600 text-sm font-semibold">
                    <Check className="w-4 h-4" />
                    Active
                  </div>
                )}
              </div>

              {/* Pet Image */}
              <div className={`w-full h-40 ${getRarityGradient(pet.rarity)} rounded-lg flex items-center justify-center mb-4 overflow-hidden`}>
                {pet.image_url ? (
                  <img src={pet.image_url} alt={pet.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-5xl">
                    {pet.rarity === 'legendary' ? '🐉' :
                     pet.rarity === 'epic' ? '🦅' :
                     pet.rarity === 'rare' ? '🦊' :
                     pet.rarity === 'uncommon' ? '🐱' : '🐶'}
                  </span>
                )}
              </div>

              {/* Pet Info */}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xl font-bold text-gray-800">
                  {userPet.nickname || pet.name}
                </h3>
                {/* Level */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="font-semibold">Level {userPet.level}</span>
                  </div>
                </div>
              </div>
              {userPet.nickname && (
                <p className="text-xs text-gray-500 mb-2">({pet.name})</p>
              )}

              {/* Stats */}
              <div className="space-y-2 mb-4">
                {/* Obtained Date */}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  Birthday {new Date(userPet.obtained_at).toLocaleDateString()}
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    pet.rarity === 'common' ? 'bg-gray-400' :
                    pet.rarity === 'uncommon' ? 'bg-green-500' :
                    pet.rarity === 'rare' ? 'bg-blue-500' :
                    pet.rarity === 'epic' ? 'bg-purple-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${(userPet.xp % 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* Pet Detail Modal */}
      {selectedPet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {selectedPet.nickname || selectedPet.pet.name}
            </h2>

            {/* Pet Preview */}
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg p-6 mb-4 text-center overflow-hidden">
              {selectedPet.pet.image_url ? (
                <img src={selectedPet.pet.image_url} alt={selectedPet.pet.name} className="w-32 h-32 mx-auto object-contain rounded-lg mb-4" />
              ) : (
                <div className="text-6xl mb-4">
                  {selectedPet.pet.rarity === 'legendary' ? '🐉' :
                   selectedPet.pet.rarity === 'epic' ? '🦅' :
                   selectedPet.pet.rarity === 'rare' ? '🦊' :
                   selectedPet.pet.rarity === 'uncommon' ? '🐱' : '🐶'}
                </div>
              )}

              <div className="space-y-3 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Species:</span>
                  <span className="font-semibold">{selectedPet.pet.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Level:</span>
                  <span className="font-semibold">{selectedPet.level}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">XP:</span>
                  <span className="font-semibold">{selectedPet.xp}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Rarity:</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getRarityBadgeColor(selectedPet.pet.rarity)}`}>
                    {selectedPet.pet.rarity.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">{selectedPet.pet.description}</p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedPet(null)}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
              >
                Close
              </button>
              {!selectedPet.is_active && (
                <button
                  onClick={() => handleSetActive(selectedPet.id)}
                  className="flex-1 px-4 py-3 bg-blue-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-lg transition-colors"
                >
                  Set Active
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pet Dex Modal */}
      {showPetDex && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-blue-500 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Book className="w-6 h-6" />
                  Pet Dex
                </h2>
                <p className="text-purple-100 text-sm mt-1">
                  {ownedPetIds.length} / {allPets.length} pets discovered
                </p>
              </div>
              <button
                onClick={() => setShowPetDex(false)}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Pet Grid */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Group by rarity */}
              {['common', 'uncommon', 'rare', 'epic', 'legendary'].map(rarity => {
                const petsOfRarity = allPets.filter(p => p.rarity === rarity)
                if (petsOfRarity.length === 0) return null

                return (
                  <div key={rarity} className="mb-6">
                    <h3 className={`text-lg font-bold mb-3 capitalize ${
                      rarity === 'common' ? 'text-gray-600' :
                      rarity === 'uncommon' ? 'text-green-600' :
                      rarity === 'rare' ? 'text-blue-600' :
                      rarity === 'epic' ? 'text-purple-600' : 'text-yellow-600'
                    }`}>
                      {rarity} Pets
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                      {petsOfRarity.map(pet => {
                        const isOwned = ownedPetIds.includes(pet.id)

                        return (
                          <div
                            key={pet.id}
                            className={`relative rounded-xl p-3 text-center transition-all ${
                              isOwned
                                ? `border-2 ${getRarityColor(pet.rarity)}`
                                : 'border-2 border-gray-200 bg-gray-100'
                            }`}
                          >
                            {/* Pet Image */}
                            <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
                              {pet.image_url ? (
                                <img
                                  src={pet.image_url}
                                  alt={isOwned ? pet.name : '???'}
                                  className={`w-full h-full object-contain select-none pointer-events-none ${
                                    !isOwned ? 'filter brightness-0' : ''
                                  }`}
                                  onContextMenu={(e) => e.preventDefault()}
                                  draggable="false"
                                />
                              ) : (
                                <span className={`text-3xl ${!isOwned ? 'filter grayscale brightness-50' : ''}`}>
                                  {pet.rarity === 'legendary' ? '🐉' :
                                   pet.rarity === 'epic' ? '🦅' :
                                   pet.rarity === 'rare' ? '🦊' :
                                   pet.rarity === 'uncommon' ? '🐱' : '🐶'}
                                </span>
                              )}
                            </div>

                            {/* Pet Name */}
                            <p className={`text-xs font-semibold truncate ${
                              isOwned ? 'text-gray-800' : 'text-gray-400'
                            }`}>
                              {isOwned ? pet.name : '???'}
                            </p>

                            {/* Owned Badge */}
                            {isOwned && (
                              <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-100 p-4 border-t">
              <button
                onClick={() => setShowPetDex(false)}
                className="w-full bg-blue-500 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PetInventory
