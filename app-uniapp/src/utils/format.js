/**
 * 金额 / 销量 / 比例 格式化（对齐 H5）
 */

export const money = (v, digits = 2) => {
  const n = Number(v) || 0;
  return n.toFixed(digits);
};

// 销量：≥1万 用「x.x万」；≥1千 用 k
export const sales = (v) => {
  const n = Number(v) || 0;
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

// 展示比例 ×120% 向上取整（用户侧）
export const displayRatePct = (rate) => {
  const r = Number(rate) || 0;
  if (!r) return 0;
  return Math.ceil(r * 120 - 1e-9);
};

// 时间格式化（YYYY-MM-DD HH:mm）
export const fmtTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
