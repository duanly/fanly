// 用 sharp 从 admin-icon.svg 生成运营中心 PWA 图标（各种尺寸 PNG）
// 用法：在 h5/ 目录下执行 node public/icons/generate-admin-sharp.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SVG_PATH = path.join(__dirname, 'admin-icon.svg');
const OUT_DIR = __dirname;

const SIZES = [
  { name: 'square-64', size: 64 },
  { name: 'square-120', size: 120 },
  { name: 'square-180', size: 180 },
  { name: 'square-192', size: 192 },
  { name: 'square-256', size: 256 },
  { name: 'square-260', size: 260 },
  { name: 'square-512', size: 512 },
  { name: 'square-1024', size: 1024 },
];

async function main() {
  const svg = fs.readFileSync(SVG_PATH);

  for (const s of SIZES) {
    const outPath = path.join(OUT_DIR, `admin-icon-${s.name}.png`);
    await sharp(svg)
      .resize(s.size, s.size)
      .png()
      .toFile(outPath);
    console.log(`✓ admin-icon-${s.name}.png (${s.size}x${s.size})`);
  }

  console.log(`\n完成：生成了 ${SIZES.length} 个运营中心图标`);
}

main().catch(console.error);
