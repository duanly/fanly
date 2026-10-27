import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/home_link.dart';
import '../../../core/theme/app_theme.dart';

/// 首页 banner 轮播。渐变背景直接画；图片 URL 铺底。站内路由跳转、外链暂占位。
class HomeBanner extends StatefulWidget {
  final List<HomeLink> banners;
  const HomeBanner({super.key, required this.banners});

  @override
  State<HomeBanner> createState() => _HomeBannerState();
}

class _HomeBannerState extends State<HomeBanner> {
  final _page = PageController();
  int _index = 0;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  void _onTap(HomeLink b) {
    if (!b.internal) return; // 外链阶段 3 接 url_launcher
    final path = b.url;
    // 映射 H5 站内路径到 Flutter 路由；阶段 1 只跳已实现的
    if (path.startsWith('/goods/')) {
      context.push(path);
    } else if (path == '/parse') {
      // 底部 Tab 由 shell 管理，这里暂不跳
    }
  }

  Decoration? _decoration(String image) {
    if (image.contains('gradient')) {
      // 把 linear-gradient(135deg,#a,#b) 近似为对角渐变
      final colors = RegExp(r'#([0-9a-fA-F]{6})').allMatches(image).map((m) {
        final hex = m.group(1)!;
        return Color(int.parse('FF$hex', radix: 16));
      }).toList();
      if (colors.length >= 2) {
        return BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: colors,
          ),
        );
      }
    }
    return const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFFF6B35), Color(0xFFF7931E)],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.banners;
    if (list.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          height: 150,
          child: PageView.builder(
            controller: _page,
            onPageChanged: (i) => setState(() => _index = i),
            itemCount: list.length,
            itemBuilder: (_, i) {
              final b = list[i];
              final isImg = b.isImageUrl;
              return GestureDetector(
                onTap: () => _onTap(b),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: isImg ? null : _decoration(b.image),
                  clipBehavior: Clip.antiAlias,
                  child: isImg
                      ? CachedNetworkImage(imageUrl: b.image, fit: BoxFit.cover)
                      : Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(b.title,
                                  style: const TextStyle(
                                      color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 7),
                              Text(b.subtitle,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.92), fontSize: 12.5)),
                            ],
                          ),
                        ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 7),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(list.length, (i) {
            final active = i == _index;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: active ? 14 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: active ? AppColors.primary : const Color(0x33FF4B3A),
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }
}
