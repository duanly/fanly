/// 首页配置项（banner / 八大分区 / 活动位共用 home_link 表）
class HomeLink {
  final int id;
  final String slot;
  final String title;
  final String subtitle;
  final String icon;
  final String image; // 图片 URL 或 CSS 渐变
  final String url;
  final bool internal;
  final int sortWeight;

  const HomeLink({
    required this.id,
    this.slot = 'entry',
    this.title = '',
    this.subtitle = '',
    this.icon = '',
    this.image = '',
    this.url = '',
    this.internal = false,
    this.sortWeight = 0,
  });

  bool get isImageUrl => image.startsWith('http') || image.startsWith('/');
  bool get isGradient => image.contains('gradient');

  factory HomeLink.fromJson(Map<String, dynamic> j) => HomeLink(
        id: (j['id'] as num?)?.toInt() ?? 0,
        slot: j['slot']?.toString() ?? 'entry',
        title: j['title']?.toString() ?? '',
        subtitle: j['subtitle']?.toString() ?? '',
        icon: j['icon']?.toString() ?? '',
        image: j['image']?.toString() ?? '',
        url: j['url']?.toString() ?? '',
        internal: j['internal'] == true,
        sortWeight: (j['sortWeight'] as num?)?.toInt() ?? 0,
      );
}
