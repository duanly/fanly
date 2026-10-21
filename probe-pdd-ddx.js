#!/usr/bin/env node
/**
 * 订单侠拼多多接口探针
 * 用法：node probe-pdd-ddx.js
 */

const API_KEY = process.env.DDX_API_KEY || 'gdZbzphjq9P0DHD3BbvJPClxixesk9M3';
const PID = process.env.PDD_PID || '44814283_318146216';
const BASE = process.env.DDX_BASE_URL || 'https://api.tbk.dingdanxia.com';

async function call(path, body = {}) {
  const url = BASE + path;
  const payload = { ...body, apikey: API_KEY };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined || payload[k] === null || payload[k] === '') {
      delete payload[k];
    }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString(),
  });
  const json = await res.json();
  return json;
}

function printHeader(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function printObj(obj, depth = 0) {
  const prefix = '  '.repeat(depth);
  if (Array.isArray(obj)) {
    console.log(`${prefix}Array(${obj.length})`);
    if (obj.length > 0 && typeof obj[0] === 'object') {
      printObj(obj[0], depth + 1);
      console.log(`${prefix}  ... (共 ${obj.length} 条)`);
    } else {
      console.log(`${prefix}  ${JSON.stringify(obj.slice(0, 3))}${obj.length > 3 ? '...' : ''}`);
    }
    return;
  }
  if (typeof obj === 'object' && obj !== null) {
    const keys = Object.keys(obj);
    for (const k of keys.slice(0, 30)) {
      const v = obj[k];
      if (typeof v === 'object' && v !== null) {
        console.log(`${prefix}${k}: `);
        printObj(v, depth + 1);
      } else if (typeof v === 'string' && v.length > 100) {
        console.log(`${prefix}${k}: "${v.slice(0, 80)}..." (${v.length} 字符)`);
      } else {
        console.log(`${prefix}${k}: ${JSON.stringify(v)}`);
      }
    }
    if (keys.length > 30) console.log(`${prefix}... 还有 ${keys.length - 30} 个字段`);
  } else {
    console.log(`${prefix}${JSON.stringify(obj)}`);
  }
}

async function test(name, path, params) {
  printHeader(`测试: ${name}`);
  console.log(`  接口: ${path}`);
  console.log(`  参数: ${JSON.stringify(params)}`);
  try {
    const t0 = Date.now();
    const json = await call(path, params);
    const dt = Date.now() - t0;
    console.log(`  耗时: ${dt}ms`);
    console.log(`  code: ${json.code}, msg: ${json.msg || json.message || ''}`);
    const data = json.data ?? json.result ?? json;
    if (Array.isArray(data)) {
      console.log(`  返回数组: ${data.length} 条`);
      if (data.length > 0) {
        console.log(`  第一条结构:`);
        printObj(data[0], 2);
      }
    } else if (data && typeof data === 'object') {
      const keys = Object.keys(data);
      // 找一下可能是列表的字段
      const listKeys = keys.filter(k =>
        Array.isArray(data[k]) && ['list', 'goods_list', 'order_list', 'results'].includes(k)
      );
      if (listKeys.length > 0) {
        for (const k of listKeys) {
          console.log(`  ${k}: ${data[k].length} 条`);
          if (data[k].length > 0) {
            console.log(`  第一条结构:`);
            printObj(data[k][0], 2);
          }
        }
        // 打印其他非列表字段
        const otherKeys = keys.filter(k => !listKeys.includes(k));
        if (otherKeys.length > 0) {
          console.log(`  其他字段:`);
          for (const k of otherKeys.slice(0, 10)) {
            if (typeof data[k] !== 'object') {
              console.log(`    ${k}: ${JSON.stringify(data[k])}`);
            }
          }
        }
      } else {
        console.log(`  返回对象结构:`);
        printObj(data, 1);
      }
    } else {
      console.log(`  返回值: ${JSON.stringify(data)}`);
    }
    return json;
  } catch (e) {
    console.log(`  ❌ 错误: ${e.message}`);
    return null;
  }
}

(async () => {
  console.log(`\n🚀 订单侠拼多多接口探针`);
  console.log(`  API Key: ${API_KEY.slice(0, 4)}...${API_KEY.slice(-4)}`);
  console.log(`  PID: ${PID}`);
  console.log(`  Base URL: ${BASE}`);

  // 1. 搜索
  await test('商品搜索', '/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 5,
    pid: PID,
    with_coupon: true,
  });

  // 2. 推荐
  await test('推荐榜单', '/pdd/recommend', {
    offset: 0,
    limit: 5,
    channel_type: 5,
    pid: PID,
  });

  // 3. 转链（先从搜索结果里拿个 goods_sign）
  try {
    const search = await call('/pdd/goods_search', {
      keyword: '纸巾',
      page: 1,
      page_size: 3,
      pid: PID,
    });
    const list = search?.data?.list ?? search?.data?.goods_list ?? [];
    if (list.length > 0) {
      const goodsSign = list[0].goods_sign;
      printHeader('测试: 转链');
      console.log(`  goods_sign: ${goodsSign}`);
      console.log(`  商品名: ${list[0].goods_name || list[0].title || ''}`);
      const convert = await call('/pdd/convert', {
        p_id: PID,
        goods_sign: goodsSign,
        custom_parameters: JSON.stringify({ uid: 'test123' }),
        generate_short_url: true,
        generate_schema_url: true,
        multi_group: true,
        generate_we_app: true,
        itemInfo: false,
      });
      console.log(`  code: ${convert.code}, msg: ${convert.msg || ''}`);
      const data = convert.data ?? convert.result ?? convert;
      console.log(`  返回结构:`);
      printObj(data, 1);
    }
  } catch (e) {
    console.log(`\n转链测试跳过: ${e.message}`);
  }

  // 4. 订单（试几个可能的路径）
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
  const orderPaths = [
    '/pdd/order_list',
    '/pdd/order_details',
    '/pdd/order',
  ];
  for (const p of orderPaths) {
    const r = await test(`订单接口 (${p})`, p, {
      start_time: Math.floor(start.getTime() / 1000),
      end_time: Math.floor(end.getTime() / 1000),
      page: 1,
      page_size: 10,
    });
    if (r && (r.code === 200 || r.code === 0)) {
      console.log(`  ✅ 接口 ${p} 可用！`);
      break;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  探针结束`);
  console.log(`${'='.repeat(60)}\n`);
})();
