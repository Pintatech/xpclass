import { useEffect, useState } from 'react'

/** True while the media query matches (re-renders when it changes). Its own file so bits.jsx keeps fast refresh. */
export const useMedia = (query) => {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [query])
  return matches
}
