import 'package:flutter/material.dart';

/// 签到入口条（复刻 H5 .checkin-bar）。本期点击先 toast，阶段 3 接签到页。
class CheckinBar extends StatelessWidget {
  final VoidCallback? onTap;
  const CheckinBar({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 44,
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFFF5E6), Color(0xFFFFF0ED)],
          ),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFFFE0CC)),
          boxShadow: const [
            BoxShadow(color: Color(0x26FF9632), blurRadius: 10, offset: Offset(0, 2)),
          ],
        ),
        child: Row(
          children: [
            const Text('🎁', style: TextStyle(fontSize: 20)),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('每日签到领金币',
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFFFF6B35))),
                  Text('攒够就能换钱 · 今天还没签',
                      style: TextStyle(fontSize: 11, color: Color(0xFF999999))),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(999),
                boxShadow: const [
                  BoxShadow(color: Color(0x26FF4B3A), blurRadius: 6, offset: Offset(0, 2)),
                ],
              ),
              child: const Row(
                children: [
                  Text('去签到',
                      style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFFF4B3A))),
                  Icon(Icons.chevron_right, size: 14, color: Color(0xFFFF4B3A)),
                ],
              ),

            ),
          ],
        ),
      ),
    );
  }
}
