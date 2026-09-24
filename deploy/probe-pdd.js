#!/usr/bin/env node
/**
 * 拼多多（多多进宝）接口自检。
 *
 *   node deploy/probe-pdd.js                # 读 server/.env
 *   PDD_CLIENT_ID=.. PDD_CLIENT_SECRET=.. PDD_PID=.. node deploy/probe-pdd.js
 *   KEYWORD=纸巾 node deploy/probe-pdd.js
 *
 * 只读接口 + 一次转链，不会产生任何订单。secret 永远不打印。
 * 需要 Node 18+（用到内置 fetch）。
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── 配置 ──────────────────────────────────────────────
function loadEnv() {
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
}
loadEnv();

const CLIENT_ID = process.env.PDD_CLIENT_ID || '';
const SECRET    = process.env.PDD_CLIENT_SECRET || '';
const PID       = process.env.PDD_PID || '';
const GATEWAY   = process.env.PDD_GATEWAY || 'https://gw-api.pinduoduo.com/api/router';
const KEYWORD   = process.env.KEYWORD || '纸巾';
const UID       = process.env.UID_PARAM || 'PDD3X599G';

if (!CLIENT_ID || !SECRET) {
  console.error('缺 PDD_CLIENT_ID / PDD_CLIENT_SECRET');
  process.exit(1);
}
console.log(`client_id = ${CLIENT_ID.slice(0, 6)}…${CLIENT_ID.slice(-4)}`);
console.log(`p_id      = ${PID || '(空！转链会失败)'}`);
console.log(`网关      = ${GATEWAY}\n`);

// ── 网关 ──────────────────────────────────────────────
function sign(params) {
  const raw = SECRET + Object.keys(params).sort().map(k => k + params[k]).join('') + SECRET;
  return { sign: crypto.createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase(), raw };
}

async function call(type, biz = {}, { debug = false } = {}) {
  const params = {
    type,
    client_id: CLIENT_ID,
    timestamp: String(Math.floor(Date.now() / 1000)),
    data_type: 'JSON',
  };
  for (const [k, v] of Object.entries(biz)) {
    if (v === undefined || v === null || v === '') continue;
    params[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  const { sign: sg, raw } = sign(params);
  params.sign = sg;

  if (debug) {
    // 签名串里把 secret 抹掉，方便和文档比对而不泄密
    console.log('  待签名串:', raw.split(SECRET).join('«secret»').slice(0, 300));
  }

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
    throw new Error(`${e.error_code} ${e.error_msg}${e.sub_msg ? ' / ' + e.sub_msg : ''}`);
  }
  const keys = Object.keys(json);
  return json[keys.find(k => k.endsWith('_response')) || keys[0]];
}

const yuan = v => (Math.round(Number(v || 0)) / 100).toFixed(2);

// ── 用例 ──────────────────────────────────────────────
(async () => {
  let goodsSign = null;

  console.log('【1】商品搜索 pdd.ddk.goods.search');
  try {
    const d = await call('pdd.ddk.goods.search',
      { keyword: KEYWORD, page: 1, page_size: 5, sort_type: 0, pid: PID },
      { debug: true });
    const list = d.goods_list || [];
    console.log(`  共 ${d.total_count ?? '?'} 条，取前 ${list.length} 条：`);
    list.forEach((g, i) => {
      const price = Number(g.min_group_price || 0) / 100;
      const coupon = g.has_coupon ? Number(g.coupon_discount || 0) / 100 : 0;
      const rate = Number(g.promotion_rate || 0) / 1000;
      console.log(`  ${i + 1}. ${String(g.goods_name).slice(0, 26)}`);
      console.log(`     券后 ${(price - coupon).toFixed(2)} 元 | 佣金率 ${(rate * 100).toFixed(1)}% ` +
                  `| 预估佣金 ${((price - coupon) * rate).toFixed(2)} 元 | 销量 ${g.sales_tip || g.sold_quantity}`);
      console.log(`     goods_sign=${g.goods_sign}  goods_id=${g.goods_id}`);
    });
    goodsSign = list[0] && list[0].goods_sign;
    if (list[0] && process.env.RAW !== '0') {
      // 字段映射是照文档写的，拿真实数据核一遍才放心
      console.log('\n  第 1 条的原始字段（只看非空的）：');
      Object.entries(list[0])
        .filter(([, v]) => v !== '' && v !== null && v !== undefined &&
                           !(Array.isArray(v) && !v.length))
        .forEach(([k, v]) => {
          const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
          console.log(`    ${k.padEnd(28)} ${s.slice(0, 70)}`);
        });
    }
  } catch (e) { console.log('  ✗', e.message); }

  console.log('\n【2】商品详情 pdd.ddk.goods.detail');
  if (!goodsSign) console.log('  跳过（上一步没拿到 goods_sign）');
  else try {
    const d = await call('pdd.ddk.goods.detail', { goods_sign: goodsSign, pid: PID });
    const g = (d.goods_details || [])[0];
    console.log(g ? `  ✓ ${String(g.goods_name).slice(0, 30)} | 店铺 ${g.mall_name}` : '  空结果');
  } catch (e) { console.log('  ✗', e.message); }

  console.log('\n【3】转链 pdd.ddk.goods.promotion.url.generate  ← 订单归属的命门');
  if (!goodsSign) console.log('  跳过');
  else if (!PID) console.log('  跳过（PDD_PID 为空）');
  else try {
    const custom = JSON.stringify({ uid: UID });
    console.log(`  custom_parameters = ${custom}  (${Buffer.byteLength(custom)} 字节 / 上限 64)`);
    const d = await call('pdd.ddk.goods.promotion.url.generate', {
      p_id: PID,
      goods_sign_list: [goodsSign],
      custom_parameters: custom,
      generate_short_url: true,
      generate_schema_url: true,
      generate_mobile: true,
    });
    const u = (d.goods_promotion_url_list || [])[0] || {};
    console.log('  短链   :', u.mobile_short_url || u.short_url || '(无)');
    console.log('  deeplink:', (u.schema_url || u.mobile_url || '(无)').slice(0, 90));
    console.log('\n  ★ 拿手机点开这个短链下单，几分钟后跑【4】，');
    console.log(`    看 custom_parameters 是不是原样回来 {"uid":"${UID}"}。回得来，归属就通了。`);
  } catch (e) { console.log('  ✗', e.message); }

  console.log('\n【4】订单增量 pdd.ddk.order.list.increment.get（近 24 小时）');
  try {
    const end = Math.floor(Date.now() / 1000);
    const d = await call('pdd.ddk.order.list.increment.get', {
      start_update_time: end - 24 * 3600,
      end_update_time: end,
      page: 1, page_size: 20, return_count: true,
    });
    const list = d.order_list || [];
    console.log(`  共 ${d.total_count ?? list.length} 单`);
    list.slice(0, 5).forEach(o => {
      console.log(`  ${o.order_sn} | ${o.order_status_desc}(${o.order_status}) | ` +
                  `订单 ${yuan(o.order_amount)} | 佣金 ${yuan(o.promotion_amount)} | ` +
                  `custom=${o.custom_parameters || '(空)'}`);
    });
    if (!list.length) console.log('  （近 24 小时没有订单，正常）');
  } catch (e) { console.log('  ✗', e.message); }

  console.log('\n常见报错对照：');
  console.log('  10001 签名错误      → client_secret 填错，或参数里混了空值');
  console.log('  10002 时间戳过期    → 服务器时间不准，date 对一下');
  console.log('  50001 无权限        → 应用没开通多多进宝，或还在审核');
  console.log('  70028 pid 不合法    → PDD_PID 不是这个账号的推广位');
  console.log('  自定义参数相关报错  → p_id 没做备案，去多多进宝后台绑定推广位');
})();
