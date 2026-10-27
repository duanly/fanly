import 'package:flutter/material.dart';

/// 平台标识唯一来源（与 H5 utils/platform.js 一致）
class Plat {
  final String key;
  final String name;
  final String short;
  final String bg; // 品牌色 hex
  const Plat(this.key, this.name, this.short, this.bg);

  Color get color => Color(int.parse('FF${bg.replaceFirst('#', '')}', radix: 16));
}

const _plats = <Plat>[
  Plat('TB', '淘宝', '淘', '#ff5000'),
  Plat('JD', '京东', '京', '#c81623'),
  Plat('VIP', '唯品会', '唯', '#ff2d52'),
  Plat('PDD', '拼多多', '多', '#e02e24'),
  Plat('JTK', '本地生活', '生', '#ff9500'),
];

Plat? platOf(String? key) {
  for (final p in _plats) {
    if (p.key == key) return p;
  }
  return null;
}

String platName(String? key) => platOf(key)?.name ?? (key ?? '');
String platShort(String? key) => platOf(key)?.short ?? (key ?? '').characters.first;
Color platColor(String? key) => platOf(key)?.color ?? const Color(0xFF969799);
