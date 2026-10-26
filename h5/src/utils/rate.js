/**
 * 展示用返利率：后台真实比例 ×120% 后四舍五入保留 1 位小数。
 * 只用于前端展示（数字好看 + 覆盖联盟管理费预期），
 * 实际返现金额始终以后台配置计算，不受影响。
 *
 * @param {number} rate 真实分成比例（小数，如 0.45 表示 45%）
 * @returns {string} 展示百分比，1 位小数，如 0.45 → "54.0"，0.033 → "4.0"
 */
export function displayRatePct(rate) {
  const r = Number(rate);
  if (!r || Number.isNaN(r) || r <= 0) return '0.0';
  // 减掉微小 epsilon：避免浮点误差把 14.45 算成 14.450000001
  const pct = Math.round(r * 120 * 10 - 1e-9) / 10;
  return pct.toFixed(1);
}
