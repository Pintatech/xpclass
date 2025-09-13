import React, { useState, useRef, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import {
    Play,
    Pause,
    Volume2,
    ArrowRight,
    ArrowLeft,
    Mic,
    MicOff,
    RotateCcw,
    CheckCircle,
    Timer,
    Clock
} from 'lucide-react';
import RecordingInterface from '../study/RecordingInterface';

const SentencePronunciationExercise = ({ exercise, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(1); // 1: Video + Sentences, 2: Words + Practice
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [recordingResult, setRecordingResult] = useState(null);

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

    const videoRef = useRef(null);

    // Extract content from exercise
    const videoUrl = exercise?.content?.videoUrl || exercise?.video_url;
    const sentences = exercise?.content?.sentences || [];
    const words = exercise?.content?.words || [];

    console.log('🔍 Exercise content:', exercise?.content);
    console.log('🔍 Sentences:', sentences);
    console.log('🔍 Current sentence index:', currentSentenceIndex);

    const currentSentence = sentences[currentSentenceIndex] || {};
    console.log('🔍 Current sentence:', currentSentence);

    // Function to render text with colored highlights
    const renderStyledText = (text) => {
        if (!text) return text;

        // Support multiple color tags: <red>text</red>, <blue>text</blue>, etc.
        const colorTags = /<(\w+)>(.*?)<\/\1>/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = colorTags.exec(text)) !== null) {
            // Add text before the tag
            if (match.index > lastIndex) {
                parts.push({
                    text: text.slice(lastIndex, match.index),
                    color: null
                });
            }

            // Add the colored text
            parts.push({
                text: match[2], // The text inside the tag
                color: match[1]  // The color name
            });

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({
                text: text.slice(lastIndex),
                color: null
            });
        }

        // If no tags found, return original text
        if (parts.length === 0) {
            return text;
        }

        // Render styled parts
        return parts.map((part, index) => {
            if (part.color) {
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

                return (
                    <span
                        key={index}
                        className={colorClasses[part.color] || 'text-red-600 font-bold'}
                    >
                        {part.text}
                    </span>
                );
            }
            return part.text;
        });
    };

    // Text-to-Speech function with custom speed
    const speakText = (text, speed = 1.0, lang = 'en-US') => {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            speechSynthesis.cancel();

            // Remove HTML tags for TTS (speak plain text only)
            const plainText = text.replace(/<[^>]*>/g, '');

            const utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = lang;
            utterance.rate = speed; // Use specified speed
            utterance.pitch = 1;
            utterance.volume = 1;

            speechSynthesis.speak(utterance);
        } else {
            console.warn('Text-to-speech not supported in this browser');
        }
    };

    const toggleVideo = () => {
        if (videoRef.current) {
            if (isVideoPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsVideoPlaying(!isVideoPlaying);
        }
    };

    const handleSentenceClick = (sentence, speed = 1.0) => {
        speakText(sentence.text, speed, sentence.lang || 'en-US');
    };

    const handleWordClick = (word) => {
        speakText(word.text, 1.0, word.lang || 'en-US');
    };

    const nextSentence = () => {
        if (currentSentenceIndex < sentences.length - 1) {
            setCurrentSentenceIndex(currentSentenceIndex + 1);
            setRecordingResult(null);
        }
    };

    const previousSentence = () => {
        if (currentSentenceIndex > 0) {
            setCurrentSentenceIndex(currentSentenceIndex - 1);
            setRecordingResult(null);
        }
    };

    const handleRecordingResult = (result) => {
        console.log('🎯 Recording result received:', result);
        console.log('🎯 Current sentence:', currentSentence);
        console.log('🎯 Current sentence text:', currentSentence.text);
        setRecordingResult(result);
        
        // Removed auto-advance to next sentence to require manual progression
    };

    // Competitive helpers
    const toggleCompetitiveMode = () => {
        const next = !isCompetitiveMode;
        setIsCompetitiveMode(next);
        if (next) {
            // reset when turning on
            setCurrentPlayer('mom');
            setMomAccuracy(null);
            setKidAccuracy(null);
            setRoundComplete(false);
            setMomAudioUrl(null);
            setKidAudioUrl(null);
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                setCurrentAudio(null);
            }
        }
    };

    const handleScoreUpdate = (accuracy /* number */, xp) => {
        if (!isCompetitiveMode) return;
        if (currentPlayer === 'mom') {
            setMomAccuracy(accuracy);
            setCurrentPlayer('kid');
        } else {
            setKidAccuracy(accuracy);
            setRoundComplete(true);
        }
    };

    const handleAudioRecorded = (audioUrl, audioBlob) => {
        if (!isCompetitiveMode) return;
        if (currentPlayer === 'mom') {
            setMomAudioUrl(audioUrl);
        } else {
            setKidAudioUrl(audioUrl);
        }
    };

    const playPlayerAudio = (audioUrl) => {
        if (!audioUrl) return;
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        const audio = new Audio(audioUrl);
        setCurrentAudio(audio);
        audio.onended = () => setCurrentAudio(null);
        audio.play().catch(() => {});
    };

    const determineWinner = () => {
        if (momAccuracy === null || kidAccuracy === null) return;
        if (momAccuracy > kidAccuracy) setMomScore((s) => s + 1);
        else if (kidAccuracy > momAccuracy) setKidScore((s) => s + 1);
    };

    useEffect(() => {
        if (roundComplete) determineWinner();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roundComplete]);

    const startNewRound = () => {
        setCurrentPlayer('mom');
        setMomAccuracy(null);
        setKidAccuracy(null);
        setRoundComplete(false);
        setMomAudioUrl(null);
        setKidAudioUrl(null);
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            setCurrentAudio(null);
        }
    };

    const handleComplete = () => {
        onComplete?.({
            exerciseId: exercise.id,
            accuracy: recordingResult?.accuracy || 0,
            completedAt: new Date().toISOString()
        });
    };

    const goToStep2 = () => {
        setCurrentStep(2);
        setCurrentSentenceIndex(0);
        setRecordingResult(null);
    };

    const goBackToStep1 = () => {
        setCurrentStep(1);
        setRecordingResult(null);
    };

    // Listen for bottom navigation buttons
    useEffect(() => {
        const handleBottomNavHocTiep = () => {
            console.log('🎯 Bottom nav "Học tiếp" clicked');
            if (currentStep === 1) {
                // If in Step 1, go to Step 2 (same as Continue to Practice)
                goToStep2();
            } else if (currentStep === 2) {
                // In Step 2 (practice), advance to next sentence
                if (currentSentenceIndex < sentences.length - 1) {
                    nextSentence();
                } else {
                    console.log('✅ Already on last sentence');
                }
            }
        };

        const handleBottomNavBack = () => {
            console.log('🎯 Bottom nav "Back" clicked, currentStep:', currentStep);
            if (currentStep === 2) {
                // If in Step 2 (practice), go back to Step 1 (video)
                console.log('🎯 Going back to video from practice');
                goBackToStep1();
            } else {
                // If in Step 1, use normal back navigation
                console.log('🎯 Using normal back navigation');
                window.history.back();
            }
        };

        window.addEventListener('bottomNavHocTiep', handleBottomNavHocTiep);
        window.addEventListener('bottomNavBack', handleBottomNavBack);
        
        return () => {
            window.removeEventListener('bottomNavHocTiep', handleBottomNavHocTiep);
            window.removeEventListener('bottomNavBack', handleBottomNavBack);
        };
    }, [currentStep, currentSentenceIndex, sentences.length]);

    if (!exercise) {
        return (
            <div className="text-center p-8">
                <p className="text-gray-600">Không tìm thấy bài tập</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            

            {/* Step 1: Video + Sentences */}
            {currentStep === 1 && (
                <div className="space-y-6">
                    {/* Video Player */}
                    <div className="relative bg-black rounded-lg overflow-hidden">
                        {videoUrl ? (
                            <>
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    className="w-full h-64 object-cover"
                                    onPlay={() => setIsVideoPlaying(true)}
                                    onPause={() => setIsVideoPlaying(false)}
                                    onEnded={() => setIsVideoPlaying(false)}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <button
                                        onClick={toggleVideo}
                                        className="bg-black/50 hover:bg-black/70 text-white p-4 rounded-full transition-colors"
                                    >
                                        {isVideoPlaying ? (
                                            <Pause className="w-8 h-8" />
                                        ) : (
                                            <Play className="w-8 h-8" />
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-white">
                                <p>No video available</p>
                            </div>
                        )}
                    </div>

                    {/* Sentences List */}
                    <div className="space-y-3">
                        {sentences.map((sentence, index) => (
                            <div
                                key={index}
                                className={`relative p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border-2 border-transparent hover:border-blue-300 group max-w-[80%] ${
                                  index % 2 === 0 ? 'ml-auto pr-8' : 'mr-auto pl-8'
                                }`}
                            >
                                {/* Side avatars: Mom on odd (1,3), Kid on even (2,4) */}
                                {((index % 2) === 0) && (
                                  <img
                                    src="https://xpclass.vn/momtek/svg%20icon/Mom.svg"
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="absolute -left-10 top-1/2 -translate-y-1/2 -translate-x-1/2"
                                  />
                                )}
                                {((index % 2) === 1) && (
                                  <img
                                    src="https://xpclass.vn/momtek/svg%20icon/Kid.svg"
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="absolute -right-10 top-1/2 -translate-y-1/2 translate-x-1/2"
                                  />
                                )}
                                {/* Row: Audio buttons + sentence */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSentenceClick(sentence, 1.0);
                                        }}
                                        className="p-0 rounded-none transition-transform hover:scale-105"
                                        title="Normal Speed (1.0x)"
                                    >
                                        <img src="https://xpclass.vn/momtek/svg%20icon/Normal%20audio.svg" alt="" width={20} height={20} />
                                    </button>
                                    <p className="flex-1 text-center text-gray-800 font-medium">{renderStyledText(sentence.text)}</p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSentenceClick(sentence, 0.5);
                                        }}
                                        className="p-0 rounded-none transition-transform hover:scale-105"
                                        title="Slow Speed (0.5x)"
                                    >
                                        <img src="https://xpclass.vn/momtek/svg%20icon/Slow%20audio.svg" alt="" width={20} height={20} />
                                    </button>
                                </div>
                                {sentence.translation && (
                                    <div className="mt-2 text-center">
                                        <p className="text-sm text-gray-600">{renderStyledText(sentence.translation)}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            )}

            {/* Step 2: Words + Practice */}
            {currentStep === 2 && (
                <div className="space-y-6">
                    {/* Competitive Mode Toggle & Scoreboard */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-center gap-4">
                            {isCompetitiveMode && (
                                <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${currentPlayer === 'mom' ? 'border-pink-400 bg-pink-50 shadow-md' : 'border-gray-200 bg-gray-50'}`}>
                                    <div className="text-2xl font-bold text-pink-600">{momScore}</div>
                                    <div className="text-2xl">👩‍💼</div>
                                </div>
                            )}
                            <button
                                onClick={toggleCompetitiveMode}
                                className={`transition-all duration-200 hover:scale-105 ${isCompetitiveMode ? 'opacity-100 shadow-lg' : 'opacity-70 hover:opacity-100'}`}
                                title="Toggle Competitive Mode"
                            >
                                <img src="https://xpclass.vn/momtek/versus.jpg" alt="VS" className="w-12 h-12 object-contain rounded" />
                            </button>
                            {isCompetitiveMode && (
                                <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${currentPlayer === 'kid' ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-gray-200 bg-gray-50'}`}>
                                    <div className="text-2xl">👶</div>
                                    <div className="text-2xl font-bold text-blue-600">{kidScore}</div>
                                </div>
                            )}
                        </div>
                        {isCompetitiveMode && (
                            <div className="text-center">
                                {roundComplete ? (
                                    <div className={`inline-block px-4 py-2 rounded-lg font-medium ${
                                        momAccuracy > kidAccuracy
                                            ? 'bg-pink-100 text-pink-800 border border-pink-200'
                                            : kidAccuracy > momAccuracy
                                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                                    }`}>
                                        {momAccuracy > kidAccuracy && '🎉 Mom wins this round!'}
                                        {kidAccuracy > momAccuracy && '🎉 Kid wins this round!'}
                                        {kidAccuracy === momAccuracy && '🤝 It\'s a tie!'}
                                    </div>
                                ) : (
                                    <div className={`inline-block px-4 py-2 rounded-lg font-medium ${currentPlayer === 'mom' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-pink-100 text-pink-800 border border-pink-200'}`}>
                                        🎤 {currentPlayer === 'mom' ? "Mom" : "Kid"}'s turn!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Words Section */}
                    <Card>

                        <Card.Content>
                            <div className="space-y-4 mb-6">
                                {/* Row 1 - Word 1 on the left */}
                                <div className="flex justify-start">
                                    {(currentSentence.words || words).slice(0, 1).map((word, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleWordClick(word)}
                                            className="px-4 py-2 bg-gray-200 border-2 border-gray-200 hover:border-blue-300 rounded-lg transition-colors group"
                                        >
                                            <span className="text-gray-900 font-medium">{word.text}</span>
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Row 2 - Word 2 in the middle */}
                                <div className="flex justify-center">
                                    {(currentSentence.words || words).slice(1, 2).map((word, index) => (
                                        <button
                                            key={index + 1}
                                            onClick={() => handleWordClick(word)}
                                            className="px-4 py-2 bg-gray-200 border-2 border-gray-200 hover:border-blue-300 rounded-lg transition-colors group"
                                        >
                                            <span className="text-gray-900 font-medium">{word.text}</span>
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Row 3 - Word 3 on the right */}
                                <div className="flex justify-end">
                                    {(currentSentence.words || words).slice(2, 3).map((word, index) => (
                                        <button
                                            key={index + 2}
                                            onClick={() => handleWordClick(word)}
                                            className="px-4 py-2 bg-gray-200 border-2 border-gray-200 hover:border-blue-300 rounded-lg transition-colors group"
                                        >
                                            <span className="text-gray-900 font-medium">{word.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Current Sentence */}
                            <div className={`relative p-2 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-lg transition-colors group mb-6 w-full ${
                              currentSentenceIndex % 2 === 0 ? 'ml-auto pr-8' : 'mr-auto pl-8'
                            }`}>
                                {/* Speed Buttons - Top Corners */}
                                <div className="absolute top-2 left-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSentenceClick(currentSentence, 1.0);
                                        }}
                                        className="p-0 rounded-none transition-transform hover:scale-105"
                                        title="Normal Speed (1.0x)"
                                    >
                                        <img src="https://xpclass.vn/momtek/svg%20icon/Normal%20audio.svg" alt="" width={16} height={16} />
                                    </button>
                                </div>
                                <div className="absolute top-2 right-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSentenceClick(currentSentence, 0.5);
                                        }}
                                        className="p-0 rounded-none transition-transform hover:scale-105"
                                        title="Slow Speed (0.5x)"
                                    >
                                        <img src="https://xpclass.vn/momtek/svg%20icon/Slow%20audio.svg" alt="" width={16} height={16} />
                                    </button>
                                </div>

                                {/* Sentence Content */}
                                <div className="pt-6 text-center">
                                    <p className="text-lg font-medium text-gray-900">{renderStyledText(currentSentence.text)}</p>
                                    {currentSentence.translation && (
                                        <p className="text-sm text-gray-600 mt-2">{renderStyledText(currentSentence.translation)}</p>
                                    )}
                                </div>
                            </div>
                        </Card.Content>
                    </Card>

                    {/* Recording Interface - Moved outside the Card container */}
                    <div className="flex items-center gap-4">
                        {isCompetitiveMode && momAccuracy !== null && (
                            <div className="flex flex-col items-center gap-2">
                                {momAudioUrl && (
                                    <button onClick={() => playPlayerAudio(momAudioUrl)} className="flex items-center gap-2 px-4 py-2 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-lg transition-colors">
                                        <Play className="w-4 h-4" />
                                        <span>👩‍💼</span>
                                    </button>
                                )}
                                <div className="text-sm font-medium text-pink-600">{Math.round(momAccuracy)}%</div>
                            </div>
                        )}
                        <div className="flex-1 flex items-center justify-center">
                            {isCompetitiveMode && roundComplete ? (
                                <button
                                    onClick={startNewRound}
                                    className="flex items-center justify-center w-20 h-20 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all transform hover:scale-105 shadow-md"
                                    title="Start New Round"
                                >
                                    <RotateCcw className="w-8 h-8" />
                                </button>
                            ) : (
                                <RecordingInterface
                                    key={currentSentenceIndex}
                                    targetText={currentSentence.text || ''}
                                    onResult={handleRecordingResult}
                                    onScoreUpdate={handleScoreUpdate}
                                    onAudioRecorded={handleAudioRecorded}
                                    hideAccuracy={isCompetitiveMode}
                                />
                            )}
                        </div>
                        {isCompetitiveMode && kidAccuracy !== null && (
                            <div className="flex flex-col items-center gap-2">
                                {kidAudioUrl && (
                                    <button onClick={() => playPlayerAudio(kidAudioUrl)} className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors">
                                        <Play className="w-4 h-4" />
                                        <span>👶</span>
                                    </button>
                                )}
                                <div className="text-sm font-medium text-blue-600">{Math.round(kidAccuracy)}%</div>
                            </div>
                        )}
                    </div>

                    {/* Complete Exercise Button - Only show when all sentences are done and attempted */}
                    {currentSentenceIndex === sentences.length - 1 && recordingResult && (
                        <div className="mt-6 text-center">
                            <Button onClick={handleComplete} className="bg-red-600 hover:bg-red-700">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Complete Exercise
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SentencePronunciationExercise;