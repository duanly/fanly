import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

/// 唤起外部购物 App / 浏览器。
/// 优先级：deeplink（App scheme）→ shortUrl（H5）。
/// 与 H5 Parse.vue 的 openApp 策略一致。
Future<String> launchConvert(Map<String, dynamic> link) async {
  final candidates = [
    link['deeplink']?.toString(),
    link['shortUrl']?.toString(),
    link['shortH5']?.toString(),
    link['url']?.toString(),
  ].whereType<String>().where((s) => s.isNotEmpty).toList();

  for (final url in candidates) {
    final uri = Uri.tryParse(url);
    if (uri == null) continue;
    final ok = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
    if (ok) return url;
  }
  return '';
}

/// 复制淘口令到剪贴板
Future<void> copyText(String text) async {
  await Clipboard.setData(ClipboardData(text: text));
}
