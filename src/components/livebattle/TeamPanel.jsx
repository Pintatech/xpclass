import React, { useState } from 'react'
import { ArrowRightLeft, Edit2, Check } from 'lucide-react'
import { assetUrl } from '../../hooks/useBranding'
import { POWERUPS } from '../../hooks/useLiveBattle'

const pointButtons = [
  { value: -1, image: 'https://xpclass.vn/xpclass/class-battle/brick.png', label: '-1', name: 'Brick' },
  { value: 1, image: 'https://xpclass.vn/xpclass/class-battle/apple.png', label: '+1', name: 'Apple' },
  { value: 2, image: 'https://xpclass.vn/xpclass/class-battle/fish.png', label: '+2', name: 'Fish' },
  { value: 3, image: 'https://xpclass.vn/xpclass/class-battle/meat.png', label: '+3', name: 'Meat' },
  { value: 'random', image: 'https://xpclass.vn/xpclass/class-battle/random.png', label: '?', name: 'Random' },
]

const rarityColors = {
  common: 'border-gray-300',
  uncommon: 'border-green-400',
  rare: 'border-blue-400',
  epic: 'border-purple-500',
  legendary: 'border-yellow-400',
}

const TeamPanel = ({
  team, // 'a' or 'b'
  teamName,
  teamScore,
  participants,
  isFrozen,
  hasShield,
  hasDouble,
  isActive, // game is active (not setup/finished)
  isSetup,
  onAddIndividualPoints,
  onUpdateTeam,
  onTeamNameChange,
  onAddTeamPoints,
  onActivatePowerup,
  teamColor, // 'red' or 'blue'
}) => {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(teamName)

  const colorTheme = teamColor === 'red'
    ? { bg: 'bg-red-50', border: 'border-red-300', header: 'bg-gradient-to-r from-red-500 to-red-600', accent: 'text-red-600', btn: 'bg-red-500 hover:bg-red-600', light: 'bg-red-100' }
    : { bg: 'bg-blue-50', border: 'border-blue-300', header: 'bg-gradient-to-r from-blue-500 to-blue-600', accent: 'text-blue-600', btn: 'bg-blue-500 hover:bg-blue-600', light: 'bg-blue-100' }

  const handleNameSave = () => {
    onTeamNameChange(team, nameInput)
    setEditingName(false)
  }

  return (
    <div className={`rounded-2xl ${colorTheme.border} border-2 overflow-hidden flex flex-col ${isFrozen ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className={`${colorTheme.header} text-white px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                className="bg-white/20 text-white placeholder-white/60 rounded px-2 py-0.5 text-sm w-32 outline-none"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleNameSave()}
              />
              <button onClick={handleNameSave} className="p-1 hover:bg-white/20 rounded">
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-bold text-lg">{teamName}</span>
              {(isSetup || isActive) && (
                <button onClick={() => { setNameInput(teamName); setEditingName(true) }} className="p-1 hover:bg-white/20 rounded">
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status badges */}
          {hasShield && <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">🛡️</span>}
          {hasDouble && <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">⚡2x</span>}
          {isFrozen && <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">❄️</span>}
          <span className="text-3xl font-black">{teamScore}</span>
        </div>
      </div>

      {/* Team-level point buttons + powerups */}
      {isActive && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-white/80 border-b flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Team:</span>
          {pointButtons.map(btn => (
            <button
              key={btn.label}
              onClick={() => {
                const val = btn.value === 'random'
                  ? Math.floor(Math.random() * 10) + 1
                  : btn.value
                onAddTeamPoints(team, val)
              }}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 text-base"
              title={btn.value === 'random' ? 'Random 1-10' : `${btn.name} (${btn.label})`}
            >
              {btn.image ? (
                <img src={btn.image} alt={btn.name} className="w-6 h-6 object-contain" />
              ) : (
                btn.emoji
              )}
            </button>
          ))}
          <div className="w-px h-6 bg-gray-300 mx-1" />
          {Object.entries(POWERUPS).map(([key, pu]) => (
            <button
              key={key}
              onClick={() => onActivatePowerup(key, team)}
              className={`bg-gradient-to-r ${pu.color} text-white rounded-full w-8 h-8 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow`}
              title={`${pu.name}: ${pu.description}`}
            >
              <span className="text-sm">{pu.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Participants */}
      <div className={`${colorTheme.bg} p-3 flex-1 overflow-y-auto`} style={{ maxHeight: '60vh' }}>
        {participants.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">No students</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {participants.map(p => (
              <div key={p.id} className={`bg-white rounded-xl p-2 shadow-sm border ${rarityColors[p.pet_rarity] || 'border-gray-200'} relative group`}>
                {/* Pet image */}
                <div className="flex items-center gap-2">
                  <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                    {p.pet_image ? (
                      <img src={p.pet_image} alt={p.pet_name} className={`w-20 h-20 object-contain ${team === 'b' ? '-scale-x-100' : ''}`} />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-2xl">🥚</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-800 truncate">{p.student_name}</div>
                    {p.pet_name && <div className="text-[10px] text-gray-500 truncate">{p.pet_name}</div>}
                    {isActive && (
                      <div className={`text-sm font-bold ${colorTheme.accent}`}>{p.individual_score} pts</div>
                    )}
                  </div>
                </div>

                {/* Individual point buttons (active phase) */}
                {isActive && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {pointButtons.map(btn => (
                      <button
                        key={btn.label}
                        onClick={() => {
                          const val = btn.value === 'random'
                            ? Math.floor(Math.random() * 10) + 1
                            : btn.value
                          onAddIndividualPoints(p.id, val)
                        }}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 text-sm"
                        title={btn.value === 'random' ? 'Random 1-10' : `${btn.name} (${btn.label})`}
                      >
                        {btn.image ? (
                          <img src={btn.image} alt={btn.name} className="w-5 h-5 object-contain" />
                        ) : (
                          btn.emoji
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Move team button (setup phase) */}
                {isSetup && (
                  <button
                    onClick={() => onUpdateTeam(p.id, team === 'a' ? 'b' : 'a')}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Move to other team"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TeamPanel
