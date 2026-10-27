import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/http/api.dart';
import '../../core/storage/token_store.dart';

/// 登录态。profile 为 null 即未登录；bootstrapped 表示启动时是否已检查过本地 token。
class AuthState {
  final Map<String, dynamic>? profile;
  final bool bootstrapped;
  const AuthState({this.profile, this.bootstrapped = false});

  bool get isLoggedIn => profile != null;

  AuthState copyWith({Map<String, dynamic>? profile, bool? bootstrapped, bool clearProfile = false}) {
    return AuthState(
      profile: clearProfile ? null : (profile ?? this.profile),
      bootstrapped: bootstrapped ?? this.bootstrapped,
    );
  }
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() => const AuthState();

  /// 启动：本地有 token 就拉一次 profile，判定登录是否还有效
  Future<void> bootstrap() async {
    final token = await TokenStore.instance.token;
    if (token == null || token.isEmpty) {
      state = const AuthState(bootstrapped: true);
      return;
    }
    try {
      final p = await api.profile();
      state = AuthState(profile: p, bootstrapped: true);
    } catch (_) {
      await TokenStore.instance.clearToken();
      state = const AuthState(bootstrapped: true);
    }
  }

  Future<void> refreshProfile() async {
    final p = await api.profile();
    state = state.copyWith(profile: p);
  }

  /// 返回 null 成功；否则返回错误信息
  Future<String?> login(String mobile, String password) async {
    try {
      final r = await api.login(mobile, password);
      final token = r['token']?.toString();
      if (token == null || token.isEmpty) return '登录返回异常';
      await TokenStore.instance.setToken(token);
      final p = await api.profile();
      state = state.copyWith(profile: p, bootstrapped: true);
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  Future<String?> register({
    required String mobile,
    required String password,
    required String captcha,
    required String captchaKey,
    required String smsCode,
    String? inviteCode,
  }) async {
    try {
      final r = await api.register(
        mobile: mobile,
        password: password,
        captcha: captcha,
        captchaKey: captchaKey,
        smsCode: smsCode,
        inviteCode: inviteCode,
      );
      final token = r['token']?.toString();
      if (token != null && token.isNotEmpty) {
        await TokenStore.instance.setToken(token);
        final p = await api.profile();
        state = state.copyWith(profile: p, bootstrapped: true);
      }
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  Future<void> logout() async {
    await TokenStore.instance.clearToken();
    state = const AuthState(bootstrapped: true);
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
