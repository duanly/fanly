/**
 * 双面宣传名片生成器（10px/mm 设计稿 → Retina 2x 输出，约 508dpi）。
 *
 * 正面横版 90×54mm（900×540）：四象限平台色块 + 中央蓝绿大圆（猫头二维码 + 品牌）。
 * 背面竖版 54×90mm（540×900）：品牌标题 + 17 枚标签繁星区 + 热线微信/链接/二维码。
 *
 * 用法（必须在仓库根目录运行）：
 *   node marketing/gen-card.mjs
 *
 * 产物：promo-posters/card/card-front.png（1800×1080）、card-back.png（1080×1800）
 * 依赖：gen-promo-posters.mjs 的 buildQrPng（H 级 + 猫头）、系统 swift/WebKit、
 *       platform-icons/ 下四平台常青图标（清洗脚本见 .icon-probe/clean-icons.mjs）。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildQrPng } from './gen-promo-posters.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));          // marketing/
const REPO = resolve(HERE, '..');
const BUILD = join(HERE, '.card-build');
const QR_DIR = join(BUILD, 'qr');
const ICON_DIR = join(HERE, 'platform-icons');
const OUT_DIR = join(REPO, 'promo-posters', 'card');
const HERO_ICON = join(REPO, 'h5/public/icons/icon-square-256.png');

const BOSS_CODE = 'KXPETF';
const BOSS_URL = 'https://fanly.lyelse.com/i/KXPETF';

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(QR_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// 1) 老板专属二维码（与海报同款 H 级 + 猫头）
const qrName = 'qr-boss.png';
buildQrPng(BOSS_URL, join(QR_DIR, qrName));

// 2) 图片全部 base64 内嵌（构建 HTML 在子目录，相对路径会裂；注释里也有占位符，必须 replaceAll）
const dataUri = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
const heroLogo = dataUri(HERO_ICON);
const ico = {
  TB: dataUri(join(ICON_DIR, 'tb.png')),
  JD: dataUri(join(ICON_DIR, 'jd.png')),
  PDD: dataUri(join(ICON_DIR, 'pdd.png')),
  VIP: dataUri(join(ICON_DIR, 'vip.png')),
};

// 正反面设计稿尺寸不同：正面横版 900×540，背面竖版 540×900
const sides = [
  { tpl: 'card-front.template.html', out: 'card-front.png', html: 'card-front.html', w: 900, h: 540 },
  { tpl: 'card-back.template.html', out: 'card-back.png', html: 'card-back.html', w: 540, h: 900 },
];

for (const side of sides) {
  const html = readFileSync(join(HERE, side.tpl), 'utf8')
    .replaceAll('__HERO_LOGO__', heroLogo)
    .replaceAll('__ICO_TB__', ico.TB)
    .replaceAll('__ICO_JD__', ico.JD)
    .replaceAll('__ICO_PDD__', ico.PDD)
    .replaceAll('__ICO_VIP__', ico.VIP)
    .replaceAll('__QR_SRC__', `qr/${qrName}`)
    .replaceAll('__BOSS_URL__', BOSS_URL)
    .replaceAll('__BOSS_CODE__', BOSS_CODE);
  if (html.includes('__')) throw new Error(`${side.tpl} 占位符替换失败，拒绝渲染`);
  writeFileSync(join(BUILD, side.html), html);

  // render.swift 的路径参数相对 marketing/ 解析
  const r = spawnSync(
    'swift',
    [join(HERE, 'render.swift'), `.card-build/${side.html}`, `../promo-posters/card/${side.out}`, String(side.w), String(side.h)],
    { cwd: REPO, stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`渲染失败：${side.out}`);
  console.log(`✓ promo-posters/card/${side.out}  (${side.w}×${side.h} 设计稿，Retina 2x 输出)`);
}

console.log(`\n完成：双面名片 → ${OUT_DIR}`);
console.log('印刷提示：正面 90×54mm 输出 1800×1080、背面 54×90mm 输出 1080×1800，均约 508dpi；装饰色块外缘 3mm，文字内容均在 5mm 安全边距内。双面拼版时背面需相对正面旋转 90°。');
