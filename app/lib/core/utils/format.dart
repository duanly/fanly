/// 金额、销量、平台名等展示工具（与 H5 保持一致口径）
class Fmt {
  static String money(num? v, [int digits = 2]) {
    final n = v ?? 0;
    return n.toStringAsFixed(digits);
  }

  /// 销量：≥1万 用「x.x万」；≥1千 H5 用 k，但首页卡片统一展示已售，这里保留万
  static String sales(num? v) {
    final n = (v ?? 0).toDouble();
    if (n >= 10000) return '${(n / 10000).toStringAsFixed(n >= 100000 ? 0 : 1)}万';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toInt().toString();
  }

  static const platformNames = {
    'PDD': '拼多多',
    'TB': '淘宝',
    'JD': '京东',
    'VIP': '唯品会',
    'JTK': '本地生活',
  };

  static String platform(String? code) => platformNames[code] ?? (code ?? '');
}
