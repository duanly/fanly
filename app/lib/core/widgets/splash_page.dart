import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// 启动屏：bootstrap 检查本地 token 期间显示
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('省钱猫',
                style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: AppColors.primary)),
            SizedBox(height: 18),
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
          ],
        ),
      ),
    );
  }
}
