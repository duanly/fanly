import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import 'auth_controller.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});
  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _mobile = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _obscure = true;

  @override
  void dispose() {
    _mobile.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final mobile = _mobile.text.trim();
    final password = _password.text;
    if (mobile.length != 11) {
      _toast('请输入正确的手机号');
      return;
    }
    if (password.length < 6) {
      _toast('密码至少 6 位');
      return;
    }
    setState(() => _loading = true);
    final err = await ref.read(authProvider.notifier).login(mobile, password);
    if (!mounted) return;
    setState(() => _loading = false);
    if (err != null) {
      _toast(err);
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
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 72),
              const Text('省钱猫',
                  style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: AppColors.primary)),
              const SizedBox(height: 8),
              const Text('买啥都返现 · 搜隐藏优惠券',
                  style: TextStyle(fontSize: 14, color: AppColors.textMuted)),
              const SizedBox(height: 48),
              TextField(
                controller: _mobile,
                keyboardType: TextInputType.phone,
                maxLength: 11,
                decoration: const InputDecoration(hintText: '手机号', counterText: ''),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _password,
                obscureText: _obscure,
                decoration: InputDecoration(
                  hintText: '密码',
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility,
                        color: AppColors.textMuted),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('登录'),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(
                    onPressed: () => context.push('/register'),
                    child: const Text('新用户注册'),
                  ),
                  const Text('忘记密码？联系客服重置',
                      style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
