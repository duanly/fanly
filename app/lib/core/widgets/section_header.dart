import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// 区块标题（复刻 H5 .sec-head-wrap）：左侧标题、右侧「全部 ›」
class SectionHeader extends StatelessWidget {
  final String title;
  final String? more;
  final VoidCallback? onMore;
  const SectionHeader({super.key, required this.title, this.more, this.onMore});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textMain)),
          if (more != null)
            GestureDetector(
              onTap: onMore,
              behavior: HitTestBehavior.opaque,
              child: Row(
                children: [
                  Text(more!,
                      style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
                  const Icon(Icons.chevron_right, size: 16, color: AppColors.textMuted),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
