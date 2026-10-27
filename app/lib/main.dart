import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/http/dio_client.dart';
import 'features/auth/auth_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final container = ProviderContainer();

  // 401：清登录态，路由守卫会自动跳登录页
  DioClient.instance.onUnauthorized = () {
    container.read(authProvider.notifier).logout();
  };

  // 启动时检查本地 token，决定直接进首页还是登录页
  await container.read(authProvider.notifier).bootstrap();

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const FanliApp(),
    ),
  );
}
