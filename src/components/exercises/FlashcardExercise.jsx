import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { saveRecentExercise } from "../../utils/recentExercise";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabase/client";
import Button from "../ui/Button";
import LoadingSpinner from "../ui/LoadingSpinner";
import { Volume2, ChevronLeft, ChevronRight, Mic } from "lucide-react";

const FlashcardExercise = () => {
  const location = useLocation();
  const [currentCard, setCurrentCard] = useState(0);
  const [flashcards, setFlashcards] = useState([]);
  const [displayedCards, setDisplayedCards] = useState([]);
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [session, setSession] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [speechSynth] = useState(window.speechSynthesis);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [pronunciationResult, setPronunciationResult] = useState(null);

  // Get exerciseId and sessionId from URL search params
  const searchParams = new URLSearchParams(location.search);
  const exerciseId = searchParams.get("exerciseId");
  const sessionId = searchParams.get("sessionId");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (exerciseId) {
      fetchFlashcards();
    } else {
      setLoading(false);
      setError("Không tìm thấy ID bài tập");
    }
  }, [exerciseId]);

  // Fetch session info for navigation
  useEffect(() => {
    if (sessionId) {
      fetchSessionInfo();
    }
  }, [sessionId]);

  const fetchSessionInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select(
          `
          *,
          units:unit_id (
            *,
            courses:course_id (*)
          )
        `
        )
        .eq("id", sessionId)
        .maybeSingle();

      if (error) throw error;
      setSession(data);
    } catch (err) {
      console.error("Error fetching session info:", err);
    }
  };

  const fetchFlashcards = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("id", exerciseId)
        .eq("exercise_type", "flashcard")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExercise(data);
      }

      if (data && data.content && data.content.cards) {
        setFlashcards(data.content.cards);
        // Show all cards
        setDisplayedCards(data.content.cards);

        // Save recent exercise for Home page card
        try {
          const continuePath = `/study/flashcard?exerciseId=${data.id}&sessionId=${sessionId}`;
          saveRecentExercise({
            ...data,
            continuePath,
          });
        } catch {}
      } else {
        setFlashcards([]);
        setDisplayedCards([]);
      }
    } catch (err) {
      console.error("Error fetching flashcards:", err);
      setError("Không thể tải dữ liệu flashcard");
    } finally {
      setLoading(false);
    }
  };

  const currentFlashcard = displayedCards[currentCard];

  // Function to get next exercise in session
  const getNextExercise = async () => {
    if (!sessionId) return null;

    try {
      const { data: exercises, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("session_id", sessionId)
        .eq("is_active", true)
        .order("order_index");

      if (error) throw error;

      const currentIndex = exercises.findIndex((ex) => ex.id === exerciseId);
      if (currentIndex !== -1 && currentIndex < exercises.length - 1) {
        return exercises[currentIndex + 1];
      }
      return null;
    } catch (err) {
      console.error("Error fetching next exercise:", err);
      return null;
    }
  };

  // Function to navigate to next exercise
  const goToNextExercise = async () => {
    // Mark current exercise as completed for progress tracking
    try {
      if (user && exerciseId) {
        const xpReward = exercise?.xp_reward || 10;
        await supabase.from("user_progress").upsert({
          user_id: user.id,
          exercise_id: exerciseId,
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          xp_earned: xpReward,
        });
      }
    } catch (e) {
      console.error("Failed to mark exercise completed:", e);
    }

    const nextExercise = await getNextExercise();

    if (nextExercise) {
      const paths = {
        flashcard: "/study/flashcard",
        fill_blank: "/study/fill-blank",
        multiple_choice: "/study/multiple-choice",
      };
      const exercisePath =
        paths[nextExercise.exercise_type] || "/study/flashcard";
      navigate(
        `${exercisePath}?exerciseId=${nextExercise.id}&sessionId=${sessionId}`
      );
    } else {
      // No more exercises, mark session as completed then go back to session
      try {
        if (user && sessionId) {
          await supabase.from("session_progress").upsert({
            user_id: user.id,
            session_id: sessionId,
            status: "completed",
            progress_percentage: 100,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error("Failed to mark session completed:", e);
      } finally {
        navigate(
          `/study/course/${session?.units?.course_id}/unit/${session?.unit_id}/session/${sessionId}`
        );
      }
    }
  };

  const handleCardSelect = (index) => {
    // Stop current audio when switching cards
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    // Stop any speech synthesis
    speechSynth.cancel();
    // Reset flip state and video index
    setIsFlipped(false);
    setCurrentCard(index);
  };

  const speakText = (text, lang = "en-US") => {
    // Stop any current speech
    speechSynth.cancel();

    if (text) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 0.8;

      // Try to find a native voice for the language
      const voices = speechSynth.getVoices();
      const voice =
        voices.find((v) => v.lang.startsWith(lang.split("-")[0])) || voices[0];
      if (voice) {
        utterance.voice = voice;
      }

      speechSynth.speak(utterance);
    }
  };

  const playAudio = () => {
    // Stop current speech if speaking
    if (speechSynth.speaking) {
      speechSynth.cancel();
      return;
    }

    if (currentFlashcard) {
      // Always speak the front text (English) regardless of flip state
      const textToSpeak = currentFlashcard.front;
      const language = "en-US";

      speakText(textToSpeak, language);
    }
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const goToNextCard = () => {
    const nextIndex = (currentCard + 1) % displayedCards.length;
    handleCardSelect(nextIndex);
  };

  const goToPreviousCard = () => {
    const prevIndex =
      (currentCard - 1 + displayedCards.length) % displayedCards.length;
    handleCardSelect(prevIndex);
  };

  // Initialize speech recognition
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = "en-US";

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        const targetWord = currentFlashcard?.front?.toLowerCase();
        const confidence = event.results[0][0].confidence;

        // Calculate simple accuracy based on word matching
        const isCorrect = transcript.includes(targetWord);
        const accuracy = isCorrect ? Math.round(confidence * 100) : 0;

        setPronunciationResult({
          transcript,
          targetWord: currentFlashcard?.front,
          accuracy,
          isCorrect
        });

        // Auto-hide result after 5 seconds
        setTimeout(() => {
          setPronunciationResult(null);
        }, 5000);

        setIsRecording(false);
      };

      recognitionInstance.onerror = () => {
        setIsRecording(false);
        setPronunciationResult({
          transcript: "Error",
          targetWord: currentFlashcard?.front,
          accuracy: 0,
          isCorrect: false,
          error: true
        });
        setTimeout(() => {
          setPronunciationResult(null);
        }, 3000);
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
      };

      setRecognition(recognitionInstance);
    }
  }, [currentFlashcard]);

  const toggleRecording = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      recognition.start();
      setIsRecording(true);
    }
  };

  // When user navigates away (next exercise or finish), also mark current exercise completed if there are cards
  useEffect(() => {
    if (!exerciseId) return;
    // No-op here; marking is handled on user action
  }, [exerciseId]);

  // Bottom nav Back: go back to session view
  useEffect(() => {
    const handleBottomNavBack = () => {
      console.log('🎯 Bottom nav "Back" clicked in FlashcardExercise');
      // Stop any playing audio and speech when going back
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
      speechSynth.cancel();
      // Navigate back to session view
      if (session && session.units && session.units.levels) {
        const unitId = session.units.id;
        navigate(
          `/study/course/${courseId}/unit/${unitId}/session/${sessionId}`
        );
      } else if (sessionId) {
        // Fallback: try to navigate to session without full path
        navigate(`/study/course/1/unit/1/session/${sessionId}`);
      } else {
        // Final fallback to study page
        navigate("/study");
      }
    };

    window.addEventListener("bottomNavBack", handleBottomNavBack);
    return () =>
      window.removeEventListener("bottomNavBack", handleBottomNavBack);
  }, [session, sessionId, navigate, currentAudio]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={fetchFlashcards} variant="outline">
          Thử lại
        </Button>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không có flashcard nào</div>
        <Link to="/study">
          <Button variant="outline">Quay lại</Button>
        </Link>
      </div>
    );
  }

  if (displayedCards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không có card nào để hiển thị</div>
        <Link to="/study">
          <Button variant="outline">Quay lại</Button>
        </Link>
      </div>
    );
  }

  return (
    
      <div className="max-w-6xl mx-auto space-y-6 px-4 py-6">
        {/* Main Card Display with Right Side Thumbnails */}
        <div className="flex gap-4 max-w-full mx-auto px-4">
          {/* Main Card */}
          <div className="flex-1 max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="relative">
                {/* Card Content - Front or Back */}
                <div className="aspect-square relative">
                  {!isFlipped ? (
                    // Front side - Image with front text
                    <>
                      <img
                        src={currentFlashcard?.image}
                        alt={currentFlashcard?.front}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay with front text */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="text-center text-white">
                          <h2 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">
                            {currentFlashcard?.front}
                          </h2>
                        </div>
                      </div>

                      {/* Pronunciation Result Overlay */}
                      {pronunciationResult && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                          <div className="text-center text-white p-8">
                            {pronunciationResult.error ? (
                              <>
                                <div className="text-6xl mb-4">❌</div>
                                <h3 className="text-2xl font-bold">Error</h3>
                                <p className="text-lg mt-2">Please try again</p>
                              </>
                            ) : (
                              <>
                                <div className="text-8xl font-bold mb-4">
                                  {pronunciationResult.accuracy}%
                                </div>
                                <div className="text-4xl mb-4">
                                  {pronunciationResult.isCorrect ? "✅" : "❌"}
                                </div>
                                <h3 className="text-2xl font-bold mb-2">
                                  {pronunciationResult.isCorrect ? "Great!" : "Try Again"}
                                </h3>
                                <p className="text-lg">
                                  You said: "{pronunciationResult.transcript}"
                                </p>
                                <p className="text-sm mt-2 text-gray-300">
                                  Target: "{pronunciationResult.targetWord}"
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    // Back side - Image with back text
                    <>
                      <img
                        src={currentFlashcard?.image}
                        alt={currentFlashcard?.back}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay with back text */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="text-center text-white">
                          <h2 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">
                            {currentFlashcard?.back}
                          </h2>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Controls */}
                <div className="p-6 bg-white flex justify-center items-center space-x-4">
                  <button
                    onClick={goToPreviousCard}
                    className="w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl"
                    title="Previous Card"
                    disabled={displayedCards.length <= 1}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  <button
                    onClick={playAudio}
                    className={`w-16 h-16 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl ${
                      speechSynth.speaking
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-700 hover:bg-blue-800"
                    }`}
                    title={speechSynth.speaking ? "Stop Speech" : "Speak Text"}
                  >
                    <Volume2 className="w-6 h-6" />
                  </button>

                  <button
                    onClick={toggleRecording}
                    className={`w-16 h-16 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl ${
                      isRecording
                        ? "bg-red-600 hover:bg-red-700 animate-pulse"
                        : "bg-purple-600 hover:bg-purple-700"
                    }`}
                    title={isRecording ? "Recording..." : "Practice Pronunciation"}
                  >
                    <Mic className="w-6 h-6" />
                  </button>

                  <button
                    onClick={flipCard}
                    className="w-16 h-16 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl"
                    title="Flip Card"
                  >
                    <div className="text-xs font-bold">FLIP</div>
                  </button>

                  <button
                    onClick={goToNextCard}
                    className="w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl"
                    title="Next Card"
                    disabled={displayedCards.length <= 1}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side Thumbnails - 3-4 Columns Grid */}
            <div className="hidden lg:block w-80 flex-shrink-0 overflow-hidden">
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-2 max-h-screen overflow-y-auto p-2">
                {displayedCards.map((card, index) => (
                  <button
                    key={card.id}
                    onClick={() => handleCardSelect(index)}
                    className={`relative aspect-square rounded-lg overflow-hidden transition-all duration-200 ${
                      currentCard === index
                        ? "ring-4 ring-blue-500 scale-100 z-10"
                        : "hover:scale-102 hover:shadow-lg"
                    }`}
                  >
                    <img
                      src={card.image}
                      alt={card.front}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-center text-white">
                        <p className="text-xs font-bold">{card.front}</p>
                      </div>
                    </div>
                    {currentCard === index && (
                      <div className="absolute top-1 right-1">
                        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Thumbnail Navigation - Mobile/Tablet fallback */}
          <div className="lg:hidden">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {displayedCards.map((card, index) => (
                <button
                  key={card.id}
                  onClick={() => handleCardSelect(index)}
                  className={`relative aspect-square rounded-lg overflow-hidden transition-all duration-200 ${
                    currentCard === index
                      ? "ring-4 ring-blue-500 scale-105"
                      : "hover:scale-105 hover:shadow-lg"
                  }`}
                >
                  <img
                    src={card.image}
                    alt={card.front}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <p className="text-sm font-bold">{card.front}</p>
                    </div>
                  </div>
                  {currentCard === index && (
                    <div className="absolute top-2 right-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Next Exercise Button */}
        {sessionId && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={goToNextExercise}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              Bài tiếp theo
            </Button>
          </div>
        )}
      </div>
  );
};

export default FlashcardExercise;
