import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/goods_card.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/section_header.dart';
import 'home_side_controller.dart';
import 'home_ranking_controller.dart';
import 'home_data.dart';
import 'widgets/home_banner.dart';
import 'widgets/checkin_bar.dart';
import 'widgets/paged_icon_grid.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});
  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final _scroll = ScrollController();
  static const _tabs = [
    ('hot', '🔥 热销榜'),
    ('rebate', '💰 返利榜'),
    ('pick', '⭐️ 推荐榜'),
  ];

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(rankingProvider('hot').notifier).load(reset: true);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) {
      final type = ref.read(rankTabProvider);
      final s = ref.read(rankingProvider(type));
      if (!s.loading && !s.finished) {
        ref.read(rankingProvider(type).notifier).load(
              sortBy: type == 'rebate' ? ref.read(rebateSortProvider) : null,
            );
      }
    }
  }

  void _switchTab(String type) {
    ref.read(rankTabProvider.notifier).state = type;
    final s = ref.read(rankingProvider(type));
    if (s.list.isEmpty && !s.loading) {
      ref.read(rankingProvider(type).notifier).load(
            reset: true,
            sortBy: type == 'rebate' ? ref.read(rebateSortProvider) : null,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final side = ref.watch(homeSideProvider);
    final type = ref.watch(rankTabProvider);
    final rank = ref.watch(rankingProvider(type));

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          await ref.read(homeSideProvider.notifier).refresh();
          await ref.read(rankingProvider(type).notifier).load(
                reset: true,
                sortBy: type == 'rebate' ? ref.read(rebateSortProvider) : null,
              );
        },
        child: CustomScrollView(
          controller: _scroll,
          slivers: [
            // ───── 顶部粉色渐变区：搜索 + banner + 签到 ─────
            SliverToBoxAdapter(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: [0, 0.55, 1],
                    colors: [Color(0xFFFFF0ED), Color(0xFFFFF7F5), AppColors.bg],
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Column(
                    children: [
                      SizedBox(height: MediaQuery.of(context).padding.top + 12),
                      // 搜索栏（阶段 2 接搜索页）
                      GestureDetector(
                        onTap: () {},
                        child: Container(
                          height: 36,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: const [
                              BoxShadow(
                                  color: Color(0x1AFF4B3A),
                                  blurRadius: 10,
                                  offset: Offset(0, 2)),
                            ],
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.search, size: 16, color: AppColors.primary),
                              SizedBox(width: 6),
                              Text('搜隐藏优惠券 · 搜什么都返',
                                  style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      // Banner
                      side.maybeWhen(
                        data: (s) => HomeBanner(banners: s.banners),
                        orElse: () => const SizedBox(height: 150),
                      ),
                      // 签到条
                      const CheckinBar(),
                      const SizedBox(height: 4),
                    ],
                  ),
                ),
              ),
            ),

            // ───── 本地生活宫格 ─────
            SliverToBoxAdapter(
              child: Column(
                children: [
                  const SectionHeader(title: '本地生活 🍔', more: '全部'),
                  Container(
                    margin: const EdgeInsets.fromLTRB(12, 0, 12, 0),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: PagedIconGrid(entries: localLifeEntries(context)),
                  ),
                ],
              ),
            ),

            // ───── 好物推荐（榜单）─────
            SliverToBoxAdapter(
              child: const SectionHeader(title: '好物推荐 👍', more: '全部'),
            ),

            // 榜单 tab（非吸顶，内容流里）
            SliverToBoxAdapter(
              child: Container(
                color: AppColors.bg,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(
                  children: [
                    ..._tabs.map((t) {
                      final active = t.$1 == type;
                      return GestureDetector(
                        onTap: () => _switchTab(t.$1),
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          child: Column(
                            children: [
                              Text(
                                t.$2,
                                style: TextStyle(
                                  fontSize: active ? 16 : 14,
                                  fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                                  color: active ? AppColors.primary : AppColors.textMuted,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Container(
                                width: 16,
                                height: 3,
                                decoration: BoxDecoration(
                                  color: active ? AppColors.primary : Colors.transparent,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                    const Spacer(),
                    if (type == 'rebate')
                      GestureDetector(
                        onTap: () {
                          final next = ref.read(rebateSortProvider) == 'amount' ? 'rate' : 'amount';
                          ref.read(rebateSortProvider.notifier).state = next;
                          ref.read(rankingProvider('rebate').notifier).load(reset: true, sortBy: next);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFFF6B35), AppColors.primary],
                            ),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            ref.watch(rebateSortProvider) == 'amount' ? '💰 返利金额' : '📈 返佣比例',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // 商品瀑布流
            if (rank.list.isEmpty && !rank.loading)
              const SliverToBoxAdapter(
                child: EmptyState(text: '榜单在积累中，先看看别的分区'),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 0.60,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => GoodsCard(g: rank.list[i]),
                    childCount: rank.list.length,
                  ),
                ),
              ),

            if (rank.loading)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 18),
                  child: Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                    ),
                  ),
                ),
              ),

            // 底部留白
            const SliverToBoxAdapter(child: SizedBox(height: 20)),
          ],
        ),
      ),
    );
  }
}
