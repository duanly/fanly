import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';
import '../models/goods.dart';
import '../utils/format.dart';
import '../utils/platform.dart';

/// 商品卡（复刻 H5 GoodsCard v2 视觉）：
/// 上图下文，返利「返 ¥x」大字突出、券 chip、参考价、已售。
class GoodsCard extends StatelessWidget {
  final Goods g;
  final bool showHot;
  const GoodsCard({super.key, required this.g, this.showHot = true});

  @override
  Widget build(BuildContext context) {
    final showHotTag = showHot && g.salesVolume > 1000;
    return GestureDetector(
      onTap: () => context.push('/goods/${g.platform}/${g.goodsId}'),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFFAFAFA),
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [
            BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 图片区 1:1
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (g.image.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: g.image,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: const Color(0xFFF7F8FA)),
                      errorWidget: (_, __, ___) => Container(
                        color: const Color(0xFFF7F8FA),
                        child: const Icon(Icons.image_not_supported_outlined,
                            color: AppColors.textMuted, size: 30),
                      ),
                    )
                  else
                    Container(color: const Color(0xFFF7F8FA)),
                ],
              ),
            ),
            // 内容区
            Expanded(
              child: Container(
                width: double.infinity,
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 标题（2 行，含热销角标）
                    SizedBox(
                      height: 32,
                      child: RichText(
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        text: TextSpan(
                          style: const TextStyle(fontSize: 12, height: 1.4, color: Color(0xFF333333)),
                          children: [
                            if (showHotTag)
                              WidgetSpan(
                                alignment: PlaceholderAlignment.top,
                                child: Container(
                                  margin: const EdgeInsets.only(right: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF0EC),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                  child: const Text('🔥 热销',
                                      style: TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          height: 1.4)),
                                ),
                              ),
                            TextSpan(text: g.title),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    // 返利区：平台角标 + 返 + 金额
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width: 18,
                          height: 18,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: platColor(g.platform),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(platShort(g.platform),
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  height: 1)),
                        ),
                        const SizedBox(width: 5),
                        Container(
                          width: 20,
                          height: 18,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.primary, width: 1.5),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: const Text('返',
                              style: TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  height: 1)),
                        ),
                        const SizedBox(width: 2),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            const Text('¥',
                                style: TextStyle(
                                    color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w700)),
                            Text(Fmt.money(g.rebate),
                                style: const TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.5,
                                    height: 1)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // 价格区
                    Row(
                      children: [
                        if (g.couponAmount > 0) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF0EC),
                              border: Border.all(color: const Color(0xFFFFD9D3)),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text('券 ',
                                    style: TextStyle(color: AppColors.primary, fontSize: 10)),
                                Text('¥${Fmt.money(g.couponAmount)}',
                                    style: const TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 4),
                        ],
                        const Text('参考价',
                            style: TextStyle(color: Color(0xFF999999), fontSize: 10)),
                        const SizedBox(width: 3),
                        Text('¥${Fmt.money(g.couponPrice)}',
                            style: const TextStyle(
                                color: Color(0xFF666666),
                                fontSize: 13,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(width: 4),
                        if (g.price > g.couponPrice && g.price > 0)
                          Text('¥${Fmt.money(g.price)}',
                              style: const TextStyle(
                                  color: Color(0xFFBBBBBB),
                                  fontSize: 10,
                                  decoration: TextDecoration.lineThrough)),
                      ],
                    ),
                    const Spacer(),
                    // 底部：已售
                    if (g.salesVolume > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Container(
                          padding: const EdgeInsets.only(top: 8),
                          decoration: const BoxDecoration(
                            border: Border(top: BorderSide(color: Color(0xFFF5F6F8))),
                          ),
                          child: Text('已售 ${Fmt.sales(g.salesVolume)}',
                              style: const TextStyle(color: Color(0xFF999999), fontSize: 11)),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
