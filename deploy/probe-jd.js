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

/**
 * 业务参数到底放哪个字段，京东有三种写法，各接口还不统一：
 *   param_json        —— 联盟文档里写的
 *   360buy_param_json —— 宙斯网关的老写法，很多接口至今只认这个
 *   flat              —— 业务参数直接平铺成表单字段
 * 字段名不对时业务层收不到参数，只会回一个没有任何细节的「参数错误」，
 * 而且不管内容怎么改都一样——所以必须先把模式探出来。
 */
let PARAM_MODE = process.env.JD_PARAM_MODE || '';

function buildParams(method, bizObj, mode) {
  const params = {
    method,
    app_key: APP_KEY,
    timestamp: beijingNow(),
    format: 'json',
    v: '1.0',
    sign_method: 'md5',
  };
  if (TOKEN) params.access_token = TOKEN;

  if (mode === '360buy') params['360buy_param_json'] = JSON.stringify(bizObj);
  else if (mode === 'flat') {
    for (const [k, v] of Object.entries(bizObj)) {
      params[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
  } else params.param_json = JSON.stringify(bizObj);

  return params;
}

async function call(method, bizObj, { debug = false, mode } = {}) {
  const params = buildParams(method, bizObj, mode || PARAM_MODE);
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

  console.log('【0】业务参数字段名探测 —— 这个不对后面全是「参数错误」');
  if (PARAM_MODE) {
    console.log(`  已由 JD_PARAM_MODE 指定为 ${PARAM_MODE}，跳过探测`);
  } else {
    // 拿一个有权限的接口当探针：报「参数错误」说明字段名没进去，
    // 报别的（或直接成功）说明业务层收到参数了
    for (const mode of ['param_json', '360buy', 'flat']) {
      try {
        await call('jd.union.open.goods.jingfen.query',
          { goodsReq: { eliteId: 1, pageIndex: 1, pageSize: 20 } }, { mode });
        PARAM_MODE = mode;
        console.log(`  ✓ ${mode} —— 直接通了`);
        break;
      } catch (e) {
        const msg = e.message || '';
        if (/参数错误|400/.test(msg)) {
          console.log(`  ✗ ${mode.padEnd(12)} 参数没进去`);
        } else {
          PARAM_MODE = mode;
          console.log(`  ✓ ${mode.padEnd(12)} 参数进去了（报的是「${msg.slice(0, 30)}」，属于内容问题）`);
          break;
        }
      }
    }
    if (!PARAM_MODE) {
      PARAM_MODE = 'param_json';
      console.log('  三种都不行，先按 param_json 往下跑，后面的结果仅供参考');
    } else {
      console.log(`  → 后续全部用 ${PARAM_MODE}`);
    }
  }
  console.log('');

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
  console.log('    eliteId 是频道号，文档给的一串未必都还活着，扫一遍看哪些能用');
  for (const eliteId of [1, 2, 3, 4, 10, 15, 22, 23, 30]) {
    try {
      const d = await call('jd.union.open.goods.jingfen.query', {
        goodsReq: { eliteId, pageIndex: 1, pageSize: 20 },
      });
      const list = d?.data || d || [];
      if (!list.length) { console.log(`  eliteId=${String(eliteId).padEnd(2)} → 空`); continue; }
      const g = list[0];
      const price = Number(g.priceInfo?.lowestCouponPrice ?? g.priceInfo?.price ?? 0);
      const rate = Number(g.commissionInfo?.commissionShare ?? 0) / 100;
      console.log(`  eliteId=${String(eliteId).padEnd(2)} → ${list.length} 条 | ` +
                  `${String(g.skuName).slice(0, 18)} | 券后 ${price.toFixed(2)} | 佣金 ${(price * rate).toFixed(2)}`);
      if (!skuId) { skuId = g.skuId; materialUrl = g.materialUrl; }
    } catch (e) {
      console.log(`  eliteId=${String(eliteId).padEnd(2)} ✗ ${e.message.slice(0, 60)}`);
    }
  }

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
    // 京东订单行要的是 yyyyMMddHH，精确到**小时**，多给几位就报参数错误
    const fmt = (d) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
      .replace('T', ' ').replace(/[-: ]/g, '').slice(0, 10);
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

  console.log('\n【6】权限扫描 —— 搞清楚这个 appKey 到底能调哪些接口');
  console.log('    判据：403=没权限；400/其他报错=有权限只是参数不对；✓=直接通了');
  const PROBE_APIS = [
    ['商品搜索',      'jd.union.open.goods.query',                  { goodsReqDTO: { keyword: '纸巾', pageIndex: 1, pageSize: 10 } }],
    ['京粉精选',      'jd.union.open.goods.jingfen.query',          { goodsReq: { eliteId: 1, pageIndex: 1, pageSize: 20 } }],
    ['商品详情',      'jd.union.open.goods.bigfield.query',         { goodsReq: { skuIds: [100012043978] } }],
    ['类目',          'jd.union.open.category.goods.get',           { req: { parentId: 0, grade: 0 } }],
    ['优惠券',        'jd.union.open.coupon.query',                 { couponUrls: ['https://coupon.jd.com/ilink/couponActiveInfo'] }],
    ['通用转链',      'jd.union.open.promotion.common.get',         { promotionCodeReq: { materialId: 'https://item.jd.com/100012043978.html', siteId: Number(SITE_ID) || undefined } }],
    ['子推客转链',    'jd.union.open.promotion.bysubunionid.get',   { promotionCodeReq: { materialId: 'https://item.jd.com/100012043978.html', positionId: Number(POSITION) || undefined } }],
    ['推广位查询',    'jd.union.open.position.query',               { positionReq: { unionId: Number(UNION_ID) || 0, pageIndex: 1, pageSize: 20, type: 3 } }],
    ['推广位创建',    'jd.union.open.position.create',              { positionReq: { unionId: Number(UNION_ID) || 0, key: '', type: 3, spaceNameList: ['probe-test'] } }],
    ['订单行',        'jd.union.open.order.row.query',              { orderReq: { pageNo: 1, pageSize: 20, type: 1, startTime: '2026010100', endTime: '2026010101' } }],
  ];

  const open = [];
  const denied = [];
  for (const [label, method, biz] of PROBE_APIS) {
    try {
      await call(method, biz);
      open.push(label);
      console.log(`  ✓  ${label.padEnd(12)} ${method}`);
    } catch (e) {
      const msg = e.message || '';
      if (/403|无访问权限|无权限|未授权/.test(msg)) {
        denied.push(label);
        console.log(`  ✗  ${label.padEnd(12)} 没权限`);
      } else {
        open.push(label);
        console.log(`  ○  ${label.padEnd(12)} 有权限，参数待调: ${msg.slice(0, 50)}`);
      }
    }
  }
  console.log(`\n  有权限: ${open.length ? open.join('、') : '一个都没有'}`);
  console.log(`  没权限: ${denied.length ? denied.join('、') : '无'}`);
  if (open.length && denied.length) {
    console.log('  → 先用有权限的那几个把链路跑通，没权限的去联盟后台单独申请');
  }
  if (!open.length) {
    console.log('  → 一个都调不了，多半是这个 appKey 还没绑定媒体，或者整体权限没开通');
  }

  console.log('\n【7】参数试错 —— 那几个 400 到底该怎么传');
  console.log('    每个接口挨个试入参结构，第一个通的就停，打印出正确写法');

  const hourAgo = new Date(Date.now() - 3600 * 1000);
  const hh = (d) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
    .replace('T', ' ').replace(/[-: ]/g, '').slice(0, 10);

  const SHAPES = [
    ['京粉精选', 'jd.union.open.goods.jingfen.query', [
      ['goodsReq 数字',       { goodsReq: { eliteId: 1, pageIndex: 1, pageSize: 20 } }],
      ['goodsReq 字符串',     { goodsReq: { eliteId: '1', pageIndex: '1', pageSize: '20' } }],
      ['goodsReq + pid',      { goodsReq: { eliteId: 1, pageIndex: 1, pageSize: 20, pid: process.env.JD_PID || '' } }],
      ['goodsReq + siteId',   { goodsReq: { eliteId: 1, pageIndex: 1, pageSize: 20, siteId: Number(SITE_ID) } }],
      ['goodsReqDTO',         { goodsReqDTO: { eliteId: 1, pageIndex: 1, pageSize: 20 } }],
      ['平铺',                { eliteId: 1, pageIndex: 1, pageSize: 20 }],
    ]],
    ['商品详情', 'jd.union.open.goods.bigfield.query', [
      ['skuIds 数组',         { goodsReq: { skuIds: [100012043978] } }],
      ['skuIds 字符串',       { goodsReq: { skuIds: '100012043978' } }],
      ['goodsReqDTO',         { goodsReqDTO: { skuIds: [100012043978] } }],
      ['平铺数组',            { skuIds: [100012043978] }],
    ]],
    ['类目', 'jd.union.open.category.goods.get', [
      ['req',                 { req: { parentId: 0, grade: 0 } }],
      ['平铺',                { parentId: 0, grade: 0 }],
      ['categoryReq',         { categoryReq: { parentId: 0, grade: 0 } }],
      ['grade1',              { req: { parentId: 0, grade: 1 } }],
    ]],
    ['通用转链', 'jd.union.open.promotion.common.get', [
      ['materialId+siteId',   { promotionCodeReq: { materialId: 'https://item.jd.com/100012043978.html', siteId: Number(SITE_ID) } }],
      ['+positionId',         { promotionCodeReq: { materialId: 'https://item.jd.com/100012043978.html', siteId: Number(SITE_ID), positionId: Number(POSITION) } }],
      ['siteId 字符串',       { promotionCodeReq: { materialId: 'https://item.jd.com/100012043978.html', siteId: String(SITE_ID) } }],
      ['只 materialId',       { promotionCodeReq: { materialId: 'https://item.jd.com/100012043978.html' } }],
      ['+pid',                { promotionCodeReq: { materialId: 'https://item.jd.com/100012043978.html', pid: process.env.JD_PID || '' } }],
    ]],
    ['订单行', 'jd.union.open.order.row.query', [
      ['pageNo+yyyyMMddHH',   { orderReq: { pageNo: 1, pageSize: 20, type: 1, startTime: hh(hourAgo), endTime: hh(new Date()) } }],
      ['pageIndex 命名',      { orderReq: { pageIndex: 1, pageSize: 20, type: 1, startTime: hh(hourAgo), endTime: hh(new Date()) } }],
      ['type 3 更新时间',     { orderReq: { pageNo: 1, pageSize: 20, type: 3, startTime: hh(hourAgo), endTime: hh(new Date()) } }],
      ['字符串页码',          { orderReq: { pageNo: '1', pageSize: '20', type: '1', startTime: hh(hourAgo), endTime: hh(new Date()) } }],
      ['orderReqDTO',         { orderReqDTO: { pageNo: 1, pageSize: 20, type: 1, startTime: hh(hourAgo), endTime: hh(new Date()) } }],
    ]],
  ];

  const won = {};
  for (const [label, method, shapes] of SHAPES) {
    console.log(`\n  ── ${label} ${method}`);
    let ok = false;
    for (const [name, biz] of shapes) {
      try {
        const d = await call(method, biz);
        const list = Array.isArray(d) ? d : (d?.data || []);
        const n = Array.isArray(list) ? list.length : '对象';
        console.log(`    ✓ ${name.padEnd(18)} → ${n} 条`);
        console.log(`      正确入参: ${JSON.stringify(biz).slice(0, 180)}`);
        // 头一条样本拿出来看字段，映射就是照这个写
        const sample = Array.isArray(list) ? list[0] : d;
        if (sample) {
          console.log('      样本字段:');
          Object.entries(sample).slice(0, 18).forEach(([k, v]) => {
            const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
            console.log(`        ${k.padEnd(24)} ${val.slice(0, 64)}`);
          });
        }
        won[label] = name;
        ok = true;
        break;
      } catch (e) {
        console.log(`    ✗ ${name.padEnd(18)} ${e.message.slice(0, 50)}`);
      }
    }
    if (!ok) console.log('    → 这几种都不行，把上面的报错发我，我换一批再试');
  }

  console.log('\n  试通的：', Object.keys(won).length ? JSON.stringify(won) : '一个都没通');

  console.log('\n常见报错对照：');
  console.log('  invalid signature / 签名错误 → appSecret 填错，或时间戳不是北京时间');
  console.log('  ip 白名单              → 开放平台后台把服务器公网 IP 加进白名单');
  console.log('  403 无访问权限          → 接口权限没开通，或缺 access_token');
  console.log('                            去 union.jd.com「我的API」申请接口权限并领授权key');
  console.log('  400 参数错误            → 入参结构或格式不对，不是权限问题');
  console.log('  推广位不存在            → JD_POSITION_ID 不是这个联盟账号的推广位');
})();
