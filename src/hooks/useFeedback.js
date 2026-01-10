import React, { useState } from 'react'
import confetti from 'canvas-confetti'

/**
 * Custom hook for handling feedback (memes + sounds) for exercises
 * @returns {Object} { currentMeme, showMeme, playFeedback, playCelebration, passGif }
 */
export const useFeedback = () => {
  const [currentMeme, setCurrentMeme] = useState('')
  const [showMeme, setShowMeme] = useState(false)
  const [passGif, setPassGif] = useState('')

  // Correct answer memes
  const correctMemes = [
    'https://xpclass.vn/leaderboard/correct_image/plus12.png',
    'https://xpclass.vn/leaderboard/correct_image/plus13.png',
    'https://xpclass.vn/leaderboard/correct_image/plus14.png',
    'https://xpclass.vn/leaderboard/correct_image/plus32.png',
    'https://xpclass.vn/leaderboard/correct_image/plus34.png',
    'https://xpclass.vn/leaderboard/correct_image/drake%20yes.jpg',
    'https://xpclass.vn/leaderboard/correct_image/tapping%20head.jpg'
  ]

  // Wrong answer memes
  const wrongMemes = [
    'https://xpclass.vn/leaderboard/wrong_image/Black-Girl-Wat.png',
    'https://xpclass.vn/leaderboard/wrong_image/drake.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/leo%20laugh.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/nick%20young.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/tom.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/you-guys-are-getting-paid.jpg'
  ]

  // Pass celebration GIFs
  const passGifs = [
    "https://xpclass.vn/leaderboard/end_gif/end 1.gif",
    "https://xpclass.vn/leaderboard/end_gif/end 2.gif",
    "https://xpclass.vn/leaderboard/end_gif/end 3.gif",
    "https://xpclass.vn/leaderboard/end_gif/end 4.gif",
    "https://xpclass.vn/leaderboard/end_gif/end 5.gif",
    "https://xpclass.vn/leaderboard/end_gif/end 6.gif",
    "https://xpclass.vn/leaderboard/end_gif/end 7.gif",
    "https://xpclass.vn/leaderboard/end_gif/end 8.gif"
  ]

  // Sound URLs
  const correctSounds = [
    'https://xpclass.vn/leaderboard/sound/lingo.mp3'
  ]

  const wrongSounds = [
    'https://xpclass.vn/leaderboard/sound/Bruh.mp3'
  ]

  /**
   * Play feedback (meme + sound) for correct or wrong answer
   * @param {boolean} isCorrect - Whether the answer is correct
   */
  const playFeedback = (isCorrect) => {
    // Select random meme
    const memes = isCorrect ? correctMemes : wrongMemes
    const randomMeme = memes[Math.floor(Math.random() * memes.length)]

    // Select random sound
    const sounds = isCorrect ? correctSounds : wrongSounds
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)]

    // Show meme
    setCurrentMeme(randomMeme)
    setShowMeme(true)

    // Play sound
    try {
      const audio = new Audio(randomSound)
      audio.volume = 0.5
      audio.play().catch(e => console.log('Could not play sound:', e))
    } catch (e) {
      console.log('Sound not supported:', e)
    }

    // Hide meme after 2 seconds
    setTimeout(() => {
      setShowMeme(false)
    }, 2000)
  }

  /**
   * Play celebration (confetti + sound + GIF) when passing the exercise
   */
  const playCelebration = () => {
    // Play confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    })

    // Play celebration sound
    const audio = new Audio('https://xpclass.vn/xpclass/sound/yayy.mp3')
    audio.play().catch(err => console.log('Audio play failed:', err))

    // Show random celebration GIF
    const randomGif = passGifs[Math.floor(Math.random() * passGifs.length)]
    setPassGif(randomGif)
  }

  return { currentMeme, showMeme, playFeedback, playCelebration, passGif }
}
