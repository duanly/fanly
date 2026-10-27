import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/http/api.dart';
import '../../core/models/goods.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/launcher.dart';

/// 商品详情。从选品池读，转链后唤起购物 App。
class GoodsDetailPage extends ConsumerStatefulWidget {
  final String platform;
  final String goodsId;
  const GoodsDetailPage({super.key, required this.platform, required this.goodsId});

  @override
  ConsumerState<GoodsDetailPage> createState() => _GoodsDetailPageState();
}

class _GoodsDetailPageState extends ConsumerState<GoodsDetailPage> {
  Goods? _g;
  bool _loading = true;
  bool _converting = false;
  int _imgIndex = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await api.goodsDetail(widget.platform, widget.goodsId);
      if (mounted) setState(() => _g = r == null ? null : Goods.fromJson(r));
    } catch (_) {
      if (mounted) setState(() => _g = null);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _buy() async {
    final g = _g;
    if (g == null) return;
    setState(() => _converting = true);
    try {
      // 先查授权（拼多多等需要推广位备案）
      try {
        final st = await api.authzStatus(g.platform);
        if (st['needAuth'] == true) {
          final url = await api.authzUrl(g.platform);
          final u = url['url']?.toString() ?? url['authUrl']?.toString() ?? '';
          if (u.isNotEmpty) {
            await launchUrl(Uri.parse(u), mode: LaunchMode.externalApplication);
          }
          _toast('需要先完成平台授权');
          return;
        }
      } catch (_) {
        // 授权接口失败不阻断，继续尝试转链
      }

      final link = await api.convert(g.platform, g.goodsId);
      final opened = await launchConvert(link);
      if (opened.isEmpty && mounted) _toast('暂时无法打开，请稍后再试');
    } catch (e) {
      if (mounted) _toast(e.toString());
    } finally {
      if (mounted) setState(() => _converting = false);
    }
  }

  void _toast(String m) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(m), duration: const Duration(seconds: 2)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(title: const Text('商品详情')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _g == null
              ? const Center(child: Text('商品已下架或不存在', style: TextStyle(color: AppColors.textMuted)))
              : _buildBody(_g!),
      bottomNavigationBar: _g == null ? null : _buildBottomBar(_g!),
    );
  }

  Widget _buildBody(Goods g) {
    final imgs = g.images.isNotEmpty ? g.images : (g.image.isNotEmpty ? [g.image] : <String>[]);
    return ListView(
      children: [
        // 主图
        SizedBox(
          height: 340,
          child: imgs.isEmpty
              ? Container(color: const Color(0xFFF5F5F5))
              : PageView.builder(
                  itemCount: imgs.length,
                  onPageChanged: (i) => setState(() => _imgIndex = i),
                  itemBuilder: (_, i) => CachedNetworkImage(
                    imageUrl: imgs[i],
                    fit: BoxFit.contain,
                    placeholder: (_, __) => Container(color: const Color(0xFFF7F8FA)),
                  ),
                ),
        ),
        if (imgs.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('${_imgIndex + 1}/${imgs.length}',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ),

        // 价格区
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  const Text('¥', style: TextStyle(color: AppColors.primary, fontSize: 16)),
                  Text(Fmt.money(g.couponPrice > 0 ? g.couponPrice : g.price),
                      style: const TextStyle(
                          color: AppColors.primary, fontSize: 32, fontWeight: FontWeight.w800)),
                  if (g.couponPrice > 0) ...[
                    const SizedBox(width: 8),
                    Text('¥${Fmt.money(g.price)}',
                        style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 14,
                            decoration: TextDecoration.lineThrough)),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text('券省 ¥${Fmt.money(g.couponAmount)}',
                          style: const TextStyle(color: AppColors.primary, fontSize: 11)),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              Text(g.title, style: const TextStyle(fontSize: 16, height: 1.4)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(Fmt.platform(g.platform),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSub)),
                  const SizedBox(width: 10),
                  if (g.shopName.isNotEmpty)
                    Text(g.shopName,
                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                  const Spacer(),
                  Text('${Fmt.sales(g.salesVolume)}人已买',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ],
          ),
        ),

        const Divider(height: 1, color: Color(0xFFF0F0F0)),

        // 返利账
        Container(
          margin: const EdgeInsets.all(12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _row('券后价', '¥${Fmt.money(g.couponPrice > 0 ? g.couponPrice : g.price)}'),
              _row('预计返利', '- ¥${Fmt.money(g.rebate)}', highlight: true),
              const Divider(height: 18, color: Color(0x33FF4B3A)),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('到手价',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  Text('¥${Fmt.money(g.afterRebate)}',
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.primary)),
                ],
              ),
              const SizedBox(height: 8),
              const Text('返利按每笔订单联盟实际结算计算，实际以联盟结算为准',
                  style: TextStyle(fontSize: 11, color: AppColors.textMuted, height: 1.5)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSub)),
          Text(value,
              style: TextStyle(
                fontSize: highlight ? 13 : 13,
                color: highlight ? AppColors.primary : AppColors.textMain,
                fontWeight: highlight ? FontWeight.w700 : FontWeight.w400,
              )),
        ],
      ),
    );
  }

  Widget _buildBottomBar(Goods g) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFF0F0F0))),
        ),
        child: Row(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('预计返 ¥${Fmt.money(g.rebate)}',
                    style: const TextStyle(
                        color: AppColors.primary, fontSize: 15, fontWeight: FontWeight.w800)),
                const Text('券后价在返利基础上还能省',
                    style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: _converting ? null : _buy,
                child: _converting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('领券购买 · ${Fmt.platform(g.platform)}'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
