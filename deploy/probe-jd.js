#!/usr/bin/env node
/**
 * 京东联盟接口自检。
 *
 *   node deploy/probe-jd.js                 # 读 server/.env
 *   KEYWORD=纸巾 node deploy/probe-jd.js
 *
 * 只读接口 + 一次转链，不会产生订单。secret 永远不打印。
 * 需要 Node 18+（用到内置 fetch）。
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── 配置 ──────────────────────────────────────────────
(function loadEnv() {
  const candidates = [
    process.env.ENV_FILE,
    path.resolve(__dirname, '../server/.env'),
    path.resolve(process.cwd(), 'server/.env'),
    path.resolve(process.cwd(), '.env'),
  ].filter(Boolean);
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    console.log(`(配置来自 ${f})`);
    break;
  }
})();

const APP_KEY = process.env.JD_APP_KEY || '';
const SECRET = process.env.JD_APP_SECRET || '';
const SITE_ID = process.env.JD_SITE_ID || '';
const UNION_ID = process.env.JD_UNION_ID || '';
const POSITION = process.env.JD_POSITION_ID || '';
const TOKEN = process.env.JD_ACCESS_TOKEN || '';
const GATEWAY = process.env.JD_GATEWAY || 'https://api.jd.com/routerjson';
const KEYWORD = process.env.KEYWORD || '纸巾';
const SUB_UNION = process.env.SUB_UNION_ID || 'JD3XBNQB';

if (!APP_KEY || !SECRET) {
  console.error('缺 JD_APP_KEY / JD_APP_SECRET —— 还没申请到 API 权限的话先别跑这个');
  process.exit(1);
}
console.log(`app_key     = ${APP_KEY.slice(0, 6)}…${APP_KEY.slice(-4)}`);
console.log(`联盟ID      = ${UNION_ID || '(空)'}`);
console.log(`站点ID      = ${SITE_ID || '(空)'}`);
console.log(`推广位      = ${POSITION || '(空，转链会失败)'}`);
console.log(`授权key     = ${TOKEN ? TOKEN.slice(0, 6) + '…' : '(空，部分接口可能要)'}`);
console.log(`网关        = ${GATEWAY}\n`);

// ── 网关 ──────────────────────────────────────────────

/** 京东要的是「北京时间」的 yyyy-MM-dd HH:mm:ss 字符串，不是 Unix 秒 */
function beijingNow() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' ');
}

function sign(params) {
  const raw = SECRET + Object.keys(params).sort().map((k) => k + params[k]).join('') + SECRET;
  return {
    sign: crypto.createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase(),
    raw,
  };
}

