/**
 * 展示用返利率：后台真实比例 ×120% 后向上取整为整数百分比。
 * 只用于前端展示（数字好看 + 覆盖联盟管理费预期），
 * 实际返现金额始终以后台配置计算，不受影响。
 *
 * @param {number} rate 真实分成比例（小数，如 0.45 表示 45%）
 * @returns {number} 展示百分比整数，如 0.45 → 54，0.033 → 4
 */
export function displayRatePct(rate) {
  const r = Number(rate);
  if (!r || Number.isNaN(r) || r <= 0) return 0;
  // 减掉微小 epsilon：浮点误差可能把 54 算成 54.00000000000001，ceil 后错成 55
  return Math.ceil(r * 120 - 1e-9);
}
