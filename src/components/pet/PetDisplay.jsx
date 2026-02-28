import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase/client";
import { usePet } from "../../hooks/usePet";
import { useInventory } from "../../hooks/useInventory";
import { useAuth } from "../../hooks/useAuth";
import { useProgress } from "../../hooks/useProgress";
import { chatWithPet } from "../../utils/petChatService";
import {
  Star,
  Sparkles,
  MessageCircle,
  Send,
  X,
  Loader2,
} from "lucide-react";
import PetCatchGame from "./PetCatchGame";
import PetFlappyGame from "./PetFlappyGame";
import PetWordScramble from "./PetWordScramble";
import PetWhackMole from "./PetWhackMole";

// Pet chat messages - replace with your own!
const PET_MESSAGES = [
  // English Idioms
  "Practice makes perfect! Keep going! 💪",
  "Every cloud has a silver lining! ☁️✨",
  "Rome wasn't built in a day - be patient with yourself!",
  "The early bird catches the worm! 🐦",
  "When life gives you lemons, make lemonade! 🍋",
  "Actions speak louder than words!",
  "Don't put all your eggs in one basket! 🥚",
  "Better late than never, right?",
  // Fun Facts
  "Did you know? Honey never spoils! 🍯",
  "Fun fact: Octopuses have three hearts! 🐙",
  "Did you know? Bananas are berries, but strawberries aren't! 🍌",
  "Fun fact: A group of flamingos is called a 'flamboyance'! 🦩",
  "Did you know? Sharks existed before trees! 🦈",
  "Fun fact: Venus is the only planet that spins clockwise! 🪐",
  "Did you know? Cows have best friends! 🐄💕",
  "Fun fact: The shortest war in history lasted 38 minutes!",
  "Good-bye is a contraction of God be with ye",
  "The original name for a butterfly was flutterby",
  "Uncopyrightable is the longest word in common use that contains no letter more than once.",
  "Go! is the shortest, grammatically correct sentence.",
  "Aegilops is the longest word with all letters in alphabetical order.",

  // Encouragement
  "You're doing great! Keep it up! ⭐",
  "Learning is a journey, not a race! 🚀",
  "Mistakes help us grow! Don't be afraid to try!",
  "I believe in you! Let's learn together! 📚",
];

