// Shop (/shop): everything the page draws. No data is loaded or saved here; Shop.jsx does that and passes it in.
// Looks: Shop.css (sh- classes) plus the profile's sheet, toast and placeholders (Profile.css, imported by Shop.jsx).
import { memo, useEffect, useRef } from 'react'
import {
  AlertCircle,
  Backpack,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Package,
  RotateCw,
  ShoppingBag,
} from 'lucide-react'
import AvatarWithFrame from '../ui/AvatarWithFrame'
import { assetUrl } from '../../hooks/useBranding'
import PetImage from '../pet/home/PetImage'
import { RARITY } from '../pet/home/petHomeUtils'
import Sheet from '../profile/parts/Sheet'
import { CountUp, Skel } from '../profile/parts/bits'
import { fmt, prefersReducedMotion } from '../profile/profileUtils'

// ---- Small helpers (display only) ----

// Each tab's colour: a and b make the gradient of the chosen tab, tint and ink colour its icon otherwise.
const TONES = {
  sky: { a: '#38bdf8', b: '#2563eb', tint: '#e0f2fe', ink: '#0284c7' },
  rose: { a: '#fb7185', b: '#e11d48', tint: '#ffe4e6', ink: '#e11d48' },
  pink: { a: '#f472b6', b: '#db2777', tint: '#fce7f3', ink: '#db2777' },
  amber: { a: '#fbbf24', b: '#f97316', tint: '#fef3c7', ink: '#d97706' },
  indigo: { a: '#818cf8', b: '#4f46e5', tint: '#e0e7ff', ink: '#4f46e5' },
  emerald: { a: '#34d399', b: '#059669', tint: '#d1fae5', ink: '#059669' },
  violet: { a: '#a78bfa', b: '#7c3aed', tint: '#ede9fe', ink: '#7c3aed' },
  orange: { a: '#fb923c', b: '#ea580c', tint: '#ffedd5', ink: '#ea580c' },
  cyan: { a: '#22d3ee', b: '#0891b2', tint: '#cffafe', ink: '#0891b2' },
}
const toneVars = (tone) => {
  const t = TONES[tone] || TONES.sky
  return { '--sh-a': t.a, '--sh-b': t.b, '--sh-tint': t.tint, '--sh-ink': t.ink }
}

const COIN = {
  xp: { icon: '/image/study/xp.png', label: 'XP' },
  gems: { icon: '/image/study/gem.png', label: 'gem' },
}
const kindOf = (item) => (item.price_type === 'xp' ? 'xp' : 'gems')
const rarityOfItem = (item) => RARITY[item.rarity] || RARITY[item.item_data?.rarity] || RARITY.common
// A ball, ticket or egg can cost gems, XP or both.
const stockPrices = (item) =>
  [
    { kind: 'gems', price: Number(item.price_gems) || 0 },
    { kind: 'xp', price: Number(item.price_xp) || 0 },
  ].filter((p) => p.price > 0)

const Coin = ({ kind, className = 'h-4 w-4' }) => <img src={assetUrl(COIN[kind].icon)} alt="" draggable={false} className={`shrink-0 ${className}`} />

const Stars = ({ r }) => (
  <span className={`sh-stars pf-ink-light ${r.text}`} role="img" aria-label={r.label}>
    {'★'.repeat(r.stars)}
  </span>
)

// The picture of a shop item. Backgrounds fill their box; a hammer lies on its side, as in the games.
const ItemArt = memo(function ItemArt({ item, size = 360, big = false, eager = false }) {
  if (item.category === 'background') {
    const url = big ? item.item_data?.background_url || item.image_url : item.image_url || item.item_data?.background_url
    return url ? (
      <PetImage src={url} size={big ? 960 : 640} alt="" eager={eager} className="sh-art h-full w-full object-cover" />
    ) : (
      <Package className="h-1/3 w-1/3 text-slate-300" />
    )
  }
  if (!item.image_url) {
    if (item.item_type === 'egg') return <span className="text-5xl leading-none">🥚</span>
    return <Package className="h-1/3 w-1/3 text-slate-300" />
  }
  return (
    <PetImage
      src={item.image_url}
      size={size}
      alt=""
      eager={eager}
      className="sh-art h-full w-full object-contain"
      style={item.category === 'hammer' ? { '--sh-rot': '90deg' } : undefined}
    />
  )
})

