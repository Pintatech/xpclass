import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import { Save, RefreshCw, Trophy, Plus, Trash2, Flag, Swords } from 'lucide-react'

const PvPSeasonsAdmin = () => {
  const [seasons, setSeasons] = useState([])
  const [activeSeason, setActiveSeason] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState(null)

  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSoftReset, setNewSoftReset] = useState(2)
  const [newLpPerWin, setNewLpPerWin] = useState(25)
  const [newLpPerLoss, setNewLpPerLoss] = useState(20)
  const [newDailyCap, setNewDailyCap] = useState(150)

  const [rewards, setRewards] = useState([])

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const fetchSeasons = async () => {
    setLoading(true)
    try {
      const { data: allSeasons } = await supabase
        .from('pvp_seasons')
        .select('*')
        .order('started_at', { ascending: false })

      const active = (allSeasons || []).find(s => s.status === 'active') || null
      setSeasons(allSeasons || [])
      setActiveSeason(active)

      if (active) {
        const { data: rewardRows } = await supabase
          .from('pvp_season_rewards')
          .select('*')
          .eq('season_id', active.id)
          .order('min_level', { ascending: false })
        setRewards(rewardRows || [])
      } else {
        setRewards([])
      }
    } catch (err) {
      console.error('Error fetching seasons:', err)
      showNotif('Failed to load seasons', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSeasons() }, [])

  const handleStartSeason = async () => {
    if (!newSeasonName.trim()) {
      showNotif('Enter a season name', 'error')
      return
    }
    if (activeSeason) {
      showNotif('End the current season before starting a new one', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('pvp_seasons')
        .insert({
          name: newSeasonName.trim(),
          status: 'active',
          soft_reset_levels: newSoftReset,
          lp_per_win: newLpPerWin,
          lp_per_loss: newLpPerLoss,
          daily_lp_cap: newDailyCap,
        })
      if (error) throw error
      setNewSeasonName('')
      showNotif('Season started')
      fetchSeasons()
    } catch (err) {
      console.error('Start season error:', err)
      showNotif(err.message || 'Failed to start season', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEndSeason = async () => {
    if (!activeSeason) return
    if (!confirm(`End season "${activeSeason.name}"? This will snapshot final ranks and soft-reset all players.`)) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('end_pvp_season', {
        p_season_id: activeSeason.id,
      })
      if (error) throw error
      showNotif('Season ended and ranks reset')
      fetchSeasons()
    } catch (err) {
      console.error('End season error:', err)
      showNotif(err.message || 'Failed to end season', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addRewardBand = () => {
    setRewards(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        season_id: activeSeason?.id,
        min_level: 1,
        max_level: 3,
        xp_reward: 100,
        gem_reward: 10,
        title_reward: '',
        icon_reward: '',
        _isNew: true,
      },
    ])
  }

  const updateReward = (id, patch) => {
    setRewards(prev => prev.map(r => r.id === id ? { ...r, ...patch, _dirty: true } : r))
  }

  const removeReward = async (id) => {
    const reward = rewards.find(r => r.id === id)
    if (reward?._isNew) {
      setRewards(prev => prev.filter(r => r.id !== id))
      return
    }
    if (!confirm('Delete this reward band?')) return
    try {
      await supabase.from('pvp_season_rewards').delete().eq('id', id)
      setRewards(prev => prev.filter(r => r.id !== id))
      showNotif('Reward band removed')
    } catch (err) {
      showNotif('Failed to delete', 'error')
    }
  }

  const saveRewards = async () => {
    if (!activeSeason) return
    setSaving(true)
    try {
      for (const reward of rewards) {
        if (!reward._dirty && !reward._isNew) continue
        const payload = {
          season_id: activeSeason.id,
          min_level: reward.min_level,
          max_level: reward.max_level,
          xp_reward: reward.xp_reward || 0,
          gem_reward: reward.gem_reward || 0,
          title_reward: reward.title_reward || null,
          icon_reward: reward.icon_reward || null,
        }
        if (reward._isNew) {
          await supabase.from('pvp_season_rewards').insert(payload)
        } else {
          await supabase.from('pvp_season_rewards').update(payload).eq('id', reward.id)
        }
      }
      showNotif('Rewards saved')
      fetchSeasons()
    } catch (err) {
      console.error('Save rewards error:', err)
      showNotif('Failed to save rewards', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {notification && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          notification.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Active season */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-5 h-5 text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Active Season
          </h3>
        </div>
        {activeSeason ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">{activeSeason.name}</div>
                <div className="text-xs text-gray-500">
                  Started {new Date(activeSeason.started_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={handleEndSeason}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50"
              >
                <Flag className="w-4 h-4" />
                End Season
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">LP / Win</div>
                <div className="font-bold text-gray-900">{activeSeason.lp_per_win}</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">LP / Loss</div>
                <div className="font-bold text-gray-900">{activeSeason.lp_per_loss}</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">Daily Cap</div>
                <div className="font-bold text-gray-900">{activeSeason.daily_lp_cap}</div>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <div className="text-gray-500">Soft Reset</div>
                <div className="font-bold text-gray-900">-{activeSeason.soft_reset_levels} lvl</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic">No active season. Start one below.</div>
        )}
      </div>

      {/* Start new season */}
      {!activeSeason && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Start New Season
            </h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Season name</label>
              <input
                type="text"
                value={newSeasonName}
                onChange={(e) => setNewSeasonName(e.target.value)}
                placeholder="e.g. Season 2 — Spring"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">LP / Win</label>
                <input
                  type="number"
                  min="1"
                  value={newLpPerWin}
                  onChange={(e) => setNewLpPerWin(parseInt(e.target.value) || 25)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">LP / Loss</label>
                <input
                  type="number"
                  min="0"
                  value={newLpPerLoss}
                  onChange={(e) => setNewLpPerLoss(parseInt(e.target.value) || 20)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Daily Cap</label>
                <input
                  type="number"
                  min="0"
                  value={newDailyCap}
                  onChange={(e) => setNewDailyCap(parseInt(e.target.value) || 150)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Soft Reset (levels)</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={newSoftReset}
                  onChange={(e) => setNewSoftReset(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleStartSeason}
              disabled={saving || !newSeasonName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Start Season
            </button>
          </div>
        </div>
      )}

      {/* Reward bands */}
      {activeSeason && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Reward Bands
              </h3>
            </div>
            <button
              onClick={addRewardBand}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              <Plus className="w-3 h-3" />
              Add Band
            </button>
          </div>

          {rewards.length === 0 ? (
            <div className="text-sm text-gray-500 italic text-center py-4">
              No reward bands set. Click "Add Band" to configure rewards by rank tier.
            </div>
          ) : (
            <div className="space-y-2">
              {rewards.map(reward => (
                <div key={reward.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-lg">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Min Lvl</label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={reward.min_level}
                      onChange={(e) => updateReward(reward.id, { min_level: parseInt(e.target.value) || 1 })}
                      className="w-full p-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Max Lvl</label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={reward.max_level}
                      onChange={(e) => updateReward(reward.id, { max_level: parseInt(e.target.value) || 1 })}
                      className="w-full p-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-gray-500 mb-0.5">XP</label>
                    <input
                      type="number"
                      min="0"
                      value={reward.xp_reward}
                      onChange={(e) => updateReward(reward.id, { xp_reward: parseInt(e.target.value) || 0 })}
                      className="w-full p-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Gems</label>
                    <input
                      type="number"
                      min="0"
                      value={reward.gem_reward}
                      onChange={(e) => updateReward(reward.id, { gem_reward: parseInt(e.target.value) || 0 })}
                      className="w-full p-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Title</label>
                    <input
                      type="text"
                      value={reward.title_reward || ''}
                      onChange={(e) => updateReward(reward.id, { title_reward: e.target.value })}
                      placeholder="optional"
                      className="w-full p-1 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end pt-4">
                    <button
                      onClick={() => removeReward(reward.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={saveRewards}
                disabled={saving}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Rewards
              </button>
            </div>
          )}
        </div>
      )}

      {/* Past seasons */}
      {seasons.filter(s => s.status !== 'active').length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Past Seasons
          </h3>
          <div className="space-y-2">
            {seasons.filter(s => s.status !== 'active').map(s => (
              <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <div>
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(s.started_at).toLocaleDateString()}
                    {s.ended_at && ` → ${new Date(s.ended_at).toLocaleDateString()}`}
                  </div>
                </div>
                <span className="text-xs uppercase font-semibold text-gray-500">{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PvPSeasonsAdmin
