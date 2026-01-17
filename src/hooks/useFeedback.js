import React, { useState } from "react";
import confetti from "canvas-confetti";

/**
 * Custom hook for handling feedback (memes + sounds) for exercises
 * @returns {Object} { currentMeme, showMeme, playFeedback, playCelebration, passGif }
 */
export const useFeedback = () => {
  const [currentMeme, setCurrentMeme] = useState("");
  const [showMeme, setShowMeme] = useState(false);
  const [passGif, setPassGif] = useState("");

  // Correct answer memes
  const correctMemes = [
    'https://xpclass.vn/xpclass/meme/right_cat_thumb_up.png',
'https://xpclass.vn/xpclass/meme/right_drake_yes.jpg',
'https://xpclass.vn/xpclass/meme/right_kid_thumb_up.png',
'https://xpclass.vn/xpclass/meme/right_Leonardo-Dicaprio-Cheers.jpg',
'https://xpclass.vn/xpclass/meme/right_not_bad_kid.png',
'https://xpclass.vn/xpclass/meme/right_pooh.PNG',
'https://xpclass.vn/xpclass/meme/right_Satisfied-Seal.jpg',
'https://xpclass.vn/xpclass/meme/right_success_kid.png',
'https://xpclass.vn/xpclass/meme/right_tapping_head.jpg'

  ];

  // Wrong answer memes
  const wrongMemes = [
    'https://xpclass.vn/xpclass/meme/wrong_0_day.jpg',
'https://xpclass.vn/xpclass/meme/wrong_always_has_been.jpg',
'https://xpclass.vn/xpclass/meme/wrong_batman_slap.jpg',
'https://xpclass.vn/xpclass/meme/wrong_bf.jpg',
'https://xpclass.vn/xpclass/meme/wrong_Black-Girl-Wat.png',
'https://xpclass.vn/xpclass/meme/wrong_drake.jpg',
'https://xpclass.vn/xpclass/meme/wrong_Futurama-Fry.jpg',
'https://xpclass.vn/xpclass/meme/wrong_leo_laugh.jpg',
'https://xpclass.vn/xpclass/meme/wrong_megamind.webp',
'https://xpclass.vn/xpclass/meme/wrong_Mocking-Spongebob.jpg',
'https://xpclass.vn/xpclass/meme/wrong_nick_young.jpg',
'https://xpclass.vn/xpclass/meme/wrong_pooh.PNG',
'https://xpclass.vn/xpclass/meme/wrong_tom_confused.jpg',
'https://xpclass.vn/xpclass/meme/wrong_you-guys-are-getting-paid.jpg',

  ];

  // Pass celebration GIFs
  const passGifs = [
    "https://xpclass.vn/leaderboard/end_gif/end%201.gif",
    "https://xpclass.vn/leaderboard/end_gif/end%202.gif",
    "https://xpclass.vn/leaderboard/end_gif/end%203.gif",
    "https://xpclass.vn/leaderboard/end_gif/end%204.gif",
    "https://xpclass.vn/leaderboard/end_gif/end%205.gif",
    "https://xpclass.vn/leaderboard/end_gif/end%206.gif",
    "https://xpclass.vn/leaderboard/end_gif/end%207.gif",
    "https://xpclass.vn/leaderboard/end_gif/end%208.gif"
  ];

  // Sound URLs
  const correctSounds = ["https://xpclass.vn/xpclass/sound/correct.mp3"];

  const wrongSounds = ["https://xpclass.vn/leaderboard/sound/Bruh.mp3",
    "https://xpclass.vn/xpclass/sound/error.mp3",
    "https://xpclass.vn/xpclass/sound/huh.mp3",
    "https://xpclass.vn/xpclass/sound/vineboom.mp3"
  ];

  /**
   * Play feedback (meme + sound) for correct or wrong answer
   * @param {boolean} isCorrect - Whether the answer is correct
   */
  const playFeedback = (isCorrect) => {
    // Select random meme
    const memes = isCorrect ? correctMemes : wrongMemes;
    const randomMeme = memes[Math.floor(Math.random() * memes.length)];

    // Select random sound
    const sounds = isCorrect ? correctSounds : wrongSounds;
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];

    // Show meme
    setCurrentMeme(randomMeme);
    setShowMeme(true);

    // Play sound
    try {
      const audio = new Audio(randomSound);
      audio.volume = 0.5;
      audio.play().catch((e) => console.log("Could not play sound:", e));
    } catch (e) {
      console.log("Sound not supported:", e);
    }

    // Hide meme after 2 seconds
    setTimeout(() => {
      setShowMeme(false);
    }, 2000);
  };

  /**
   * Play celebration (confetti + sound + GIF) when passing the exercise
   */
  const playCelebration = () => {
    // Play confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Play celebration sound
    const audio = new Audio("https://xpclass.vn/xpclass/sound/victory.mp3");
    audio.play().catch((err) => console.log("Audio play failed:", err));

    // Show random celebration GIF
    const randomGif = passGifs[Math.floor(Math.random() * passGifs.length)];
    setPassGif(randomGif);
  };

  return { currentMeme, showMeme, playFeedback, playCelebration, passGif };
};