const PetDisplay = () => {
  const {
    activePet,
    feedPet,
    playWithPet,
    drainPetEnergy,
    getActiveBonuses,
  } = usePet();
  const { inventory } = useInventory();
  const { user, profile } = useAuth();
  const { getEquippedItemsXPBonus, addXP } = useProgress();
  const [showFeedMenu, setShowFeedMenu] = useState(false);
  const [message, setMessage] = useState(null);
  const [chatBubble, setChatBubble] = useState(null);
  const [showPetInfo, setShowPetInfo] = useState(false);
  const [showBonuses, setShowBonuses] = useState(false);
  const [itemBonuses, setItemBonuses] = useState({ total: 0, items: [] });
  const [isEating, setIsEating] = useState(false);

  // Feed animation state
  const [feedAnimation, setFeedAnimation] = useState(null); // { food: '🍖', particles: [] }
  const petContainerRef = useRef(null);

  // Play animation state
  const [playAnimation, setPlayAnimation] = useState(null); // { xpGained: 10, phase: 'active' }
  const [trainingVideoLoaded, setTrainingVideoLoaded] = useState(false);

  // Chat state
  const [playDisabled, setPlayDisabled] = useState(false);
  const [playCooldown, setPlayCooldown] = useState(0);
  const [showGame, setShowGame] = useState(null); // null | 'picker' | 'catch' | 'flappy'
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatContainerRef = useRef(null);

  // Fetch equipped item XP bonuses
  useEffect(() => {
    const fetchItemBonuses = async () => {
      const result = await getEquippedItemsXPBonus()
      setItemBonuses(result)
    }
    fetchItemBonuses()
  }, [profile?.active_title, profile?.active_background_url, profile?.active_bowl_url])

  // Scroll chat to bottom when new messages arrive (only inside chat container)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Show random chat bubble periodically
  useEffect(() => {
    if (!activePet) return;

    const showRandomMessage = () => {
      const randomMsg =
        PET_MESSAGES[Math.floor(Math.random() * PET_MESSAGES.length)];
      setChatBubble(randomMsg);
      // Hide after 4 seconds
      setTimeout(() => setChatBubble(null), 8000);
    };

    // Show first message after 2 seconds
    const initialTimeout = setTimeout(showRandomMessage, 2000);

    // Then show messages every 15-30 seconds randomly
    const interval = setInterval(() => {
      const randomDelay = Math.random() * 15000 + 30000; // 15-30 seconds
      setTimeout(showRandomMessage, randomDelay);
    }, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [activePet]);

  // Handle sending chat message
  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading || !activePet) return;

    const userMessage = chatInput.trim();
    setChatInput("");

    // Check and drain pet energy first
    const energyResult = await drainPetEnergy(5);
    if (!energyResult.success) {
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        {
          role: "pet",
          content: `*${activePet.nickname || activePet.name} ngáp dài* Mình hơi mệt rồi... cho mình nghỉ ngơi hoặc ăn gì đó nhé! 😴`,
        },
      ]);
      return;
    }

    // Add user message to chat
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);
    setChatLoading(true);

    try {
      const response = await chatWithPet(
        activePet,
        userMessage,
        chatMessages,
        "vi",
      );
      // Add pet response to chat
      setChatMessages((prev) => [
        ...prev,
        { role: "pet", content: response.message },
      ]);
      // Show in chat bubble too
      setChatBubble(response.message);
      setTimeout(() => setChatBubble(null), 10000);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "pet",
          content: `*${activePet.nickname || activePet.name} looks confused*`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!activePet) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="text-gray-400 mb-4">
          <Sparkles className="w-16 h-16 mx-auto mb-2" />
          <h3 className="text-xl font-bold text-gray-600">No Active Pet</h3>
          <p className="text-sm text-gray-500 mt-2">
            Pet gain you bonus XP and explain questions to you
          </p>
        </div>
      </div>
    );
  }

  const bonuses = getActiveBonuses();

  const petFoodItems = inventory.filter(
    (item) => item.item?.item_type === "pet_food" && item.quantity > 0,
  );

  // Get energy gain based on food rarity
  const getFoodStats = (rarity) => {
    const stats = {
      common: { energy: 5 },
      uncommon: { energy: 10 },
      rare: { energy: 15 },
      epic: { energy: 20 },
    };
    return stats[rarity] || stats.common;
  };

  // Get next evolution stage info
  const getNextEvolution = () => {
    if (!activePet?.evolution_stages) return null;
    const currentStage = activePet.evolution_stage || 0;
    const stages = activePet.evolution_stages;

    // Find next stage
    const nextStage = stages.find((stage) => stage.stage === currentStage + 1);
    return nextStage;
  };

  // Trigger flying food animation
  const triggerFeedAnimation = (energyGained = 15, foodImageUrl = null) => {
    const particles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      image: foodImageUrl,
      angle: i * 45 + Math.random() * 20,
      distance: 40 + Math.random() * 30,
    }));

    setFeedAnimation({ food: foodImageUrl, particles, phase: "flying", energyGained });

    // After food reaches pet, show burst
    setTimeout(() => {
      setFeedAnimation((prev) => (prev ? { ...prev, phase: "burst" } : null));
    }, 600);

    // Start eating state
    setTimeout(() => {
      setIsEating(true);
    }, 600);

    // Clear animation after 3 seconds
    setTimeout(() => {
      setFeedAnimation(null);
    }, 3000);

    // Stop eating state
    setTimeout(() => {
      setIsEating(false);
    }, 4000);
  };

  // Trigger play animation with XP gain
  const triggerPlayAnimation = (xpGained = 10) => {
    setTrainingVideoLoaded(false);
    setPlayAnimation({ xpGained, phase: "active" });

    // Clear animation after 6 seconds
    setTimeout(() => {
      setPlayAnimation(null);
      setTrainingVideoLoaded(false);
    }, 6000);
  };

  const handleFeed = async (itemId = null) => {
    const result = await feedPet(activePet.id, itemId);
    if (result.success) {
      // Find the food item image
      const foodItem = itemId ? petFoodItems.find(i => i.item.id === itemId) : null;
      // Get energy gained from result or calculate from item rarity
      const energyGained = result.energy_gained || (foodItem ? getFoodStats(foodItem.item.rarity).energy : 15);
      const foodImageUrl = foodItem?.item?.image_url || null;

      // Play chomp sound
      const chompSound = new Audio('https://xpclass.vn/xpclass/sound/chomp.mp3');
      chompSound.play().catch(() => {});

      // Trigger flying food animation with energy gained
      triggerFeedAnimation(energyGained, foodImageUrl);

      setMessage({
        type: "success",
        text: `${activePet.nickname || activePet.name} enjoyed the meal! 😋`,
      });
      setShowFeedMenu(false);
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to feed pet",
      });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handlePlay = async () => {
    setShowGame('picker');
  };

  const handleGameEnd = async (score, gameType) => {
    setShowGame(null);

    // Save training score for leaderboard
    if (gameType && user?.id) {
      supabase.from('training_scores').insert({
        user_id: user.id,
        game_type: gameType,
        score
      }).then(() => {});
    }

    setPlayDisabled(true);
    setPlayCooldown(10);
    const cooldownInterval = setInterval(() => {
      setPlayCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownInterval);
          setPlayDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const result = await playWithPet(activePet.id);
    if (result.success) {
      const xpGained = result.xp_gained || 10;
      triggerPlayAnimation(xpGained);
      await addXP(5);

      setTimeout(() => {
        const trainSound = new Audio('https://xpclass.vn/xpclass/sound/pet-training.mp3');
        trainSound.play().catch(() => {});
      }, 4000);

      const evolved = result.evolution?.evolved;
      const levelUp = result.level_up;

      let message = `${activePet.nickname || activePet.name} scored ${score} points! 💪`;
      if (evolved) {
        message = `🌟 ${activePet.nickname || activePet.name} evolved to Stage ${result.evolution.new_stage}! ✨`;
      } else if (levelUp) {
        message = `${activePet.nickname || activePet.name} leveled up! 🎉 Level ${result.level}`;
      }

      setMessage({
        type: "success",
        text: message,
      });
      setTimeout(() => setMessage(null), evolved ? 5000 : 3000);
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to play with pet",
      });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: "text-gray-600 bg-gray-100",
      uncommon: "text-green-600 bg-green-100",
      rare: "text-blue-600 bg-blue-100",
      epic: "text-purple-600 bg-purple-100",
      legendary: "text-yellow-600 bg-yellow-100",
    };
    return colors[rarity] || colors.common;
  };

  const getRarityGradient = (rarity) => {
    const gradients = {
      common: "from-gray-400 to-gray-500",
      uncommon: "from-green-400 to-emerald-500",
      rare: "from-blue-400 to-indigo-500",
      epic: "from-purple-500 to-pink-500",
      legendary: "from-yellow-400 to-orange-500",
    };
    return gradients[rarity] || gradients.common;
  };

  const getRarityAura = (rarity) => {
    const auras = {
      common: "https://xpclass.vn/xpclass/common.png",
      uncommon: "https://xpclass.vn/xpclass/common.png",
      rare: "https://xpclass.vn/xpclass/common.png",
      epic: "https://xpclass.vn/xpclass/common.png",
      legendary: "https://xpclass.vn/xpclass/common.png",
    };
    return auras[rarity] || "https://xpclass.vn/xpclass/common.png";
  };

  // Get pet image based on current stats and evolution stage
  const getPetImage = () => {
    // Get base image for current evolution stage
    let baseImage = activePet.image_url;

    if (activePet.evolution_stages && activePet.evolution_stage > 0) {
      const currentStage = activePet.evolution_stages.find(
        (stage) => stage.stage === activePet.evolution_stage,
      );
      if (currentStage?.image_url) {
        baseImage = currentStage.image_url;
      }
    }

    if (!baseImage) return null;

    // Check for state variations (priority: eating > sleepy > default)
    // State images use naming pattern: base-eating.png, base-sleepy.png
    if (isEating) {
      const eatingImage = baseImage.replace(/\.([^.]+)$/, "-eating.$1");
      return eatingImage;
    }

    if ((activePet.energy ?? 100) < 30) {
      // Try stage-specific sleepy image
      const sleepyImage = baseImage.replace(/\.([^.]+)$/, "-sleepy.$1");
      return sleepyImage;
    }

    return baseImage; // default/happy state for current stage
  };

  const getPetEnergyStatus = (energy) => {
    if (energy >= 70) return { status: "energetic", color: "text-green-500" };
    if (energy >= 40) return { status: "normal", color: "text-yellow-500" };
    return { status: "sleepy", color: "text-orange-500" };
  };

  const energyStatus = activePet
    ? getPetEnergyStatus(activePet.energy ?? 100)
    : null;

  // Get background URL (null if none selected)
  const backgroundUrl = profile?.active_background_url || null;

  return (
    <div
      className="rounded-xl shadow-lg relative bg-cover bg-center bg-blue-200"
      style={{
        backgroundImage: `url(https://xpclass.vn/xpclass/image/dashboard/2709577_14710.jpg)`,
      }}
    >
      {/* Feed Animation Styles */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        @keyframes flyToPet {
          0% {
            transform: translate(0, 0) scale(0.8);
            opacity: 1;
          }
          70% {
            transform: translate(clamp(-200px, -30vw, -100px), -150px) scale(1.4);
            opacity: 1;
          }
          100% {
            transform: translate(clamp(-200px, -30vw, -100px), -160px) scale(1);
            opacity: 0;
          }
        }
        @keyframes burstSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(180deg); }
        }
        @keyframes particle0 { 0% { transform: translateY(0) scale(0) rotate(0deg); opacity: 1; } 60% { opacity: 1; } 100% { transform: translateY(-60px) scale(1.2) rotate(360deg); opacity: 0; } }
        @keyframes particle1 { 0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 1; } 60% { opacity: 1; } 100% { transform: translate(42px, -42px) scale(1.2) rotate(360deg); opacity: 0; } }
        @keyframes particle2 { 0% { transform: translateX(0) scale(0) rotate(0deg); opacity: 1; } 60% { opacity: 1; } 100% { transform: translateX(60px) scale(1.2) rotate(360deg); opacity: 0; } }
        @keyframes particle3 { 0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 1; } 60% { opacity: 1; } 100% { transform: translate(42px, 42px) scale(1.2) rotate(360deg); opacity: 0; } }
        @keyframes particle4 { 0% { transform: translateY(0) scale(0) rotate(0deg); opacity: 1; } 60% { opacity: 1; } 100% { transform: translateY(60px) scale(1.2) rotate(360deg); opacity: 0; } }
        @keyframes particle5 { 0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 1; } 60% { opacity: 1; } 100% { transform: translate(-42px, 42px) scale(1.2) rotate(360deg); opacity: 0; } }
        @keyframes particle6 { 0% { transform: translateX(0) scale(0) rotate(0deg); opacity: 1; } 60% { opacity: 1; } 100% { transform: translateX(-60px) scale(1.2) rotate(360deg); opacity: 0; } }
        @keyframes particle7 { 0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 1; } 60% { opacity: 1; } 100% { transform: translate(-42px, -42px) scale(1.2) rotate(360deg); opacity: 0; } }
        @keyframes spinBackground {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        /* Play Animation Keyframes */
        @keyframes glowRing {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.8;
          }
          50% {
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }
        @keyframes fadeGlow {
          0% {
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes auraPulse {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          20% {
            transform: scale(1);
            opacity: 0.6;
          }
          35% {
            transform: scale(0.8);
            opacity: 0.4;
          }
          55% {
            transform: scale(1.3);
            opacity: 0.7;
          }
          70% {
            transform: scale(1);
            opacity: 0.4;
          }
          85% {
            transform: scale(1.5);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
        @keyframes floatUpXP {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translateY(-10px) scale(1.2);
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(-80px) scale(1);
            opacity: 0;
          }
        }
        @keyframes orbitSparkle {
          0% {
            transform: rotate(0deg) translateX(40px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: rotate(360deg) translateX(40px) rotate(-360deg);
            opacity: 0;
          }
        }
      `}</style>

      {/* Message Toast - Fixed Position */}
      {message && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-center font-medium animate-fade-in ${
            message.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Pet Avatar */}
        <div className="flex-1">
          <div
            className="bg-white rounded-xl p-4 text-center relative bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          >
            {/* Pet Status - top left */}

            
            {!(playAnimation && trainingVideoLoaded) && <div className="absolute top-2 left-2 z-20 space-y-1 w-32">
              <div className="flex items-center">
                {/* Icon overlapping the bar */}
                <img src="https://xpclass.vn/xpclass/image/dashboard/energy.svg" alt="energy"
                  className="w-7 h-7 relative z-10 drop-shadow-lg" style={{ marginRight: '-16px' }}
                />
                {/* Bar track - pointed right end like game UI */}
                <div className="flex-1 relative h-2.5 overflow-hidden"
                  style={{
                    background: '#e5e7eb',
                    borderRadius: '2px 8px 8px 2px',
                   
                  }}
                >
                  {/* Fill bar */}
                  <div className="absolute inset-y-0 left-0"
                    style={{
                      width: `${activePet.energy ?? 100}%`,
                      background: 'linear-gradient(180deg, #fde047 0%, #f59e0b 40%, #d97706 100%)',
                      boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.4)',
                      borderRadius: '1px 4px 4px 1px',
                    }}
                  />
                  {/* Shine highlight */}
                  <div className="absolute inset-x-0 top-0 h-[40%]"
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)', borderRadius: '2px 8px 0 0' }}
                  />
                </div>
              </div>

              {(bonuses.length > 0 || itemBonuses.total > 0) && (
                <div className="relative mt-1">
                  <button
                    onClick={() => setShowBonuses(!showBonuses)}
                    className="w-8 h-8 hover:scale-110 transition-all"
                    title="View bonuses"
                  >
                    <img
                      src="https://xpclass.vn/xpclass/image/dashboard/pet-bonus.svg"
                      alt="Pet bonuses"
                      className="w-full h-full object-contain drop-shadow-lg"
                    />
                  </button>

                  {showBonuses && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowBonuses(false)} />
                      <div className="absolute top-0 left-full ml-2 bg-white rounded-lg shadow-xl p-3 z-40 border-2 border-yellow-200 min-w-[200px]">
                        <div className="space-y-2">
                          {bonuses.map((bonus, idx) => (
                            <div key={idx}>
                              {bonus.breakdown && (<>
                                {bonus.breakdown.rarity > 0 && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600">Rarity ({activePet.rarity})</span>
                                    <span className="font-bold text-yellow-600">+{bonus.breakdown.rarity}%</span>
                                  </div>
                                )}
                                {bonus.breakdown.evolution > 0 && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600">Evolution Stg {activePet.evolution_stage}</span>
                                    <span className="font-bold text-purple-600">+{bonus.breakdown.evolution}%</span>
                                  </div>
                                )}
                              </>)}
                            </div>
                          ))}
                          {itemBonuses.items.map((item, idx) => (
                            <div key={`item-${idx}`} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{item.name}</span>
                              <span className="font-bold text-blue-600">+{item.bonus}%</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-xs border-t border-gray-200 pt-1 mt-1">
                            <span className="font-bold text-gray-800">Total XP Bonus</span>
                            <span className="font-bold text-green-600">+{(bonuses.reduce((s, b) => s + (b.value || 0), 0)) + itemBonuses.total}%</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>}

            {/* Chat Bubble - absolute positioned */}
            {chatBubble && !(playAnimation && trainingVideoLoaded) && (
              <div className="absolute top-2 right-2 z-10">
                <div
                  className="relative bg-white rounded-[20px] px-4 py-2 shadow-lg max-w-[200px]"
                  style={{
                    border: "3px solid #4a5568",
                    boxShadow: "0 1px 0 #2d3748",
                  }}
                >
                  <p className="text-xs font-medium text-gray-800 text-center break-words whitespace-normal">
                    {chatBubble}
                  </p>
                  {/* Tail - pointing left toward pet */}
                  <div
                    className="absolute left-4 -bottom-3"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "10px solid transparent",
                      borderRight: "10px solid transparent",
                      borderTop: "12px solid #4a5568",
                    }}
                  />
                  <div
                    className="absolute left-4 -bottom-2"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "7px solid transparent",
                      borderRight: "7px solid transparent",
                      borderTop: "9px solid white",
                      marginLeft: "3px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Flying Food Animation - outside overflow-hidden container */}
            {feedAnimation && (
              <>
                {/* Flying Food */}
                <div
                  className={`absolute z-20 text-4xl pointer-events-none ${
                    feedAnimation.phase === "flying"
                      ? "animate-fly-to-pet"
                      : "opacity-0"
                  }`}
                  style={{
                    animation:
                      feedAnimation.phase === "flying"
                        ? "flyToPet 0.7s ease-out forwards"
                        : "none",
                    bottom: "144px",
                    right: "24px",
                  }}
                >
                  {feedAnimation.food ? (
                    <img src={feedAnimation.food} alt="food" className="w-10 h-10 object-contain" />
                  ) : "🍖"}
                </div>

                {/* Particle Burst */}
                {feedAnimation.phase === "burst" && (
                  <>
                    {/* Feed glow is now inside the pet image container */}

                    <div
                      className="absolute z-20 pointer-events-none"
                      style={{ left: "50%", top: "120px" }}
                    >
                      {feedAnimation.particles.map((particle) => (
                        <div
                          key={particle.id}
                          className="absolute"
                          style={{
                            animation: `particle${particle.id} 1.2s ease-out forwards`,
                            marginLeft: "-12px",
                            marginTop: "-12px",
                          }}
                        >
                          {particle.image ? (
                            <img src={particle.image} alt="" className="w-6 h-6 object-contain" />
                          ) : "🍖"}
                        </div>
                      ))}
                    </div>

                    {/* Floating +Energy Text */}
                    <div
                      className="absolute z-20 pointer-events-none font-bold text-3xl"
                      style={{
                        left: "50%",
                        top: "120px",
                        marginLeft: "-60px",
                        width: "120px",
                        textAlign: "center",
                        animation: "floatUpXP 2s ease-out forwards",
                        color: "#f97316",
                        textShadow:
                          "0 0 10px rgba(249, 115, 22, 0.5), 2px 2px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      +{feedAnimation.energyGained} <img src="https://xpclass.vn/xpclass/image/dashboard/energy.svg" alt="energy" className="inline w-5 h-5" />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Play Animation - Floating XP */}
            {playAnimation && (
              <>
                {/* Floating +XP Text - appears after rotation ends */}
                <div
                  className="absolute z-30 pointer-events-none font-bold text-3xl"
                  style={{
                    left: "50%",
                    top: "120px",
                    marginLeft: "-50px",
                    width: "100px",
                    textAlign: "center",
                    animation: "floatUpXP 2s ease-out 4s forwards",
                    opacity: 0,
                    color: "#e7d214",
                    textShadow:
                      "0 0 10px rgba(208, 211, 17, 0.5), 2px 2px 4px rgba(0,0,0,0.3)",
                  }}
                >
                  +{playAnimation.xpGained} XP
                </div>
              </>
            )}

            {/* Pet Image */}
            <div
              ref={petContainerRef}
              className="w-48 h-48 mx-auto mb-4 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform relative"
              onClick={() => setShowPetInfo(true)}
              title="Click to learn about the pet system"
            >
              {/* Aura Pulse Animation (hidden when training video is playing) */}
              {((playAnimation && !trainingVideoLoaded) || feedAnimation?.phase === "burst") && (
                <div
                  className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center"
                >
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${
                        feedAnimation?.phase === "burst"
                          ? "rgba(249, 115, 22, 0.7), rgba(249, 115, 22, 0.3) 50%, transparent 70%"
                          : activePet.rarity === "legendary"
                            ? "rgba(250, 204, 21, 0.7), rgba(250, 204, 21, 0.3) 50%, transparent 70%"
                            : activePet.rarity === "epic"
                              ? "rgba(168, 85, 247, 0.7), rgba(168, 85, 247, 0.3) 50%, transparent 70%"
                              : activePet.rarity === "rare"
                                ? "rgba(59, 130, 246, 0.7), rgba(59, 130, 246, 0.3) 50%, transparent 70%"
                                : activePet.rarity === "uncommon"
                                  ? "rgba(34, 197, 94, 0.7), rgba(34, 197, 94, 0.3) 50%, transparent 70%"
                                  : "rgba(156, 163, 175, 0.7), rgba(156, 163, 175, 0.3) 50%, transparent 70%"
                      })`,
                      filter: "blur(15px)",
                      animation: "auraPulse 6s ease-in-out forwards",
                    }}
                  />
                </div>
              )}
              {/* Rotating background - always visible, hidden when training video is playing */}
              {!(playAnimation && trainingVideoLoaded) && (
                <div
                  className="absolute w-56 h-56 left-1/2 top-1/2 pointer-events-none"
                  style={{
                    animation: "spinBackground 20s linear infinite",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <img
                    src={getRarityAura(activePet.rarity)}
                    alt=""
                    className="w-full h-full object-contain opacity-80"
                  />
                </div>
              )}
              {activePet.image_url ? (
                <img
                  src={getPetImage()}
                  alt={activePet.name}
                  className="w-full h-full object-contain relative z-10"
                  onError={(e) => {
                    // Fallback to base stage image if mood variant doesn't exist
                    const baseImage = (() => {
                      if (
                        activePet.evolution_stages &&
                        activePet.evolution_stage > 0
                      ) {
                        const stage = activePet.evolution_stages.find(
                          (s) => s.stage === activePet.evolution_stage,
                        );
                        return stage?.image_url || activePet.image_url;
                      }
                      return activePet.image_url;
                    })();

                    if (e.target.src !== baseImage) {
                      e.target.src = baseImage;
                    }
                  }}
                />
              ) : (
                <span className="text-6xl relative z-10">
                  🐾
                </span>
              )}
              {/* Training video overlay - uses naming convention: base-training.mp4 */}
              {playAnimation && activePet.image_url && (
                <video
                  src={(() => {
                    // Use base image (not mood variant) to derive training video URL
                    let baseImage = activePet.image_url;
                    if (activePet.evolution_stages && activePet.evolution_stage > 0) {
                      const stage = activePet.evolution_stages.find(s => s.stage === activePet.evolution_stage);
                      if (stage?.image_url) baseImage = stage.image_url;
                    }
                    return baseImage.replace(/\.([^.]+)$/, "-training.mp4");
                  })()}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain z-20"
                  onLoadedData={() => setTrainingVideoLoaded(true)}
                  onEnded={(e) => e.target.currentTime = 0}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    setTrainingVideoLoaded(false);
                  }}
                />
              )}
            </div>

            {/* Chat Button - Above Train Button */}
            <div className="absolute bottom-[272px] right-2 z-10">
              <button
                onClick={() => setShowChat(!showChat)}
                className="w-12 h-12 hover:scale-110 transition-all"
                title="Chat with pet"
              >
                <img
                  src="https://xpclass.vn/xpclass/image/dashboard/pet-chat.svg"
                  alt="Chat with pet"
                  className="w-12 h-12 object-contain drop-shadow-lg"
                />
              </button>
            </div>

            {/* Train Button - Above Food Bowl */}
            <div className="absolute bottom-52 right-2 z-10">
              <button
                onClick={handlePlay}
                disabled={playDisabled}
                className={`w-12 h-12 transition-all relative ${playDisabled ? 'cursor-not-allowed' : 'hover:scale-110'}`}
                title="Train pet"
              >
                <img
                  src="https://xpclass.vn/xpclass/image/dashboard/pet-train.svg"
                  alt="Train pet"
                  className="w-full h-full object-contain drop-shadow-lg"
                />
                {playDisabled && playCooldown > 0 && (
                  <div className="absolute -inset-1 flex items-center justify-center rounded-full bg-black/50">
                    <svg className="absolute w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                      <circle
                        cx="28" cy="28" r="24" fill="none"
                        stroke="#f59e0b" strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 24}`}
                        strokeDashoffset={`${2 * Math.PI * 24 * (1 - playCooldown / 10)}`}
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <span className="text-white font-bold text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {playCooldown}
                    </span>
                  </div>
                )}
              </button>
            </div>

            {/* Food Bowl - Bottom Right */}
            <div className="absolute bottom-36 right-2 z-10">
              <button
                onClick={() => setShowFeedMenu(!showFeedMenu)}
                className="w-12 h-12 hover:scale-110 transition-all"
                title="Feed pet"
              >
                <img
                  src={profile?.active_bowl_url || "https://png.pngtree.com/png-clipart/20220111/original/pngtree-dog-food-bowl-png-image_7072429.png"}
                  alt="Food bowl"
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              </button>

              {/* Feed Menu - appears below the bowl */}
              {showFeedMenu && (
                <>
                  {/* Overlay to close menu when clicking outside */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowFeedMenu(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl p-4 z-20 border-2 border-orange-200 min-w-[200px]">

                  {petFoodItems.length === 0 ? (
                    <p className="text-xs text-gray-500 mb-2">
                      No pet food in inventory
                    </p>
                  ) : (
                    <div className="space-y-2 mb-2 max-h-40 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {petFoodItems.map((item) => {
                        const stats = getFoodStats(item.item.rarity);
                        return (
                          <button
                            key={item.item.id}
                            onClick={() => handleFeed(item.item.id)}
                            className="w-full text-left p-2 rounded hover:bg-orange-50 transition-colors flex items-center gap-2"
                          >
                            {item.item.image_url && (
                              <img src={item.item.image_url} alt={item.item.name} className="w-8 h-8 object-contain flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium truncate">
                                  {item.item.name}
                                </span>
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                  x{item.quantity}
                                </span>
                              </div>
                              <div className="flex gap-3 mt-0.5 text-xs">
                                <span className="text-orange-600">
                                  <img src="https://xpclass.vn/xpclass/image/dashboard/energy.svg" alt="energy" className="inline w-3.5 h-3.5 mr-0.5" />+{stats.energy}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <h2 className="text-2xl font-bold text-gray-800">
                {activePet.nickname || activePet.name}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getRarityColor(activePet.rarity)}`}
              >
                {activePet.rarity.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {activePet.description}
            </p>

            {/* Level & Evolution Stage */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-lg">
                  Level {activePet.level}
                </span>
              </div>
              {activePet.evolution_stage > 0 && (
                <div className="flex items-center gap-1 bg-purple-100 px-3 py-1 rounded-full">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-600">
                    Stage {activePet.evolution_stage}
                  </span>
                </div>
              )}
            </div>

            {/* XP Progress */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Level Progress</span>
                  <span>{activePet.xp % 100}/100 XP</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-gradient-to-r ${getRarityGradient(activePet.rarity)} h-2 rounded-full transition-all`}
                    style={{ width: `${activePet.xp % 100}%` }}
                  />
                </div>
              </div>

              {/* Evolution Progress */}
              {(() => {
                const nextEvolution = getNextEvolution();
                if (nextEvolution?.xp_required) {
                  const progress = Math.min(
                    100,
                    (activePet.xp / nextEvolution.xp_required) * 100,
                  );
                  return (
                    <div>
                      <div className="flex justify-between text-xs text-purple-600 mb-1">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Evolution Stage {nextEvolution.stage}
                        </span>
                        <span>
                          {activePet.xp}/{nextEvolution.xp_required} XP
                        </span>
                      </div>
                      <div className="w-full bg-purple-100 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>

        {/* Pet Actions */}
        <div className="flex-1 p-4 space-y-4">
          {/* Chat Panel */}
          {showChat && (
            <div className="bg-white rounded-xl p-4 border-2 border-pink-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-pink-500" />
                  Chat with {activePet.nickname || activePet.name}
                </h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Messages */}
              <div
                ref={chatContainerRef}
                className="h-48 overflow-y-auto mb-3 space-y-2 p-2 bg-gray-50 rounded-lg"
              >
                {chatMessages.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-4">
                    Say hello to {activePet.nickname || activePet.name}!
                  </p>
                )}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white rounded-br-none"
                          : "bg-pink-100 text-gray-800 rounded-bl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-pink-100 text-gray-800 px-3 py-2 rounded-lg rounded-bl-none">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                    placeholder={
                      (activePet.energy ?? 100) < 10
                        ? "Pet đang mệt..."
                        : `Message ${activePet.nickname || activePet.name}...`
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                    disabled={chatLoading || (activePet.energy ?? 100) < 10}
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={
                      chatLoading ||
                      !chatInput.trim() ||
                      (activePet.energy ?? 100) < 10
                    }
                    className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    <img src="https://xpclass.vn/xpclass/image/dashboard/energy.svg" alt="energy" className="inline w-3.5 h-3.5 mr-0.5" />{activePet.energy ?? 100}/100{" "}
                    {(activePet.energy ?? 100) < 10 && "(Mệt rồi!)"}
                  </span>
                  <span>-5 energy/message</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pet Info Modal */}
      {showPetInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide shadow-2xl" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="sticky top-0 bg-blue-500 text-white p-6 rounded-t-xl flex justify-between items-center">
              <h2 className="text-2xl font-bold">🐾 Pet System Guide</h2>
              <button
                onClick={() => setShowPetInfo(false)}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* How Pets Work */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  How Pets Work
                </h3>
                <p className="text-gray-700 mb-2">
                  Pets are your learning companions that grow alongside you!
                  Take care of them and they&apos;ll boost your XP earnings.
                </p>
              </div>

                            {/* Evolution */}
              <div className="bg-purple-50 rounded-lg p-4">

                {/* Evolution Stages for Current Pet */}
                {activePet?.evolution_stages &&
                activePet.evolution_stages.length > 0 ? (
                  <div className="mb-4">
                    <h5 className="font-bold text-purple-800 mb-4">
                      {activePet.nickname || activePet.name}&apos;s Evolution
                      Path:
                    </h5>

                    {/* All Stages in a Row */}
                    <div className="flex flex-wrap gap-3 justify-center">
                      {/* Base Stage (Stage 0) */}
                      <div
                        className={`bg-white rounded-lg p-3 border-2 flex flex-col items-center w-28 ${
                          activePet.evolution_stage === 0
                            ? "border-purple-500 shadow-md"
                            : "border-gray-200"
                        }`}
                      >
                        {activePet.image_url && (
                          <div className="relative w-16 h-16 mb-2">
                            <img
                              src={activePet.image_url}
                              alt="Base form"
                              className="w-16 h-16 object-contain rounded select-none pointer-events-none"
                              onContextMenu={(e) => e.preventDefault()}
                              draggable="false"
                            />
                            <div
                              className="absolute inset-0 bg-transparent"
                              onContextMenu={(e) => e.preventDefault()}
                            />
                          </div>
                        )}
                        <span className="font-semibold text-gray-800 text-xs text-center">
                          Base
                        </span>
                        {activePet.evolution_stage === 0 && (
                          <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full mt-1">
                            Current
                          </span>
                        )}
                      </div>

                      {/* Evolution Stages */}
                      {activePet.evolution_stages.map((stage) => {
                        const isCurrent =
                          activePet.evolution_stage === stage.stage;
                        const isUnlocked =
                          activePet.evolution_stage >= stage.stage;
                        const isLocked = !isUnlocked;

                        return (
                          <div
                            key={stage.stage}
                            className={`bg-white rounded-lg p-3 border-2 flex flex-col items-center w-28 ${
                              isCurrent
                                ? "border-purple-500 shadow-md"
                                : isUnlocked
                                  ? "border-green-300"
                                  : "border-gray-400"
                            }`}
                          >
                            {stage.image_url && (
                              <div className="relative w-16 h-16 mb-2">
                                <img
                                  src={stage.image_url}
                                  alt={stage.name || `Stage ${stage.stage}`}
                                  className={`w-16 h-16 object-contain rounded select-none pointer-events-none ${
                                    isLocked
                                      ? "filter brightness-[0.2] contrast-[150%]"
                                      : ""
                                  }`}
                                  onContextMenu={(e) => e.preventDefault()}
                                  draggable="false"
                                />
                                <div
                                  className="absolute inset-0 bg-transparent"
                                  onContextMenu={(e) => e.preventDefault()}
                                />
                              </div>
                            )}
                            <span
                              className={`font-semibold text-xs text-center ${isLocked ? "text-gray-400" : "text-gray-800"}`}
                            >
                              {isLocked
                                ? "???"
                                : stage.name || `Stage ${stage.stage}`}
                            </span>
                            {stage.xp_required && (
                              <p className="text-xs text-gray-500 text-center mt-1">
                                {stage.xp_required} XP
                              </p>
                            )}
                            {isCurrent && (
                              <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full mt-1">
                                Current
                              </span>
                            )}
                            {isUnlocked && !isCurrent && (
                              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full mt-1">
                                Unlocked
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Progress bar for next stage (if locked) */}
                    {(() => {
                      const nextStage = activePet.evolution_stages.find(
                        (s) => s.stage === activePet.evolution_stage + 1,
                      );
                      if (nextStage?.xp_required) {
                        const progress = Math.min(
                          100,
                          (activePet.xp / nextStage.xp_required) * 100,
                        );
                        return (
                          <div className="mt-4">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Progress to Next Stage</span>
                              <span>
                                {activePet.xp} / {nextStage.xp_required} XP
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <div className="bg-white rounded p-3 text-sm text-gray-700 mt-3">
                    💡 <span className="font-semibold">Note:</span> This pet
                    doesn&apos;t have evolution stages, but it&apos;s still a
                    great companion!
                  </div>
                )}
              </div>

              {/* Bonuses */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 mb-3">⭐ Pet Bonuses</h4>
                <p className="text-gray-700 mb-2">
                  Your pet gives you XP bonuses:
                </p>
                <div className="space-y-2">
                  <div className="font-semibold text-sm text-gray-800">
                    Base Rarity Bonuses:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-100 px-3 py-2 rounded">
                      Common:{" "}
                      <span className="font-bold text-gray-600">+5% XP</span>
                    </div>
                    <div className="bg-green-100 px-3 py-2 rounded">
                      Uncommon:{" "}
                      <span className="font-bold text-green-600">+10% XP</span>
                    </div>
                    <div className="bg-blue-100 px-3 py-2 rounded">
                      Rare:{" "}
                      <span className="font-bold text-blue-600">+15% XP</span>
                    </div>
                    <div className="bg-purple-100 px-3 py-2 rounded">
                      Epic:{" "}
                      <span className="font-bold text-purple-600">+20% XP</span>
                    </div>
                    <div className="bg-yellow-100 px-3 py-2 rounded col-span-2">
                      Legendary:{" "}
                      <span className="font-bold text-yellow-600">+25% XP</span>
                    </div>
                  </div>
                  <div className="bg-purple-100 px-3 py-2 rounded mt-2">
                    <span className="font-semibold text-purple-800">
                      Evolution Bonus:
                    </span>{" "}
                    <span className="font-bold text-purple-700">
                      +5% XP per stage
                    </span>
                    <div className="text-xs text-purple-600 mt-1">
                      Stage 0: +0% • Stage 1: +5% • Stage 2: +10% • Stage 3:
                      +15%
                    </div>
                  </div>
                </div>
              </div>

              {/* Energy */}
              <div className="bg-orange-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-1"><img src="https://xpclass.vn/xpclass/image/dashboard/energy.svg" alt="energy" className="w-5 h-5" /> Energy System</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="bg-white rounded p-3 space-y-1">
                    <div className="flex justify-between">
                      <span>Training</span>
                      <span className="font-bold text-orange-600">-10 energy</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ask pet (in exercises)</span>
                      <span className="font-bold text-orange-600">-5 energy</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Chat message</span>
                      <span className="font-bold text-orange-600">-5 energy</span>
                    </div>
                  </div>
                  <div className="bg-orange-100 px-3 py-2 rounded mt-2">
                    <span className="font-semibold text-orange-800">Auto Regeneration:</span>{" "}
                    <span className="font-bold text-orange-700">+5 energy every 15 minutes</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    You can also feed your pet to restore energy instantly!
                  </p>
                </div>
              </div>

            </div>

            <div className="sticky bottom-0 bg-gray-100 p-4 rounded-b-xl">
              <button
                onClick={() => setShowPetInfo(false)}
                className="w-full bg-blue-500 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-lg transition-all"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Picker Modal */}
      {showGame === 'picker' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowGame(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-1">Choose Training Game</h3>
            <p className="text-sm text-gray-500 mb-5">Pick a mini-game to train {activePet.nickname || activePet.name}!</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowGame('scramble')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all group"
              >
                <span className="text-4xl group-hover:scale-110 transition-transform">🔤</span>
                <span className="font-bold text-gray-800">Word Scramble</span>
                <span className="text-xs text-gray-500">Pop the bubbles!</span>
              </button>
              <button
                onClick={() => setShowGame('whackmole')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-green-200 hover:border-green-400 hover:bg-green-50 transition-all group"
              >
                <span className="text-4xl group-hover:scale-110 transition-transform">🐹</span>
                <span className="font-bold text-gray-800">Whack-a-Mole</span>
                <span className="text-xs text-gray-500">Whack the right word!</span>
              </button>
            </div>
            <button
              onClick={() => setShowGame(null)}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Catch Mini-Game */}
      {showGame === 'catch' && (
        <PetCatchGame
          bowlImageUrl={profile?.active_bowl_url || "https://png.pngtree.com/png-clipart/20220111/original/pngtree-dog-food-bowl-png-image_7072429.png"}
          petName={activePet.nickname || activePet.name}
          onGameEnd={(score) => handleGameEnd(score, 'catch')}
          onClose={() => setShowGame(null)}
        />
      )}

      {/* Flappy Pet Mini-Game */}
      {showGame === 'flappy' && (
        <PetFlappyGame
          petImageUrl={(() => {
            // Use base image (not mood variant) for the game so it always loads
            let baseImage = activePet.image_url;
            if (activePet.evolution_stages && activePet.evolution_stage > 0) {
              const stage = activePet.evolution_stages.find(s => s.stage === activePet.evolution_stage);
              if (stage?.image_url) baseImage = stage.image_url;
            }
            return baseImage;
          })()}
          petName={activePet.nickname || activePet.name}
          onGameEnd={(score) => handleGameEnd(score, 'flappy')}
          onClose={() => setShowGame(null)}
        />
      )}

      {/* Word Scramble Mini-Game */}
      {showGame === 'scramble' && (
        <PetWordScramble
          petImageUrl={(() => {
            // Use base image (not mood variant) for the game so it always loads
            let baseImage = activePet.image_url;
            if (activePet.evolution_stages && activePet.evolution_stage > 0) {
              const stage = activePet.evolution_stages.find(s => s.stage === activePet.evolution_stage);
              if (stage?.image_url) baseImage = stage.image_url;
            }
            return baseImage;
          })()}
          petName={activePet.nickname || activePet.name}
          onGameEnd={(score) => handleGameEnd(score, 'scramble')}
          onClose={() => setShowGame(null)}
        />
      )}

      {/* Whack-a-Mole Mini-Game */}
      {showGame === 'whackmole' && (
        <PetWhackMole
          petImageUrl={(() => {
            let baseImage = activePet.image_url;
            if (activePet.evolution_stages && activePet.evolution_stage > 0) {
              const stage = activePet.evolution_stages.find(s => s.stage === activePet.evolution_stage);
              if (stage?.image_url) baseImage = stage.image_url;
            }
            return baseImage;
          })()}
          petName={activePet.nickname || activePet.name}
          onGameEnd={(score) => handleGameEnd(score, 'whackmole')}
          onClose={() => setShowGame(null)}
        />
      )}
    </div>
  );
};

export default PetDisplay;
