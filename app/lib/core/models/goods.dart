/// 商品统一模型。字段对应后端 goods/curation 接口与 H5 的 GoodsCard。
class Goods {
  final String platform;
  final String goodsId;
  final String title;
  final String image;
  final List<String> images;
  final String shopName;
  final num price;
  final num couponPrice;
  final num couponAmount;
  final num commissionRate;
  final num commission;
  final num salesVolume;

  /// 用户到手返利（后端 preview 计算后附加）
  final num rebate;
  final int? curatedId;
  final int? recommendScore;
  final String? groupKey;

  const Goods({
    required this.platform,
    required this.goodsId,
    this.title = '',
    this.image = '',
    this.images = const [],
    this.shopName = '',
    this.price = 0,
    this.couponPrice = 0,
    this.couponAmount = 0,
    this.commissionRate = 0,
    this.commission = 0,
    this.salesVolume = 0,
    this.rebate = 0,
    this.curatedId,
    this.recommendScore,
    this.groupKey,
  });

  /// 券后 - 返利 = 到手价
  num get afterRebate {
    final v = couponPrice > 0 ? couponPrice : price;
    final r = v - rebate;
    return r < 0 ? 0 : r;
  }

  factory Goods.fromJson(Map<String, dynamic> j) {
    num n(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
    return Goods(
      platform: j['platform']?.toString() ?? '',
      goodsId: j['goodsId']?.toString() ?? '',
      title: j['title']?.toString() ?? '',
      image: j['image']?.toString() ?? '',
      images: (j['images'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      shopName: j['shopName']?.toString() ?? '',
      price: n(j['price']),
      couponPrice: n(j['couponPrice']),
      couponAmount: n(j['couponAmount']),
      commissionRate: n(j['commissionRate']),
      commission: n(j['commission']),
      salesVolume: n(j['salesVolume']),
      rebate: n(j['rebate']),
      curatedId: j['curatedId'] is num ? (j['curatedId'] as num).toInt() : null,
      recommendScore: j['recommendScore'] is num ? (j['recommendScore'] as num).toInt() : null,
      groupKey: j['groupKey']?.toString(),
    );
  }

  static List<Goods> fromList(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .map((e) => Goods.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }
}
