#!/usr/bin/env bash
# 重建宣传素材：重生成网址二维码 → 重渲染两张海报。
# 自动兜底：qrcode 库缺失就装回；真实截图缺失就从 Downloads 补进 shots。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/4 确保二维码库可用"
if [ ! -d server/node_modules/qrcode ]; then
  echo "  server 缺少 qrcode，安装中…"
  (cd server && npm install qrcode --no-audit --no-fund)
fi

echo "▶ 2/4 补充真实截图到 marketing/shots"
if [ -f "$HOME/Downloads/IMG_1485.PNG" ]; then
  mkdir -p marketing/shots
  cp "$HOME/Downloads/IMG_1485.PNG" "$HOME/Downloads/IMG_1486.PNG" \
     "$HOME/Downloads/IMG_1487.PNG" "$HOME/Downloads/IMG_1488.PNG" marketing/shots/
  echo "  已复制 $(ls marketing/shots | wc -l | tr -d ' ') 张截图"
fi

echo "▶ 3/4 重新生成网址二维码（编码当前新域名）"
node marketing/gen-qr.mjs

echo "▶ 4/4 重新渲染两张海报"
swift marketing/render.swift poster.html        poster.png        1080 1920
swift marketing/render.swift poster-square.html poster-square.png 1080 1080

echo "🎉 素材重建完成：二维码 + 竖版/方形海报均为最新域名"
