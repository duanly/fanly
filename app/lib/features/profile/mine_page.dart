import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/rate.dart';
import '../auth/auth_controller.dart';

class MinePage extends ConsumerWidget {
  const MinePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(authProvider).profile ?? {};
    final nickname = p['nickname']?.toString().isNotEmpty == true
        ? p['nickname'].toString()
        : (p['mobile']?.toString() ?? '用户');
    final avatar = p['avatar']?.toString() ?? '';
    final mobile = p['mobile']?.toString() ?? '';
    final userRate = displayRatePct(p['userRebateRate'] is num
        ? (p['userRebateRate'] as num).toDouble()
        : double.tryParse(p['userRebateRate']?.toString() ?? ''));
    final agentRate = displayRatePct(p['agentRate'] is num
        ? (p['agentRate'] as num).toDouble()
        : double.tryParse(p['agentRate']?.toString() ?? ''));

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 28,
                bottom: 24,
                left: 20,
                right: 20,
              ),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFFF6A35), AppColors.primary],
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: Colors.white24,
                    backgroundImage: avatar.startsWith('http')
                        ? CachedNetworkImageProvider(avatar)
                        : null,
                    child: avatar.startsWith('http')
                        ? null
                        : Text(nickname.characters.first,
                            style: const TextStyle(color: Colors.white, fontSize: 22)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(nickname,
                            style: const TextStyle(
                                color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text(mobile,
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Transform.translate(
              offset: const Offset(0, -18),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    Expanded(child: _rateItem('自购返利', '$userRate%')),
                    Container(width: 1, height: 34, color: AppColors.line),
                    Expanded(child: _rateItem('推广分成', '$agentRate%')),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                children: [
                  _todoTile(Icons.account_balance_wallet_outlined, '我的钱包'),
                  _todoTile(Icons.receipt_long_outlined, '我的订单'),
                  _todoTile(Icons.people_alt_outlined, '推广中心'),
                  _todoTile(Icons.headset_mic_outlined, '联系客服'),
                  _todoTile(Icons.verified_user_outlined, '实名认证'),
                  ListTile(
                    leading: const Icon(Icons.logout, color: AppColors.danger),
                    title: const Text('退出登录', style: TextStyle(color: AppColors.danger)),
                    onTap: () async {
                      await ref.read(authProvider.notifier).logout();
                      if (context.mounted) context.go('/login');
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _rateItem(String label, String value) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primary)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
      ],
    );
  }

  Widget _todoTile(IconData icon, String label) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSub),
      title: Text(label),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
      onTap: () {},
    );
  }
}
