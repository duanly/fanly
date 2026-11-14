/**
 * 把仓库根 icons/*.svg（H5 图标库，后台数据存 icon:xxx 或裸文件名 xxx.svg）
 * 栅格化成 PNG，供 uni-app 三端使用。
 *
 * 为什么不用 SVG：微信小程序 WXSS/模板对 SVG 支持受限，统一 PNG 最稳。
 * 与 H5 的差异：H5 用 vite 虚拟模块 virtual:icon-lib 内联 SVG；
 * uni 端把同名 PNG 放 static/icons/lib/，app-icon 组件按 key 解析路径。
 *
 * 产出：
 *   src/static/icons/lib/{name}.png   128×128，透明底，保留 SVG 原色
 *   src/components/app-icon/icon-names.js  合法 key 清单（app-icon 兜底用）
 *
 * sharp 复用同仓 h5/node_modules。用法：node scripts/gen-icons-png.mjs
 */
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SVG_DIR = join(ROOT, '..', 'icons'); // 仓库根 icons/，与 H5 同源
const OUT_DIR = join(ROOT, 'src', 'static', 'icons', 'lib');
const MANIFEST = join(ROOT, 'src', 'components', 'app-icon', 'icon-names.js');

const SIZE = 128; // 展示尺寸普遍 40~48rpx（约 20~24pt），128 在 @3x 仍清晰

async function loadSharp() {
  const candidates = ['sharp', join(ROOT, '..', 'h5', 'node_modules', 'sharp')];
  const require = createRequire(import.meta.url);
  for (const c of candidates) {
    try { return require(c); } catch { /* 试下一个 */ }
  }
  throw new Error('找不到 sharp：请在 h5/ 下 npm i，或在本工程安装 sharp');
}

const sharp = await loadSharp();
await mkdir(OUT_DIR, { recursive: true });

const files = (await readdir(SVG_DIR)).filter((f) => f.endsWith('.svg'));
const names = [];
for (const f of files) {
  const name = f.replace(/\.svg$/, '');
  names.push(name);
  const svg = await readFile(join(SVG_DIR, f));
  await sharp(svg, { density: 300 })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT_DIR, `${name}.png`));
  console.log('✓', name);
}

names.sort();
const banner = '// 由 scripts/gen-icons-png.mjs 自动生成，勿手改。源：仓库根 icons/*.svg\n';
await writeFile(
  MANIFEST,
  `${banner}export const ICON_NAMES = Object.freeze(${JSON.stringify(names, null, 2)});\n`,
);
console.log(`全部完成：${names.length} 个图标 → src/static/icons/lib/，清单 → icon-names.js`);
