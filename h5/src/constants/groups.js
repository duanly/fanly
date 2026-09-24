/**
 * 选品专题。
 *
 * 这份清单前台和后台共用：H5 首页的分类宫格按它跳转，
 * 后台选品时从这里选专题，两边的 key 必须一致，否则商品配了也显示不出来。
 *
 * key 会存进 curated_goods.groupKey，改 key 等于把已有选品孤立掉，
 * 要改就连带着后台的存量数据一起改。加新专题只加不删最安全。
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

/** 首页宫格显示哪些（去掉 default，它就是首页本身） */
export const GRID_GROUPS = GROUPS.filter((g) => g.key !== 'default');

/** 后台自建的专题（比如「婴儿」）在这儿没有预设，给个兜底外观 */
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
    name: key,                    // 后台填什么就显示什么
    icon: key.slice(0, 1),        // 没图标就用首字
    bg: FALLBACK_BG[i % FALLBACK_BG.length],
  };
}