async function call(method, bizObj, { debug = false } = {}) {
  const params = {
    method,
    app_key: APP_KEY,
    timestamp: beijingNow(),
    format: 'json',
    v: '1.0',
    sign_method: 'md5',
    // 业务参数整个塞进一个字段，不像拼多多那样平铺
    param_json: JSON.stringify(bizObj),
  };
  // 有授权 key 就带上；它参与签名，不能只放在 body 里
  if (TOKEN) params.access_token = TOKEN;
  const { sign: sg, raw } = sign(params);
  params.sign = sg;

  if (debug) console.log('  待签名串:', raw.split(SECRET).join('«secret»').slice(0, 300));

  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status} 非 JSON: ${text.slice(0, 200)}`); }

  if (json.error_response) {
    const e = json.error_response;
    throw new Error(`${e.code || e.zh_desc || ''} ${e.zh_desc || e.en_desc || JSON.stringify(e)}`);
  }

  // 京东自己把 response 拼成了 responce，沿用至今，别按 response 找
  const outerKey = Object.keys(json).find((k) => k.endsWith('_responce')) || Object.keys(json)[0];
  const outer = json[outerKey] || {};
  if (outer.code && String(outer.code) !== '0') {
    throw new Error(`${outer.code} ${outer.msg || outer.message || ''}`);
  }

  // 真正的数据还裹了一层 JSON **字符串**，要再 parse 一次 —— 这是最容易漏的坑
  const resultKey = Object.keys(outer).find((k) => k.endsWith('Result'));
  if (!resultKey) return outer;
  const inner = typeof outer[resultKey] === 'string'
    ? JSON.parse(outer[resultKey])
    : outer[resultKey];
  if (inner.code !== undefined && Number(inner.code) !== 200 && Number(inner.code) !== 0) {
    throw new Error(`内层 ${inner.code}: ${inner.message || ''}`);
  }
  return inner.data !== undefined ? inner.data : inner;
}

// ── 用例 ──────────────────────────────────────────────
(async () => {
  let skuId = null;
  let materialUrl = null;

  console.log('【1】关键词搜索 jd.union.open.goods.query');
  try {
    const d = await call('jd.union.open.goods.query', {
      goodsReqDTO: { keyword: KEYWORD, pageIndex: 1, pageSize: 10, sortName: 'inOrderCount30Days' },
    }, { debug: true });
    const list = d?.data || d || [];
    console.log(`  取到 ${list.length} 条：`);
    list.slice(0, 3).forEach((g, i) => {
      // 京东金额单位是**元**，佣金比例是百分数，跟拼多多正好相反
      const price = Number(g.priceInfo?.lowestCouponPrice ?? g.priceInfo?.price ?? 0);
      const rate = Number(g.commissionInfo?.commissionShare ?? 0) / 100;
      console.log(`  ${i + 1}. ${String(g.skuName).slice(0, 26)}`);
      console.log(`     券后 ${price.toFixed(2)} 元 | 佣金率 ${(rate * 100).toFixed(1)}% ` +
                  `| 预估佣金 ${(price * rate).toFixed(2)} 元 | 30天销量 ${g.inOrderCount30Days ?? '?'}`);
      console.log(`     skuId=${g.skuId}  materialUrl=${String(g.materialUrl).slice(0, 60)}`);
    });
    skuId = list[0]?.skuId;
    materialUrl = list[0]?.materialUrl;
  } catch (e) { console.log('  ✗', e.message); }

  console.log('\n【2】京粉精选 jd.union.open.goods.jingfen.query —— 首页榜单的料');
  try {
    const d = await call('jd.union.open.goods.jingfen.query', {
      goodsReq: { eliteId: 1, pageIndex: 1, pageSize: 10 },
    });
    const list = d?.data || d || [];
    console.log(`  ✓ eliteId=1 返回 ${list.length} 条 | 首条：${String(list[0]?.skuName).slice(0, 26)}`);
    console.log('  （eliteId 是频道号：1 好券商品、2 超级大牌…，值得挨个试一遍再定用哪些）');
  } catch (e) { console.log('  ✗', e.message); }

  console.log('\n【3】推广位 jd.union.open.position.query —— 订单归属靠它');
  try {
    const d = await call('jd.union.open.position.query', {
      positionReq: { unionId: Number(UNION_ID), key: '', pageIndex: 1, pageSize: 20, type: 3 },
    });
    const list = d?.data || d || [];
    console.log(`  ✓ 已有 ${list.length} 个推广位`);
    list.slice(0, 5).forEach((p) => console.log(`     ${p.id}  ${p.spaceName || ''}`));
    if (!POSITION && list[0]) {
      console.log(`  ★ .env 里 JD_POSITION_ID 先填 ${list[0].id}，用来跑通转链`);
    }
  } catch (e) {
    console.log('  ✗', e.message);
    console.log('  （没有推广位就去联盟后台「推广管理 → 推广位管理」建一个）');
  }

  console.log('\n【4】转链 jd.union.open.promotion.bysubunionid.get  ← 订单归属的命门');
  if (!materialUrl) console.log('  跳过（第 1 步没拿到 materialUrl）');
  else if (!POSITION) console.log('  跳过（JD_POSITION_ID 为空）');
  else try {
    const d = await call('jd.union.open.promotion.bysubunionid.get', {
      promotionCodeReq: {
        materialId: materialUrl,
        positionId: Number(POSITION),
        subUnionId: SUB_UNION,   // 没权限的话这个字段会被忽略，归属只认 positionId
        ...(SITE_ID ? { siteId: Number(SITE_ID) } : {}),
      },
    });
    console.log('  短链   :', d?.shortURL || d?.clickURL || '(无)');
    console.log('  长链   :', String(d?.clickURL || '').slice(0, 90));
    console.log('\n  ★ 拿手机点开这个短链下单，几分钟后跑【5】，');
    console.log(`    看 positionId 是不是 ${POSITION}。对得上，归属就通了。`);
  } catch (e) { console.log('  ✗', e.message); }

  console.log('\n【5】订单行 jd.union.open.order.row.query（近 1 小时）');
  try {
    const now = new Date();
    const fmt = (d) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      .replace('T', '').replace(/[-: ]/g, '').slice(0, 12);
    const d = await call('jd.union.open.order.row.query', {
      orderReq: {
        pageNo: 1, pageSize: 20, type: 1,     // type: 1 下单时间 / 2 完成时间 / 3 更新时间
        startTime: fmt(new Date(now.getTime() - 3600 * 1000)),
        endTime: fmt(now),
      },
    });
    const list = d?.data || d || [];
    console.log(`  共 ${list.length} 单`);
    list.slice(0, 5).forEach((o) => {
      console.log(`  ${o.orderId} | 状态 ${o.validCode} | 金额 ${o.skuList?.[0]?.estimateFee ?? '?'} ` +
                  `| positionId=${o.positionId} subUnionId=${o.subUnionId || '(空)'}`);
    });
    if (!list.length) console.log('  （近 1 小时没有订单，正常）');
  } catch (e) { console.log('  ✗', e.message); }

  console.log('\n常见报错对照：');
  console.log('  invalid signature / 签名错误 → appSecret 填错，或时间戳不是北京时间');
  console.log('  ip 白名单              → 开放平台后台把服务器公网 IP 加进白名单');
  console.log('  权限不足 / 未授权       → 对应接口的权限还没申请下来');
  console.log('  推广位不存在            → JD_POSITION_ID 不是这个联盟账号的推广位');
})();
