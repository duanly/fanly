/**
 * 管理后台「一键生成专属海报」浏览器端渲染器。
 *
 * 版面与 marketing/poster-promo.template.html 保持一致（改版面时两边同步）：
 * 账号相关变量只有 4 个——二维码 / 推广码(inviteCode) / 专属链接 / 专属电话；
 * 平台老板热线 158 7341 6463（微信同号）固定写死，不随账号变化。
 *
 * 渲染管线（两段式，规避 WebKit foreignObject 内嵌 <img> 光栅化空白的坑）：
 *   1. 离屏 DOM 按 1080px 设计稿真实布局，测出 Logo / 二维码的精确位置；
 *   2. SVG foreignObject 只光栅化文字、渐变底色和版式（img 位用透明占位）；
 *   3. 二维码与 Logo 由 canvas drawImage 按实测坐标二次合成（圆角裁剪）。
 * 所有图片均为 data URI，不依赖服务端字体/外部资源，iOS/安卓/桌面都能出图。
 * 高清 2160×3840 印刷级海报仍走 Mac 脚本 marketing/gen-promo-posters.mjs。
 */

const ICON_URL = '/icons/icon-square-256.png';
const W = 1080;
const H = 1920;
const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片资源加载失败'));
    img.src = src;
  });
}

async function urlToDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Logo 资源加载失败');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Logo 转码失败'));
    fr.readAsDataURL(blob);
  });
}

/** canvas 圆角矩形路径（兼容无 ctx.roundRect 的老浏览器） */
function roundedPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * H 级二维码 + 中心猫头白底圆角方块。
 * 比例与 marketing/gen-promo-posters.mjs 完全一致：logoBox 30% / icon 25.5% / 圆角 16%。
 */
async function buildQrDataUrl(text, iconImg) {
  const mod = await import('qrcode');
  const QRCode = mod.default || mod;
  const SIZE = 800;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: 'H',
    width: SIZE,
    margin: 2,
    color: { dark: '#18100c', light: '#ffffff' },
  });
  const ctx = canvas.getContext('2d');
  const logoBox = Math.round(SIZE * 0.3);
  const iconSize = Math.round(SIZE * 0.255);
  const x = (SIZE - logoBox) / 2;
  const y = (SIZE - logoBox) / 2;
  const r = Math.round(logoBox * 0.16);
  ctx.save();
  roundedPath(ctx, x, y, logoBox, logoBox, r);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.drawImage(iconImg, x + (logoBox - iconSize) / 2, y + (logoBox - iconSize) / 2, iconSize, iconSize);
  ctx.restore();
  return canvas.toDataURL('image/png');
}

const fmtPhone = (m) => m.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');

