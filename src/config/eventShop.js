/**
 * The event shop's stock — exclusive items that never appear in the regular
 * shop.
 *
 * This is a display case, not a till: nothing here is bought in the app. The
 * exchange happens in person with a teacher, so an entry carries a price to
 * read rather than a price to charge, and there is no purchase state, no
 * currency and no `shop_items` row behind it. Edit this file to change the
 * window.
 *
 * image: either a path inside the ui-assets bucket ('/event/shop/chest.png'),
 *   resolved through assetUrl like every other remote asset, or a full URL to
 *   an image hosted anywhere else — the two are told apart by the leading
 *   scheme. An item whose image is missing, still uploading, or refused by the
 *   host draws a neutral placeholder rather than a broken image.
 * price: free text, so it can be gems, XP, a real amount, or a condition
 *   ("hạ gục trùm cuối") without the list needing to know which.
 * note: the one line of small print under the price (stock left, a deadline, a
 *   condition). Omit it and nothing is drawn.
 */
export const EVENT_SHOP_ITEMS = [
  {
    id: 'legendary-frame',
    name: 'Lootbox 1',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/1.png',
    note: ' '
  },
  {
    id: 'legendary-frame',
    name: 'Lootbox 2',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/2.png',
    note: ' '
  },{
    id: 'legendary-frame',
    name: 'Lootbox 3',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/3.png',
    note: ' '
  }
  ,{
    id: 'legendary-frame',
    name: 'Lootbox 4',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/4.png',
    note: ' '
  },{
    id: 'legendary-frame',
    name: 'Lootbox 5',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/5.png',
    note: ' '
  },{
    id: 'legendary-frame',
    name: 'Lootbox 6',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/6.png',
    note: ' '
  },{
    id: 'legendary-frame',
    name: 'Lootbox 7',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/7.png',
    note: ' '
  },{
    id: 'legendary-frame',
    name: 'Lootbox 8',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/8.png',
    note: ' '
  },{
    id: 'legendary-frame',
    name: 'Lootbox 9',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/9.png',
    note: ' '
  },{
    id: 'legendary-frame',
    name: 'Lootbox 10',
    description: 'Vật phẩm random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/event/prize/10.png',
    note: ' '
  },
    {
    id: 'legendary-frame',
    name: 'Túi quà trung thu',
    description: 'Kẹo bánh trung thu',
    price: '7 viên ngọc',
    rarity: 'legendary',
    image: 'https://bhlpjvcplrofixogcrqp.supabase.co/storage/v1/object/public/inventory-assets/mid-autumn-26/tui-keo.png',
    note: ' '
  },
  // A stat-reset potion used to sit here. There are no stats to reset — every
  // fighter has the same three lives and the same one damage — so it went with
  // them rather than staying on a shelf promising something that cannot happen.
]

/** Rarity styling, in the same five tiers the regular shop uses. */
export const EVENT_SHOP_RARITY = {
  common: { label: 'THƯỜNG', badge: 'bg-gray-100 text-gray-600', ring: 'border-gray-200' },
  uncommon: { label: 'HIẾM', badge: 'bg-green-50 text-green-600', ring: 'border-green-200' },
  rare: { label: 'QUÝ', badge: 'bg-blue-50 text-blue-600', ring: 'border-blue-200' },
  epic: { label: 'SỬ THI', badge: 'bg-purple-50 text-purple-600', ring: 'border-purple-200' },
  legendary: { label: 'HUYỀN THOẠI', badge: 'bg-yellow-50 text-yellow-700', ring: 'border-yellow-200' }
}
