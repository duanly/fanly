import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/http/api.dart';
import '../../core/models/goods.dart';

/// 榜单分页状态（每个类型独立）
class RankingState {
  final List<Goods> list;
  final int page;
  final bool loading;
  final bool finished;
  const RankingState({this.list = const [], this.page = 1, this.loading = false, this.finished = false});

  RankingState copyWith({List<Goods>? list, int? page, bool? loading, bool? finished}) {
    return RankingState(
      list: list ?? this.list,
      page: page ?? this.page,
      loading: loading ?? this.loading,
      finished: finished ?? this.finished,
    );
  }
}

class RankingNotifier extends FamilyNotifier<RankingState, String> {
  late final String _type;

  @override
  RankingState build(String arg) {
    _type = arg;
    return const RankingState();
  }

  Future<void> load({bool reset = false, String? sortBy}) async {
    if (state.loading) return;
    final page = reset ? 1 : state.page;
    state = state.copyWith(loading: true, page: reset ? 1 : null);
    try {
      final r = await api.ranking(_type, page: page, sortBy: sortBy);
      final rows = Goods.fromList(r['list']);
      final hasMore = r['hasMore'] != false && rows.length >= 20;
      state = state.copyWith(
        list: reset ? rows : [...state.list, ...rows],
        page: page + 1,
        loading: false,
        finished: !hasMore,
      );
    } catch (_) {
      state = state.copyWith(loading: false, finished: true);
    }
  }
}

final rankingProvider =
    NotifierProvider.family<RankingNotifier, RankingState, String>(RankingNotifier.new);

/// 当前选中的榜单 tab
final rankTabProvider = StateProvider<String>((_) => 'hot');

/// 返利榜排序：amount 绝对金额 / rate 返佣比例
final rebateSortProvider = StateProvider<String>((_) => 'amount');
