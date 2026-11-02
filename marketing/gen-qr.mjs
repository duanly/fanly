/**
 * 生成带应用 ICON 的网址二维码。
 *
 * 依赖：server/node_modules/qrcode（算矩阵）；图像读写零依赖（node:zlib）。
 * 用法：node marketing/gen-qr.mjs
 * 输出：
 *   marketing/qrcode-fanly.png   1080 级高清，微信里直接发
 *   marketing/qrcode-fanly.svg   供海报/印刷内嵌，无限缩放
 */
import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QRCode = require(join('/Users/lyelsa/Documents/fanly/server/node_modules/qrcode'));

const HERE = dirname(fileURLToPath(import.meta.url));
const URL_TEXT = 'https://fanly.lyelse.com';
const ICON_FILE = join('/Users/lyelsa/Documents/fanly/h5/public/icons/icon-square-256.png');
const FG = [24, 16, 12]; // 近黑色码眼，比纯黑柔和一点

// ───────── 二维码矩阵（H 级容错：中心盖 LOGO 后仍可靠扫描） ─────────
const qr = QRCode.create(URL_TEXT, { errorCorrectionLevel: 'H' });
const N = qr.modules.size;
const dark = qr.modules.data; // N*N，1=黑
const isDark = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? false : dark[y * N + x] === 1);

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
  // PNG IDAT 是 zlib 封装流（带头尾校验），用同步 inflateSync
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

// ───────── PNG 编码（与 tabbar 脚本同款） ─────────
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

// ───────── 渲染：码矩阵 → 高分位图，中心合成 ICON ─────────
const QUIET = 4;
const modPx = 24; // 每模块 24px
const CS = (N + QUIET * 2) * modPx; // 画布边长
const canvas = Buffer.alloc(CS * CS * 4, 255); // 白底
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

// 中心白底圆角方块 + ICON
const icon = decodePng(readFileSync(ICON_FILE));
const logoBox = Math.round(CS * 0.30); // 白底方块 30%
const iconSize = Math.round(CS * 0.255); // ICON 25.5%
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
// ICON 双线性降采样
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

writeFileSync(join(HERE, 'qrcode-fanly.png'), encodePng(CS, CS, canvas));

// ───────── SVG 版 ─────────
let d = '';
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    if (isDark(x, y)) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
  }
}
const iconB64 = readFileSync(ICON_FILE).toString('base64');
const svgW = N + QUIET * 2;
const logoSvg = svgW * 0.255;
const boxSvg = svgW * 0.30;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgW}" viewBox="0 0 ${svgW} ${svgW}">`
  + `<rect width="${svgW}" height="${svgW}" fill="#fff"/>`
  + `<path d="${d}" fill="rgb(${FG.join(',')})"/>`
  + `<rect x="${(svgW - boxSvg) / 2}" y="${(svgW - boxSvg) / 2}" width="${boxSvg}" height="${boxSvg}" rx="${boxSvg * 0.16}" fill="#fff"/>`
  + `<image x="${(svgW - logoSvg) / 2}" y="${(svgW - logoSvg) / 2}" width="${logoSvg}" height="${logoSvg}" href="data:image/png;base64,${iconB64}"/>`
  + `</svg>`;
writeFileSync(join(HERE, 'qrcode-fanly.svg'), svg);

console.log(`✓ qrcode-fanly.png (${CS}×${CS})`);
console.log(`✓ qrcode-fanly.svg (v${qr.version}, ${N} modules)`);
