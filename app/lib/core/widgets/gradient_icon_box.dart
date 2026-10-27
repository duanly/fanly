import 'package:flutter/material.dart';

/// 渐变圆角图标盒（复刻 H5 .ll-ico/.cat-ico）。
/// 传入 "linear-gradient(135deg,#a,#b)" 字符串解析成 LinearGradient。
class GradientIconBox extends StatelessWidget {
  final String gradient;
  final String emoji;
  final double size;
  final double radius;
  const GradientIconBox({
    super.key,
    required this.gradient,
    required this.emoji,
    this.size = 44,
    this.radius = 14,
  });

  static const _fallback = [Color(0xFFFF6B35), Color(0xFFF7931E)];

  List<Color> _colors() {
    final m = RegExp(r'#([0-9a-fA-F]{6})').allMatches(gradient);
    final list = m
        .map((x) => Color(int.parse('FF${x.group(1)!}', radix: 16)))
        .toList();
    return list.length >= 2 ? list : _fallback;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: _colors(),
        ),
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [
          BoxShadow(color: Color(0x14000000), blurRadius: 10, offset: Offset(0, 4)),
        ],
      ),
      alignment: Alignment.center,
      child: Text(emoji, style: TextStyle(fontSize: size * 0.5)),
    );
  }
}
