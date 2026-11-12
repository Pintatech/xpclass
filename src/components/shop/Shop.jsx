// Shop (/shop): loads what is on sale, buys and equips. Everything on screen is drawn by ShopParts.jsx; the looks are
// Shop.css plus the profile's pieces (sheet, toast, placeholders) from Profile.css.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Compass, Egg, Frame, Hammer, Image as ImageIcon, Rocket, Sailboat, Smile, Soup } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { usePet } from '../../hooks/usePet'
import { useInventory } from '../../hooks/useInventory'
import { assetUrl } from '../../hooks/useBranding'
import { RARITY_ORDER } from '../pet/home/petHomeUtils'
import { Toast } from '../profile/parts/bits'
import { CategoryTabs, CollectionChips, ItemCard, ItemSheet, ShopEmpty, ShopError, ShopSkeleton, ShopTopBar, StockCard } from './ShopParts'
import '../profile/Profile.css'
import './Shop.css'

// ---- What the shop sells ----

// The tabs, in order. `stock` tabs sell collectible_items (balls and tickets, eggs) that pile up in the inventory; the
// others sell shop_items of that category, each bought once. The Egg tab stays hidden unless the page was opened with
// ?tab=egg (the "Egg Shop" button on the profile).
const CATEGORIES = [
  { key: 'avatar', label: 'Avatar', icon: Smile, tone: 'sky' },
  { key: 'ball', label: 'Adventure', icon: Compass, tone: 'rose', stock: true },
  { key: 'egg', label: 'Egg', icon: Egg, tone: 'pink', stock: true, hidden: true },
  { key: 'frame', label: 'Frame', icon: Frame, tone: 'amber' },
  { key: 'background', label: 'Background', icon: ImageIcon, tone: 'indigo' },
  { key: 'pet', label: 'Pet bowl', icon: Soup, tone: 'emerald' },
  { key: 'spaceship', label: 'Spaceship', icon: Rocket, tone: 'violet' },
  { key: 'hammer', label: 'Hammer', icon: Hammer, tone: 'orange' },
  { key: 'boat', label: 'Boat', icon: Sailboat, tone: 'cyan' },
]

// What wearing an item saves on the profile. `field` is the one that tells the item is worn; it is also checked after
// saving, because updateProfile reports a failed equipment save only by leaving the field out.
const EQUIP = {
  avatar: { field: 'avatar_url', save: (it) => ({ avatar_url: it.item_data?.avatar_url || it.image_url }) },
  frame: {
    field: 'active_title',
    save: (it) => ({ active_title: it.image_url, active_frame_ratio: it.item_data?.avatar_ratio || 66, hide_frame: false }),
  },
  background: { field: 'active_background_url', save: (it) => ({ active_background_url: it.item_data?.background_url || it.image_url }) },
  pet: { field: 'active_bowl_url', save: (it) => ({ active_bowl_url: it.item_data?.bowl_url || it.image_url }) },
  spaceship: {
    field: 'active_spaceship_url',
    save: (it) => ({ active_spaceship_url: it.image_url, active_spaceship_laser: it.item_data?.laser_color || null }),
  },
  boat: { field: 'active_boat_url', save: (it) => ({ active_boat_url: it.image_url }) },
  hammer: { field: 'active_hammer_url', save: (it) => ({ active_hammer_url: it.image_url }) },
}

const isWornBy = (item, profile) => {
  const rule = EQUIP[item.category]
  if (!rule || !profile) return false
  const value = rule.save(item)[rule.field]
  return !!value && profile[rule.field] === value
}

// ---- Helpers ----

const EMPTY_SHOP = { items: [], purchases: [], eggs: [], balls: [] }

// item_data is jsonb, but old rows may hold it as a JSON string.
const parseData = (data) => {
  if (data && typeof data === 'object') return data
  if (typeof data === 'string') {
    try {
      const value = JSON.parse(data)
      return value && typeof value === 'object' ? value : {}
    } catch {
      return {}
    }
  }
  return {}
}

const priceKind = (item) => (item.price_type === 'xp' ? 'xp' : 'gems')
const balanceOf = (profile, kind) => Number(kind === 'xp' ? profile?.xp : profile?.gems) || 0

// XP items first, then the cheapest first (the order the shop has always used).
const byShopOrder = (a, b) => {
  const ka = priceKind(a)
  const kb = priceKind(b)
  if (ka !== kb) return ka === 'xp' ? -1 : 1
  return (Number(a.price) || 0) - (Number(b.price) || 0)
}

