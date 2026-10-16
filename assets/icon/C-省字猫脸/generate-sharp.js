// 用 sharp 从 SVG 生成各种尺寸的 PNG
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SVG_PATH = path.join(__dirname, 'icon.svg');
const OUT_DIR = __dirname;

const SIZES = [
  { name: 'square-64', size: 64 },
  { name: 'square-120', size: 120 },
  { name: 'square-180', size: 180 },
  { name: 'square-256', size: 256 },
  { name: 'square-260', size: 260 },
  { name: 'square-512', size: 512 },
  { name: 'square-1024', size: 1024 },
];

// iOS/macOS 圆角图标不用预生成，系统自动加。
// 但网站 favicon 和 PWA 要方的。

async function main() {
  const svg = fs.readFileSync(SVG_PATH);

  for (const s of SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${s.name}.png`);
    await sharp(svg)
      .resize(s.size, s.size)
      .png()
      .toFile(outPath);
    console.log(`✓ icon-${s.name}.png (${s.size}x${s.size})`);
  }

  console.log(`\n完成：生成了 ${SIZES.length} 个图标`);
}

main().catch(console.error);
