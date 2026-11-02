#!/usr/bin/env bash
# 全站域名更新：旧 → fanly.lyelse.com
#   1) 替换所有文本里的旧网址（sed 宽匹配，旧拼写 fanly/fannly 等都覆盖）
#   2) 重新生成网址二维码（二维码本身编码了 URL，必须重生成）
#   3) 重新渲染两张海报（内嵌的二维码同步更新）
set -euo pipefail
cd "$(dirname "$0")/.."

NEW="fanly.lyelse.com"
echo "▶ 新域名: https://$NEW"

# ── 1. 找出所有引用旧域名的文本文件并替换 ──
count=0
grep -rlZ --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  -E "https://[a-z0-9.]*lyelse\.com" . 2>/dev/null \
| while IFS= read -r -d '' f; do
    sed -i '' -E "s#https://[a-z0-9.]*lyelse\.com#https://$NEW#g" "$f"
    echo "  ✓ $f"
  done

echo
echo "▶ 替换后仓库中现存的域名（应全部为 $NEW）:"
grep -rhoE "https://[a-z0-9.]*lyelse\.com" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist . 2>/dev/null \
  | sort | uniq -c

# ── 2. 重新生成二维码（PNG + SVG） ──
echo
node marketing/gen-qr.mjs

# ── 3. 重新渲染两张海报 ──
swift marketing/render.swift poster.html        poster.png        1080 1920
swift marketing/render.swift poster-square.html poster-square.png 1080 1080

echo
echo "🎉 完成：代码/文档域名、二维码、两张海报均已更新"
