import { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import Button from './Button'

/**
 * AudioPlayer component with optional play limit
 *
 * @param {string} audioUrl - URL of the audio file
 * @param {number} maxPlays - Maximum number of times audio can be played (0 = unlimited)
 * @param {string} variant - Button variant (default, outline, etc.)
 * @param {string} className - Additional CSS classes
 * @param {function} onPlayComplete - Callback when audio finishes playing
 * @param {function} onLimitReached - Callback when play limit is reached
 */
const AudioPlayer = ({
  audioUrl,
  maxPlays = 0,
  variant = 'outline',
  className = '',
  onPlayComplete,
  onLimitReached,
  disabled = false
}) => {
  const [playCount, setPlayCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasReachedLimit, setHasReachedLimit] = useState(false)
  const audioRef = useRef(null)

  // Check if limit is reached
  useEffect(() => {
    if (maxPlays > 0 && playCount >= maxPlays) {
      setHasReachedLimit(true)
      if (onLimitReached) {
        onLimitReached()
      }
    }
  }, [playCount, maxPlays, onLimitReached])

  const handlePlay = () => {
    // Check if already at limit
    if (maxPlays > 0 && playCount >= maxPlays) {
      return
    }

    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)

      // Set up event listeners
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
        if (onPlayComplete) {
          onPlayComplete()
        }
      })

      audioRef.current.addEventListener('pause', () => {
        setIsPlaying(false)
      })

      audioRef.current.addEventListener('play', () => {
        setIsPlaying(true)
      })
    }

    // Play the audio
    audioRef.current.play()
      .then(() => {
        setPlayCount(prev => prev + 1)
      })
      .catch(err => {
        console.error('Error playing audio:', err)
        setIsPlaying(false)
      })
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Get button text based on state
  const getButtonText = () => {
    if (hasReachedLimit) {
      return 'Limit Reached'
    }
    if (isPlaying) {
      return 'Playing...'
    }
    if (maxPlays > 0) {
      const remaining = maxPlays - playCount
      return `Listen (${remaining} left)`
    }
    return 'Listen'
  }

  const isDisabled = disabled || hasReachedLimit

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Button
        onClick={handlePlay}
        variant={variant}
        disabled={isDisabled}
        className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
      >
        {hasReachedLimit ? (
          <VolumeX className="w-5 h-5 mr-2" />
        ) : (
          <Volume2 className="w-5 h-5 mr-2" />
        )}
        {getButtonText()}
      </Button>

      {/* Optional: Show play count indicator */}
      {maxPlays > 0 && !hasReachedLimit && (
        <div className="text-xs text-gray-500">
          {playCount} / {maxPlays} plays
        </div>
      )}

      {/* Stop button (only show when playing) */}
      {isPlaying && (
        <Button
          onClick={handleStop}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          Stop
        </Button>
      )}
    </div>
  )
}

export default AudioPlayer
