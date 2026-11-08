/**
 * 基于 marketing/poster.png 同款模板，批量生成「账号专属招商海报」。
 * 每张海报只有 4 个账号相关变量，其余版面全部固定：
 *   二维码（编码专属邀请 URL）、推广码、专属邀请 URL、专属电话（账号手机号）；
 * 平台老板热线 15873416463（微信同号）硬编码在模板里，任何账号都不变。
 *
 * 用法（项目根目录）：
 *   node marketing/gen-promo-posters.mjs [账号json] [--base=https://fanly.lyelse.com]
 *
 * 流程：账号 JSON → 带 Logo 的 H 级二维码（.promo-build/qr）
 *      → 套 poster-promo.template.html 生成 per-账号 HTML（.promo-build）
 *      → 调系统 WebKit（render.swift）渲染 2160×3840 PNG
 *      → 输出到 promo-posters/poster-2160/
 *
 * 依赖：server/node_modules/qrcode（与 gen-qr.mjs 同款）、系统 swift/WebKit。
 */
import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));          // marketing/
const REPO = resolve(HERE, '..');
const QRCode = require(join(REPO, 'server/node_modules/qrcode'));

const args = process.argv.slice(2);
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};
const inputArg = args.find((a) => !a.startsWith('--'));
const accountsPath = resolve(inputArg || join(REPO, 'server/promo-accounts.json'));
const base = (opt('base', 'https://fanly.lyelse.com')).replace(/\/+$/, '');

const BUILD = join(HERE, '.promo-build');
const QR_DIR = join(BUILD, 'qr');
const OUT_DIR = join(REPO, 'promo-posters', 'poster-2160');
const ICON_FILE = join(REPO, 'h5/public/icons/icon-square-256.png');
const TEMPLATE = join(HERE, 'poster-promo.template.html');
const FG = [24, 16, 12]; // 与 qrcode-fanly.png 同款近黑码眼

// ───────── 极简 PNG 解码（8bit RGB/RGBA，仅用于读 ICON） ─────────
function decodePng(buf) {
  let p = 8;
  let w = 0; let h = 0; let colorType = 6;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      colorType = body[9];
      if (body[8] !== 8 || (colorType !== 2 && colorType !== 6)) {
        throw new Error('仅支持 8bit RGB/RGBA PNG');
      }
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const ch = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let sp = 0;
  const paeth = (a, b, c) => {
    const v = a + b - c;
    const da = Math.abs(v - a); const db = Math.abs(v - b); const dc = Math.abs(v - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const f = raw[sp++];
    const row = raw.subarray(sp, sp + stride);
    const dst = out.subarray(y * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? dst[i - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= ch ? out[(y - 1) * stride + i - ch] : 0;
      let v = row[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += ((a + b) >> 1);
      else if (f === 4) v += paeth(a, b, c);
      dst[i] = v & 255;
    }
    sp += stride;
  }
  return { w, h, ch, data: out };
}

// ───────── PNG 编码 ─────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    const rs = y * (w * 4 + 1);
    rgba.copy(raw, rs + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 生成与 qrcode-fanly.png 同款（H 容错 + 中心猫头）的账号专属二维码 */
export function buildQrPng(urlText, outFile) {
  const qr = QRCode.create(urlText, { errorCorrectionLevel: 'H' });
  const N = qr.modules.size;
  const dark = qr.modules.data;
  const isDark = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? false : dark[y * N + x] === 1);

  const QUIET = 4;
  const modPx = 24;
  const CS = (N + QUIET * 2) * modPx;
  const canvas = Buffer.alloc(CS * CS * 4, 255);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!isDark(x, y)) continue;
      const x0 = (x + QUIET) * modPx;
      const y0 = (y + QUIET) * modPx;
      for (let yy = 0; yy < modPx; yy++) {
        const row = (y0 + yy) * CS * 4 + x0 * 4;
        for (let xx = 0; xx < modPx; xx++) {
          const i = row + xx * 4;
          canvas[i] = FG[0]; canvas[i + 1] = FG[1]; canvas[i + 2] = FG[2];
        }
      }
    }
  }

  // 中心白底圆角方块 + ICON（比例与 gen-qr.mjs 完全一致）
  const icon = decodePng(readFileSync(ICON_FILE));
  const logoBox = Math.round(CS * 0.30);
  const iconSize = Math.round(CS * 0.255);
  const half = CS >> 1;
  const lx = half - (logoBox >> 1);
  const ly = half - (logoBox >> 1);
  const radius = Math.round(logoBox * 0.16);
  function roundRectMask(px, py, bx, by, bw, bh, r) {
    const qx = Math.abs(px - (bx + bw / 2)) - (bw / 2 - r);
    const qy = Math.abs(py - (by + bh / 2)) - (bh / 2 - r);
    const ax = Math.max(qx, 0); const ay = Math.hypot(ax, Math.max(qy, 0));
    const d = ay + Math.min(Math.max(qx, qy), 0) - r;
    return Math.max(0, Math.min(1, 0.5 - d * 1.5));
  }
  function sampleIcon(u, v) {
    const fx = u * (icon.w - 1); const fy = v * (icon.h - 1);
    const x0 = Math.floor(fx); const y0 = Math.floor(fy);
    const tx = fx - x0; const ty = fy - y0;
    const x1 = Math.min(icon.w - 1, x0 + 1); const y1 = Math.min(icon.h - 1, y0 + 1);
    const px = (yy, xx, c) => icon.data[(yy * icon.w + xx) * icon.ch + c];
    const out = [0, 0, 0, 255];
    for (let c = 0; c < 4; c++) {
      const top = px(y0, x0, c) * (1 - tx) + px(y0, x1, c) * tx;
      const bot = px(y1, x0, c) * (1 - tx) + px(y1, x1, c) * tx;
      out[c] = Math.round(top * (1 - ty) + bot * ty);
    }
    if (icon.ch === 3) out[3] = 255;
    return out;
  }
  for (let py = ly; py < ly + logoBox; py++) {
    for (let px = lx; px < lx + logoBox; px++) {
      const cover = roundRectMask(px + 0.5, py + 0.5, lx, ly, logoBox, logoBox, radius);
      const i = (py * CS + px) * 4;
      if (cover <= 0) continue;
      let rgba;
      const ix = px - (half - (iconSize >> 1));
      const iy = py - (half - (iconSize >> 1));
      if (ix >= 0 && iy >= 0 && ix < iconSize && iy < iconSize) {
        rgba = sampleIcon(ix / iconSize, iy / iconSize);
        const a = (rgba[3] / 255) * cover;
        canvas[i] = Math.round(rgba[0] * a + canvas[i] * (1 - a));
        canvas[i + 1] = Math.round(rgba[1] * a + canvas[i + 1] * (1 - a));
        canvas[i + 2] = Math.round(rgba[2] * a + canvas[i + 2] * (1 - a));
      } else {
        canvas[i] = Math.round(255 * cover + canvas[i] * (1 - cover));
        canvas[i + 1] = Math.round(255 * cover + canvas[i + 1] * (1 - cover));
        canvas[i + 2] = Math.round(255 * cover + canvas[i + 2] * (1 - cover));
      }
    }
  }

  writeFileSync(outFile, encodePng(CS, CS, canvas));
  return { size: CS, version: qr.version };
}

