import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/http/api.dart';
import 'auth_controller.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});
  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _mobile = TextEditingController();
  final _password = TextEditingController();
  final _captcha = TextEditingController();
  final _sms = TextEditingController();
  final _invite = TextEditingController();

  String _captchaKey = '';
  String _captchaSvg = '';
  int _countdown = 0;
  bool _loading = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _refreshCaptcha();
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in [_mobile, _password, _captcha, _sms, _invite]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _refreshCaptcha() async {
    try {
      final r = await api.captcha();
      setState(() {
        _captchaKey = r['key']?.toString() ?? '';
        _captchaSvg = r['svg']?.toString() ?? '';
      });
    } catch (_) {}
  }

  Future<void> _sendSms() async {
    final mobile = _mobile.text.trim();
    if (mobile.length != 11) {
      _toast('请输入正确的手机号');
      return;
    }
    try {
      await api.sendSms(mobile);
      _toast('验证码已发送');
      setState(() => _countdown = 60);
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 1), (t) {
        if (!mounted) {
          t.cancel();
          return;
        }
        setState(() => _countdown = _countdown - 1);
        if (_countdown <= 0) t.cancel();
      });
    } catch (e) {
      _toast(e.toString());
      _refreshCaptcha();
    }
  }

  Future<void> _submit() async {
    if (_mobile.text.trim().length != 11) return _toast('请输入正确的手机号');
    if (_password.text.length < 6) return _toast('密码至少 6 位');
    if (_captcha.text.isEmpty) return _toast('请输入图形验证码');
    if (_sms.text.isEmpty) return _toast('请输入短信验证码');

    setState(() => _loading = true);
    final err = await ref.read(authProvider.notifier).register(
          mobile: _mobile.text.trim(),
          password: _password.text,
          captcha: _captcha.text.trim(),
          captchaKey: _captchaKey,
          smsCode: _sms.text.trim(),
          inviteCode: _invite.text.trim(),
        );
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null) {
      _toast(err);
      _refreshCaptcha();
    } else {
      context.go('/');
    }
  }

  void _toast(String m) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(m), duration: const Duration(seconds: 2)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(title: const Text('注册')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            TextField(
              controller: _mobile,
              keyboardType: TextInputType.phone,
              maxLength: 11,
              decoration: const InputDecoration(hintText: '手机号', counterText: ''),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _captcha,
                    decoration: const InputDecoration(hintText: '图形验证码'),
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: _refreshCaptcha,
                  child: Container(
                    width: 110,
                    height: 48,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF7F8FA),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: _captchaSvg.isEmpty
                        ? const Text('获取', style: TextStyle(color: AppColors.textMuted, fontSize: 13))
                        : SvgPicture.string(_captchaSvg, width: 100, height: 40),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _sms,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(hintText: '短信验证码'),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 110,
                  height: 48,
                  child: OutlinedButton(
                    onPressed: _countdown > 0 ? null : _sendSms,
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.zero,
                      side: const BorderSide(color: AppColors.primary),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text(
                      _countdown > 0 ? '${_countdown}s' : '获取验证码',
                      style: TextStyle(fontSize: 13, color: _countdown > 0 ? AppColors.textMuted : AppColors.primary),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(hintText: '设置密码（至少 6 位）'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _invite,
              decoration: const InputDecoration(hintText: '邀请码（选填）'),
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('注册并登录'),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
