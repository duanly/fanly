import 'package:flutter/material.dart';
import 'widgets/paged_icon_grid.dart';

/// 本地生活宫格静态数据（与 H5 llItems 一致）。
/// tab/cat 跳转在阶段 3 本地生活页接入后启用，本期先占位。
List<GridEntry> localLifeEntries(BuildContext context) => [
      const GridEntry(
          name: '饿了么', emoji: '🍜', tag: '领红包',
          gradient: 'linear-gradient(135deg,#00b43c,#00963a)', onTap: _noop),
      const GridEntry(
          name: '美团券包', emoji: '🎫', tag: '天天神券',
          gradient: 'linear-gradient(135deg,#ffd100,#ff9500)', onTap: _noop),
      const GridEntry(
          name: '电影票', emoji: '🎬', tag: '特惠看',
          gradient: 'linear-gradient(135deg,#ff6b9d,#c44569)', onTap: _noop),
      const GridEntry(
          name: '酒店民宿', emoji: '🏨', tag: '超值住',
          gradient: 'linear-gradient(135deg,#4ecdc4,#44a08d)', onTap: _noop),
      const GridEntry(
          name: '打车出行', emoji: '🚕', tag: '立减券',
          gradient: 'linear-gradient(135deg,#f7931e,#ff6b35)', onTap: _noop),
      const GridEntry(
          name: '咖啡奶茶', emoji: '☕', tag: '买一送一',
          gradient: 'linear-gradient(135deg,#c44569,#f8b500)', onTap: _noop),
      const GridEntry(
          name: '会员权益', emoji: '✨', tag: '半价充',
          gradient: 'linear-gradient(135deg,#667eea,#764ba2)', onTap: _noop),
      const GridEntry(
          name: '景点门票', emoji: '🏞️', tag: '低价游',
          gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)', onTap: _noop),
    ];

void _noop() {}
