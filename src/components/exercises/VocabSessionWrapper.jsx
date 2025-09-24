import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../ui/LoadingSpinner';
import { saveRecentExercise } from '../../utils/recentExercise';
import { ArrowLeft, Star } from 'lucide-react';

// Styled text rendering function
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
  return parts.map((part, idx) => part.color ? (
    <span key={idx} className={colorClasses[part.color] || 'text-red-600 font-bold'}>{part.text}</span>
  ) : (
    <span key={idx}>{part.text}</span>
  ));
};

const VocabSessionWrapper = () => {
  const { levelId, unitId, sessionId: paramSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const pairIndex = searchParams.get('pairIndex');
  const urlSessionId = searchParams.get('sessionId');
  const sessionId = urlSessionId || paramSessionId;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentView, setCurrentView] = useState('grid'); // 'grid' or 'word-pronunciation'
  const [exercisePairs, setExercisePairs] = useState([]);
  const [currentPair, setCurrentPair] = useState(null);
  const [currentPairIndex, setCurrentPairIndex] = useState(null);
  const [sessionExercises, setSessionExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wordPronunciationResult, setWordPronunciationResult] = useState(null);
  const [completedPairs, setCompletedPairs] = useState(new Set());
  const [showWordExercise, setShowWordExercise] = useState(false);

  // iOS detection
  const isIOS = typeof navigator !== 'undefined' && (
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
     /CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent))
  );

  // Bottom nav Back: if inside an exercise view under same URL, return to grid; else normal back
  useEffect(() => {
    const handleBottomNavBack = () => {
      if (currentView !== 'grid') {
        setCurrentView('grid');
        setCurrentPair(null);
        setCurrentPairIndex(null);
        setWordPronunciationResult(null);
        setShowWordExercise(false);
      } else {
        navigate(-1);
      }
    };

    window.addEventListener('bottomNavBack', handleBottomNavBack);
    return () => window.removeEventListener('bottomNavBack', handleBottomNavBack);
  }, [currentView, navigate]);

  useEffect(() => {
    const fetchExercises = async () => {
      setLoading(true);
      setError(null);
      try {
        if (sessionId) {
          // Fetch all exercises in this session
          const { data: allExercises, error: sessionError } = await supabase
            .from('exercises')
            .select('*')
            .eq('session_id', sessionId)
            .eq('is_active', true)
            .order('order_index');

          if (sessionError) throw sessionError;
          setSessionExercises(allExercises || []);

          // Since combined_learning is removed, just use all remaining exercises
          const wordExercises = allExercises || [];

          // Create exercise list from combined_learning exercises only
          const pairs = [];

          for (let i = 0; i < wordExercises.length; i++) {
            const wordEx = wordExercises[i];
            
            if (wordEx) {
              // Map word exercise data
              const mappedWordExercise = {
                ...wordEx,
                word: wordEx.word || wordEx.content?.word || wordEx.title,
                audioUrl: wordEx.audio_url || wordEx.content?.audioUrl || wordEx.content?.audio_url,
                videoUrl: wordEx.video_url || wordEx.content?.videoUrl || wordEx.content?.video_url,
                imageUrl: wordEx.image_url || wordEx.content?.imageUrl || wordEx.content?.image_url,
                imageUrls: wordEx.image_urls || wordEx.content?.imageUrls || wordEx.content?.image_urls ||
                          (wordEx.image_url || wordEx.content?.imageUrl ? [wordEx.image_url || wordEx.content?.imageUrl] : [])
              };

              pairs.push({
                index: i,
                wordExercise: mappedWordExercise,
                sentenceExercise: null, // No more sentence exercises
                // Use the word exercise image
                imageUrl: mappedWordExercise?.imageUrl || mappedWordExercise?.imageUrls?.[0],
                title: mappedWordExercise?.word || `Exercise ${i + 1}`
              });
            }
          }

          setExercisePairs(pairs);

          // Check if we should start with a specific pair
          if (pairIndex !== null) {
            const pairIdx = parseInt(pairIndex);
            if (pairs[pairIdx]) {
              setCurrentPair(pairs[pairIdx]);
              setCurrentPairIndex(pairIdx);
              setCurrentView('word-pronunciation');
            }
          }

          // Fetch user progress to mark completed pairs
          if (user && allExercises?.length > 0) {
            const exerciseIds = allExercises.map(ex => ex.id);
            const { data: userProgress, error: progressError } = await supabase
              .from('user_progress')
              .select('exercise_id, status')
              .eq('user_id', user.id)
              .in('exercise_id', exerciseIds);

            if (!progressError && userProgress) {
              const completedExerciseIds = new Set(
                userProgress.filter(p => p.status === 'completed').map(p => p.exercise_id)
              );
              
              const completedPairIndices = new Set();
              pairs.forEach((pair, index) => {
                const wordCompleted = !pair.wordExercise || completedExerciseIds.has(pair.wordExercise.id);
                if (wordCompleted) {
                  completedPairIndices.add(index);
                }
              });
              
              setCompletedPairs(completedPairIndices);
            }
          }

          // Save recent exercise for Home page card
          try {
            const continuePath = `/study/vocab-session?sessionId=${sessionId}`;
            saveRecentExercise({
              id: `vocab-session-${sessionId}`,
              title: 'Vocab Session',
              session_id: sessionId,
              continuePath
            });
          } catch (e) {}
        }
      } catch (err) {
        console.error('Error fetching exercises:', err);
        setError('Không thể tải bài tập. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    fetchExercises();
  }, [sessionId, urlSessionId, pairIndex, user]);

  const handlePairClick = (pair) => {
    setCurrentPair(pair);
    setCurrentPairIndex(pair.index);
    setCurrentView('word-pronunciation');
    setWordPronunciationResult(null);
    
    // iOS-specific: Delay showing CombinedLearningExercise to avoid premature microphone permission
    if (isIOS) {
      setShowWordExercise(false);
      // Show exercise after a short delay to ensure proper user interaction
      setTimeout(() => {
        setShowWordExercise(true);
      }, 500);
    } else {
      setShowWordExercise(true);
    }
  };

  const handleWordPronunciationComplete = (result) => {
    console.log('Word pronunciation completed:', result);
    setWordPronunciationResult(result);
    
    // Mark word pronunciation exercise as completed in user_progress
    const updateProgress = async () => {
      try {
        if (user && currentPair?.wordExercise?.id) {
          const xpReward = currentPair.wordExercise.xp_reward || 10
          await supabase.from('user_progress').upsert({
            user_id: user.id,
            exercise_id: currentPair.wordExercise.id,
            status: 'completed',
            score: result?.accuracy,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            xp_earned: xpReward
          });
        }
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    };
    updateProgress();

    // Complete the pair since there are no sentence exercises anymore
    handlePairComplete();
  };


  const handlePairComplete = () => {
    // Mark this pair as completed
    setCompletedPairs(prev => new Set([...prev, currentPairIndex]));
    
    // Check if all pairs are completed
    const totalPairs = exercisePairs.length;
    const completedCount = completedPairs.size + 1; // +1 for the current pair
    
    if (completedCount >= totalPairs) {
      // All pairs completed, handle session completion
      handleSessionComplete();
    } else {
      // Return to grid view
      setCurrentView('grid');
      setCurrentPair(null);
      setCurrentPairIndex(null);
    }
  };

  const handleSessionComplete = () => {
    // Check if there are other exercises in the session to continue with
    const remainingExercises = sessionExercises.filter(ex =>
      ex.exercise_type !== 'vocab_removed' // No need to filter anything specific now
    );

    if (remainingExercises.length > 0) {
      // Navigate to next non-vocab exercise
      const nextExercise = remainingExercises[0];
      console.log('🎯 Moving to next non-vocab exercise:', nextExercise.title, 'Type:', nextExercise.exercise_type);
      
      const paths = {
        flashcard: '/study/flashcard',
        fill_blank: '/study/fill-blank',
      };
      
      const exercisePath = paths[nextExercise.exercise_type] || '/study/flashcard';
      navigate(`${exercisePath}?exerciseId=${nextExercise.id}&sessionId=${sessionId}`);
    } else {
      // No more exercises, mark session as completed then go back
      console.log('🎉 Vocab session completed! Marking session_progress and going back');
      const markSessionCompleted = async () => {
        try {
          if (user && sessionId) {
            await supabase.from('session_progress').upsert({
              user_id: user.id,
              session_id: sessionId,
              status: 'completed',
              progress_percentage: 100,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error('Failed to mark session completed:', e);
        } finally {
          if (levelId && unitId && sessionId) {
            navigate(`/study/course/${courseId}/unit/${unitId}/session/${sessionId}`);
          } else {
            navigate('/study');
          }
        }
      };
      markSessionCompleted();
    }
  };

  const handleBackToGrid = () => {
    setCurrentView('grid');
    setCurrentPair(null);
    setCurrentPairIndex(null);
    setWordPronunciationResult(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <div className="ml-4 text-lg text-gray-600">Đang tải bài tập từ vựng...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          <button 
            onClick={() => navigate('/study')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Quay lại Study
          </button>
        </div>
      </div>
    );
  }

  if (exercisePairs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-lg mb-4">Không tìm thấy bài tập từ vựng.</div>
          <button 
            onClick={() => navigate('/study')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Quay lại Study
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Grid View */}
      {currentView === 'grid' && (
        <div>
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="bg-orange-500 text-white px-6 py-3 rounded-lg inline-block w-full text-left border-2 border-gray-600 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Sesson 1</p>
                <h1 className="text-2xl font-bold">Vocab</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-0.5 h-16 bg-gray-600"></div>
                <Star className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {exercisePairs.map((pair) => (
              <div key={pair.index} className="space-y-3">
                {/* Image */}
              <div
                onClick={() => handlePairClick(pair)}
                className={`relative cursor-pointer rounded-xl border-2 transition-all duration-300 overflow-hidden ${
                  completedPairs.has(pair.index)
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-blue-400 hover:shadow-lg hover:scale-105'
                }`}
                  style={{ aspectRatio: '1.4' }}
              >
                {pair.imageUrl ? (
                  <img 
                    src={pair.imageUrl} 
                    alt={pair.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <div className="text-4xl">📚</div>
                  </div>
                )}

                {/* Completion Badge */}
                {completedPairs.has(pair.index) && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
                </div>

                {/* Title under image */}
                  <div className="text-center">
                  <div className="font-medium text-sm truncate">{renderStyledText(pair.title)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Views */}
      {currentView !== 'grid' && currentPair && (
        <div>
          {/* Back Button and Progress */}
          <div className="mb-6">
            

            {/* Progress indicator for current pair */}
            <div className="bg-gray-100 border-2 border-gray-600 rounded-xl shadow-sm p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {currentView === 'word-pronunciation' ? 'Step 1: ' : 'Step 2: '}
                    <span className="text-lg font-bold">{currentView === 'word-pronunciation' ? 'Word' : 'Sentence'}</span>
                  </span>
                </div>
                
                {/* Progress bar with circles */}
                <div className="relative">
                  <div className="w-full bg-gray-300 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: currentView === 'word-pronunciation' ? '50%' : '100%' }}
                    ></div>
                  </div>
                  
                  {/* Circle at 50% (middle) */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      wordPronunciationResult 
                        ? 'bg-blue-600' 
                        : 'bg-gray-200'
                    }`}>
                      <span className="text-gray-400 text-xs font-bold">✓</span>
                    </div>
                  </div>
                  
                  {/* Circle at 100% (end) */}
                  <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-bold">✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Exercise Content */}
          {currentView === 'word-pronunciation' && currentPair.wordExercise && showWordExercise && (
            <div className="text-center p-8">
              <h2 className="text-xl font-bold mb-4">Exercise Type No Longer Supported</h2>
              <p className="text-gray-600 mb-4">The combined learning exercise type has been removed.</p>
              <button
                onClick={() => handleWordPronunciationComplete({ completed: true })}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg"
              >
                Skip This Exercise
              </button>
            </div>
          )}
          
          {/* Loading state for iOS */}
          {currentView === 'word-pronunciation' && currentPair.wordExercise && !showWordExercise && isIOS && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-sm text-gray-500 text-center">
                Đang chuẩn bị bài học...
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default VocabSessionWrapper;