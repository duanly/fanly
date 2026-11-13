#!/bin/zsh
# 从 1024 母版生成 uni-app 全套应用图标，零依赖（macOS 自带 sips）。
#
# 输出两处，对齐 HBuilderX 云打包约定：
#   1. unpackage/res/icons/NxN.png —— manifest.json 的 app-plus.distribute.icons
#      引用的就是这套（HBuilderX 可视化界面「自动生成」也写到这里）。
#      unpackage/ 在 .gitignore 中，不进 git；换机器/重新克隆后重跑本脚本即可复现。
#   2. src/static/favicon.png(64) + src/static/icons/apple-touch-icon-180.png(180)
#      —— H5 端 index.html 的浏览器标签图标与 iOS 主屏幕图标。
#
# 母版要求：1024x1024、无 alpha（App Store 拒收透明通道图标）。
# 用法：zsh scripts/gen-app-icons.sh [母版路径]
# HBuilderX 内重新自动生成后也建议重跑一遍本脚本，保持两边输出完全一致。

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/scripts/icon-master-1024.png}"
[ -f "$SRC" ] || SRC="$ROOT/../h5/public/icons/icon-square-1024.png"

OUT_UNI="$ROOT/unpackage/res/icons"
OUT_H5="$ROOT/src/static"
OUT_TOUCH="$ROOT/src/static/icons"

if [ ! -f "$SRC" ]; then
  echo "母版不存在: $SRC" >&2
  exit 1
fi

mkdir -p "$OUT_UNI" "$OUT_TOUCH"

# 与 manifest.json 引用的文件名严格一致（HBuilderX 命名约定 NxN.png）
SIZES=(20 29 40 58 60 72 76 80 87 96 120 144 152 167 180 192 1024)

for s in $SIZES; do
  sips -s format png -z "$s" "$s" "$SRC" --out "$OUT_UNI/${s}x${s}.png" >/dev/null
done

# H5 专用：favicon（标签页）与 apple-touch-icon（添加到主屏幕，系统会自动裁圆角）
sips -s format png -z 64 64 "$SRC" --out "$OUT_H5/favicon.png" >/dev/null
sips -s format png -z 180 180 "$SRC" --out "$OUT_TOUCH/apple-touch-icon-180.png" >/dev/null

echo "母版: $SRC"
echo "云打包图标 → $OUT_UNI（17 个尺寸）"
echo "H5 图标   → $OUT_H5/favicon.png, $OUT_TOUCH/apple-touch-icon-180.png"