function main() {
  if (!existsSync(accountsPath)) {
    throw new Error(`账号文件不存在：${accountsPath}（先在 server 跑 npm run seed:promo）`);
  }
  const accounts = JSON.parse(readFileSync(accountsPath, 'utf8'));
  if (!Array.isArray(accounts) || !accounts.length) throw new Error('账号 JSON 为空');

  rmSync(BUILD, { recursive: true, force: true });
  mkdirSync(QR_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const template = readFileSync(TEMPLATE, 'utf8');
  // Logo 走 data URI 内嵌：构建 HTML 在 .promo-build/ 子目录，../ 相对路径会解析错位
  const heroLogo = `data:image/png;base64,${readFileSync(ICON_FILE).toString('base64')}`;
  const manifest = [];

  // 11 位手机号按 3-4-4 分组显示（与老板热线「158 7341 6463」同样式）
  const fmtPhone = (m) => m.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');

  for (const acc of accounts) {
    const inviteUrl = `${base}/i/${acc.inviteCode}`;
    const qrName = `qr-${acc.mobile}.png`;
    const qrPath = join(QR_DIR, qrName);
    const meta = buildQrPng(inviteUrl, qrPath);

    // 生成 per-账号 HTML（放在 .promo-build/ 下，模板里的 ../h5 相对路径恰好仍指向仓库 h5/）
    // 注意用 replaceAll：模板顶部注释里也出现了同名占位符，replace 只会换掉第一个
    const html = template
      .replaceAll('__HERO_LOGO__', heroLogo)
      .replaceAll('__QR_SRC__', `qr/${qrName}`)
      .replaceAll('__PROMO_CODE__', acc.inviteCode)
      .replaceAll('__INVITE_URL__', inviteUrl)
      .replaceAll('__PHONE_MAIN__', fmtPhone(acc.mobile));
    if (html.includes('__')) {
      throw new Error(`${acc.mobile} 模板占位符替换失败，拒绝渲染`);
    }
    const htmlName = `poster-${acc.mobile}.html`;
    writeFileSync(join(BUILD, htmlName), html);

    // WebKit 离屏渲染（与 rebuild-assets.sh 同一条管线，Retina 下输出 2160×3840）
    const outName = `${acc.mobile}-${acc.inviteCode}.png`;
    const r = spawnSync(
      'swift',
      [join(HERE, 'render.swift'), `.promo-build/${htmlName}`, `../promo-posters/poster-2160/${outName}`, '1080', '1920'],
      { cwd: REPO, stdio: 'inherit' },
    );
    if (r.status !== 0) throw new Error(`渲染失败：${outName}`);

    manifest.push({
      mobile: acc.mobile, nickname: acc.nickname, inviteCode: acc.inviteCode,
      inviteUrl, poster: `poster-2160/${outName}`, qrVersion: meta.version,
    });
    console.log(`✓ ${outName}  推广码 ${acc.inviteCode}  → ${inviteUrl}`);
  }

  writeFileSync(join(OUT_DIR, 'posters-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n完成：${manifest.length} 张账号专属招商海报 → ${OUT_DIR}`);
}

// 被 gen-card.mjs 等脚本 import 时不自动跑批处理，只有直接执行本文件才跑
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
