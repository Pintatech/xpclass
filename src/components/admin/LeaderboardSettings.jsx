import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Save, RefreshCw, Eye, EyeOff, Play, Pause, Trophy, Settings, Package } from 'lucide-react';

import { assetUrl } from '../../hooks/useBranding';
const ALL_TABS = [
  { key: 'week', label: 'Tuần này (Weekly XP)' },
  { key: 'month', label: 'Tháng này (Monthly XP)' },
  { key: 'training', label: 'Competition' },
];

const GAME_TYPES = [
  { key: 'scramble', label: 'Word Scramble', icon: '🔤' },
  { key: 'whackmole', label: 'Whack-a-Mole', icon: '🔨' },
  { key: 'catch', label: 'Catch Game', icon: '🎯' },
  { key: 'flappy', label: 'Flappy Pet', icon: '🐦' },
  { key: 'astroblast', label: 'Astro Blast', icon: '🚀' },
];

const TRAINING_GAMES = [
  { key: 'scramble', label: 'Word Scramble', icon: '🔤' },
  { key: 'whackmole', label: 'Whack-a-Mole', icon: '🔨' },
  { key: 'astroblast', label: 'Astro Blast', icon: '🚀' },
];

const LeaderboardSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Settings state
  const [visibleTabs, setVisibleTabs] = useState(['week', 'month', 'training']);
  const [defaultTab, setDefaultTab] = useState('training');
  const [competitionActive, setCompetitionActive] = useState(true);
  const [competitionType, setCompetitionType] = useState('game'); // 'game' or 'items'
  const [competitionGameType, setCompetitionGameType] = useState('scramble');
  const [competitionItemId, setCompetitionItemId] = useState('');
  const [rewardGems, setRewardGems] = useState(1);
  const [rewardThreshold, setRewardThreshold] = useState(0); // minimum score to qualify for XP reward
  const [rewardXP, setRewardXP] = useState(5); // XP given to all qualifiers
  const [maxAttempts, setMaxAttempts] = useState(0); // 0 = unlimited
  const [competitionEndDate, setCompetitionEndDate] = useState(''); // ISO date string e.g. '2026-03-10'
  const [enabledTrainingGames, setEnabledTrainingGames] = useState(['scramble', 'whackmole', 'astroblast']);

  // Collectible items for "most items" competition
  const [collectibleItems, setCollectibleItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchCollectibleItems();
  }, []);

  const fetchCollectibleItems = async () => {
    try {
      setItemsLoading(true);
      const { data } = await supabase
        .from('collectible_items')
        .select('id, name, image_url, item_type, set_name, rarity')
        .eq('is_active', true)
        .order('set_name')
        .order('name');
      setCollectibleItems(data || []);
    } catch (err) {
      console.error('Error fetching collectible items:', err);
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'leaderboard_visible_tabs',
          'leaderboard_default_tab',
          'leaderboard_competition_active',
          'leaderboard_competition_type',
          'leaderboard_competition_game_type',
          'leaderboard_competition_item_id',
          'leaderboard_competition_reward_gems',
          'leaderboard_competition_reward_threshold',
          'leaderboard_competition_reward_xp',
          'leaderboard_competition_max_attempts',
          'leaderboard_competition_end_date',
          'pet_training_enabled_games',
        ]);

      if (error) throw error;

      data?.forEach((row) => {
        switch (row.setting_key) {
          case 'leaderboard_visible_tabs':
            try { setVisibleTabs(JSON.parse(row.setting_value)); } catch {}
            break;
          case 'leaderboard_default_tab':
            setDefaultTab(row.setting_value);
            break;
          case 'leaderboard_competition_active':
            setCompetitionActive(row.setting_value === 'true');
            break;
          case 'leaderboard_competition_type':
            setCompetitionType(row.setting_value);
            break;
          case 'leaderboard_competition_game_type':
            setCompetitionGameType(row.setting_value);
            break;
          case 'leaderboard_competition_item_id':
            setCompetitionItemId(row.setting_value);
            break;
          case 'leaderboard_competition_reward_gems':
            setRewardGems(parseInt(row.setting_value) || 1);
            break;
          case 'leaderboard_competition_reward_threshold':
            setRewardThreshold(parseInt(row.setting_value) || 0);
            break;
          case 'leaderboard_competition_reward_xp':
            setRewardXP(parseInt(row.setting_value) || 5);
            break;
          case 'leaderboard_competition_max_attempts':
            setMaxAttempts(parseInt(row.setting_value) || 0);
            break;
          case 'leaderboard_competition_end_date':
            setCompetitionEndDate(row.setting_value || '');
            break;
          case 'pet_training_enabled_games':
            try { setEnabledTrainingGames(JSON.parse(row.setting_value)); } catch {}
            break;
        }
      });
    } catch (err) {
      console.error('Error fetching leaderboard settings:', err);
      showNotification('Error loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSave = async () => {
    if (visibleTabs.length === 0) {
      showNotification('At least one tab must be visible', 'error');
      return;
    }

    if (competitionType === 'items' && !competitionItemId) {
      showNotification('Please select a collectible item for the competition', 'error');
      return;
    }

    const effectiveDefault = visibleTabs.includes(defaultTab) ? defaultTab : visibleTabs[0];

    try {
      setSaving(true);

      const settings = [
        { setting_key: 'leaderboard_visible_tabs', setting_value: JSON.stringify(visibleTabs), description: 'Visible leaderboard tabs' },
        { setting_key: 'leaderboard_default_tab', setting_value: effectiveDefault, description: 'Default leaderboard tab' },
        { setting_key: 'leaderboard_competition_active', setting_value: String(competitionActive), description: 'Whether competition is active' },
        { setting_key: 'leaderboard_competition_type', setting_value: competitionType, description: 'Competition type: game or items' },
        { setting_key: 'leaderboard_competition_game_type', setting_value: competitionGameType, description: 'Which game type for competition' },
        { setting_key: 'leaderboard_competition_item_id', setting_value: competitionItemId, description: 'Item ID for collection competition' },
        { setting_key: 'leaderboard_competition_reward_gems', setting_value: String(rewardGems), description: 'Gem reward for weekly champion' },
        { setting_key: 'leaderboard_competition_reward_threshold', setting_value: String(rewardThreshold), description: 'Minimum score to qualify for XP reward' },
        { setting_key: 'leaderboard_competition_reward_xp', setting_value: String(rewardXP), description: 'XP reward for all qualifiers' },
        { setting_key: 'leaderboard_competition_max_attempts', setting_value: String(maxAttempts), description: 'Max attempts per week (0 = unlimited)' },
        { setting_key: 'leaderboard_competition_end_date', setting_value: competitionEndDate, description: 'Competition end date (ISO)' },
        { setting_key: 'pet_training_enabled_games', setting_value: JSON.stringify(enabledTrainingGames), description: 'Which training games are available to students' },
      ];

      for (const s of settings) {
        const { error } = await supabase
          .from('site_settings')
          .upsert(s, { onConflict: 'setting_key' });
        if (error) throw error;
      }

      setDefaultTab(effectiveDefault);
      showNotification('Settings saved successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      showNotification('Error saving settings: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const [ending, setEnding] = useState(false);

  const handleEndCompetition = async () => {
    if (!window.confirm('End competition and award the winner? This will give the top player their gem reward and pause the competition.')) return;

    try {
      setEnding(true);

      if (competitionType === 'game') {
        // Find top scorer across all training_scores for this game type
        const { data: scores } = await supabase
          .from('training_scores')
          .select('user_id, score')
          .eq('game_type', competitionGameType)
          .order('score', { ascending: false })
          .limit(100);

        if (!scores || scores.length === 0) {
          showNotification('No players found — nobody played this competition.', 'error');
          return;
        }

        // Get best score per user
        const bestScores = {};
        scores.forEach(s => {
          if (!bestScores[s.user_id] || s.score > bestScores[s.user_id]) {
            bestScores[s.user_id] = s.score;
          }
        });

        const sorted = Object.entries(bestScores).sort((a, b) => b[1] - a[1]);
        const [championId, championScore] = sorted[0];

        // Award XP to all qualifiers who passed the threshold
        const qualifiers = sorted.filter(([, score]) => rewardThreshold > 0 ? score >= rewardThreshold : false);
        if (rewardXP > 0 && qualifiers.length > 0) {
          for (const [userId] of qualifiers) {
            const { data: userData } = await supabase.from('users').select('xp').eq('id', userId).single();
            await supabase.from('users').update({ xp: (userData?.xp || 0) + rewardXP }).eq('id', userId);
          }
        }

        // Award gems to champion (#1)
        if (rewardGems > 0) {
          const { data: userData } = await supabase.from('users').select('gems').eq('id', championId).single();
          await supabase.from('users').update({ gems: (userData?.gems || 0) + rewardGems }).eq('id', championId);
        }

        // Get winner name
        const { data: winner } = await supabase.from('users').select('full_name').eq('id', championId).single();

        // Clear training scores for this game type
        await supabase.from('training_scores').delete().eq('game_type', competitionGameType);

        // Pause competition
        setCompetitionActive(false);
        await supabase.from('site_settings').upsert({
          setting_key: 'leaderboard_competition_active',
          setting_value: 'false',
          description: 'Whether competition is active',
        }, { onConflict: 'setting_key' });

        const qualifierMsg = qualifiers.length > 0 ? ` ${qualifiers.length} player${qualifiers.length > 1 ? 's' : ''} earned ${rewardXP} XP.` : '';
        showNotification(`Competition ended! ${winner?.full_name || 'Winner'} won with ${championScore} points and received ${rewardGems} gems!${qualifierMsg}`);
      } else {
        // Item competition — just pause, no score cleanup needed
        setCompetitionActive(false);
        await supabase.from('site_settings').upsert({
          setting_key: 'leaderboard_competition_active',
          setting_value: 'false',
          description: 'Whether competition is active',
        }, { onConflict: 'setting_key' });

        showNotification('Item competition ended.');
      }
    } catch (err) {
      console.error('Error ending competition:', err);
      showNotification('Error ending competition: ' + err.message, 'error');
    } finally {
      setEnding(false);
    }
  };

  const toggleTab = (tabKey) => {
    setVisibleTabs((prev) =>
      prev.includes(tabKey)
        ? prev.filter((t) => t !== tabKey)
        : [...prev, tabKey]
    );
  };

  const selectedItem = collectibleItems.find(i => i.id === competitionItemId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          notification.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Settings className="w-6 h-6 text-gray-700" />
        <h2 className="text-xl font-bold text-gray-900">Leaderboard Settings</h2>
      </div>

      {/* Tab Visibility */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Tab Visibility
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Choose which tabs students can see on the leaderboard page.
        </p>
        <div className="space-y-3">
          {ALL_TABS.map((tab) => {
            const isVisible = visibleTabs.includes(tab.key);
            return (
              <label
                key={tab.key}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  isVisible
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isVisible ? (
                    <Eye className="w-4 h-4 text-blue-500" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={`font-medium ${isVisible ? 'text-gray-900' : 'text-gray-500'}`}>
                    {tab.label}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggleTab(tab.key)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Default Tab */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Default Tab
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Which tab is selected when students open the leaderboard.
        </p>
        <select
          value={visibleTabs.includes(defaultTab) ? defaultTab : visibleTabs[0] || ''}
          onChange={(e) => setDefaultTab(e.target.value)}
          className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {ALL_TABS.filter((t) => visibleTabs.includes(t.key)).map((tab) => (
            <option key={tab.key} value={tab.key}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* Pet Training Games */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Pet Training Games
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Choose which mini-games students can play in pet training.
        </p>
        <div className="space-y-3">
          {TRAINING_GAMES.map((game) => {
            const isEnabled = enabledTrainingGames.includes(game.key);
            return (
              <label
                key={game.key}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  isEnabled
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{game.icon}</span>
                  <span className={`font-medium ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                    {game.label}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => {
                    setEnabledTrainingGames(prev =>
                      prev.includes(game.key)
                        ? prev.filter(k => k !== game.key)
                        : [...prev, game.key]
                    );
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Competition Control */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Competition Settings
        </h3>

        {/* Active toggle */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-gray-900">Competition Status</p>
            <p className="text-sm text-gray-500">
              {competitionActive
                ? 'Competition is running. Scores are tracked.'
                : 'Competition is paused. Students can still play but scores are not tracked.'}
            </p>
          </div>
          <button
            onClick={() => setCompetitionActive(!competitionActive)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              competitionActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {competitionActive ? (
              <>
                <Play className="w-4 h-4" fill="currentColor" />
                Active
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                Paused
              </>
            )}
          </button>
        </div>

        {/* Competition Type */}
        <div className="border-t border-gray-100 pt-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-3">Competition Type</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCompetitionType('game')}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                competitionType === 'game'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-lg mb-1">🎮</div>
              <div className="text-sm font-semibold text-gray-900">Mini Game</div>
              <div className="text-xs text-gray-500">Best score in a game</div>
            </button>
            <button
              onClick={() => setCompetitionType('items')}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                competitionType === 'items'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-lg mb-1">📦</div>
              <div className="text-sm font-semibold text-gray-900">Item Collection</div>
              <div className="text-xs text-gray-500">Most of a specific item</div>
            </button>
          </div>
        </div>

        {/* Game Type Selection */}
        {competitionType === 'game' && (
          <div className="border-t border-gray-100 pt-4 mb-4">
            <p className="text-sm font-medium text-gray-900 mb-3">Choose Game</p>
            <div className="grid grid-cols-2 gap-2">
              {GAME_TYPES.map((game) => (
                <button
                  key={game.key}
                  onClick={() => setCompetitionGameType(game.key)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    competitionGameType === game.key
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{game.icon}</span>
                  <span className={`text-sm font-medium ${
                    competitionGameType === game.key ? 'text-purple-700' : 'text-gray-700'
                  }`}>
                    {game.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Item Selection */}
        {competitionType === 'items' && (
          <div className="border-t border-gray-100 pt-4 mb-4">
            <p className="text-sm font-medium text-gray-900 mb-3">Choose Item</p>
            {itemsLoading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading items...
              </div>
            ) : collectibleItems.length === 0 ? (
              <p className="text-sm text-gray-500">No collectible items found. Create items in the Inventory management first.</p>
            ) : (
              <>
                <select
                  value={competitionItemId}
                  onChange={(e) => setCompetitionItemId(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Select an item --</option>
                  {collectibleItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.set_name || item.item_type}) - {item.rarity}
                    </option>
                  ))}
                </select>
                {selectedItem && (
                  <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {selectedItem.image_url && (
                      <img src={selectedItem.image_url} alt={selectedItem.name} className="w-10 h-10 object-contain rounded" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{selectedItem.name}</div>
                      <div className="text-xs text-gray-500">
                        {selectedItem.set_name && `Set: ${selectedItem.set_name} · `}
                        {selectedItem.rarity}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Attempt Limit */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-900 mb-2">Attempts per Week</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="50"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 p-2 border border-gray-300 rounded-lg text-center text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">
              {maxAttempts === 0 ? 'Unlimited attempts' : `${maxAttempts} attempt${maxAttempts > 1 ? 's' : ''} per student per week`}
            </span>
          </div>
        </div>

        {/* Competition End Date */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-900 mb-2">Competition End Date</p>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={competitionEndDate}
              onChange={(e) => setCompetitionEndDate(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {competitionEndDate && (
              <button
                onClick={() => setCompetitionEndDate('')}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {competitionEndDate ? `Countdown shown to students until ${competitionEndDate}` : 'No end date — no countdown shown'}
          </p>
        </div>

        {/* Reward Config */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <p className="text-sm font-medium text-gray-900">Champion Reward</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="100"
              value={rewardGems}
              onChange={(e) => setRewardGems(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 p-2 border border-gray-300 rounded-lg text-center text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <img src={assetUrl('/image/study/gem.png')} alt="Gem" className="w-4 h-4" />
              Gems for Top 1 at end of week
            </div>
          </div>
        </div>

        {/* Threshold Reward Config */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-medium text-gray-900">Qualifier Reward</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="10000"
                value={rewardThreshold}
                onChange={(e) => setRewardThreshold(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 p-2 border border-gray-300 rounded-lg text-center text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-600">Minimum score to qualify (0 = disabled)</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="1000"
                value={rewardXP}
                onChange={(e) => setRewardXP(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 p-2 border border-gray-300 rounded-lg text-center text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-600">XP awarded to all who pass threshold</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* End Competition & Award */}
      {competitionActive && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700 mb-3">End the current competition, award gems to the winner, and clear scores.</p>
          <button
            onClick={handleEndCompetition}
            disabled={ending}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50 transition-all"
          >
            {ending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
            {ending ? 'Ending...' : 'End Competition & Award Winner'}
          </button>
        </div>
      )}
    </div>
  );
};

export default LeaderboardSettings;
