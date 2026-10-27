import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// 分类（阶段 0 占位；阶段 1 实现品类与商品流）
class CategoryPage extends StatelessWidget {
  const CategoryPage({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('分类')),
      body: const Center(
        child: Text('分类页 · 下一阶段上线', style: TextStyle(color: AppColors.textMuted)),
      ),
    );
  }
}