// Items of one avatar_group share a card (variants in name order); the other items get a card each.
const groupItems = (items) => {
  const groups = []
  const byName = new Map()
  for (const item of items) {
    const name = item.item_data?.avatar_group
    if (!name) {
      groups.push({ key: `i:${item.id}`, variants: [item] })
      continue
    }
    let group = byName.get(name)
    if (!group) {
      group = { key: `g:${name}`, variants: [] }
      byName.set(name, group)
      groups.push(group)
    }
    group.variants.push(item)
  }
  for (const group of groups) group.variants.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
  return groups.sort((a, b) => byShopOrder(a.variants[0], b.variants[0]))
}

// Where a card goes: 0 = it holds the item in use, 1 = the student has one of its items, 2 = not bought yet.
const rankOf = (group, owned, profile) =>
  group.variants.some((v) => isWornBy(v, profile)) ? 0 : group.variants.some((v) => owned.has(v.id)) ? 1 : 2

// PostgREST answers PGRST202 for a function it does not know (add_buy_shop_item.sql not run yet).
const isMissingFunction = (error) => error?.code === 'PGRST202' || error?.code === '42883'

// The words of a refused ball or egg purchase, when they are meant for people (not a database error).
const friendlyRefusal = (message, currency) => {
  if (/not enough|insufficient|không đủ/i.test(message || '')) return currency === 'xp' ? 'Chưa đủ XP' : 'Chưa đủ gem'
  if (message && message.length <= 60 && !/function|permission|violat|fetch|network|syntax|relation|column|null value|jwt/i.test(message)) {
    return message
  }
  return 'Chưa mua được. Thử lại nhé!'
}

const playBuySound = () => {
  try {
    new Audio(assetUrl('/sound/shop-purchase.mp3')).play().catch(() => {})
  } catch {
    /* no audio on this device */
  }
}

