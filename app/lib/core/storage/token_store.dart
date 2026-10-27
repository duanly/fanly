import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// JWT 安全存储。
/// iOS Keychain / Android Keystore，比 SharedPreferences 安全，
/// 后续 local_auth 生物识别可在此基础上加解锁门槛。
class TokenStore {
  TokenStore._();
  static final TokenStore instance = TokenStore._();

  static const _kToken = 'token'; // 用户端 token
  static const _kAdminToken = 'admin_token';

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<String?> get token => _storage.read(key: _kToken);
  Future<String?> get adminToken => _storage.read(key: _kAdminToken);

  Future<void> setToken(String? v) async {
    if (v == null || v.isEmpty) {
      await _storage.delete(key: _kToken);
    } else {
      await _storage.write(key: _kToken, value: v);
    }
  }

  Future<void> clearToken() => _storage.delete(key: _kToken);
}
