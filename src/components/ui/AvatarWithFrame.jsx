const AVATAR_RATIO = 66 // avatar takes ~66% of the container, frame fills 100%

const AvatarWithFrame = ({
  avatarUrl,
  frameUrl,
  size = 80,
  fallback,
  onClick,
  className = '',
}) => {
  const hasFrame = frameUrl && frameUrl.startsWith('http')

  const renderAvatar = () => {
    if (avatarUrl) {
      if (avatarUrl.startsWith('http')) {
        return (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-full h-full object-cover rounded-full"
            onError={(e) => {
              e.target.style.display = 'none'
              if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline'
            }}
          />
        )
      }
      return <span className="text-2xl">{avatarUrl}</span>
    }
    if (fallback) {
      return <span className="text-2xl font-bold">{fallback}</span>
    }
    return <span className="text-2xl font-bold">U</span>
  }

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Avatar - if frame exists, shrink to center; otherwise fill container */}
      <div
        className={`absolute bg-white/20 rounded-full flex items-center justify-center overflow-hidden ${
          onClick ? 'cursor-pointer hover:bg-white/30 transition-colors' : ''
        }`}
        style={hasFrame ? {
          width: `${AVATAR_RATIO}%`,
          height: `${AVATAR_RATIO}%`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        } : {
          width: '100%',
          height: '100%',
        }}
        onClick={onClick}
      >
        {renderAvatar()}
        {fallback && (
          <span className="hidden text-2xl font-bold">{fallback}</span>
        )}
      </div>
      {/* Frame covers the full container */}
      {hasFrame && (
        <img
          src={frameUrl}
          alt=""
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      )}
    </div>
  )
}

export default AvatarWithFrame
