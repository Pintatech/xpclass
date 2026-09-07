import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_CHARACTER_ID, EVENT_CHARACTERS, getCharacter } from '../config/eventCharacter'

const KEY = 'xpclass_event_character'
const CHANGED = 'xpclass:event-character-changed'

// Keyed per user: classroom machines get shared, and one student's pick
// shouldn't become the next student's.
const storageKey = (userId) => (userId ? `${KEY}:${userId}` : KEY)

const read = (userId) => {
  try {
    const saved = localStorage.getItem(storageKey(userId))
    return saved && EVENT_CHARACTERS[saved] ? saved : DEFAULT_CHARACTER_ID
  } catch {
    return DEFAULT_CHARACTER_ID
  }
}

/**
 * The character a user picked for the event hero.
 *
 * Stored in localStorage rather than on the profile because there are no
 * migrations in this repo to add a column with — swapping `read`/`chooseCharacter`
 * for a profiles field is the only change needed if this should follow a user
 * between devices.
 */
export const useEventCharacter = (userId) => {
  const [characterId, setCharacterId] = useState(() => read(userId))

  useEffect(() => {
    setCharacterId(read(userId))
  }, [userId])

  // The hero and the sprite lab can both be mounted; keep them in step.
  useEffect(() => {
    const sync = () => setCharacterId(read(userId))
    window.addEventListener(CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [userId])

  const chooseCharacter = useCallback((id) => {
    if (!EVENT_CHARACTERS[id]) return
    try {
      localStorage.setItem(storageKey(userId), id)
    } catch {
      // Private mode / storage disabled — the pick just won't survive a reload.
    }
    window.dispatchEvent(new CustomEvent(CHANGED))
  }, [userId])

  return { characterId, character: getCharacter(characterId), chooseCharacter }
}

export default useEventCharacter
