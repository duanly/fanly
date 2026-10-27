import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/http/api.dart';
import '../../core/models/home_link.dart';

class HomeSideState {
  final List<HomeLink> banners;
  final List<HomeLink> entries;
  final List<HomeLink> categories;
  final bool loading;
  const HomeSideState({
    this.banners = const [],
    this.entries = const [],
    this.categories = const [],
    this.loading = true,
  });

  HomeSideState copyWith({
    List<HomeLink>? banners,
    List<HomeLink>? entries,
    List<HomeLink>? categories,
    bool? loading,
  }) {
    return HomeSideState(
      banners: banners ?? this.banners,
      entries: entries ?? this.entries,
      categories: categories ?? this.categories,
      loading: loading ?? this.loading,
    );
  }
}

class HomeSideNotifier extends AsyncNotifier<HomeSideState> {
  @override
  Future<HomeSideState> build() => _load();

  Future<HomeSideState> _load() async {
    // 各块独立失败互不牵连；banner 后台没配时用兜底
    final results = await Future.wait([
      api.homeLinks('banner').catchError((_) => <Map<String, dynamic>>[]),
      api.homeLinks('entry').catchError((_) => <Map<String, dynamic>>[]),
      api.homeLinks('category').catchError((_) => <Map<String, dynamic>>[]),
    ]);

    final banners = results[0].map(HomeLink.fromJson).toList();
    return HomeSideState(
      banners: banners.isNotEmpty ? banners : _fallbackBanners(),
      entries: results[1].map(HomeLink.fromJson).toList(),
      categories: results[2].map(HomeLink.fromJson).toList(),
      loading: false,
    );
  }

  Future<void> refresh() async {
    state = AsyncData(await _load());
  }

  /// 后台没配 banner 时的兜底（对应 H5 FALLBACK_BANNERS）
  List<HomeLink> _fallbackBanners() => const [
        HomeLink(id: -1, title: '天天签到领金币', subtitle: '连续签到 7 天 · 攒够直接提现',
            image: 'linear-gradient(135deg,#ff9f43,#ee5a24)', url: '/checkin', internal: true),
        HomeLink(id: -2, title: '吃喝玩乐都省钱', subtitle: '外卖 · 奶茶 · 电影 · 酒店 最高省 30%',
            image: 'linear-gradient(135deg,#7c4dff,#448aff)', url: '/local-life', internal: true),
        HomeLink(id: -3, title: '网购先查返利', subtitle: '淘宝 · 京东 · 拼多多 · 唯品会 隐藏券',
            image: 'linear-gradient(135deg,#ff3b30,#af52de)', url: '/category/all', internal: true),
        HomeLink(id: -4, title: '邀请好友一起做推广', subtitle: '好友下单赚佣金 · 长期分成',
            image: 'linear-gradient(135deg,#ff4081,#d500f9)', url: '/agent', internal: true),
      ];
}

final homeSideProvider =
    AsyncNotifierProvider<HomeSideNotifier, HomeSideState>(HomeSideNotifier.new);
