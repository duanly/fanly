import 'package:flutter/material.dart';

/// 品牌色与 H5（省钱猫）保持一致
class AppColors {
  static const Color primary = Color(0xFFFF4B3A); // 主品牌红
  static const Color primaryDark = Color(0xFFE03A2A);
  static const Color primarySoft = Color(0xFFFFF1EF);
  static const Color orange = Color(0xFFFF9500);
  static const Color gold = Color(0xFFFFB020);
  static const Color success = Color(0xFF07C160);
  static const Color danger = Color(0xFFEE0A24);
  static const Color info = Color(0xFF1989FA);

  static const Color textMain = Color(0xFF1A1A1A);
  static const Color textSub = Color(0xFF666666);
  static const Color textMuted = Color(0xFF999999);
  static const Color line = Color(0xFFEEEEEE);
  static const Color bg = Color(0xFFF5F6F8);
  static const Color card = Colors.white;
}

class AppTheme {
  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: AppColors.bg,
      fontFamily: null,
    );

    return base.copyWith(
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textMain,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: AppColors.textMain,
          fontSize: 17,
          fontWeight: FontWeight.w600,
        ),
        surfaceTintColor: Colors.transparent,
      ),
      cardColor: AppColors.card,
      dividerColor: AppColors.line,
      splashFactory: NoSplash.splashFactory,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF7F8FA),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.2),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.primary),
      ),
    );
  }
}
