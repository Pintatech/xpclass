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
    name: 'Lootbox đồ chơi',
    description: 'Đồ chơi random',
    price: '??? bánh nướng',
    rarity: 'legendary',
    image: 'https://png.pngtree.com/element_our/20190602/ourlarge/pngtree-cartoon-brown-treasure-chest-illustration-image_1409643.jpg',
    note: ' '
  },
  {
    id: 'event-title',
    name: 'Lootbox đồ dùng học tập',
    description: 'Đồ dùng học tập random',
    price: '??? bánh nướng',
    rarity: 'epic',
    image: 'https://img.magnific.com/free-vector/vector-cartoon-style-icon-pirat-gold-treasure-wooden-chest-isolated-white-background_134830-1840.jpg',
    note: ' '
  },
  {
    id: 'mystery-chest',
    name: 'Rương Bí Ẩn',
    description: 'Một rương vật phẩm ngẫu nhiên của sự kiện.',
    price: '??? bánh nướng',
    rarity: 'rare',
    image: 'https://i.pinimg.com/736x/a2/98/5e/a2985ee62f1d3169abbaf6aaa188379c.jpg'
  }
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