// A few stars that fly out of a picture once, after a purchase.
const Burst = () => (
  <span className="sh-burst" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <span key={i} style={{ '--n': i }} />
    ))}
  </span>
)

// ---- Top bar ----

const Wallet = ({ kind, value }) => (
  <span className="sh-coin" title={COIN[kind].label} aria-label={`${COIN[kind].label}: ${fmt(value)}`} data-coin={kind}>
    <Coin kind={kind} className="sh-coin-icon" />
    <span aria-hidden="true">
      <CountUp value={value} />
    </span>
  </span>
)

export const ShopTopBar = ({ xp, gems }) => (
  <header className="sh-top pf-rise" style={{ '--i': 0 }}>
    <img src={assetUrl('/icon/navigation/shop.svg')} alt="" className="sh-top-logo" draggable={false} />
    <h1 className="sh-top-title">Shop</h1>
    <div className="sh-wallet">
      <Wallet kind="xp" value={xp} />
      <Wallet kind="gems" value={gems} />
    </div>
  </header>
)

// ---- Tabs and collections ----

export const CategoryTabs = ({ tabs, active, onPick }) => {
  const rowRef = useRef(null)
  const first = useRef(true)

  // On phones the row scrolls sideways: bring the chosen tab into view (at once on arrival, smoothly after a tap).
  useEffect(() => {
    const row = rowRef.current
    const el = row?.querySelector('[aria-selected="true"]')
    if (row && el && row.scrollWidth > row.clientWidth + 1) {
      const left = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2
      row.scrollTo({ left: Math.max(0, left), behavior: first.current || prefersReducedMotion() ? 'auto' : 'smooth' })
    }
    first.current = false
  }, [active])

  return (
    <div ref={rowRef} className="sh-tabs pf-rise" style={{ '--i': 0.5 }} role="tablist" aria-label="Shop">
      {tabs.map((t) => {
        const Icon = t.icon
        const on = t.key === active
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            data-tab={t.key}
            onClick={() => onPick(t.key)}
            className="sh-tab pf-press"
            style={toneVars(t.tone)}
          >
            <span className="sh-tab-icon">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </span>
            <span className="sh-tab-label">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export const CollectionChips = ({ names, active, onPick }) =>
  names.length > 0 ? (
    <div className="sh-chips" role="group" aria-label="Collection">
      {['all', ...names].map((name) => (
        <button key={name} type="button" aria-pressed={active === name} onClick={() => onPick(name)} className="sh-chip pf-press">
          {name === 'all' ? 'All' : name}
        </button>
      ))}
    </div>
  ) : null

// ---- Cards ----

// The line under a shop item: its price, "Trang bị", "Đang dùng" (with show/hide for a frame) or "Đã có".
const CardAction = ({ item, owned, worn, canEquip, canAfford, frameHidden, busy, locked, onOpen, onEquip, onToggleFrame }) => {
  if (!owned) {
    const kind = kindOf(item)
    return (
      <button
        type="button"
        onClick={onOpen}
        className="sh-price pf-press"
        data-can={canAfford}
        data-coin={kind}
        data-action="price"
        aria-label={`${item.name}: ${fmt(item.price)} ${COIN[kind].label}`}
        title={`${fmt(item.price)} ${COIN[kind].label}`}
      >
        {!canAfford && <Lock className="h-3 w-3 shrink-0" strokeWidth={3} />}
        <Coin kind={kind} />
        <span className="tabular-nums">{fmt(item.price)}</span>
      </button>
    )
  }
  if (worn) {
    const isFrame = item.category === 'frame'
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="sh-worn" data-action="worn" data-hidden={isFrame && frameHidden ? 'true' : undefined}>
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3.5} />
          <span className="truncate">{isFrame && frameHidden ? 'Đang ẩn' : 'Đang dùng'}</span>
        </span>
        {isFrame && (
          <button
            type="button"
            onClick={onToggleFrame}
            disabled={locked}
            className="sh-eye pf-press"
            data-action="frame"
            aria-label={frameHidden ? 'Hiện khung' : 'Ẩn khung'}
            title={frameHidden ? 'Hiện khung' : 'Ẩn khung'}
          >
            {busy === 'frame' ? <Loader2 className="h-4 w-4 animate-spin" /> : frameHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        )}
      </div>
    )
  }
  if (canEquip) {
    return (
      <button type="button" onClick={() => onEquip(item)} disabled={locked} className="sh-equip pf-press" data-action="equip">
        {busy === 'equip' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Trang bị'}
      </button>
    )
  }
  return (
    <span className="sh-have" data-action="owned">
      <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
      Đã có
    </span>
  )
}

const VariantStepper = ({ variants, item, ownedIds, onStep, onPick }) => {
  const idx = variants.indexOf(item)
  return (
    <div className="sh-variants">
      <button type="button" onClick={() => onStep(-1)} className="sh-step pf-press" aria-label="Trước" title="Trước">
        <ChevronLeft className="h-4 w-4" strokeWidth={3} />
      </button>
      {variants.length <= 6 ? (
        variants.map((v, i) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onPick(v.id)}
            className="sh-dot"
            data-on={i === idx}
            data-owned={ownedIds.has(v.id)}
            aria-label={v.name}
            title={v.name}
          />
        ))
      ) : (
        <span className="min-w-[2.5rem] text-center text-xs font-black tabular-nums text-slate-500">
          {idx + 1}/{variants.length}
        </span>
      )}
      <button type="button" onClick={() => onStep(1)} className="sh-step pf-press" aria-label="Sau" title="Sau">
        <ChevronRight className="h-4 w-4" strokeWidth={3} />
      </button>
    </div>
  )
}

/** A shop item (avatar, frame, background...). Items of one avatar_group share a card with arrows between them. */
export const ItemCard = memo(function ItemCard({
  group,
  item,
  index,
  owned,
  worn,
  canEquip,
  canAfford,
  frameHidden,
  busy,
  locked,
  ownedIds,
  pop,
  onOpen,
  onEquip,
  onToggleFrame,
  onVariant,
}) {
  const r = rarityOfItem(item)
  const variants = group.variants
  const bonus = Number(item.item_data?.xp_bonus) || 0
  const open = () => onOpen(group.key, item.id)
  const step = (d) => {
    const i = variants.indexOf(item)
    onVariant(group.key, variants[(i + d + variants.length) % variants.length].id)
  }

  return (
    <article className="sh-card pf-rise" style={{ '--i': Math.min(index, 10) * 0.4 }} data-item={item.id} data-owned={owned} data-worn={worn}>
      <button
        type="button"
        onClick={open}
        className={`sh-pic bg-gradient-to-b ${r.tile} ${pop ? 'sh-pop' : ''}`}
        data-bg={item.category === 'background' || undefined}
        aria-label={item.name}
        title={item.name}
      >
        <ItemArt item={item} />
        <Stars r={r} />
        {worn ? (
          <span className="sh-mark" data-worn="true" title="Đang dùng" aria-label="Đang dùng" role="img">
            <Check className="h-3 w-3" strokeWidth={4} />
          </span>
        ) : (
          owned && (
            <span className="sh-mark" title="Đã có" aria-label="Đã có" role="img">
              <Check className="h-3 w-3" strokeWidth={4} />
            </span>
          )
        )}
        {bonus > 0 && (
          <span className="sh-bonus" title={`+${bonus}% XP`} aria-label={`+${bonus}% XP`}>
            +{bonus}%
            <Coin kind="xp" className="h-3 w-3" />
          </span>
        )}
        {pop && <Burst />}
      </button>
      {variants.length > 1 && (
        <VariantStepper variants={variants} item={item} ownedIds={ownedIds} onStep={step} onPick={(id) => onVariant(group.key, id)} />
      )}
      <div className="sh-card-body">
        <div className="sh-name" title={item.name}>
          {item.name}
        </div>
        <div className="sh-act">
          <CardAction
            item={item}
            owned={owned}
            worn={worn}
            canEquip={canEquip}
            canAfford={canAfford}
            frameHidden={frameHidden}
            busy={busy}
            locked={locked}
            onOpen={open}
            onEquip={onEquip}
            onToggleFrame={onToggleFrame}
          />
        </div>
      </div>
    </article>
  )
})

/** A ball, ticket or egg: bought again and again, so the card shows how many the student has. */
export const StockCard = memo(function StockCard({ item, index, qty, xp, gems, pop, onOpen }) {
  const r = RARITY[item.rarity] || RARITY.common
  const prices = stockPrices(item)
  const open = () => onOpen(item.id)
  return (
    <article className="sh-card pf-rise" style={{ '--i': Math.min(index, 10) * 0.4 }} data-stock={item.id}>
      <button type="button" onClick={open} className={`sh-pic bg-gradient-to-b ${r.tile} ${pop ? 'sh-pop' : ''}`} aria-label={item.name} title={item.name}>
        <ItemArt item={item} />
        <Stars r={r} />
        {qty > 0 && (
          <span className="sh-qty" title={`Bạn có ${qty}`} aria-label={`Bạn có ${qty}`}>
            ×{fmt(qty)}
          </span>
        )}
        {pop && <Burst />}
      </button>
      <div className="sh-card-body">
        <div className="sh-name" title={item.name}>
          {item.name}
        </div>
        <div className="sh-act">
          {prices.length > 0 ? (
            prices.map((p) => {
              const can = (p.kind === 'xp' ? xp : gems) >= p.price
              return (
                <button
                  key={p.kind}
                  type="button"
                  onClick={open}
                  className="sh-price pf-press"
                  data-can={can}
                  data-coin={p.kind}
                  data-action="price"
                  aria-label={`${item.name}: ${fmt(p.price)} ${COIN[p.kind].label}`}
                  title={`${fmt(p.price)} ${COIN[p.kind].label}`}
                >
                  {!can && <Lock className="h-3 w-3 shrink-0" strokeWidth={3} />}
                  <Coin kind={p.kind} />
                  <span className="tabular-nums">{fmt(p.price)}</span>
                </button>
              )
            })
          ) : (
            <span className="sh-off" title="Không bán" aria-label="Không bán">
              <Lock className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
    </article>
  )
})

// ---- The item sheet: big picture, try-on, price, buy / equip ----

// Avatars and frames are shown on the student's own avatar, as they will look once worn.
const Stage = ({ item, profile, pop }) => {
  const r = rarityOfItem(item)
  const isBg = item.category === 'background'
  let art
  if (item.category === 'avatar' || item.category === 'frame') {
    const isFrame = item.category === 'frame'
    const avatar = isFrame ? profile?.avatar_url : item.item_data?.avatar_url || item.image_url
    const frame = isFrame ? item.image_url : profile?.hide_frame ? null : profile?.active_title
    const ratio = isFrame ? item.item_data?.avatar_ratio || 66 : profile?.active_frame_ratio
    const hasFrame = !!frame && frame.startsWith('http')
    art = (
      <div className="pf-avatar-wrap" style={{ '--pf-avatar-glyph': '3.75rem' }}>
        <AvatarWithFrame
          avatarUrl={avatar}
          frameUrl={frame}
          frameRatio={ratio}
          size={164}
          fallback={(profile?.full_name || 'U').trim().charAt(0).toUpperCase() || 'U'}
          className={hasFrame ? '' : 'sh-try-ring'}
        />
      </div>
    )
  } else {
    art = (
      <div className={isBg ? 'absolute inset-0' : 'sh-stage-art'}>
        <ItemArt item={item} size={512} big eager />
      </div>
    )
  }
  return (
    <div className={`sh-stage bg-gradient-to-b ${r.hero} ${pop ? 'sh-pop' : ''}`} data-bg={isBg || undefined} data-stage={item.category || item.item_type}>
      {art}
      {pop && <Burst />}
    </div>
  )
}

const BuyButton = ({ kind, price, can, busy, locked, onClick, label = 'Mua' }) => (
  <button type="button" onClick={onClick} disabled={!can || locked} className="sh-buy pf-press" data-action="buy" data-kind={kind}>
    {busy ? (
      <Loader2 className="h-5 w-5 animate-spin" />
    ) : (
      <>
        {can ? <ShoppingBag className="h-5 w-5" /> : <Lock className="h-4 w-4" strokeWidth={3} />}
        {label}
        <span className="sh-buy-price">
          <Coin kind={kind} className="h-5 w-5" />
          <span className="tabular-nums">{fmt(price)}</span>
        </span>
      </>
    )}
  </button>
)

// What is left after paying, or how much is still missing (with a bar of what the student has so far).
const Balance = ({ kind, have, price }) => {
  const need = price - have
  if (need <= 0) {
    return (
      <div className="sh-balance" aria-label={`${COIN[kind].label}: ${fmt(have)} → ${fmt(have - price)}`}>
        <Coin kind={kind} />
        <span className="tabular-nums">{fmt(have)}</span>
        <span className="text-slate-300">→</span>
        <span className="tabular-nums text-slate-800">{fmt(have - price)}</span>
      </div>
    )
  }
  return (
    <div className="sh-balance" data-short="true">
      <div className="sh-need-track" role="progressbar" aria-valuemin={0} aria-valuemax={price} aria-valuenow={have} aria-label={`${fmt(have)}/${fmt(price)} ${COIN[kind].label}`}>
        <span style={{ '--p': `${Math.max(4, Math.round((have / price) * 100))}%` }} />
      </div>
      <span className="shrink-0 tabular-nums" title={`Thiếu ${fmt(need)} ${COIN[kind].label}`}>
        Thiếu {fmt(need)}
      </span>
      <Coin kind={kind} />
    </div>
  )
}

export const ItemSheet = ({
  item,
  category,
  variants,
  ownedIds,
  profile,
  isWorn,
  canEquip,
  qty,
  busy,
  locked,
  pop,
  onBuy,
  onBuyStock,
  onEquip,
  onToggleFrame,
  onPickVariant,
  onClose,
}) => {
  const stock = !!category.stock
  const r = stock ? RARITY[item.rarity] || RARITY.common : rarityOfItem(item)
  const Icon = category.icon
  const owned = !stock && ownedIds.has(item.id)
  const worn = !stock && isWorn(item)
  const bonus = Number(item.item_data?.xp_bonus) || 0
  const collection = item.item_data?.collection
  const isFrame = item.category === 'frame'
  const frameHidden = !!profile?.hide_frame
  const balance = (kind) => (kind === 'xp' ? profile?.xp : profile?.gems) || 0

  let foot
  if (stock) {
    const prices = stockPrices(item)
    foot = (
      <>
        <div className="sh-have-row" aria-label={`Bạn có ${qty || 0}`}>
          <Backpack className="h-4 w-4" />
          <span className="tabular-nums">×{fmt(qty || 0)}</span>
        </div>
        {prices.length > 0 ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${prices.length}, minmax(0, 1fr))` }}>
            {prices.map((p) => (
              <BuyButton
                key={p.kind}
                kind={p.kind}
                price={p.price}
                can={balance(p.kind) >= p.price}
                busy={busy === `stock:${item.id}:${p.kind}`}
                locked={locked}
                onClick={() => onBuyStock(item, p.kind)}
              />
            ))}
          </div>
        ) : (
          <div className="sh-buy" data-off="true" aria-disabled="true">
            <Lock className="h-4 w-4" strokeWidth={3} />
            Không bán
          </div>
        )}
      </>
    )
  } else if (!owned) {
    const kind = kindOf(item)
    const price = Number(item.price) || 0
    foot = (
      <>
        <Balance kind={kind} have={balance(kind)} price={price} />
        <BuyButton kind={kind} price={price} can={balance(kind) >= price} busy={busy === `buy:${item.id}`} locked={locked} onClick={() => onBuy(item)} />
      </>
    )
  } else if (worn) {
    foot = (
      <div className="flex gap-2">
        <span className="sh-buy" data-kind="worn" data-action="worn">
          <Check className="h-5 w-5" strokeWidth={3} />
          {isFrame && frameHidden ? 'Đang ẩn' : 'Đang dùng'}
        </span>
        {isFrame && (
          <button type="button" onClick={onToggleFrame} disabled={locked} className="sh-buy sh-buy-side pf-press" data-kind="frame" data-action="frame">
            {busy === 'frame' ? <Loader2 className="h-5 w-5 animate-spin" /> : frameHidden ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            {frameHidden ? 'Hiện khung' : 'Ẩn khung'}
          </button>
        )}
      </div>
    )
  } else if (canEquip) {
    foot = (
      <button type="button" onClick={() => onEquip(item)} disabled={locked} className="sh-buy pf-press" data-kind="equip" data-action="equip">
        {busy === `equip:${item.id}` ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Trang bị'}
      </button>
    )
  } else {
    foot = (
      <span className="sh-buy" data-kind="worn" data-action="owned">
        <Check className="h-5 w-5" strokeWidth={3} />
        Đã có
      </span>
    )
  }

  return (
    <Sheet
      title={item.name}
      sub={
        <span className={r.text}>
          {'★'.repeat(r.stars)} <span className="text-slate-500">{r.label}</span>
        </span>
      }
      lead={
        <span className="sh-lead" style={toneVars(category.tone)}>
          <Icon className="h-5 w-5" strokeWidth={2.4} />
        </span>
      }
      onClose={onClose}
    >
      <div data-sheet={item.id}>
        <div className="relative">
          <Stage item={item} profile={profile} pop={pop} />
          {(worn || owned) && (
            <span className="sh-stage-tag" data-worn={worn || undefined}>
              <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
              {worn ? 'Đang dùng' : 'Đã có'}
            </span>
          )}
        </div>

        {variants && variants.length > 1 && (
          <div className="sh-strip" role="group" aria-label="Variants">
            {variants.map((v) => {
              const vr = rarityOfItem(v)
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onPickVariant(v.id)}
                  aria-pressed={v.id === item.id}
                  aria-label={v.name}
                  title={v.name}
                  className={`sh-strip-item pf-press bg-gradient-to-b ${vr.tile}`}
                >
                  <ItemArt item={v} size={128} />
                  {ownedIds.has(v.id) && <span className="sh-strip-dot" data-worn={isWorn(v) || undefined} />}
                </button>
              )
            })}
          </div>
        )}

        {(collection || bonus > 0) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {collection && <span className="sh-tag">{collection}</span>}
            {bonus > 0 && (
              <span className="sh-tag" data-bonus="true">
                +{bonus}%
                <Coin kind="xp" className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        )}
        {item.description && <p className="mt-3 text-center text-sm font-semibold leading-snug text-slate-500">{item.description}</p>}

        <div className="sh-foot">{foot}</div>
      </div>
    </Sheet>
  )
}

// ---- Page states ----

export const ShopSkeleton = () => (
  <div className="sh-root mx-auto max-w-5xl space-y-4" aria-busy="true" aria-label="Loading" data-shop="loading">
    <div className="flex items-center gap-2.5">
      <Skel className="h-10 w-10 rounded-2xl" />
      <Skel className="h-7 w-20 rounded-xl" />
      <div className="ml-auto flex gap-2">
        <Skel className="h-9 w-24 rounded-full" />
        <Skel className="h-9 w-20 rounded-full" />
      </div>
    </div>
    <div className="flex gap-2 overflow-hidden">
      {[112, 132, 100, 136, 120, 128].map((w, i) => (
        <Skel key={i} className="h-11 shrink-0 rounded-full" style={{ width: w }} />
      ))}
    </div>
    <div className="sh-grid">
      {Array.from({ length: 8 }, (_, i) => (
        <Skel key={i} className="aspect-[4/5] rounded-[22px]" />
      ))}
    </div>
  </div>
)

export const ShopError = ({ onRetry }) => (
  <div className="sh-card sh-state" role="alert" data-shop-error>
    <span className="sh-state-icon bg-rose-50 text-rose-400">
      <AlertCircle className="h-7 w-7" />
    </span>
    <p className="text-base font-black text-slate-700">Không tải được Shop</p>
    <button
      type="button"
      onClick={onRetry}
      className="pf-press mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-sky-400 to-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-blue-600/30"
    >
      <RotateCw className="h-4 w-4" />
      Thử lại
    </button>
  </div>
)

export const ShopEmpty = () => (
  <div className="sh-card sh-state" data-shop-empty>
    <span className="sh-state-icon bg-slate-100 text-slate-400">
      <ShoppingBag className="h-7 w-7" />
    </span>
    <p className="text-sm font-extrabold text-slate-500">Chưa có món nào</p>
  </div>
)