/* ───────── 海报版面（镜像 marketing/poster-promo.template.html） ───────── */
const POSTER_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .poster-root {
    width: 1080px; height: 1920px;
    font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    background: #f4ece2; color: #2b1d16;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .poster { width: 1080px; height: 1920px; display: flex; flex-direction: column; position: relative; }
  .hero {
    flex: none;
    background: linear-gradient(150deg, #ff8a3d 0%, #ff5630 55%, #f0332e 100%);
    padding: 44px 64px 38px; color: #fff; position: relative; overflow: hidden;
  }
  .hero::after {
    content: ''; position: absolute; right: -170px; bottom: -230px;
    width: 560px; height: 560px; border: 26px solid rgba(255,255,255,.10); border-radius: 50%;
  }
  .hero-top { display: flex; align-items: center; gap: 26px; position: relative; z-index: 2; }
  .hero-logo { width: 100px; height: 100px; border-radius: 24px; box-shadow: 0 12px 28px rgba(150,20,10,.35); }
  .hero-name { font-size:70px; font-weight: 900; letter-spacing: 3px; }
  .hero-slogan { margin-top: 24px; font-size: 40px; font-weight: 800; position: relative; z-index: 2; }
  .hero-sub { margin-top: 10px; font-size: 26px; opacity: .92; position: relative; z-index: 2; }
  .card {
    flex: none; background: #fff; border-radius: 28px;
    margin: 18px 64px 0; padding: 22px 30px 24px;
    box-shadow: 0 10px 28px rgba(120,60,20,.09);
  }
  .card-title { display: flex; align-items: center; gap: 14px; font-size: 35px; font-weight: 900; margin-bottom: 18px; }
  .card-title .bar { width: 11px; height: 36px; border-radius: 6px; background: linear-gradient(#ff8a3d,#ff3b30); }
  .card-title .mini { margin-left: auto; font-size: 22px; font-weight: 700; color: #ff5630; background: #fff0ec; padding: 6px 16px; border-radius: 999px; }
  .plats { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .plat { border-radius: 20px; padding: 16px 24px; color: #fff; display: flex; align-items: center; gap: 18px; }
  .plat .p-ico {
    width: 62px; height: 62px; border-radius: 16px; background: rgba(255,255,255,.22);
    display: flex; align-items: center; justify-content: center; font-size: 38px; font-weight: 900; flex: none;
  }
  .plat .p-name { font-size: 33px; font-weight: 800; }
  .plat .p-desc { font-size: 21px; opacity: .9; margin-top: 3px; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px; }
  .chip { border-radius: 999px; padding: 11px 28px; color: #fff; font-size: 26px; font-weight: 700; }
  .chip.ghost { background: #fff; color: #7a4a30; border: 3px solid #ffd9c2; }
  .agent-card { background: linear-gradient(135deg,#5a3bf0,#8a2fd0); color: #fff; box-shadow: 0 12px 30px rgba(70,30,160,.30); }
  .agent-card .card-title { margin-bottom: 16px; }
  .agent-card .bar { background: linear-gradient(#ffd34d,#ff9d2e); }
  .agent-card .mini { background: rgba(255,255,255,.22); color: #fff; font-size: 22px; }
  .perks { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .perk { display: flex; align-items: center; gap: 18px; font-size: 26px; font-weight: 700; background: rgba(255,255,255,.13); border-radius: 14px; padding: 11px 22px; }
  .perk .pk { font-size: 32px; flex: none; width: 42px; text-align: center; }
  .perk b { font-weight: 900; color: #ffe27a; }
  .ladder { display: flex; margin-top: 12px; background: rgba(0,0,0,.18); border-radius: 14px; padding: 12px 8px; }
  .ladder .lv { flex: 1; text-align: center; }
  .ladder .lv .l-name { font-size: 24px; font-weight: 800; }
  .ladder .lv .l-rate { font-size: 20px; opacity: .9; margin-top: 3px; }
  .ladder .lv.hot .l-rate { color: #ffe27a; font-weight: 900; }
  .bottom-card { display: flex; align-items: center; gap: 26px; }
  .qr-wrap { flex: none; width: 248px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .qr-img { width: 240px; height: 240px; border-radius: 18px; border: 5px solid #fff3ec; flex: none; }
  .qr-code { font-size: 22px; color: #a0765c; font-weight: 700; white-space: nowrap; }
  .qr-code b { color: #ff3b30; font-size: 28px; letter-spacing: 1px; margin-left: 6px; }
  .qr-url { font-size: 14px; color: #b79a86; white-space: nowrap; }
  .contact { flex: 1; min-width: 0; }
  .contact .ct-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
  .contact .ct-ico {
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(#ff8a3d,#ff3b30); color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 30px; flex: none;
  }
  .contact .ct-tel { font-size: 38px; font-weight: 900; color: #ff3b30; letter-spacing: 1px; }
  .contact .ct-lab { font-size: 21px; color: #a0765c; }
  .contact .ct-boss {
    display: flex; align-items: center; gap: 10px;
    font-size: 23px; font-weight: 700; color: #7a4a30;
    margin-bottom: 12px; white-space: nowrap;
  }
  .contact .ct-boss .dot { width: 10px; height: 10px; border-radius: 50%; background: #ff8a3d; flex: none; }
  .contact .ct-boss b { color: #ff3b30; font-weight: 900; margin: 0 4px; }
  .contact .wx-row {
    display: flex; align-items: center; gap: 14px;
    background: #07c160; color: #fff; border-radius: 14px; padding: 11px 20px;
    font-size: 26px; font-weight: 800;
  }
  .contact .wx-row .wlab { font-size: 21px; font-weight: 600; opacity: .92; margin-left: auto; }
  .scan-line { margin-top: 10px; font-size: 20px; color: #a0765c; }
  .footer { margin-top: auto; padding: 14px 0 18px; text-align: center; font-size: 20px; color: #b79a86; }
`;

const posterBody = ({ heroSrc, qrSrc, inviteCode, inviteUrl, phone }) => `
<div class="poster">
  <div class="hero">
    <div class="hero-top">
      <img id="pl-hero" class="hero-logo" src="${heroSrc}" alt="省钱猫" />
      <div class="hero-name">省钱猫</div>
    </div>
    <div class="hero-slogan">四大平台购物返利 · 本地生活天天领券</div>
    <div class="hero-sub">买啥都先领券，下单再返现 —— 省下的，就是赚到的</div>
  </div>

  <div class="card">
    <div class="card-title"><span class="bar"></span>四大平台购物返利<span class="mini">隐藏券 + 高额返利</span></div>
    <div class="plats">
      <div class="plat" style="background:linear-gradient(135deg,#ff8200,#ff5000)">
        <span class="p-ico">淘</span>
        <div><div class="p-name">淘宝</div><div class="p-desc">领券下单 · 收货返利</div></div>
      </div>
      <div class="plat" style="background:linear-gradient(135deg,#e23a44,#c81623)">
        <span class="p-ico">京</span>
        <div><div class="p-name">京东</div><div class="p-desc">全网好物 · 返利到账</div></div>
      </div>
      <div class="plat" style="background:linear-gradient(135deg,#f64036,#e02e24)">
        <span class="p-ico">多</span>
        <div><div class="p-name">拼多多</div><div class="p-desc">拼团低价 · 再省一笔</div></div>
      </div>
      <div class="plat" style="background:linear-gradient(135deg,#ff4d79,#ff2d52)">
        <span class="p-ico">唯</span>
        <div><div class="p-name">唯品会</div><div class="p-desc">品牌特卖 · 专属返利</div></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title"><span class="bar"></span>本地生活优惠券<span class="mini">券后立减</span></div>
    <div class="chips">
      <span class="chip" style="background:#ffb300">美团外卖</span>
      <span class="chip" style="background:#1296db">饿了么</span>
      <span class="chip" style="background:#ff6a00">淘宝闪购</span>
      <span class="chip" style="background:#ff6034">美团到店</span>
      <span class="chip ghost">酒店</span>
      <span class="chip ghost">电影</span>
      <span class="chip ghost">打车</span>
      <span class="chip ghost">飞猪</span>
    </div>
  </div>

  <div class="card agent-card">
    <div class="card-title"><span class="bar"></span>代理招商 · 0元加入<span class="mini">最高返佣 25%</span></div>
    <div class="perks">
      <div class="perk"><span class="pk">🎁</span><span><b>免费加入</b>，0 门槛 0 囤货，一部手机就能做</span></div>
      <div class="perk"><span class="pk">💰</span><span>自买省钱 · 分享赚钱，团队订单<b>永久分成</b></span></div>
      <div class="perk"><span class="pk">📈</span><span>等级晋升 + 专属培训 + <b>一对一辅导</b></span></div>
    </div>
    <div class="ladder">
      <div class="lv"><div class="l-name">白银</div><div class="l-rate">起步分成</div></div>
      <div class="lv"><div class="l-name">黄金</div><div class="l-rate">更高比例</div></div>
      <div class="lv hot"><div class="l-name">钻石</div><div class="l-rate">最高 25%</div></div>
    </div>
  </div>

  <div class="card bottom-card">
    <div class="qr-wrap">
      <img id="pl-qr" class="qr-img" src="${qrSrc}" alt="扫码进入省钱猫" />
      <div class="qr-code">推广码<b>${inviteCode}</b></div>
      <div class="qr-url">${inviteUrl}</div>
    </div>
    <div class="contact">
      <div class="ct-row">
        <span class="ct-ico">📞</span>
        <div>
          <div class="ct-tel">${phone}</div>
          <div class="ct-lab">专属顾问 · 咨询 / 合作 / 招商</div>
        </div>
      </div>
      <div class="ct-boss">
        <span class="dot"></span>
        <span>平台热线<b>158 7341 6463</b>（微信同号）</span>
      </div>
      <div class="wx-row">💬 添加微信请备注来意<span class="wlab">平台官方客服</span></div>
      <div class="scan-line">扫一扫二维码，立即进省钱猫领券 / 申请代理</div>
    </div>
  </div>

  <div class="footer">耒阳市优辰网络科技有限公司 · https://fanly.lyelse.com</div>
</div>
`;

/**
 * 生成账号专属招商海报 PNG。
 * @param {{ mobile: string, inviteCode: string }} account
 * @returns {Promise<{ dataUrl: string, inviteUrl: string }>}
 */
export async function renderPoster({ mobile, inviteCode }) {
  if (!mobile || !inviteCode) throw new Error('缺少手机号或邀请码，无法生成海报');
  const inviteUrl = `${window.location.origin}/i/${inviteCode}`;
  const phone = fmtPhone(mobile);

  const heroDataUrl = await urlToDataUrl(ICON_URL);
  const iconImg = await loadImage(heroDataUrl);
  const qrDataUrl = await buildQrDataUrl(inviteUrl, iconImg);
  const [heroImg, qrImg] = await Promise.all([loadImage(heroDataUrl), loadImage(qrDataUrl)]);

  // ── 第 1 段：离屏真实 DOM 布局，测量两张图的坐标（1080 设计稿坐标，与 canvas 1:1） ──
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;top:0;left:-100000px;width:1080px;height:1920px;overflow:hidden;';
  holder.innerHTML =
    `<style>${POSTER_CSS}</style><div class="poster-root">` +
    posterBody({ heroSrc: heroDataUrl, qrSrc: qrDataUrl, inviteCode, inviteUrl, phone }) +
    '</div>';
  document.body.appendChild(holder);
  let heroRect;
  let qrBorderRect;
  try {
    // 不用 requestAnimationFrame：离屏/后台 WebView 会挂起 rAF。
    // 两张图都有固定 CSS 尺寸且已预解码，getBoundingClientRect 会强制同步布局，测量结果确定可用。
    const base = holder.querySelector('.poster-root').getBoundingClientRect();
    const rectOf = (sel) => {
      const r = holder.querySelector(sel).getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    };
    heroRect = rectOf('#pl-hero');
    qrBorderRect = rectOf('#pl-qr');
  } finally {
    holder.remove();
  }

  // ── 第 2 段：SVG foreignObject 光栅化纯版式（图片位换成透明占位，保留边框/圆角占位） ──
  const inner =
    `<style>${POSTER_CSS}</style>` +
    posterBody({ heroSrc: TRANSPARENT_PX, qrSrc: TRANSPARENT_PX, inviteCode, inviteUrl, phone });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" class="poster-root">${inner}</div>` +
    `</foreignObject></svg>`;
  const svgImg = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4ece2';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(svgImg, 0, 0, W, H);

  // ── 第 3 段：直接 drawImage 合成两张图（foreignObject 内嵌图在 WebKit 下会光栅化空白） ──
  ctx.save();
  roundedPath(ctx, heroRect.x, heroRect.y, heroRect.w, heroRect.h, 24);
  ctx.clip();
  ctx.drawImage(heroImg, heroRect.x, heroRect.y, heroRect.w, heroRect.h);
  ctx.restore();

  // 二维码内容盒：CSS 边框 5px，圆角从 18 收窄到 13；边框本身已由第 2 段画出
  const b = 5;
  ctx.save();
  roundedPath(ctx, qrBorderRect.x + b, qrBorderRect.y + b, qrBorderRect.w - b * 2, qrBorderRect.h - b * 2, 13);
  ctx.clip();
  ctx.drawImage(qrImg, qrBorderRect.x + b, qrBorderRect.y + b, qrBorderRect.w - b * 2, qrBorderRect.h - b * 2);
  ctx.restore();

  return { dataUrl: canvas.toDataURL('image/png'), inviteUrl };
}
