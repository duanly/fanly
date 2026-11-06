// 推广海报批量生成：读 promo-accounts.json，每个账号出一张绑定其邀请码的 PNG 海报
//
// 用法（在 h5/ 目录下）：
//   node scripts/gen-promo-posters.mjs [账号json路径] [--base=https://fanly.lyelse.com] [--out=../promo-posters]
//
// 依赖（仅本机生成用，未写进 package.json）：sharp、qrcode、jsqr
//   npm i --no-save sharp qrcode jsqr
//
// 二维码内容固定为 {base}/i/{inviteCode}，与 App 内「我的推广码」同一落地页
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 参数解析 ──
const args = process.argv.slice(2);
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};
const inputArg = args.find((a) => !a.startsWith('--'));
const repoRoot = resolve(__dirname, '../..');
const defaultInput = existsSync(resolve(repoRoot, 'server/promo-accounts.json'))
  ? resolve(repoRoot, 'server/promo-accounts.json')
  : resolve(repoRoot, 'server/data/promo-accounts.json');
const inputPath = resolve(inputArg || defaultInput);
const base = (opt('base', 'https://fanly.lyelse.com')).replace(/\/+$/, '');
const outDir = resolve(opt('out', resolve(repoRoot, 'promo-posters')));

// 品牌 app 图标（与桌面图标同源），嵌在海报顶部
const iconPng = readFileSync(resolve(__dirname, '../public/icons/icon-square-512.png'));
const iconB64 = iconPng.toString('base64');

const FONT = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
const W = 750;
const H = 1334;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 单张海报 SVG（QR 以 base64 PNG 内嵌，保证 sharp 渲染稳定） */
function posterSvg({ inviteCode, inviteUrl, nickname, mobile }, qrB64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff8a3d"/>
      <stop offset="100%" stop-color="#ff3b30"/>
    </linearGradient>
    <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="620" cy="120" r="260" fill="url(#glow1)"/>
  <circle cx="90" cy="1080" r="300" fill="url(#glow1)"/>
  <circle cx="660" cy="700" r="180" fill="#ffffff" fill-opacity="0.06"/>

  <!-- 顶部品牌区 -->
  <image href="data:image/png;base64,${iconB64}" x="335" y="64" width="80" height="80" rx="18"/>
  <text x="375" y="208" text-anchor="middle" font-family="${FONT}" font-size="46" font-weight="800" fill="#ffffff">省钱猫</text>
  <text x="375" y="256" text-anchor="middle" font-family="${FONT}" font-size="24" fill="#ffffff" fill-opacity="0.92">买啥都返现 · 隐藏优惠券免费领</text>

  <!-- 中部白色卡片 -->
  <rect x="48" y="312" width="654" height="760" rx="28" fill="#ffffff"/>
  <text x="375" y="386" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="700" fill="#1a1a1a">长按识别二维码 注册领返利</text>
  <text x="375" y="430" text-anchor="middle" font-family="${FONT}" font-size="20" fill="#999999">${esc(nickname)} 专属邀请海报 · ${esc(mobile)}</text>

  <!-- 二维码白底盘 -->
  <rect x="165" y="468" width="420" height="420" rx="20" fill="#ffffff" stroke="#ffe1dd" stroke-width="2"/>
  <image href="data:image/png;base64,${qrB64}" x="195" y="498" width="360" height="360"/>

  <!-- 邀请码 -->
  <text x="375" y="962" text-anchor="middle" font-family="${FONT}" font-size="22" fill="#999999">邀请码</text>
  <text x="375" y="1016" text-anchor="middle" font-family="Arial, ${FONT}" font-size="44" font-weight="800" letter-spacing="8" fill="#ff3b30">${esc(inviteCode)}</text>

  <!-- 链接 -->
  <text x="375" y="1052" text-anchor="middle" font-family="Arial, ${FONT}" font-size="17" fill="#bbbbbb">${esc(inviteUrl)}</text>

  <!-- 底部卖点 -->
  <g font-family="${FONT}" font-size="22" fill="#ffffff" font-weight="600">
    <circle cx="150" cy="1156" r="7" fill="#ffffff"/>
    <text x="170" y="1164">外卖打车电影票 单单返现</text>
    <circle cx="150" cy="1216" r="7" fill="#ffffff"/>
    <text x="170" y="1224">淘宝京东拼多多 先领券再下单</text>
    <circle cx="150" cy="1276" r="7" fill="#ffffff"/>
    <text x="170" y="1284">0 门槛 0 费用 提现秒到账</text>
  </g>
</svg>`;
}

async function main() {
  const accounts = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(accounts) || !accounts.length) throw new Error('账号 JSON 为空');
  mkdirSync(outDir, { recursive: true });

  const manifest = [];
  for (const acc of accounts) {
    const inviteUrl = `${base}/i/${acc.inviteCode}`;
    // 600px 二维码，白底，纠错级 H（海报可能被压缩/贴标，H 最抗造）
    const qrBuf = await QRCode.toBuffer(inviteUrl, { width: 600, margin: 1, errorCorrectionLevel: 'H' });
    const svg = posterSvg({ ...acc, inviteUrl }, qrBuf.toString('base64'));
    const file = `${acc.mobile}-${acc.inviteCode}.png`;
    const outPath = resolve(outDir, file);
    await sharp(Buffer.from(svg)).png().toFile(outPath);

    // 回读成品图解码 QR，校验海报与账号确实绑定、地址无误
    const { data, info } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (!decoded || decoded.data !== inviteUrl) {
      throw new Error(`${file} 二维码校验失败：期望 ${inviteUrl}，实读 ${decoded?.data || '空'}`);
    }
    manifest.push({ mobile: acc.mobile, nickname: acc.nickname, inviteCode: acc.inviteCode, inviteUrl, poster: file });
    console.log(`✓ ${file}  QR 校验通过 → ${inviteUrl}`);
  }

  writeFileSync(resolve(outDir, 'posters-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n完成：${manifest.length} 张海报 → ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
