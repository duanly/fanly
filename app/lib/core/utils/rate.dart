import 'dart:math' as math;

/// 展示用返利率：真实比例 ×120% 后向上取整（与 H5 displayRatePct 一致）。
/// rate 为小数（0.45 表示 45%），返回展示百分整数（0.45 → 54）。
int displayRatePct(num? rate) {
  if (rate == null || rate.isNaN || rate <= 0) return 0;
  // 减 epsilon，规避浮点误差把 54 算成 54.000...01 导致 ceil 成 55
  return math.max(0, (rate * 120 - 1e-9).ceil());
}
