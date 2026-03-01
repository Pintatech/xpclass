import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Save, RefreshCw, Eye, EyeOff, Play, Pause, Trophy, Settings, Package } from 'lucide-react';

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

        {/* Reward Config */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <p className="text-sm font-medium text-gray-900">Weekly Champion Reward</p>
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
              <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gem" className="w-4 h-4" />
              Gems for Top 1 at end of week
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
    </div>
  );
};

export default LeaderboardSettings;
