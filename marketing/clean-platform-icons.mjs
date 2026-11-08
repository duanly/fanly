/**
 * 四平台常青图标清洗脚本（一次性资产管线，可复跑）。
 *
 * 背景：2026-11 双11期间 iTunes Search API 拿到的 tb/pdd/vip App 图标是季节版
 * （带「天猫双11」「11.11 特卖狂欢节」横幅与装饰），不适合印长期名片。
 * 京东官网 manifest 提供常青 512 PNG（jd-source.png，直接归一化）；
 * 其余三家做像素掩码：品牌标识只保留白色像素（淘宝额外保留黄色点缀），
 * 按最小通道做软 alpha 抗锯齿，其余透明，再居中合成到采样的品牌纯色底。
 *
 * 输入（均在 marketing/platform-icons/）：
 *   tb.jpg / pdd.jpg / vip.jpg  —— iTunes 512 季节版（来源见文件头注释历史）
 *   jd-source.png               —— https://www.jd.com/manifest.json 的 512 常青图
 * 输出：tb.png / jd.png / pdd.png / vip.png（512×512，供 gen-card.mjs base64 内嵌）
 *
 * 运行：仓库根目录 node marketing/clean-platform-icons.mjs
 * 依赖：h5/node_modules/sharp（--no-save 安装，被 npm i 清掉后需重装：
 *       cd h5 && npm i --no-save sharp qrcode jsqr）
 */
import sharp from '../h5/node_modules/sharp/dist/index.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'platform-icons');
const N = 512;
const clamp = (v) => Math.max(0, Math.min(255, v));

async function load(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/**
 * 生成只含品牌标的透明图层 + 其 bbox。
 * rule: 'white'（纯白标）| 'white+yellow'（白标 + 上半区黄点，仅淘宝）
 */
function maskLogo(img, bg, rule, { top = 0, bottom = img.h, yellowBelow = 0 } = {}) {
  const { data, w, h } = img;
  const out = Buffer.alloc(w * h * 4);
  const minBg = Math.min(bg[0], bg[1], bg[2]);
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isYellow = rule === 'white+yellow' && y < yellowBelow && r > 225 && g > 170 && b < 130;
      // 软 alpha 按最小通道：白色三通道都高 → 不透明；黄/彩色装饰有低通道 → 趋近透明
      const a = isYellow ? 255 : clamp((Math.min(r, g, b) - minBg) / (255 - minBg) * 255);
      if (a > 30) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a;
    }
  }
  return { layer: out, bbox: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}

async function recompose(src, out, opts) {
  const img = await load(join(DIR, src));
  const bg = [img.data[18 * 4], img.data[18 * 4 + 1], img.data[18 * 4 + 2]]; // (18,18) 采样品牌底色
  const { layer, bbox } = maskLogo(img, bg, opts.rule, opts);
  console.log(src, 'bg=', bg, 'bbox=', bbox);

  const pad = 4; // 外扩保留抗锯齿边缘，钳制在画布内
  const region = {
    left: Math.max(0, bbox.left - pad),
    top: Math.max(0, bbox.top - pad),
    width: Math.min(img.w - Math.max(0, bbox.left - pad), bbox.width + pad * 2),
    height: Math.min(img.h - Math.max(0, bbox.top - pad), bbox.height + pad * 2),
  };
  const mark = await sharp(layer, { raw: { width: img.w, height: img.h, channels: 4 } })
    .extract(region)
    .png()
    .toBuffer();
  await sharp({
    create: { width: N, height: N, channels: 4, background: { r: bg[0], g: bg[1], b: bg[2], alpha: 1 } },
  })
    .composite([{ input: mark, left: Math.round((N - region.width) / 2), top: Math.round((N - region.height) / 2) }])
    .png()
    .toFile(join(DIR, out));
  console.log('→', out);
}

await Promise.all([
  // 淘宝：白字淘 + 黄色点缀（仅 y<210 认黄色，避开底部黄饰带），扫描止于白横幅弧形侵入前
  recompose('tb.jpg', 'tb.png', { rule: 'white+yellow', top: 30, bottom: 378, yellowBelow: 210 }),
  // 拼多多：纯白心形拼 logo
  recompose('pdd.jpg', 'pdd.png', { rule: 'white', top: 40, bottom: 366 }),
  // 唯品会：纯白「唯品会」字标，11.11 在 y226 以下
  recompose('vip.jpg', 'vip.png', { rule: 'white', top: 40, bottom: 226 }),
  // 京东官方常青图直接归一化（自身带圆角与透明角）
  sharp(join(DIR, 'jd-source.png'))
    .resize(N, N, { fit: 'contain', background: '#ffffff' })
    .png()
    .toFile(join(DIR, 'jd.png')),
]);
console.log('done');
