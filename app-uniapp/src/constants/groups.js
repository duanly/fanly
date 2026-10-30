/**
 * 选品专题 / 比价品类（移植自 H5 constants/groups.js，两端 key 必须一致）
 */
export const GROUPS = [
  { key: 'default', name: '精选', icon: '⭐️', bg: 'linear-gradient(135deg,#ff8a3d,#ff5000)' },
  { key: 'travel', name: '旅行优惠', icon: '🏔', bg: 'linear-gradient(135deg,#5ec26a,#34a853)' },
  { key: 'car', name: '加油打车', icon: '🚗', bg: 'linear-gradient(135deg,#5b9cf8,#3a7bd5)' },
  { key: 'fun', name: '吃喝玩乐', icon: '🎮', bg: 'linear-gradient(135deg,#a05bf8,#7b3ad5)' },
  { key: 'brand', name: '大牌秒杀', icon: '⚡️', bg: 'linear-gradient(135deg,#ff6a6a,#e23b3b)' },
  { key: 'food', name: '省钱外卖', icon: '🍔', bg: 'linear-gradient(135deg,#4fc3f7,#2196f3)' },
  { key: 'cheap', name: '9块9特卖', icon: '💰', bg: 'linear-gradient(135deg,#ffb74d,#f57c00)' },
  { key: 'daily', name: '日用百货', icon: '🧺', bg: 'linear-gradient(135deg,#81c784,#43a047)' },
  { key: 'beauty', name: '美妆个护', icon: '💄', bg: 'linear-gradient(135deg,#f06ba8,#e4007f)' },
  { key: 'digital', name: '数码家电', icon: '📱', bg: 'linear-gradient(135deg,#607d8b,#37474f)' },
];

export const groupName = (key) =>
  GROUPS.find((g) => g.key === key)?.name || key;

export const CATEGORIES = [
  { key: 'clothing', name: '服装' },
  { key: 'electronics', name: '电子' },
  { key: 'appliance', name: '家电' },
  { key: 'trendy', name: '潮玩' },
  { key: 'toys', name: '玩具' },
  { key: 'kids', name: '儿童' },
  { key: 'beauty', name: '美妆' },
  { key: 'food', name: '食品' },
  { key: 'home', name: '家居' },
  { key: 'sports', name: '运动' },
];

export const categoryName = (key) =>
  CATEGORIES.find((c) => c.key === key)?.name || key;

export const GRID_GROUPS = GROUPS.filter((g) => g.key !== 'default');

const FALLBACK_BG = [
  'linear-gradient(135deg,#7986cb,#3f51b5)',
  'linear-gradient(135deg,#4db6ac,#00897b)',
  'linear-gradient(135deg,#ffb74d,#f57c00)',
  'linear-gradient(135deg,#ba68c8,#8e24aa)',
  'linear-gradient(135deg,#90a4ae,#546e7a)',
];

export function groupMeta(key, i = 0) {
  const hit = GROUPS.find((g) => g.key === key);
  if (hit) return hit;
  return {
    key,
    name: key,
    icon: key.slice(0, 1),
    bg: FALLBACK_BG[i % FALLBACK_BG.length],
  };
}
