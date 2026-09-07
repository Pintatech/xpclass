// Natural dimensions of sprite sheets, keyed by URL.
//
// Sheets are a few KB each and get remounted a lot (hero, lab, previews), so
// only the first mount decodes one. It lives outside SpriteAnimation.jsx
// because a file that exports both a component and helpers loses fast refresh.
const dimsCache = new Map()

export const getSheetDims = (src) => (src ? dimsCache.get(src) || null : null)

export const hasSheetDims = (src) => dimsCache.has(src)

export const setSheetDims = (src, dims) => dimsCache.set(src, dims)

/**
 * Warm the cache for sheets a component is about to switch between.
 *
 * Without this, the first click after mount swaps to a sheet whose size isn't
 * known yet, and the frame box can't be drawn until it loads.
 */
export const preloadSheets = (urls) => {
  for (const url of urls) {
    if (!url || dimsCache.has(url)) continue
    const img = new Image()
    img.onload = () => dimsCache.set(url, { width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => dimsCache.set(url, { width: 0, height: 0, error: true })
    img.src = url
  }
}
