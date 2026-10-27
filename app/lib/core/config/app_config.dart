/// 运行环境配置。
///
/// baseUrl 通过 --dart-define 注入，避免把域名写死在代码里：
///   flutter run --dart-define=API_BASE=https://api.example.com
///
/// - iOS 模拟器访问宿主机：http://localhost:3000
/// - Android 模拟器访问宿主机：http://10.0.2.2:3000
/// - 真机 / 生产环境：https://你的域名
class AppConfig {
  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://localhost:3000',
  );
}
