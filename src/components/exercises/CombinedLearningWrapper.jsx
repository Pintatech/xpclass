import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../ui/LoadingSpinner';
import CombinedLearningExercise from './CombinedLearningExercise';
import { saveRecentExercise } from '../../utils/recentExercise';

const CombinedLearningWrapper = () => {
  const { levelId, unitId, sessionId: paramSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const exerciseId = searchParams.get('exerciseId');
  const urlSessionId = searchParams.get('sessionId');
  // Use sessionId from URL params first, then from path params
  const sessionId = urlSessionId || paramSessionId;
  const navigate = useNavigate();
  const { user } = useAuth();

  console.log('🔍 CombinedLearningWrapper params:', { 
    levelId, 
    unitId, 
    paramSessionId, 
    exerciseId, 
    urlSessionId, 
    finalSessionId: sessionId 
  });
  const [exercise, setExercise] = useState(null);
  const [sessionExercises, setSessionExercises] = useState([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchExercise = async () => {
      setLoading(true);
      setError(null);
      try {
        // First, fetch all exercises in this session
        if (sessionId) {
          const { data: allExercises, error: sessionError } = await supabase
            .from('exercises')
            .select('*')
            .eq('session_id', sessionId)
            .eq('is_active', true)
            .order('order_index');

          if (sessionError) throw sessionError;
          setSessionExercises(allExercises || []);

          // Find current exercise by ID
          let currentExercise = null;
          if (exerciseId && allExercises) {
            currentExercise = allExercises.find(ex => ex.id === exerciseId);
          }
          
          // If not found by ID, get the first combined_learning exercise
          if (!currentExercise) {
            currentExercise = allExercises?.find(ex => ex.exercise_type === 'combined_learning');
          }
          
          // Set current exercise index for navigation
          if (currentExercise && allExercises) {
            const currentIndex = allExercises.findIndex(ex => ex.id === currentExercise.id);
            setCurrentExerciseIndex(currentIndex);
          }
          if (currentExercise) {
            console.log('🔍 Exercise data from database:', currentExercise);
            console.log('🔍 Exercise content:', currentExercise.content);
          
            // Map database data to component expected format
            const mappedExercise = {
              ...currentExercise,
              // Use direct fields first, then fallback to content
              word: currentExercise.word || currentExercise.content?.word || currentExercise.title,
              audioUrl: currentExercise.audio_url || currentExercise.content?.audioUrl || currentExercise.content?.audio_url,
              videoUrl: currentExercise.video_url || currentExercise.content?.videoUrl || currentExercise.content?.video_url,
              imageUrl: currentExercise.image_url || currentExercise.content?.imageUrl || currentExercise.content?.image_url,
              imageUrls: currentExercise.image_urls || currentExercise.content?.imageUrls || currentExercise.content?.image_urls || 
                        (currentExercise.image_url || currentExercise.content?.imageUrl ? [currentExercise.image_url || currentExercise.content?.imageUrl] : [])
            };
            
            console.log('🔍 Mapped exercise data:', mappedExercise);
            setExercise(mappedExercise);

            // Save recent exercise for Home page card
            try {
              const continuePath = `/study/combined-learning?exerciseId=${currentExercise.id}&sessionId=${sessionId}`;
              saveRecentExercise({
                ...currentExercise,
                continuePath
              });
            } catch (e) {}
          }
        } else {
          // Fallback: create a sample exercise for testing
          setExercise({
            id: 'sample-combined-exercise',
            title: 'Sample Combined Learning Exercise',
            exercise_type: 'combined_learning',
            word: 'Hello',
            audioUrl: '/audio/hello.mp3',
            videoUrl: '/video/hello.mp4',
            imageUrl: '/images/hello.jpg',
            imageUrls: ['/images/hello1.jpg', '/images/hello2.jpg'],
            content: {
              word: 'Hello',
              audioUrl: '/audio/hello.mp3',
              videoUrl: '/video/hello.mp4',
              imageUrl: '/images/hello.jpg',
              imageUrls: ['/images/hello1.jpg', '/images/hello2.jpg']
            }
          });
        }
      } catch (err) {
        console.error('Error fetching exercise:', err);
        setError('Không thể tải bài tập. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    fetchExercise();
  }, [exerciseId, sessionId, urlSessionId]);

  const handleComplete = (result) => {
    console.log('Exercise completed:', result);
    
    // Mark current exercise as completed in user_progress
    const updateProgress = async () => {
      try {
        if (user && exercise?.id) {
          await supabase.from('user_progress').upsert({
            user_id: user.id,
            exercise_id: exercise.id,
            status: 'completed',
            score: result?.accuracy,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error('Error updating progress:', error)
      }
    }
    updateProgress()
    
    // Check if there's a next exercise in the session
    const nextExerciseIndex = currentExerciseIndex + 1;
    const hasNextExercise = nextExerciseIndex < sessionExercises.length;
    
    if (hasNextExercise) {
      // Navigate to next exercise in the session
      const nextExercise = sessionExercises[nextExerciseIndex];
      console.log('🎯 Moving to next exercise:', nextExercise.title, 'Type:', nextExercise.exercise_type);
      
      // Navigate based on exercise type
      const paths = {
        combined_learning: '/study/combined-learning',
        flashcard: '/study/flashcard',
        audio_flashcard: '/study/audio-flashcard',
        sentence_pronunciation: '/study/sentence-pronunciation',
        multiple_choice: '/study/multiple-choice',
      };
      
      const exercisePath = paths[nextExercise.exercise_type] || '/study/flashcard';
      navigate(`${exercisePath}?exerciseId=${nextExercise.id}&sessionId=${sessionId}`);
    } else {
      // No more exercises, mark session as completed then go back
      console.log('🎉 Session completed! Marking session_progress and going back');
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
            navigate(`/study/level/${levelId}/unit/${unitId}/session/${sessionId}`);
          } else {
            navigate('/study');
          }
        }
      };
      markSessionCompleted();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <div className="ml-4 text-lg text-gray-600">Đang tải bài tập...</div>
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

  if (!exercise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-lg mb-4">Không tìm thấy bài tập.</div>
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

  return <CombinedLearningExercise exercise={exercise} onComplete={handleComplete} />;
};

export default CombinedLearningWrapper;
