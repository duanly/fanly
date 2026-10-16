// 从 SVG 源文件生成各种尺寸的 PNG 图标
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const SVG_PATH = path.join(__dirname, 'icon.svg');
const OUT_DIR = __dirname;

const SIZES = [
  { name: 'square-64', size: 64, rounded: 0 },
  { name: 'square-120', size: 120, rounded: 0 },
  { name: 'square-180', size: 180, rounded: 0 },
  { name: 'square-256', size: 256, rounded: 0 },
  { name: 'square-260', size: 260, rounded: 0 },
  { name: 'square-512', size: 512, rounded: 0 },
  { name: 'square-1024', size: 1024, rounded: 0 },
  { name: 'rounded-64', size: 64, rounded: 16 },
  { name: 'rounded-120', size: 120, rounded: 30 },
  { name: 'rounded-180', size: 180, rounded: 45 },
  { name: 'rounded-256', size: 256, rounded: 64 },
  { name: 'rounded-260', size: 260, rounded: 65 },
  { name: 'rounded-512', size: 512, rounded: 128 },
  { name: 'rounded-1024', size: 1024, rounded: 256 },
];

async function main() {
  // 先尝试 canvas 加载 SVG
  const svg = fs.readFileSync(SVG_PATH, 'utf-8');
  const img = await loadImage(Buffer.from(svg));

  for (const s of SIZES) {
    const canvas = createCanvas(s.size, s.size);
    const ctx = canvas.getContext('2d');

    if (s.rounded > 0) {
      // 圆角裁剪
      ctx.beginPath();
      const r = s.rounded;
      ctx.moveTo(r, 0);
      ctx.lineTo(s.size - r, 0);
      ctx.quadraticCurveTo(s.size, 0, s.size, r);
      ctx.lineTo(s.size, s.size - r);
      ctx.quadraticCurveTo(s.size, s.size, s.size - r, s.size);
      ctx.lineTo(r, s.size);
      ctx.quadraticCurveTo(0, s.size, 0, s.size - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.clip();
    }

    ctx.drawImage(img, 0, 0, s.size, s.size);

    const outPath = path.join(OUT_DIR, `icon-${s.name}.png`);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buf);
    console.log(`✓ icon-${s.name}.png (${s.size}x${s.size})`);
  }

  console.log(`\n完成：生成了 ${SIZES.length} 个图标`);
}

main().catch((e) => {
  console.error('生成失败:', e.message);
  console.error('请先安装 canvas: npm install canvas');
  process.exit(1);
});
