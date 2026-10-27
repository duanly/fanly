import 'package:flutter/material.dart';
import 'home_page.dart';
import '../goods/category_page.dart';
import '../goods/parse_page.dart';
import '../profile/mine_page.dart';

/// 底部 4 Tab 主壳：首页 / 分类 / 转链 / 我的。
/// 阶段 0 用 IndexedStack 保持各 tab 状态；阶段 1 商品详情等二级页用根 navigator push。
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _pages = [
    HomePage(),
    CategoryPage(),
    ParsePage(),
    MinePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFFFF4B3A),
        unselectedItemColor: const Color(0xFF999999),
        backgroundColor: Colors.white,
        selectedFontSize: 11,
        unselectedFontSize: 11,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: '首页'),
          BottomNavigationBarItem(icon: Icon(Icons.grid_view_outlined), activeIcon: Icon(Icons.grid_view), label: '分类'),
          BottomNavigationBarItem(icon: Icon(Icons.transform_outlined), activeIcon: Icon(Icons.transform), label: '转链'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: '我的'),
        ],
      ),
    );
  }
}
