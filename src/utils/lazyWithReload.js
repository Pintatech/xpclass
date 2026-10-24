import { lazy } from 'react'

const RELOAD_KEY = 'chunk-reload-at'

// React.lazy that survives deploys: a tab opened before a deploy still points at
// the old chunk hashes, which no longer exist. On a failed import, reload once to
// pick up the new index.html (guarded so a real outage can't loop reloads).
export default function lazyWithReload(importer) {
  return lazy(async () => {
    try {
      return await importer()
    } catch (error) {
      let last = 0
      try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0 } catch { /* storage blocked */ }
      if (Date.now() - last > 10000) {
        try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* storage blocked */ }
        window.location.reload()
        return new Promise(() => {}) // keep the fallback up until the reload happens
      }
      throw error
    }
  })
}
