import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// 转链查返利（阶段 0 占位；阶段 2 接入剪贴板识别 + 自动转链唤起）
class ParsePage extends StatelessWidget {
  const ParsePage({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('转链查返利')),
      body: const Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          children: [
            TextField(
              maxLines: 4,
              decoration: InputDecoration(
                hintText: '把淘宝 / 京东 / 拼多多 / 唯品会的商品链接或口令粘贴到这里',
              ),
            ),
            SizedBox(height: 16),
            Text('转链功能将在下一阶段上线', style: TextStyle(color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}
