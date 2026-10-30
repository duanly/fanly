/**
 * 生成 tabBar 所需的 8 张 PNG（81×81，透明底）。
 *
 * 零依赖：用 SDF（有向距离场）手绘 4 个图标，node:zlib 压缩 + 手写 PNG chunk。
 * 用法：node scripts/gen-tabbar-icons.mjs
 *
 * 输出：src/static/tabbar/{home,local,cart,mine}{,-on}.png
 * 灰色 #999999 = 未选中；品牌红 #ff4b3a = 选中。
 * 以后想换图标，改下面各图标的 SDF 组合再跑一次即可。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 81;
const H = 81;

// ── SDF 基础元（输入点/参数，返回到形状边缘的距离；<0 在内部） ──
function seg(px, py, ax, ay, bx, by, half) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const h = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  const dx = px - (ax + vx * h);
  const dy = py - (ay + vy * h);
  return Math.hypot(dx, dy) - half;
}
function circle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}
function rrect(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - (hx - r);
  const qy = Math.abs(py - cy) - (hy - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// ── 4 个图标：各自返回一组 SDF 函数，渲染时取最小值 ──
const ICONS = {
  home: (x, y) => Math.min(
    // 屋顶
    seg(x, y, 15, 41, 40, 17, 3.2),
    seg(x, y, 40, 17, 65, 41, 3.2),
    // 房身（圆角矩形描边）
    Math.abs(rrect(x, y, 40, 53, 20, 13, 2)) - 2.8,
    // 门（实心）
    rrect(x, y, 40, 58, 4, 7, 1),
  ),
  local: (x, y) => Math.min(
    // 袋身（圆角矩形描边）
    Math.abs(rrect(x, y, 40, 49, 20, 18, 4)) - 3,
    // 提手：圆的上半弧描边
    y <= 37 ? Math.abs(circle(x, y, 40, 35, 11)) - 2.6 : Infinity,
  ),
  cart: (x, y) => Math.min(
    // 两个轮子（实心）
    circle(x, y, 27, 62, 5),
    circle(x, y, 54, 62, 5),
    // 梯形车篮（4 段描边）
    seg(x, y, 19, 28, 66, 28, 3),
    seg(x, y, 19, 28, 28, 54, 3),
    seg(x, y, 28, 54, 56, 54, 3),
    seg(x, y, 56, 54, 66, 28, 3),
  ),
  mine: (x, y) => Math.min(
    // 头（实心）
    circle(x, y, 40, 29, 11),
    // 肩膀：大圆被画布裁掉下半，只露出弧
    circle(x, y, 40, 88, 25),
  ),
};

// ── 渲染：逐像素覆盖率，边缘 1px 抗锯齿 ──
function render(sdf, [r, g, b]) {
  const buf = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    const rowStart = y * (W * 4 + 1);
    for (let x = 0; x < W; x++) {
      const d = sdf(x + 0.5, y + 0.5);
      const cover = Math.max(0, Math.min(1, 0.5 - d));
      const i = rowStart + 1 + x * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = Math.round(cover * 255);
    }
  }
  return buf;
}

// ── PNG 编码 ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 输出 8 个文件 ──
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'static', 'tabbar');
mkdirSync(outDir, { recursive: true });

const GRAY = [0x99, 0x99, 0x99];
const RED = [0xff, 0x4b, 0x3a];

for (const [name, sdf] of Object.entries(ICONS)) {
  writeFileSync(join(outDir, `${name}.png`), encodePng(render(sdf, GRAY)));
  writeFileSync(join(outDir, `${name}-on.png`), encodePng(render(sdf, RED)));
  console.log(`✓ ${name}.png / ${name}-on.png`);
}
