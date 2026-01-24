import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { saveRecentExercise } from "../../utils/recentExercise";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabase/client";
import Button from "../ui/Button";
import LoadingSpinner from "../ui/LoadingSpinner";
import {
  Volume2,
  ChevronLeft,
  ChevronRight,
  Mic,
  Video,
  Image,
} from "lucide-react";
import { assessPronunciation } from "../../utils/azurePronunciationService";

// Theme-based side decoration images for PC
const themeSideImages = {
  blue: {
    left: "https://xpclass.vn/xpclass/image/theme_question/ice_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/ice_right.png",
  },
  green: {
    left: "https://xpclass.vn/xpclass/image/theme_question/forest_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/forest_right.png"
  },
  purple: {
    left: "https://xpclass.vn/xpclass/image/theme_question/pirate.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/pirate.png"
  },
  orange: {
    left: "https://xpclass.vn/xpclass/image/theme_question/ninja_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/ninja_right.png"
  },
  red: {
    left: "https://xpclass.vn/xpclass/image/theme_question/candy_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/candy_right.png"
  },
  yellow: {
    left: "https://xpclass.vn/xpclass/image/theme_question/desert_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/desert_right.png"
  }
}

const getThemeSideImages = (theme) => {
  return themeSideImages[theme] || themeSideImages.blue
}

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
  const [pronunciationResult, setPronunciationResult] = useState(null);
  const [mediaMode, setMediaMode] = useState("image"); // 'image' or 'video'
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoRefs, setVideoRefs] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [cardScores, setCardScores] = useState({});
  const [colorTheme, setColorTheme] = useState('blue');

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

      // Set color theme from session or unit
      const theme = data?.color_theme || data?.units?.color_theme || 'blue'
      setColorTheme(theme)
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
    // Validate that ALL cards have been practiced
    const totalCards = displayedCards.length;
    const practicedCards = Object.keys(cardScores).length;

    if (totalCards > 0 && practicedCards < totalCards) {
      // Show alert - must practice all cards
      alert(
        `Please practice pronunciation for all ${totalCards} cards. You've practiced ${practicedCards} so far.`
      );
      return; // Block navigation
    }

    // Calculate average of best scores
    let finalScore = null;
    let status = "completed";

    if (practicedCards > 0) {
      const scores = Object.values(cardScores).map((card) => card.bestScore);
      const totalScore = scores.reduce((sum, score) => sum + score, 0);
      finalScore = Math.round(totalScore / scores.length);

      // Determine status based on score threshold (75% = passing)
      status = finalScore >= 75 ? "completed" : "attempted";
    }

    // Mark current exercise as completed for progress tracking
    try {
      if (user && exerciseId) {
        const xpReward = exercise?.xp_reward || 10;

        const progressData = {
          user_id: user.id,
          exercise_id: exerciseId,
          status: status,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          xp_earned: status === "completed" ? xpReward : 0,
        };

        // Add score if available
        if (finalScore !== null) {
          progressData.score = finalScore;
          progressData.max_score = 100;
        }

        await supabase.from("user_progress").upsert(progressData);
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
    // Pause all videos
    pauseAllVideos();
    // Reset flip state and video index
    setIsFlipped(false);
    setMediaMode("image");
    setCurrentVideoIndex(0);
    setCurrentCard(index);
  };

  const speakText = (text, lang = "en-US") => {
    // Stop any current speech
    speechSynth.cancel();

    if (!text) return;

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.75;
      utterance.pitch = 1;
      utterance.volume = 0.8;

      // Get available voices
      const voices = speechSynth.getVoices();

      // Debug: log available voices
      console.log("🔊 Available TTS voices:", voices.length, voices.map(v => `${v.name} (${v.lang})`));

      // Simple approach: just find any English voice, don't be picky
      let voice = null;

      if (lang.startsWith("en")) {
        // Try to find ANY English voice
        voice = voices.find((v) =>
          v.lang === "en-US" ||
          v.lang === "en-GB" ||
          v.lang.startsWith("en-") ||
          v.lang === "en"
        );

        // Still no voice? Try by name
        if (!voice) {
          voice = voices.find((v) =>
            v.name.toLowerCase().includes("english")
          );
        }
      }

      // Fallback to first available voice
      if (!voice && voices.length > 0) {
        voice = voices[0];
      }

      if (voice) {
        console.log("🔊 Using voice:", voice.name, voice.lang);
        utterance.voice = voice;
      } else {
        console.log("🔊 No voice found, using default");
      }

      speechSynth.speak(utterance);
    };

    // On Android, voices may not be loaded yet - wait for them
    const voices = speechSynth.getVoices();
    if (voices.length > 0) {
      speak();
    } else {
      // Wait for voices to load (Android needs this)
      speechSynth.onvoiceschanged = () => {
        speak();
      };
      // Fallback: try speaking anyway after a short delay
      setTimeout(() => {
        if (speechSynth.getVoices().length === 0) {
          // Still no voices, speak without voice selection
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang;
          utterance.rate = 0.75;
          speechSynth.speak(utterance);
        }
      }, 100);
    }
  };

  const playAudio = () => {
    if (currentFlashcard) {
      // If there's a custom audio URL, play that instead of TTS
      if (currentFlashcard.audioUrl && currentFlashcard.audioUrl.trim()) {
        // Stop current speech if speaking
        if (speechSynth.speaking) {
          speechSynth.cancel();
        }

        // Stop current audio if playing
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }

        // Play custom audio
        const audio = new Audio(currentFlashcard.audioUrl);
        audio.play().catch((err) => {
          console.error("Error playing audio:", err);
          // Fallback to TTS if audio fails
          const textToSpeak = currentFlashcard.front;
          const language = "en-US";
          speakText(textToSpeak, language);
        });
        setCurrentAudio(audio);
      } else {
        // Use text-to-speech as fallback
        // Stop current speech if speaking
        if (speechSynth.speaking) {
          speechSynth.cancel();
          return;
        }

        // Always speak the front text (English) regardless of flip state
        const textToSpeak = currentFlashcard.front;
        const language = "en-US";

        speakText(textToSpeak, language);
      }
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

  const toggleMediaMode = () => {
    const newMode = mediaMode === "image" ? "video" : "image";

    if (newMode === "image") {
      pauseAllVideos();
    }
    setMediaMode(newMode);
    setCurrentVideoIndex(0);
  };

  const pauseAllVideos = () => {
    videoRefs.forEach((videoRef) => {
      if (videoRef) {
        videoRef.pause();
        videoRef.currentTime = 0;
      }
    });
  };

  // Toggle recording with Azure pronunciation assessment
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          // Stop all tracks
          stream.getTracks().forEach((track) => track.stop());

          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          console.log("🎤 Recording stopped, blob size:", audioBlob.size);

          // Show loading state
          setPronunciationResult({
            loading: true,
          });

          // Assess pronunciation using Azure
          const referenceText = currentFlashcard?.front || "";
          const result = await assessPronunciation(
            referenceText,
            audioBlob,
            "en-US"
          );

          console.log("📊 Azure assessment result:", result);

          if (result.success) {
            // Use syllable score as the main score (first word's first syllable)
            const syllableScore =
              result.words?.[0]?.syllables?.[0]?.accuracyScore ||
              result.overallScore;

            // Update card scores - keep best score per card
            const cardId = currentFlashcard?.id;
            setCardScores((prev) => {
              const existing = prev[cardId];
              const newBestScore = existing
                ? Math.max(existing.bestScore, syllableScore)
                : syllableScore;
              const newAttempts = existing ? existing.attempts + 1 : 1;

              return {
                ...prev,
                [cardId]: {
                  word: currentFlashcard?.front,
                  bestScore: newBestScore,
                  attempts: newAttempts,
                  lastAttempt: new Date(),
                },
              };
            });

            setPronunciationResult({
              transcript: result.recognizedText,
              targetWord: currentFlashcard?.front,
              accuracy: syllableScore, // Show syllable score instead of overall
              accuracyScore: result.accuracyScore,
              fluencyScore: result.fluencyScore,
              completenessScore: result.completenessScore,
              prosodyScore: result.prosodyScore,
              feedback: result.feedback,
              words: result.words,
              isCorrect: syllableScore >= 70,
              error: false,
            });
          } else {
            setPronunciationResult({
              transcript: result.message || "Error",
              targetWord: currentFlashcard?.front,
              accuracy: 0,
              isCorrect: false,
              error: true,
            });
          }

          // Auto-hide result after 8 seconds
          setTimeout(() => {
            setPronunciationResult(null);
          }, 5000);
        };

        mediaRecorder.onerror = (error) => {
          console.error("MediaRecorder error:", error);
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
          setPronunciationResult({
            transcript: "Recording error",
            targetWord: currentFlashcard?.front,
            accuracy: 0,
            isCorrect: false,
            error: true,
          });
          setTimeout(() => {
            setPronunciationResult(null);
          }, 3000);
        };

        // Start recording with timeslice to capture data regularly (every 100ms)
        mediaRecorder.start(100);
        setIsRecording(true);

        // Auto-stop after 5 seconds
        setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            setIsRecording(false);
          }
        }, 5000);
      } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Failed to access microphone. Please check permissions.");
        setIsRecording(false);
      }
    }
  };

  // When user navigates away (next exercise or finish), also mark current exercise completed if there are cards
  useEffect(() => {
    if (!exerciseId) return;
    // No-op here; marking is handled on user action
  }, [exerciseId]);

  // Auto-play video when switching to video mode or changing video index
  useEffect(() => {
    if (mediaMode === "video" && videoRefs[currentVideoIndex]) {
      const videoElement = videoRefs[currentVideoIndex];
      const playPromise = videoElement.play();

      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("Auto-play prevented:", error);
        });
      }
    }
  }, [mediaMode, currentVideoIndex, videoRefs]);

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
      // Pause all videos
      pauseAllVideos();
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

  const sideImages = getThemeSideImages(colorTheme)

  return (
    <>
      <style>{`
        .flip-card-container {
          perspective: 1000px;
        }

        .flip-card-inner {
          position: relative;
          width: 100%;
          transition: transform 0.4s;
          transform-style: preserve-3d;
        }

        .flip-card-inner.flipped {
          transform: rotateY(180deg);
        }

        .flip-card-front,
        .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }

        .flip-card-back {
          transform: rotateY(180deg);
        }

        .button-3d {
          transform: translateY(0);
          transition: all 0.1s ease;
        }

        .button-3d:active:not(:disabled) {
          transform: translateY(4px);
        }

        /* Gray buttons (Previous/Next) */
        .button-3d.btn-gray {
          box-shadow: 0 4px 0 #201f1f;
        }
        .button-3d.btn-gray:active:not(:disabled) {
          box-shadow: 0 2px 0 #201f1f;
        }
        .button-3d.btn-gray:disabled {
          box-shadow: 0 2px 0 #0000001a;
        }

        /* Orange button (Media toggle) */
        .button-3d.btn-orange {
          box-shadow: 0 4px 0 #a24719;
        }
        .button-3d.btn-orange:active:not(:disabled) {
          box-shadow: 0 2px 0 #a24719;
        }
        .button-3d.btn-orange:disabled {
          box-shadow: 0 2px 0 #0000001a;
        }

        /* Blue button (Audio) */
        .button-3d.btn-blue {
          box-shadow: 0 4px 0 #001b69;
        }
        .button-3d.btn-blue:active:not(:disabled) {
          box-shadow: 0 2px 0 #001b69;
        }
        .button-3d.btn-blue:disabled {
          box-shadow: 0 2px 0 #0000001a;
        }

        /* Red button (Stop/Recording) */
        .button-3d.btn-red {
          box-shadow: 0 4px 0 #9b2020;
        }
        .button-3d.btn-red:active:not(:disabled) {
          box-shadow: 0 2px 0 #9b2020;
        }
        .button-3d.btn-red:disabled {
          box-shadow: 0 2px 0 #0000001a;
        }

        /* Purple button (Mic) */
        .button-3d.btn-purple {
          box-shadow: 0 4px 0 #5c00af;
        }
        .button-3d.btn-purple:active:not(:disabled) {
          box-shadow: 0 2px 0 #5c00af;
        }
        .button-3d.btn-purple:disabled {
          box-shadow: 0 2px 0 #0000001a;
        }

        /* Green button (Flip) */
        .button-3d.btn-green {
          box-shadow: 0 4px 0 #225000;
        }
        .button-3d.btn-green:active:not(:disabled) {
          box-shadow: 0 2px 0 #225000;
        }
      `}</style>
      {/* Left side image - only visible on desktop (md and up) */}
      <div className="hidden md:block fixed left-0 bottom-[5%] -translate-y-1/2 w-48 lg:w-64 xl:w-80 pointer-events-none z-10">
        <img
          src={sideImages.left}
          alt="Theme decoration left"
          className="w-full h-auto object-contain"
          style={{ maxHeight: '80vh' }}
        />
      </div>

      {/* Right side image - only visible on desktop (md and up) */}
      <div className="hidden md:block fixed right-0 bottom-[5%] -translate-y-1/2 w-48 lg:w-64 xl:w-80 pointer-events-none z-10">
        <img
          src={sideImages.right}
          alt="Theme decoration right"
          className="w-full h-auto object-contain"
          style={{ maxHeight: '80vh' }}
        />
      </div>

      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 px-2 sm:px-4 py-4 sm:py-6 relative z-20">
        {/* Main Card Display with Right Side Thumbnails */}
        <div className="flex flex-col lg:flex-row gap-4 max-w-full mx-auto">
          {/* Main Card */}
          <div className="flex-1 max-w-xl lg:max-w-xl mx-auto w-full">
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 flip-card-container">
              <div className="relative">
                {/* Card Content - Front or Back */}
                <div
                  className={`flip-card-inner aspect-square ${
                    isFlipped ? "flipped" : ""
                  }`}
                >
                  {/* Front Face */}
                  <div className="flip-card-front aspect-square relative">
                    {mediaMode === "image" ? (
                      <>
                        <img
                          src={currentFlashcard?.image}
                          alt={currentFlashcard?.front}
                          className="w-full h-full object-cover"
                        />
                        {/* Overlay with front text */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center px-4">
                          <div className="text-center text-white">
                            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 drop-shadow-lg break-words max-w-full">
                              {currentFlashcard?.front}
                            </h2>
                          </div>
                        </div>

                        {/* Pronunciation Result Overlay */}
                        {pronunciationResult && (
                          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-10 overflow-y-auto">
                            <div className="text-center text-white p-6 max-w-lg">
                              {pronunciationResult.loading ? (
                                <>
                                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
                                  <h3 className="text-xl font-bold">
                                    Analyzing pronunciation...
                                  </h3>
                                </>
                              ) : pronunciationResult.error ? (
                                <>
                                  <div className="text-6xl mb-4">❌</div>
                                  <h3 className="text-2xl font-bold">Error</h3>
                                  <p className="text-lg mt-2">
                                    {pronunciationResult.transcript}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <div className="text-7xl font-bold mb-4">
                                    {pronunciationResult.accuracy}%
                                  </div>
                                  <div className="text-4xl mb-6">
                                    {pronunciationResult.isCorrect
                                      ? "✅"
                                      : "💪"}
                                  </div>

                                  {/* Syllable and Phoneme breakdown */}
                                  {pronunciationResult.words &&
                                    pronunciationResult.words.length > 0 && (
                                      <div className="mt-3 text-left bg-white/5 rounded-lg p-3 max-h-64 overflow-y-auto">
                                        <div className="space-y-3">
                                          {pronunciationResult.words.map(
                                            (word, idx) => (
                                              <div
                                                key={idx}
                                                className="space-y-2"
                                              >
                                                {/* Phoneme-level breakdown */}
                                                {word.phonemes &&
                                                  word.phonemes.length > 0 && (
                                                    <div>
                                                      <div className="text-xs text-gray-400 mb-1">
                                                        Phonemes:
                                                      </div>
                                                      <div className="flex flex-wrap gap-1">
                                                        {word.phonemes.map(
                                                          (phoneme, pIdx) => (
                                                            <div
                                                              key={pIdx}
                                                              className={`px-2 py-1 rounded text-xs font-mono ${
                                                                phoneme.accuracyScore >=
                                                                80
                                                                  ? "bg-green-700"
                                                                  : phoneme.accuracyScore >=
                                                                    60
                                                                  ? "bg-yellow-700"
                                                                  : "bg-red-700"
                                                              }`}
                                                              title={`Phoneme: ${phoneme.phoneme} - Score: ${phoneme.accuracyScore}%`}
                                                            >
                                                              {phoneme.phoneme}{" "}
                                                              <span className="text-xs opacity-75">
                                                                (
                                                                {
                                                                  phoneme.accuracyScore
                                                                }
                                                                %)
                                                              </span>
                                                            </div>
                                                          )
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                              </div>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <video
                          ref={(el) => {
                            if (el && !videoRefs[currentVideoIndex]) {
                              const newRefs = [...videoRefs];
                              newRefs[currentVideoIndex] = el;
                              setVideoRefs(newRefs);
                            }
                          }}
                          src={currentFlashcard?.videoUrls?.[currentVideoIndex]}
                          className="w-full h-full object-cover"
                          controls
                          autoPlay
                          playsInline
                          muted
                          onError={() => {
                            console.error(
                              "Video failed to load:",
                              currentFlashcard?.videoUrls?.[currentVideoIndex]
                            );
                          }}
                        />
                        {/* Text overlay */}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center px-4 pointer-events-none">
                          <div className="text-center text-white">
                            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 drop-shadow-lg break-words max-w-full">
                              {currentFlashcard?.front}
                            </h2>
                          </div>
                        </div>

                        {/* Video thumbnails navigation */}
                        {currentFlashcard?.videoUrls?.length > 1 && (
                          <div className="absolute top-4 left-4 flex flex-row gap-2 z-10">
                            {currentFlashcard.videoUrls.map(
                              (videoUrl, videoIndex) => (
                                <button
                                  key={videoIndex}
                                  onClick={() => {
                                    if (videoRefs[currentVideoIndex]) {
                                      videoRefs[currentVideoIndex].pause();
                                    }
                                    setCurrentVideoIndex(videoIndex);
                                  }}
                                  className={`relative w-8 h-8 sm:w-8 sm:h-8 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                                    currentVideoIndex === videoIndex
                                      ? "border-blue-500 ring-2 ring-blue-400 scale-105"
                                      : "border-white/50 hover:border-white hover:scale-105"
                                  }`}
                                  title={`Video ${videoIndex + 1}`}
                                >
                                  <video
                                    src={videoUrl}
                                    className="w-full h-full object-cover pointer-events-none"
                                    muted
                                  />
                                  {currentVideoIndex === videoIndex && (
                                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"></div>
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Back Face */}
                  <div className="flip-card-back aspect-square relative">
                    {mediaMode === "image" ? (
                      <>
                        <img
                          src={currentFlashcard?.image}
                          alt={currentFlashcard?.back}
                          className="w-full h-full object-cover"
                        />
                        {/* Overlay with back text */}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center px-4">
                          <div className="text-center text-white">
                            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 drop-shadow-lg break-words max-w-full">
                              {currentFlashcard?.back}
                            </h2>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <video
                          src={currentFlashcard?.videoUrls?.[currentVideoIndex]}
                          className="w-full h-full object-cover"
                          controls
                          playsInline
                          muted
                        />
                        {/* Text overlay */}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center px-4 pointer-events-none">
                          <div className="text-center text-white">
                            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 drop-shadow-lg break-words max-w-full">
                              {currentFlashcard?.back}
                            </h2>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="p-3 sm:p-4 md:p-6 bg-white flex justify-center items-center gap-2 sm:gap-3 md:gap-4">
                  <button
                    onClick={goToPreviousCard}
                    className="button-3d btn-gray w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0"
                    title="Previous Card"
                    disabled={displayedCards.length <= 1}
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>

                  {/* Media toggle button */}
                  <button
                    onClick={toggleMediaMode}
                    className="button-3d btn-orange w-12 h-12 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-orange-600 hover:bg-orange-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      mediaMode === "image"
                        ? "Switch to Video"
                        : "Switch to Image"
                    }
                    disabled={
                      !currentFlashcard?.videoUrls ||
                      currentFlashcard.videoUrls.length === 0
                    }
                  >
                    {mediaMode === "image" ? (
                      <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                      <Image className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                  </button>

                  <button
                    onClick={playAudio}
                    disabled={
                      !currentFlashcard?.front || !currentFlashcard.front.trim()
                    }
                    className={`button-3d w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-white rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${
                      speechSynth.speaking
                        ? "btn-red bg-red-600 hover:bg-red-700"
                        : "btn-blue bg-blue-700 hover:bg-blue-800"
                    }`}
                    title={speechSynth.speaking ? "Stop Speech" : "Speak Text"}
                  >
                    <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>

                  <button
                    onClick={toggleRecording}
                    disabled={
                      !currentFlashcard?.front || !currentFlashcard.front.trim()
                    }
                    className={`button-3d w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-white rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${
                      isRecording
                        ? "btn-red bg-red-600 hover:bg-red-700 animate-pulse"
                        : "btn-purple bg-purple-600 hover:bg-purple-700"
                    }`}
                    title={
                      isRecording ? "Recording..." : "Practice Pronunciation"
                    }
                  >
                    <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>

                  <button
                    onClick={flipCard}
                    className="button-3d btn-green w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-green-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0"
                    title="Flip Card"
                  >
                    <div className="text-xs font-bold">FLIP</div>
                  </button>

                  <button
                    onClick={goToNextCard}
                    className="button-3d btn-gray w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0"
                    title="Next Card"
                    disabled={displayedCards.length <= 1}
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side Thumbnails - 3-4 Columns Grid */}
            <div className="hidden lg:block  flex-shrink-0 overflow-hidden">
              <div className="grid grid-cols-3 xl:grid-cols-8 gap-2 max-h-screen overflow-y-auto p-2">
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
                    {/* Video indicator */}
                    {card.videoUrls && card.videoUrls.length > 0 && (
                      <div className="absolute top-1 left-1">
                        <div className="bg-orange-600 rounded-full p-1">
                          <Video className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                    {/* Practice indicator */}
                    {cardScores[card.id] && (
                      <div className="absolute bottom-1 right-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            cardScores[card.id].bestScore >= 80
                              ? "bg-green-500"
                              : cardScores[card.id].bestScore >= 60
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        >
                          ✓
                        </div>
                      </div>
                    )}
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
          <div className="lg:hidden w-full">
            <div className="grid gap-2 sm:gap-3 grid-cols-5 sm:grid-cols-4 md:grid-cols-5">
              {displayedCards.map((card, index) => (
                <button
                  key={card.id}
                  onClick={() => handleCardSelect(index)}
                  className={`relative aspect-square rounded-lg overflow-hidden transition-all duration-200 ${
                    currentCard === index
                      ? "ring-2 sm:ring-4 ring-blue-500 scale-105"
                      : "hover:scale-105 hover:shadow-lg"
                  }`}
                >
                  <img
                    src={card.image}
                    alt={card.front}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-1">
                    <div className="text-center text-white">
                      <p className="text-xs sm:text-sm font-bold line-clamp-2">
                        {card.front}
                      </p>
                    </div>
                  </div>
                  {/* Video indicator */}
                  {card.videoUrls && card.videoUrls.length > 0 && (
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2">
                      <div className="bg-orange-600 rounded-full p-1">
                        <Video className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  )}
                  {/* Practice indicator */}
                  {cardScores[card.id] && (
                    <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2">
                      <div
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          cardScores[card.id].bestScore >= 80
                            ? "bg-green-500"
                            : cardScores[card.id].bestScore >= 60
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      >
                        ✓
                      </div>
                    </div>
                  )}
                  {currentCard === index && (
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2"></div>
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
    </>
  );
};

export default FlashcardExercise;
