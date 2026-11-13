/**
 * 把 scripts/bg-svg/*.svg（移植自 H5 public/bg）栅格化成 PNG。
 * 为什么不用 SVG 原图：微信小程序 WXSS 不支持 SVG 背景图，
 * 统一用 <image mode="scaleToFill"> 铺 PNG，三端（H5/App/MP）表现一致。
 * SVG 本身 preserveAspectRatio=none，本来就是任意拉伸的，fit:'fill' 完全对齐。
 *
 * sharp 不在本工程依赖里，复用同仓 h5/node_modules 的 sharp；
 * 找不到时给出明确提示，不静默失败。
 *
 * 用法：node scripts/gen-bg-png.mjs
 */
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SVG_DIR = join(ROOT, 'scripts', 'bg-svg');
const OUT_DIR = join(ROOT, 'src', 'static', 'bg');

// 软渐变背景，900 宽在 3x 屏也够清晰，体积可控
const W = 900;
const H = 540;

async function loadSharp() {
  const candidates = [
    'sharp', // 本工程装了的话优先
    join(ROOT, '..', 'h5', 'node_modules', 'sharp'),
  ];
  const require = createRequire(import.meta.url);
  for (const c of candidates) {
    try {
      return require(c);
    } catch { /* 试下一个 */ }
  }
  throw new Error('找不到 sharp：请在 h5/ 下 npm i，或在本工程安装 sharp');
}

const sharp = await loadSharp();
await mkdir(OUT_DIR, { recursive: true });

const files = (await readdir(SVG_DIR)).filter((f) => f.endsWith('.svg'));
for (const f of files) {
  const svg = await readFile(join(SVG_DIR, f));
  const out = join(OUT_DIR, f.replace(/\.svg$/, '.png'));
  await sharp(svg, { density: 300 })
    .resize(W, H, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('✓', f, '→', out.replace(ROOT + '/', ''));
}
console.log('全部完成');
