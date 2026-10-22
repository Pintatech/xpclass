import { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import Button from './Button'

// "5" -> 5, "0:05" -> 5, "1:02.5" -> 62.5; empty/invalid -> null
const toSeconds = (str) => {
  if (!str) return null
  const parts = str.split(':').map(Number)
  if (parts.length > 3 || parts.some(n => !Number.isFinite(n) || n < 0)) return null
  return parts.reduce((total, n) => total * 60 + n, 0)
}

// Split a media-fragment URL ("song.mp3#t=5,12") into the plain URL and the clip range
const parseClipUrl = (url) => {
  const hashIndex = url.indexOf('#')
  if (hashIndex === -1) return { src: url, start: 0, end: null }
  const match = url.slice(hashIndex + 1).match(/(?:^|&)t=([^,&]*)(?:,([^&]*))?/)
  if (!match) return { src: url, start: 0, end: null }
  const start = toSeconds(match[1]) ?? 0
  const end = toSeconds(match[2])
  return { src: url.slice(0, hashIndex), start, end: end !== null && end > start ? end : null }
}

/**
 * AudioPlayer component with optional play limit
 *
 * @param {string} audioUrl - URL of the audio file. Add "#t=5" or "#t=5,12" (seconds or m:ss)
 *   to start at 0:05 and optionally stop at 0:12
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
  seekable = true,
  externalPlayCount,
  onPlay,
  playbackRate = 1
}) => {
  const [internalPlayCount, setInternalPlayCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasReachedLimit, setHasReachedLimit] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef(null)
  const clipRef = useRef({ start: 0, end: null })

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

    // Audio element is created eagerly (see effect below); bail if not ready
    if (!audioRef.current) {
      return
    }

    // Start from the clip start if we're before it or past the clip end
    const audio = audioRef.current
    const { start, end } = clipRef.current
    if (audio.currentTime < start || (end !== null && audio.currentTime >= end)) {
      audio.currentTime = start
    }

    // Play the audio
    audio.play()
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

  // Keep the live audio element in sync when playbackRate prop changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
      audioRef.current.defaultPlaybackRate = playbackRate
    }
  }, [playbackRate])

  // Create the audio element eagerly whenever the source changes, so the
  // progress bar is seekable before the user presses play.
  useEffect(() => {
    if (!audioUrl) return

    const { src, start, end } = parseClipUrl(audioUrl)
    clipRef.current = { start, end }
    const audio = new Audio(src)
    audio.playbackRate = playbackRate
    audio.defaultPlaybackRate = playbackRate
    audioRef.current = audio

    const finishPlay = () => {
      audio.pause()
      audio.currentTime = start
      setIsPlaying(false)
      setProgress(0)
      if (onPlayComplete) {
        onPlayComplete()
      }
    }
    const handleEnded = finishPlay
    const handleLoadedMetadata = () => {
      if (start > 0 && audio.currentTime < start) audio.currentTime = start
    }
    const handlePauseEvent = () => setIsPlaying(false)
    const handlePlayEvent = () => setIsPlaying(true)
    const handleTimeUpdate = () => {
      if (end !== null && audio.currentTime >= end) {
        finishPlay()
        return
      }
      const clipEnd = end ?? audio.duration
      if (clipEnd && clipEnd > start) {
        setProgress(Math.max(0, Math.min(100, ((audio.currentTime - start) / (clipEnd - start)) * 100)))
      }
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePauseEvent)
    audio.addEventListener('play', handlePlayEvent)
    audio.addEventListener('timeupdate', handleTimeUpdate)

    // Reset state for the new source
    setIsPlaying(false)
    setProgress(0)
    setInternalPlayCount(0)
    setHasReachedLimit(false)

    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePauseEvent)
      audio.removeEventListener('play', handlePlayEvent)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      if (audioRef.current === audio) {
        audioRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl])

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
        <div
          className={`relative w-full h-2 bg-gray-200 rounded-full overflow-hidden ${seekable ? 'cursor-pointer' : ''}`}
          onClick={seekable ? (e) => {
            const audio = audioRef.current
            if (!audio || !audio.duration || isNaN(audio.duration)) return
            const rect = e.currentTarget.getBoundingClientRect()
            const seekRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            const { start, end } = clipRef.current
            const clipEnd = end ?? audio.duration
            audio.currentTime = start + seekRatio * (clipEnd - start)
            setProgress(seekRatio * 100)
          } : undefined}
        >
          <div
            className="absolute top-0 left-0 h-full bg-purple-500 transition-all duration-200 ease-linear pointer-events-none"
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
