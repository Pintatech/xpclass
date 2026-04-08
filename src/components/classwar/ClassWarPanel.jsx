import { Star, Crown, Flame } from 'lucide-react';

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

const ClassWarPanel = ({ team, teamName, members, totalXP, opponentXP, userId, compact = false }) => {
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