const Shop = () => {
  const [params, setParams] = useSearchParams()
  const { user, profile, updateProfile, fetchUserProfile } = useAuth()
  const { spendGems, spendXP } = useProgress()
  const { buyEgg, buyBall } = usePet()
  const { inventory, fetchInventory, incrementNewCount } = useInventory()
  const userId = user?.id

  const [shop, setShop] = useState(EMPTY_SHOP)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [sheet, setSheet] = useState(null) // { type: 'item', groupKey, id } | { type: 'stock', id }
  const [picked, setPicked] = useState({}) // avatar group -> the variant its card shows
  const [collectionPick, setCollectionPick] = useState({ tab: null, name: 'all' })
  const [busy, setBusy] = useState(null) // the action being saved: buy:<id>, stock:<id>:<currency>, equip:<id>, frame
  const [pop, setPop] = useState(null) // the item just bought (its picture bounces)
  const [toast, setToast] = useState(null)
  const busyRef = useRef(null)
  const loadRef = useRef(0)
  const toastTimer = useRef(0)
  const popTimer = useRef(0)

  const showToast = useCallback((text, good = false) => {
    clearTimeout(toastTimer.current)
    setToast({ text, good, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const celebrate = useCallback((id) => {
    clearTimeout(popTimer.current)
    setPop(null)
    // A frame later, so buying the same ball twice in a row bounces it again.
    requestAnimationFrame(() => {
      setPop(id)
      popTimer.current = setTimeout(() => setPop(null), 900)
    })
  }, [])

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current)
      clearTimeout(popTimer.current)
    },
    []
  )

  // ---- Loading ----

  // Everything at once. Only the newest load may fill the page. A refresh that fails leaves the shop as it was; only
  // a first load that fails shows the error card (with "Thử lại").
  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!userId) return
      const id = ++loadRef.current
      if (!quiet) setStatus((s) => (s === 'ready' ? s : 'loading'))
      try {
        const [items, purchases, eggs, balls] = await Promise.all([
          supabase.from('shop_items').select('*').eq('is_active', true).order('price'),
          supabase.from('user_purchases').select('item_id').eq('user_id', userId),
          supabase.from('collectible_items').select('*').eq('item_type', 'egg').eq('is_active', true).order('sort_order', { ascending: true }),
          supabase.from('collectible_items').select('*').in('item_type', ['ball', 'ticket']).eq('is_active', true).order('sort_order', { ascending: true }),
        ])
        const failed = [items, purchases, eggs, balls].find((r) => r.error)
        if (failed) throw failed.error
        if (id !== loadRef.current) return
        setShop({
          items: (items.data || []).map((it) => ({ ...it, item_data: parseData(it.item_data) })),
          purchases: (purchases.data || []).map((p) => p.item_id),
          eggs: eggs.data || [],
          balls: balls.data || [],
        })
        setStatus('ready')
      } catch (err) {
        console.error('Error loading the shop:', err)
        if (id === loadRef.current) setStatus((s) => (s === 'ready' ? s : 'error'))
      }
    },
    [userId]
  )

  useEffect(() => {
    setSheet(null)
    load()
  }, [load])

  const retry = () => {
    setStatus('loading')
    load()
  }

  const owned = useMemo(() => new Set(shop.purchases), [shop.purchases])
  const markOwned = useCallback((id) => setShop((s) => (s.purchases.includes(id) ? s : { ...s, purchases: [...s.purchases, id] })), [])

  // How many of each ball, ticket and egg the student has (the inventory the whole app keeps).
  const qtyById = useMemo(() => {
    const map = new Map()
    for (const row of inventory || []) {
      const id = row.item?.id ?? row.item_id
      if (id) map.set(id, (map.get(id) || 0) + (Number(row.quantity) || 0))
    }
    return map
  }, [inventory])

  // ---- Tab (kept in the address as ?tab=, so a reload or a link opens the same one) ----

  const urlTab = params.get('tab')
  const [eggShown, setEggShown] = useState(urlTab === 'egg')
  useEffect(() => {
    if (urlTab === 'egg') setEggShown(true)
  }, [urlTab])
  const tabs = useMemo(() => CATEGORIES.filter((c) => !c.hidden || (c.key === 'egg' && eggShown)), [eggShown])
  const tab = tabs.find((c) => c.key === urlTab) || tabs[0]
  const pickTab = useCallback(
    (key) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('tab', key)
          return next
        },
        { replace: true }
      ),
    [setParams]
  )

  // ---- What the tab shows ----

  const tabItems = useMemo(() => (tab.stock ? [] : shop.items.filter((it) => it.category === tab.key).sort(byShopOrder)), [shop.items, tab])
  const collections = useMemo(() => [...new Set(tabItems.map((it) => it.item_data?.collection).filter(Boolean))], [tabItems])
  const collection = collectionPick.tab === tab.key && collections.includes(collectionPick.name) ? collectionPick.name : 'all'
  const groups = useMemo(
    () => groupItems(collection === 'all' ? tabItems : tabItems.filter((it) => it.item_data?.collection === collection)),
    [tabItems, collection]
  )
  const stockList = useMemo(() => {
    const list = tab.key === 'ball' ? shop.balls : tab.key === 'egg' ? shop.eggs : []
    return [...list].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))
  }, [tab.key, shop.balls, shop.eggs])

  // Bought first: the item in use, then the others the student has, then the rest in shop order. The order is taken
  // when a tab or collection opens (or the list loads), not after each purchase or equip, so a card never jumps away
  // under the student's finger; it moves up the next time the tab is opened. (Worked out during render, the way React
  // suggests for a value kept from an earlier render, so the first paint is already in order.)
  const [order, setOrder] = useState({ tabItems: null, collection: null, withProfile: false, rank: null })
  let rank = order.rank
  if (status === 'ready' && (order.tabItems !== tabItems || order.collection !== collection || order.withProfile !== !!profile)) {
    rank = new Map(groups.map((g) => [g.key, rankOf(g, owned, profile)]))
    setOrder({ tabItems, collection, withProfile: !!profile, rank })
  }
  const sortedGroups = useMemo(() => (rank ? [...groups].sort((a, b) => (rank.get(a.key) ?? 2) - (rank.get(b.key) ?? 2)) : groups), [groups, rank])

  // The variant a group's card shows: the one picked, else the one worn, else the first one bought, else the first.
  const shownOf = (group) =>
    group.variants.length === 1
      ? group.variants[0]
      : group.variants.find((v) => v.id === picked[group.key]) ||
        group.variants.find((v) => isWornBy(v, profile)) ||
        group.variants.find((v) => owned.has(v.id)) ||
        group.variants[0]

  // The sheet looks its item up on every render, so it follows purchases, saves and reloads.
  const sheetGroup = sheet?.type === 'item' ? groups.find((g) => g.key === sheet.groupKey) || null : null
  const sheetItem =
    sheet?.type === 'item'
      ? sheetGroup?.variants.find((v) => v.id === sheet.id) || null
      : sheet?.type === 'stock'
        ? stockList.find((s) => s.id === sheet.id) || null
        : null
  // Its item went away (no longer on sale after a reload, another tab in the address): close it.
  useEffect(() => {
    if (sheet && !sheetItem && status === 'ready') setSheet(null)
  }, [sheet, sheetItem, status])

  // ---- Actions. One at a time: a second tap while one is saving does nothing. ----

  const run = useCallback(
    async (key, task) => {
      if (busyRef.current) return
      busyRef.current = key
      setBusy(key)
      try {
        await task()
      } catch (err) {
        console.error('Shop action failed:', err)
        showToast('Có lỗi xảy ra. Thử lại nhé!')
      } finally {
        busyRef.current = null
        setBusy(null)
      }
    },
    [showToast]
  )

  // Until add_buy_shop_item.sql has run: pay, then write the purchase, as the old Shop did, but only after checking
  // that the item is not owned yet, and with the money given back if the purchase cannot be written.
  const buyOldWay = async (item) => {
    const kind = priceKind(item)
    const price = Math.max(0, Number(item.price) || 0)
    const { data: have, error: readError } = await supabase.from('user_purchases').select('item_id').eq('user_id', userId).eq('item_id', item.id).limit(1)
    if (readError) {
      console.error('Error checking the purchase:', readError)
      return { success: false }
    }
    if (have?.length) return { success: false, error: 'owned' }
    // spend_user_gems / spend_user_xp refuse 0, so a free item skips paying.
    if (price > 0) {
      const paid = kind === 'xp' ? await spendXP(price) : await spendGems(price)
      if (!paid?.success) return { success: false, error: /not enough/i.test(paid?.error || '') ? 'not_enough' : undefined, price_type: kind }
    }
    const { error } = await supabase.from('user_purchases').insert({ user_id: userId, item_id: item.id })
    if (!error) return { success: true }
    console.error('Error recording the purchase:', error)
    if (price > 0) {
      const { error: refundError } = await supabase.rpc('increment_user_currency', {
        p_user_id: userId,
        p_xp: kind === 'xp' ? price : 0,
        p_gems: kind === 'gems' ? price : 0,
      })
      if (refundError) console.error('Could not give the money back:', refundError)
    }
    return { success: false, error: error.code === '23505' ? 'owned' : undefined }
  }

  // An avatar, frame, background, bowl, spaceship, boat or hammer: one call that checks, pays and records together.
  const buyItem = (item) =>
    run(`buy:${item.id}`, async () => {
      if (owned.has(item.id)) return
      let result
      const { data, error } = await supabase.rpc('buy_shop_item', { p_item_id: item.id })
      if (error && isMissingFunction(error)) {
        result = await buyOldWay(item)
      } else if (error) {
        console.error('buy_shop_item failed:', error)
        result = { success: false }
      } else {
        result = data || { success: false }
      }

      if (result.success) {
        markOwned(item.id)
        playBuySound()
        celebrate(item.id)
        showToast(`Đã mua ${item.name}!`, true)
        await fetchUserProfile(userId) // the new balance, here and in the rest of the app
        return
      }
      if (result.error === 'owned') {
        markOwned(item.id)
        showToast('Bạn đã có món này rồi', true)
      } else if (result.error === 'not_enough') {
        showToast(result.price_type === 'xp' ? 'Chưa đủ XP' : 'Chưa đủ gem')
      } else if (result.error === 'not_for_sale') {
        showToast('Món này không còn bán')
        load({ quiet: true })
      } else {
        showToast('Chưa mua được. Thử lại nhé!')
      }
      // The balance on screen may be out of date (spent in another tab): read it again.
      fetchUserProfile(userId)
    })

  // A ball, ticket or egg, with gems or XP.
  const buyStock = (item, currency) =>
    run(`stock:${item.id}:${currency}`, async () => {
      const isEgg = item.item_type === 'egg'
      const res = isEgg ? await buyEgg(item.id, currency) : await buyBall(item.id, currency)
      if (!res?.success) {
        console.error('Purchase refused:', res?.error)
        showToast(friendlyRefusal(res?.error, currency))
        fetchUserProfile(userId)
        return
      }
      playBuySound()
      celebrate(item.id)
      showToast(`Đã mua ${res.egg_name || res.ball_name || item.name}!`, true)
      incrementNewCount(isEgg ? 'eggs' : 'items')
      await Promise.all([fetchInventory(), fetchUserProfile(userId)])
    })

  const equip = (item) =>
    run(`equip:${item.id}`, async () => {
      const rule = EQUIP[item.category]
      if (!rule || !owned.has(item.id)) return
      const updates = rule.save(item)
      const res = await updateProfile(updates)
      if (res?.error || (res?.data?.[rule.field] ?? null) !== (updates[rule.field] ?? null)) {
        console.error('Error equipping item:', res?.error)
        showToast('Chưa trang bị được. Thử lại nhé!')
        // A failed equipment save leaves those fields out of the profile: read them again.
        fetchUserProfile(userId)
        return
      }
      showToast('Đã trang bị!', true)
    })

  // Show or hide the frame that is worn.
  const toggleFrame = () =>
    run('frame', async () => {
      const next = !profile?.hide_frame
      const res = await updateProfile({ hide_frame: next })
      if (res?.error || !!res?.data?.hide_frame !== next) {
        console.error('Error changing the frame:', res?.error)
        showToast('Chưa đổi được. Thử lại nhé!')
        fetchUserProfile(userId)
      }
    })

  // Cards get handlers that never change, so a card only redraws when its own item changes.
  const latest = useRef(null)
  latest.current = { buyItem, buyStock, equip, toggleFrame }
  const act = useMemo(
    () => ({
      openItem: (groupKey, id) => setSheet({ type: 'item', groupKey, id }),
      openStock: (id) => setSheet({ type: 'stock', id }),
      pickVariant: (groupKey, id) => {
        setPicked((p) => ({ ...p, [groupKey]: id }))
        setSheet((s) => (s?.type === 'item' && s.groupKey === groupKey ? { ...s, id } : s))
      },
      buyItem: (item) => latest.current.buyItem(item),
      buyStock: (item, currency) => latest.current.buyStock(item, currency),
      equip: (item) => latest.current.equip(item),
      toggleFrame: () => latest.current.toggleFrame(),
    }),
    []
  )

  // ---- Page ----

  if (status === 'loading') return <ShopSkeleton />

  const xp = balanceOf(profile, 'xp')
  const gems = balanceOf(profile, 'gems')
  const locked = !!busy
  const cardBusy = (item) =>
    busy === `buy:${item.id}` ? 'buy' : busy === `equip:${item.id}` ? 'equip' : busy === 'frame' && item.category === 'frame' ? 'frame' : null

  let body
  if (status === 'error') {
    body = <ShopError onRetry={retry} />
  } else if (tab.stock) {
    body =
      stockList.length === 0 ? (
        <ShopEmpty />
      ) : (
        <div className="sh-grid" key={tab.key} role="tabpanel">
          {stockList.map((item, i) => (
            <StockCard key={item.id} item={item} index={i} qty={qtyById.get(item.id) || 0} xp={xp} gems={gems} pop={pop === item.id} onOpen={act.openStock} />
          ))}
        </div>
      )
  } else {
    body = (
      <>
        <CollectionChips names={collections} active={collection} onPick={(name) => setCollectionPick({ tab: tab.key, name })} />
        {groups.length === 0 ? (
          <ShopEmpty />
        ) : (
          <div className="sh-grid" key={`${tab.key}:${collection}`} role="tabpanel">
            {sortedGroups.map((group, i) => {
              const item = shownOf(group)
              return (
                <ItemCard
                  key={group.key}
                  group={group}
                  item={item}
                  index={i}
                  owned={owned.has(item.id)}
                  worn={isWornBy(item, profile)}
                  canEquip={!!EQUIP[item.category]}
                  canAfford={balanceOf(profile, priceKind(item)) >= (Number(item.price) || 0)}
                  frameHidden={!!profile?.hide_frame}
                  busy={cardBusy(item)}
                  locked={locked}
                  ownedIds={owned}
                  pop={pop === item.id}
                  onOpen={act.openItem}
                  onEquip={act.equip}
                  onToggleFrame={act.toggleFrame}
                  onVariant={act.pickVariant}
                />
              )
            })}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="sh-root mx-auto max-w-5xl space-y-4" data-shop="ready" data-tab={tab.key}>
      <ShopTopBar xp={xp} gems={gems} />
      <CategoryTabs tabs={tabs} active={tab.key} onPick={pickTab} />
      {body}

      {sheetItem && (
        <ItemSheet
          item={sheetItem}
          category={tab}
          variants={sheetGroup?.variants || null}
          ownedIds={owned}
          profile={profile}
          isWorn={(v) => isWornBy(v, profile)}
          canEquip={!!EQUIP[sheetItem.category]}
          qty={qtyById.get(sheetItem.id) || 0}
          busy={busy}
          locked={locked}
          pop={pop === sheetItem.id}
          onBuy={act.buyItem}
          onBuyStock={act.buyStock}
          onEquip={act.equip}
          onToggleFrame={act.toggleFrame}
          onPickVariant={(id) => act.pickVariant(sheetGroup.key, id)}
          onClose={() => setSheet(null)}
        />
      )}

      {toast && <Toast key={toast.id} message={toast.text} good={toast.good} />}
    </div>
  )
}

export default Shop
