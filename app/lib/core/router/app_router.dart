import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/login_page.dart';
import '../../features/auth/register_page.dart';
import '../../features/home/home_shell.dart';
import '../../features/goods/goods_detail_page.dart';
import '../widgets/splash_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  // auth 状态变化时通知路由重算（登录/退出/启动 bootstrap 完成）
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;

      // 启动检查未完成：停在 splash
      if (!auth.bootstrapped) {
        return loc == '/splash' ? null : '/splash';
      }

      final atAuth = loc == '/login' || loc == '/register';
      if (!auth.isLoggedIn) {
        // 未登录：只允许登录/注册/splash
        return atAuth ? null : '/login';
      }
      // 已登录：登录页和 splash 都回首页
      if (atAuth || loc == '/splash') return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
      GoRoute(path: '/', builder: (_, __) => const HomeShell()),
      GoRoute(
        path: '/goods/:platform/:goodsId',
        builder: (_, st) => GoodsDetailPage(
          platform: st.pathParameters['platform']!,
          goodsId: st.pathParameters['goodsId']!,
        ),
      ),
    ],
  );
});
