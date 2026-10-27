import 'package:flutter/material.dart';
import '../../../core/widgets/gradient_icon_box.dart';

/// 宫格数据项
class GridEntry {
  final String name;
  final String tag;
  final String emoji;
  final String gradient;
  final VoidCallback onTap;
  const GridEntry({
    required this.name,
    required this.emoji,
    required this.gradient,
    required this.onTap,
    this.tag = '',
  });
}

/// 5 列分页宫格轮播（复刻 H5 本地生活/品类宫格，每页 10 个，两行五列）。
class PagedIconGrid extends StatefulWidget {
  final List<GridEntry> entries;
  final int perPage;
  final Color indicatorColor;
  final double iconSize;
  const PagedIconGrid({
    super.key,
    required this.entries,
    this.perPage = 10,
    this.indicatorColor = const Color(0x4DFF9500),
    this.iconSize = 44,
  });

  @override
  State<PagedIconGrid> createState() => _PagedIconGridState();
}

class _PagedIconGridState extends State<PagedIconGrid> {
  final _pc = PageController();
  int _idx = 0;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = <List<GridEntry>>[];
    for (var i = 0; i < widget.entries.length; i += widget.perPage) {
      pages.add(widget.entries.sublist(
          i, (i + widget.perPage).clamp(0, widget.entries.length)));
    }
    if (pages.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          height: 132,
          child: PageView.builder(
            controller: _pc,
            onPageChanged: (i) => setState(() => _idx = i),
            itemCount: pages.length,
            itemBuilder: (_, pi) {
              return GridView.count(
                crossAxisCount: 5,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                mainAxisSpacing: 8,
                childAspectRatio: 0.72,
                children: pages[pi].map((e) => _cell(e)).toList(),
              );
            },
          ),
        ),
        if (pages.length > 1)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(pages.length, (i) {
              final active = i == _idx;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 14 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: active ? const Color(0xFFFF9500) : widget.indicatorColor,
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
      ],
    );
  }

  Widget _cell(GridEntry e) {
    return GestureDetector(
      onTap: e.onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GradientIconBox(
            gradient: e.gradient,
            emoji: e.emoji,
            size: widget.iconSize,
          ),
          const SizedBox(height: 4),
          Text(e.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF333333))),
          if (e.tag.isNotEmpty)
            Text(e.tag,
                style: const TextStyle(fontSize: 10, color: Color(0xFFFF9500))),
        ],
      ),
    );
  }
}
