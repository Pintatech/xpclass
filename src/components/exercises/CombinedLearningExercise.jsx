import React, { useState, useRef, useEffect } from 'react';
import { Play, Volume2, Mic, RotateCcw, Video, Image, Square } from 'lucide-react';
import Button from '../ui/Button';
import RecordingInterface from '../study/RecordingInterface';
import { useProgress } from '../../hooks/useProgress';
// Removed useNavigate import for bottomNavBack handling here

const CombinedLearningExercise = ({ exercise, onComplete }) => {
  const [currentMode, setCurrentMode] = useState('image'); // 'image' or 'video'
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // Track current image index
  const [hasListened, setHasListened] = useState(false);
  const [hasWatched, setHasWatched] = useState(false);
  const [hasPracticed, setHasPracticed] = useState(false);
  const [showRecordingInterface, setShowRecordingInterface] = useState(false);
  
  // Development mode - set to true to skip conditions
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  const [audioState, setAudioState] = useState({
    isPlaying: false,
    currentSpeed: null
  });
  const [watchProgress, setWatchProgress] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(null);

  // Touch/swipe state
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  // Competitive mode state
  const [isCompetitiveMode, setIsCompetitiveMode] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState('mom'); // 'mom' or 'kid'
  const [momScore, setMomScore] = useState(0);
  const [kidScore, setKidScore] = useState(0);
  const [momAccuracy, setMomAccuracy] = useState(null);
  const [kidAccuracy, setKidAccuracy] = useState(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const [momAudioUrl, setMomAudioUrl] = useState(null);
  const [kidAudioUrl, setKidAudioUrl] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [startTime] = useState(Date.now());
  
  // iOS detection
  const isIOS = typeof navigator !== 'undefined' && (
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
     /CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent))
  );
  
  // Progress hook for XP tracking
  const { completeExerciseWithXP } = useProgress();

  // iOS-specific: Delay showing RecordingInterface to avoid premature permission prompts
  useEffect(() => {
    if (isIOS) {
      // On iOS, delay showing RecordingInterface until user has interacted
      const timer = setTimeout(() => {
        setShowRecordingInterface(true);
      }, 1000); // 1 second delay
      
      // Also show RecordingInterface immediately on user interaction
      const handleUserInteraction = () => {
        setShowRecordingInterface(true);
        document.removeEventListener('touchstart', handleUserInteraction);
        document.removeEventListener('click', handleUserInteraction);
      };
      
      document.addEventListener('touchstart', handleUserInteraction, { once: true });
      document.addEventListener('click', handleUserInteraction, { once: true });
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('touchstart', handleUserInteraction);
        document.removeEventListener('click', handleUserInteraction);
      };
    } else {
      // On other platforms, show immediately
      setShowRecordingInterface(true);
    }
  }, [isIOS]);

  // Styled text rendering similar to SentencePronunciationExercise
  const renderStyledText = (text) => {
    if (!text) return text;
    const colorTags = /<(\w+)>(.*?)<\/\1>/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = colorTags.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), color: null });
      }
      parts.push({ text: match[2], color: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), color: null });
    }
    if (parts.length === 0) return text;
    const colorClasses = {
      red: 'text-red-600 font-bold',
      blue: 'text-blue-600 font-bold',
      green: 'text-green-600 font-bold',
      orange: 'text-orange-600 font-bold',
      purple: 'text-purple-600 font-bold',
      pink: 'text-pink-600 font-bold',
      yellow: 'text-yellow-600 font-bold',
      indigo: 'text-indigo-600 font-bold'
    };
    return parts.map((part, index) =>
      part.color ? (
        <span key={index} className={colorClasses[part.color] || 'text-red-600 font-bold'}>{part.text}</span>
      ) : (
        <span key={index}>{part.text}</span>
      )
    );
  };

  const playAudio = (speed = 1.0) => {
    if (!exercise?.audioUrl) {
      console.warn('No exercise.audioUrl provided');
    }
    // Ensure we have an audio instance even if <audio> hasn't mounted yet
    if (!audioRef.current && exercise?.audioUrl) {
      const dyn = new Audio(exercise.audioUrl);
      dyn.preload = 'auto';
      dyn.onended = handleAudioEnd;
      audioRef.current = dyn;
      console.log('🎧 Created dynamic Audio instance');
    }

    if (audioRef.current) {
      // If already playing at the same speed, stop it
      if (audioState.isPlaying && audioState.currentSpeed === speed) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setAudioState({ isPlaying: false, currentSpeed: null });
        console.log('⏹️ Stopped audio');
        return;
      }
      // If playing at different speed, stop current and start new
      if (audioState.isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      // Start playing with specified speed
      setAudioState({ isPlaying: true, currentSpeed: speed });
      try {
        audioRef.current.playbackRate = speed;
      } catch {}
      const p = audioRef.current.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          console.log(`🎵 Audio started playing at ${speed}x speed`, exercise?.audioUrl);
          setHasListened(true);
        }).catch((err) => {
          console.error('Audio play() rejected:', err);
        });
      } else {
        // If play() didn't return a promise (older browsers), still mark listened
        setHasListened(true);
      }
    } else {
      console.warn('audioRef.current is null');
    }
  };

  const handleAudioEnd = () => {
    setAudioState({ isPlaying: false, currentSpeed: null });
    console.log('🔚 Audio ended');
    setHasListened(true);
  };

  // Image navigation functions
  const nextImage = () => {
    const imageUrls = exercise.imageUrls || [exercise.imageUrl];
    setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const prevImage = () => {
    const imageUrls = exercise.imageUrls || [exercise.imageUrl];
    setCurrentImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  const getCurrentImageUrl = () => {
    const imageUrls = exercise.imageUrls || [exercise.imageUrl];
    return imageUrls[currentImageIndex];
  };

  const getTotalImages = () => {
    const imageUrls = exercise.imageUrls || [exercise.imageUrl];
    return imageUrls.length;
  };

  // Swipe functions
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && getTotalImages() > 1) {
      nextImage();
    }
    if (isRightSwipe && getTotalImages() > 1) {
      prevImage();
    }
  };

  // Competitive mode functions
  const toggleCompetitiveMode = () => {
    setIsCompetitiveMode(!isCompetitiveMode);
    if (!isCompetitiveMode) {
      // Reset scores when starting competitive mode
      setMomScore(0);
      setKidScore(0);
      setMomAccuracy(null);
      setKidAccuracy(null);
      setCurrentPlayer('mom');
      setRoundComplete(false);
      setMomAudioUrl(null);
      setKidAudioUrl(null);
      
      // Stop current audio if playing
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
    }
  };

  const handleScoreUpdate = async (accuracy, xp) => {
    // Complete exercise and award XP only on first completion
    const exerciseXP = exercise?.xp_reward || 10; // Default to 10 if not set
    const completionResult = await completeExerciseWithXP(exercise.id, exerciseXP, {
      score: accuracy,
      max_score: 100
    });
    
    if (completionResult.xpAwarded) {
      console.log('💎 Awarded XP for first completion:', completionResult.xpAwarded);
    } else {
      console.log('📝 Exercise completed before, no XP awarded');
    }
    
    if (isCompetitiveMode) {
      // Update current player's accuracy
      if (currentPlayer === 'mom') {
        setMomAccuracy(accuracy);
        setCurrentPlayer('kid');
      } else {
        setKidAccuracy(accuracy);
        setRoundComplete(true);
      }
      setHasPracticed(true);
    } else {
      // Normal mode
      setFinalAccuracy(accuracy);
      setHasPracticed(true);
    }
  };

  const handleAudioRecorded = (audioUrl, audioBlob) => {
    if (isCompetitiveMode) {
      // Store audio for current player
      if (currentPlayer === 'mom') {
        console.log('👩‍💼 Storing Mom\'s audio');
        setMomAudioUrl(audioUrl);
      } else if (currentPlayer === 'kid') {
        console.log('👶 Storing Kid\'s audio');
        setKidAudioUrl(audioUrl);
      }
    }
  };

  const playPlayerAudio = (audioUrl, player) => {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);
    
    audio.onended = () => {
      setCurrentAudio(null);
    };

    audio.play().catch(error => {
      console.error('Error playing audio:', error);
    });

    console.log(`🎵 Playing ${player}'s audio`);
  };

  const determineWinner = () => {
    if (momAccuracy !== null && kidAccuracy !== null) {
      if (momAccuracy > kidAccuracy) {
        setMomScore(prev => prev + 1);
        return 'mom';
      } else if (kidAccuracy > momAccuracy) {
        setKidScore(prev => prev + 1);
        return 'kid';
      } else {
        // Tie - no points awarded
        return 'tie';
      }
    }
    return null;
  };

  const startNewRound = () => {
    setCurrentPlayer('mom');
    setMomAccuracy(null);
    setKidAccuracy(null);
    setRoundComplete(false);
    setMomAudioUrl(null);
    setKidAudioUrl(null);
    
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
  };

  // Determine winner when round is complete
  useEffect(() => {
    if (roundComplete) {
      determineWinner();
    }
  }, [roundComplete]);

  const handleVideoPlay = () => {
    console.log('🎥 Video started playing');
  };
  
  const handleVideoPause = () => {
    console.log('🎥 Video paused');
  };
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setWatchProgress(progress);
      
      // Mark as watched if user watched at least 80%
      if (progress >= 80 && !hasWatched) {
        setHasWatched(true);
      }
    }
  };

  const handleComplete = () => {
    onComplete({
      type: 'combined_learning',
      completed: true,
      hasListened,
      hasWatched,
      hasPracticed,
      watchProgress,
      accuracy: isCompetitiveMode ? Math.max(momAccuracy || 0, kidAccuracy || 0) : (finalAccuracy || 85),
      timeSpent: Date.now() - startTime,
      // Add competitive mode data
      isCompetitiveMode,
      momScore,
      kidScore,
      momAccuracy,
      kidAccuracy
    });
  };

  const canContinue = (hasListened && hasWatched && (isCompetitiveMode ? (momAccuracy !== null && kidAccuracy !== null) : hasPracticed));

  // Removed bottomNavBack listener here to let parent handle view change

  return (
    <div className="space-y-6">
      {/* Competitive Mode Toggle & Scoreboard */}
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          {/* Mom Score - Only show in competitive mode */}
      {isCompetitiveMode && (
            <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${currentPlayer === 'mom'
                ? 'border-pink-400 bg-pink-50 shadow-md'
                : 'border-gray-200 bg-gray-50'
              }`}>
              <div className="text-2xl font-bold text-pink-600">{momScore}</div>
              <div className="text-2xl">👩‍💼</div>
            </div>
          )}

          {/* VS Image Toggle */}
                <button
            onClick={toggleCompetitiveMode}
            className={`transition-all duration-200 hover:scale-105 ${isCompetitiveMode
                ? 'opacity-100 shadow-lg'
                : 'opacity-70 hover:opacity-100'
              }`}
          >
            <img
              src="https://xpclass.vn/momtek/versus.jpg"
              alt="Toggle Competitive Mode"
              className="w-16 h-16 object-contain rounded-lg"
            />
                </button>

          {/* Kid Score - Only show in competitive mode */}
          {isCompetitiveMode && (
            <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${currentPlayer === 'kid'
                ? 'border-blue-400 bg-blue-50 shadow-md'
                : 'border-gray-200 bg-gray-50'
              }`}>
              <div className="text-2xl">👶</div>
              <div className="text-2xl font-bold text-blue-600">{kidScore}</div>
            </div>
          )}
        </div>
      </div>

      {/* Content Display with Fixed Frame + Word wrapped together */}
        <div className="w-full max-w-md mx-auto mb-4 border border-gray-300 rounded-xl bg-white">
          {/* Fixed Frame Container */}
          <div className="relative w-full h-64 bg-gray-100 rounded-t-xl overflow-hidden">
            {currentMode === 'image' ? (
              // Image Mode with Swipe Support
            <div
              className="relative w-full h-full"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
                <img 
                  src={getCurrentImageUrl()} 
                  alt={exercise.word}
                className="w-full h-full object-cover transition-all duration-300 ease-in-out select-none"
                  style={{ objectPosition: 'center' }}
                draggable={false}
                />
                
              {/* Image Dots Indicator */}
                {getTotalImages() > 1 && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  {Array.from({ length: getTotalImages() }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`rounded-full transition-all duration-200 ${index === currentImageIndex
                          ? 'w-3 h-3 bg-white'
                          : 'w-2 h-2 bg-white bg-opacity-50 hover:bg-opacity-75'
                        }`}
                    />
                  ))}
                  </div>
                )}
              </div>
            ) : (
              // Video Mode
              <video
                ref={videoRef}
                className="w-full h-full object-cover transition-all duration-300 ease-in-out"
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => console.log('🎥 Video metadata loaded')}
                onCanPlay={() => console.log('🎥 Video can play')}
                controls
                preload="metadata"
                style={{ objectPosition: 'center' }}
                playsInline
              >
                <source src={exercise.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
            
            {/* Mode Toggle - Top Right Corner */}
            <div className="absolute top-6 right-2">
              <button
                onClick={() => setCurrentMode(currentMode === 'image' ? 'video' : 'image')}
                className="w-10 h-10 bg-gray-500 bg-opacity-90 rounded-full shadow-sm flex items-center justify-center transition-all duration-200 hover:scale-105"
              >
                {currentMode === 'image' ? (
                  <img src="https://xpclass.vn/momtek/svg%20icon/video.svg" alt="Video" className="w-6 h-6" />
                ) : (
                  <img src="https://xpclass.vn/momtek/svg%20icon/image.svg" alt="Image" className="w-6 h-6" />
                )}
              </button>
            </div>
            
            {/* Loading State - Only show when video is not loaded */}
            {currentMode === 'video' && !videoRef.current?.readyState && (
              <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center pointer-events-none">
                <div className="text-white text-sm font-medium">
                  Loading video...
                </div>
              </div>
            )}
          </div>

          {/* Word + Audio Controls on the same row */}
          <div className="flex items-center px-4 py-3 gap-3">
            {currentMode === 'image' && (
              <button
                onClick={() => playAudio(1.0)}
                className="p-0 transition-transform hover:scale-105"
                aria-label="Play normal speed"
              >
                <img src="https://xpclass.vn/momtek/svg%20icon/Normal%20audio.svg" alt="" width={20} height={20} />
              </button>
            )}
            <h3 className="flex-1 text-center text-2xl font-bold text-gray-800">{renderStyledText(exercise.word)}</h3>
            {currentMode === 'image' && (
              <button
                onClick={() => playAudio(0.5)}
                className="p-0 transition-transform hover:scale-105"
                aria-label="Play slow speed"
              >
                <img src="https://xpclass.vn/momtek/svg%20icon/Slow%20audio.svg" alt="" width={20} height={20} />
              </button>
            )}
        </div>
      </div>

      {/* Pronunciation Practice - Moved above progress indicators */}
        {isCompetitiveMode && (
          <div className="text-center mb-3">
          <div className={`inline-block px-4 py-2 rounded-lg font-medium ${currentPlayer === 'mom'
                ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                : 'bg-pink-100 text-pink-800 border border-pink-200'
            }`}>
            🎤 {currentPlayer === 'mom' ? 'Mom' : 'Kid'}'s turn!
          </div>
        </div>
      )}
      <div className="flex items-center gap-4">
        {/* Mom's Audio - Left */}
        {isCompetitiveMode && momAccuracy !== null && (
          <div className="flex flex-col items-center gap-2">
            {momAudioUrl && (
              <button
                onClick={() => playPlayerAudio(momAudioUrl, 'Mom')}
                className="flex items-center gap-2 px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>👩‍💼</span>
              </button>
            )}
            <div className="text-sm font-medium text-pink-600">
              {Math.round(momAccuracy)}%
            </div>
          </div>
        )}

        {/* Recording Interface - Center */}
        <div className="flex-1">
          {isCompetitiveMode && roundComplete ? (
            // Show reset button when round is complete
            <div className="flex flex-col items-center gap-4">
              
                <button
                  onClick={startNewRound}
                  className="flex items-center justify-center w-20 h-20 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all transform hover:scale-105 shadow-md"
                >
                  <RotateCcw className="w-8 h-8" />
                </button>
            </div>
          ) : showRecordingInterface ? (
            // Show normal recording interface
        <RecordingInterface
          sentence={exercise.word}
              onNext={() => { }} // We'll handle completion separately
          onScoreUpdate={handleScoreUpdate}
              onAudioRecorded={handleAudioRecorded}
              hideAccuracy={isCompetitiveMode} // Hide accuracy display in competitive mode
            />
          ) : (
            // Show loading state for iOS
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                <Mic className="w-8 h-8 text-gray-400" />
              </div>
              <div className="text-sm text-gray-500 text-center">
                {isIOS ? 'Đang chuẩn bị microphone...' : 'Đang tải...'}
              </div>
            </div>
          )}
        </div>

        {/* Kid's Audio - Right */}
        {isCompetitiveMode && kidAccuracy !== null && (
          <div className="flex flex-col items-center gap-2">
            {kidAudioUrl && (
              <button
                onClick={() => playPlayerAudio(kidAudioUrl, 'Kid')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>👶</span>
              </button>
            )}
            <div className="text-sm font-medium text-blue-600">
              {Math.round(kidAccuracy)}%
            </div>
          </div>
        )}
      </div>

      {/* Continue Button - Redesigned */}
      <div className="text-center mt-8">
        <button
          onClick={handleComplete}
          disabled={!canContinue}
          className={`w-full max-w-sm mx-auto px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform ${canContinue
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {canContinue ? (
            <div className="flex items-center justify-center gap-3">
              <span>🎉</span>
              <span>Hoàn thành bài học</span>
              <span>🎉</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span>⏳</span>
              <span>Hoàn thành tất cả các bước để tiếp tục</span>
            </div>
          )}
        </button>
        
        {/* Progress Status */}
        {!canContinue && (
          <div className="mt-4 text-sm text-gray-500">
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${hasListened ? 'text-green-600' : 'text-gray-400'}`}>
                <span>{hasListened ? '✅' : '⭕'}</span>
                <span>Đã nghe</span>
              </div>
              <div className={`flex items-center gap-2 ${hasWatched ? 'text-green-600' : 'text-gray-400'}`}>
                <span>{hasWatched ? '✅' : '⭕'}</span>
                <span>Đã xem</span>
              </div>
              <div className={`flex items-center gap-2 ${hasPracticed ? 'text-green-600' : 'text-gray-400'}`}>
                <span>{hasPracticed ? '✅' : '⭕'}</span>
                <span>Đã luyện</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CombinedLearningExercise;