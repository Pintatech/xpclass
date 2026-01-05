import { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
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
 * @param {number} externalPlayCount - External play count (for shared limits across multiple instances)
 * @param {function} onPlay - Callback when play button is clicked (to increment external count)
 */
const AudioPlayer = ({
  audioUrl,
  maxPlays = 0,
  variant = 'outline',
  className = '',
  onPlayComplete,
  onLimitReached,
  disabled = false,
  externalPlayCount,
  onPlay
}) => {
  const [internalPlayCount, setInternalPlayCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasReachedLimit, setHasReachedLimit] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef(null)

  // Use external play count if provided, otherwise use internal
  const playCount = externalPlayCount !== undefined ? externalPlayCount : internalPlayCount

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
        setProgress(0)
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

      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current.duration) {
          const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100
          setProgress(currentProgress)
        }
      })
    }

    // Play the audio
    audioRef.current.play()
      .then(() => {
        // If external play count is managed, call onPlay callback
        if (onPlay) {
          onPlay()
        } else {
          // Otherwise use internal state
          setInternalPlayCount(prev => prev + 1)
        }
      })
      .catch(err => {
        console.error('Error playing audio:', err)
        setIsPlaying(false)
      })
  }

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Reset audio player when audioUrl changes
  useEffect(() => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    // Reset state
    setIsPlaying(false)
    setProgress(0)
    setInternalPlayCount(0)
    setHasReachedLimit(false)
  }, [audioUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const isDisabled = disabled || hasReachedLimit

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        onClick={isPlaying ? handlePause : handlePlay}
        disabled={isDisabled}
        className={`
          w-12 h-12 rounded-full flex-shrink-0
          flex items-center justify-center
          transition-all duration-200
          ${isDisabled
            ? 'bg-gray-300 cursor-not-allowed opacity-50'
            : 'bg-purple-500 hover:bg-purple-600 active:scale-95'
          }
        `}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" stroke="white" fill="white" />
        ) : (
          <Play className="w-6 h-6 ml-0.5" stroke="white" fill="white" />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-purple-500 transition-all duration-200 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Optional: Show play count indicator */}
        {maxPlays > 0 && !hasReachedLimit && (
          <div className="text-xs text-gray-500 whitespace-nowrap">
            {playCount} / {maxPlays}
          </div>
        )}
      </div>
    </div>
  )
}

export default AudioPlayer
