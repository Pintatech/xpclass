import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Image as ImageIcon, Loader2, ShoppingBag, X } from 'lucide-react'
import { supabase } from '../../../supabase/client'
import { defaultBackground } from './petHomeUtils'

const bgUrlOf = (item) => item?.item_data?.background_url || item?.image_url || null

/**
 * Pick the home background. Tapping one shows it on the home right away (preview); "Use this" saves it.
 * It is a low sheet so the home stays visible above it.
 */
const BackgroundPicker = ({ userId, currentUrl, previewUrl, onPreview, onApply, onClose, onShop }) => {
  // Loaded each time the picker opens (two small reads), so a background just bought in the Shop shows up.
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    let alive = true
    ;(async () => {
      try {
        const { data: purchases, error: e1 } = await supabase.from('user_purchases').select('item_id').eq('user_id', userId)
        if (e1) throw e1
        const ids = (purchases || []).map((p) => p.item_id)
        let list = []
        if (ids.length) {
          const { data, error: e2 } = await supabase
            .from('shop_items')
            .select('id, name, image_url, item_data')
            .eq('category', 'background')
            .eq('is_active', true)
            .in('id', ids)
          if (e2) throw e2
          list = data || []
        }
        if (alive) setItems(list)
      } catch (err) {
        console.error('Error loading backgrounds:', err)
        if (alive) {
          setError('Could not load your backgrounds')
          setItems([])
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // null = the default meadow. `chosen` is what the home shows now.
  const chosen = previewUrl !== undefined ? previewUrl : currentUrl || null
  const changed = (chosen || null) !== (currentUrl || null)
  const options = [{ id: 'default', name: 'Meadow', url: null, thumb: defaultBackground() }, ...(items || []).map((it) => ({ id: it.id, name: it.name, url: bgUrlOf(it), thumb: it.image_url || bgUrlOf(it) }))]

  const apply = async () => {
    setSaving(true)
    const ok = await onApply(chosen || null)
    setSaving(false)
    if (ok) onClose()
  }

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[205] flex justify-center px-0 sm:px-4 sm:pb-4" role="dialog" aria-label="Home background">
      <div className="ph-sheet-enter w-full max-w-2xl rounded-t-3xl bg-white p-4 shadow-[0_-12px_40px_rgba(15,23,42,0.3)] sm:rounded-3xl">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-800">Home background</h2>
            <p className="text-xs font-semibold text-slate-500">Tap one to try it on your home</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="ph-strip -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {options.map((o) => {
            const on = (chosen || null) === (o.url || null)
            const current = (currentUrl || null) === (o.url || null)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onPreview(o.url)}
                className={`relative h-[84px] w-[132px] shrink-0 overflow-hidden rounded-2xl bg-slate-200 bg-cover bg-center ring-offset-2 transition ${
                  on ? 'ring-4 ring-indigo-500' : 'ring-1 ring-slate-200 hover:ring-slate-300'
                }`}
                style={{ backgroundImage: o.thumb ? `url("${o.thumb}")` : undefined }}
              >
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-3 text-left text-[11px] font-extrabold text-white">
                  {o.name}
                </span>
                {current && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-indigo-600 shadow">In use</span>
                )}
                {on && (
                  <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white shadow">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            )
          })}
          {items === null &&
            Array.from({ length: 3 }, (_, i) => <div key={i} className="h-[84px] w-[132px] shrink-0 animate-pulse rounded-2xl bg-slate-100" />)}
          <button
            type="button"
            onClick={onShop}
            className="flex h-[84px] w-[132px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-xs font-extrabold text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
          >
            <ShoppingBag className="h-5 w-5" />
            More in Shop
          </button>
        </div>
        {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-200">
            {changed ? 'Cancel' : 'Close'}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!changed || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-600 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Use this
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default BackgroundPicker
