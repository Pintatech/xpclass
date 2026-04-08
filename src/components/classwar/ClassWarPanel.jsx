import { Star, Crown, Flame, Gift } from 'lucide-react';
import { assetUrl } from '../../hooks/useBranding';

const teamThemes = {
  A: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    headerBg: 'bg-gradient-to-r from-red-600 to-red-500',
    accent: 'text-red-600',
    barBg: 'bg-red-200',
    barFill: 'bg-red-500',
    highlight: 'bg-red-100 ring-2 ring-red-400',
    xpBadge: 'bg-red-100 text-red-700',
  },
  B: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    headerBg: 'bg-gradient-to-r from-blue-600 to-blue-500',
    accent: 'text-blue-600',
    barBg: 'bg-blue-200',
    barFill: 'bg-blue-500',
    highlight: 'bg-blue-100 ring-2 ring-blue-400',
    xpBadge: 'bg-blue-100 text-blue-700',
  },
};

const RewardBadge = ({ reward, label }) => {
  if (!reward) return null;
  const parts = [];
  if (reward.xp > 0) parts.push({ type: 'xp', value: reward.xp });
  if (reward.gems > 0) parts.push({ type: 'gems', value: reward.gems });
  if (reward.items?.length > 0) {
    reward.items.forEach(i => parts.push({ type: 'item', value: `${i.item_name} x${i.quantity}`, image: i.image_url }));
  }
  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-white/80">
      <Gift className="w-3 h-3 shrink-0 text-yellow-300" />
      <span className="font-semibold text-yellow-200">{label}:</span>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="mx-0.5">+</span>}
          {p.type === 'xp' && <><span>{p.value}</span><img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-3 h-3" /></>}
          {p.type === 'gems' && <><span>{p.value}</span><img src={assetUrl('/image/study/gem.png')} alt="Gems" className="w-3 h-3" /></>}
          {p.type === 'item' && <>{p.image && <img src={p.image} alt="" className="w-3 h-3 object-contain" />}<span>{p.value}</span></>}
        </span>
      ))}
    </div>
  );
};

const ClassWarPanel = ({ team, teamName, members, totalXP, opponentXP, userId, rewards, compact = false }) => {
  const theme = teamThemes[team] || teamThemes.A;
  const isWinning = totalXP > opponentXP;
  const maxXP = Math.max(totalXP, opponentXP, 1);

  return (
    <div className={`${theme.bg} ${theme.border} border rounded-xl overflow-hidden ${compact ? '' : 'sticky top-6'}`}>
      {/* Header */}
      <div className={`${theme.headerBg} px-4 py-3 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isWinning && totalXP > 0 && <Crown className="w-4 h-4 text-yellow-300" />}
            <span className="font-bold text-sm">{teamName}</span>
          </div>
          <span className="text-xs opacity-80">{members.length} members</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Flame className="w-5 h-5 text-yellow-300" />
          <span className="text-2xl font-extrabold">{totalXP.toLocaleString()}</span>
          <span className="text-xs opacity-70">XP</span>
        </div>
        {/* XP bar */}
        <div className={`mt-2 h-2 ${theme.barBg} rounded-full overflow-hidden`}>
          <div
            className={`h-full ${theme.barFill} rounded-full transition-all duration-500`}
            style={{ width: `${Math.round((totalXP / maxXP) * 100)}%` }}
          />
        </div>
        {/* Rewards */}
        {rewards && (
          <div className="mt-2">
            <RewardBadge reward={isWinning ? rewards.winner : rewards.loser} label={isWinning ? 'Reward' : 'Reward'} />
          </div>
        )}
      </div>

      {/* Member list */}
      <div className={`p-3 space-y-1.5 ${compact ? 'max-h-48' : 'max-h-[60vh]'} overflow-y-auto`}>
        {members.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">No members yet</p>
        )}
        {members.map((member, idx) => {
          const isCurrentUser = member.id === userId;
          return (
            <div
              key={member.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                isCurrentUser ? theme.highlight : 'hover:bg-white/60'
              }`}
            >
              {/* Rank */}
              <span className="w-5 text-center text-xs font-bold text-gray-400">
                {idx === 0 && members.length > 1 ? (
                  <Star className="w-3.5 h-3.5 text-yellow-500 inline" />
                ) : (
                  idx + 1
                )}
              </span>

              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden shrink-0">
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                    {(member.name || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name */}
              <span className={`flex-1 truncate text-xs ${isCurrentUser ? 'font-bold' : 'text-gray-700'}`}>
                {member.name}
                {isCurrentUser && <span className="ml-1 text-[10px] opacity-60">(you)</span>}
              </span>

              {/* XP */}
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${theme.xpBadge}`}>
                {member.xp}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClassWarPanel;
