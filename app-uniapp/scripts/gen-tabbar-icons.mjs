/**
 * 生成 tabBar 所需的 8 张 PNG（81×81，透明底）。
 *
 * 源：scripts/tabbar-svg/{home,local,cart,mine}.svg
 *   24×24 viewBox、stroke=currentColor 的线性图标（vant 风格）。
 * 颜色：未选中灰 #999999 → {name}.png；选中品牌红 #ff4b3a → {name}-on.png。
 *
 * sharp 不在本工程依赖里，复用同仓 h5/node_modules 的 sharp；
 * 找不到时给出明确提示，不静默失败。
 *
 * 用法：node scripts/gen-tabbar-icons.mjs
 * 想换图标：改 tabbar-svg/ 里的 SVG 后重跑本脚本。
 */
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SVG_DIR = join(ROOT, 'scripts', 'tabbar-svg');
const OUT_DIR = join(ROOT, 'src', 'static', 'tabbar');

const SIZE = 81; // tabBar 图标逻辑尺寸约 27pt，@3x = 81px
const GRAY = '#999999';
const BRAND = '#ff4b3a';

async function loadSharp() {
  const candidates = [
    'sharp',
    join(ROOT, '..', 'h5', 'node_modules', 'sharp'),
  ];
  const require = createRequire(import.meta.url);
  for (const c of candidates) {
    try { return require(c); } catch { /* 试下一个 */ }
  }
  throw new Error('找不到 sharp：请在 h5/ 下 npm i，或在本工程安装 sharp');
}

const sharp = await loadSharp();
await mkdir(OUT_DIR, { recursive: true });

const files = (await readdir(SVG_DIR)).filter((f) => f.endsWith('.svg'));
for (const f of files) {
  const name = f.replace(/\.svg$/, '');
  const svg = await readFile(join(SVG_DIR, f), 'utf8');

  for (const [suffix, color] of [['', GRAY], ['-on', BRAND]]) {
    const colored = svg.replaceAll('currentColor', color);
    const out = join(OUT_DIR, `${name}${suffix}.png`);
    await sharp(Buffer.from(colored), { density: 384 })
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log('✓', out.replace(ROOT + '/', ''));
  }
}
console.log('全部完成');
