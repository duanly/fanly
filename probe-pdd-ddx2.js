const API_KEY = 'gdZbzphjq9P0DHD3BbvJPClxixesk9M3';
const PID = '44814283_318146216';
const BASE = 'https://api.tbk.dingdanxia.com';

async function call(path, body = {}) {
  const url = BASE + path;
  const payload = { ...body, apikey: API_KEY };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined || payload[k] === null || payload[k] === '') delete payload[k];
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString(),
  });
  return res.json();
}

async function test(name, path, params) {
  console.log(`\n--- ${name} ---`);
  console.log(`  接口: ${path}`);
  console.log(`  参数: ${JSON.stringify(params)}`);
  const json = await call(path, params);
  console.log(`  code: ${json.code}, msg: ${json.msg || ''}`);
  const data = json.data ?? json.result ?? json;
  return { json, data };
}

(async () => {
  // 1. 搜索（page_size=10）
  const s1 = await test('搜索 page_size=10', '/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 10,
    pid: PID,
  });
  const list = s1.data?.list ?? s1.data?.goods_list ?? [];
  console.log(`  列表长度: ${list.length}`);
  if (list.length > 0) {
    const g = list[0];
    console.log(`  所有字段: ${Object.keys(g).sort().join(', ')}`);
    console.log(`  goods_sign: ${g.goods_sign || '(无)'}`);
    console.log(`  goods_id: ${g.goods_id}`);
    console.log(`  goods_name: ${g.goods_name}`);
    console.log(`  promotion_rate: ${g.promotion_rate} (千分比 → ${g.promotion_rate/10}%)`);
    console.log(`  min_group_price: ${g.min_group_price} 分 = ${g.min_group_price/100} 元`);
    console.log(`  coupon_discount: ${g.coupon_discount} 分 = ${g.coupon_discount/100} 元`);
    console.log(`  has_coupon: ${g.has_coupon}`);
    console.log(`  sales_tip: ${g.sales_tip}`);

    // 2. 转链
    const goodsSign = g.goods_sign;
    if (goodsSign) {
      const c = await test('转链', '/pdd/convert', {
        p_id: PID,
        goods_sign: goodsSign,
        custom_parameters: JSON.stringify({ uid: 'test123' }),
        generate_short_url: true,
        generate_schema_url: true,
        multi_group: true,
      });
      const cd = c.data;
      if (cd && typeof cd === 'object') {
        console.log(`  返回字段: ${Object.keys(cd).join(', ')}`);
        for (const k of Object.keys(cd)) {
          const v = cd[k];
          if (typeof v !== 'object') console.log(`  ${k}: ${v}`);
          else if (v && typeof v === 'object') console.log(`  ${k}: { ${Object.keys(v).join(', ')} }`);
        }
      }
    }
  }

  // 3. 推荐里有没有 goods_sign
  const r1 = await test('推荐', '/pdd/recommend', {
    offset: 0,
    limit: 10,
    channel_type: 5,
    pid: PID,
  });
  const rlist = r1.data?.list ?? [];
  if (rlist.length > 0) {
    console.log(`  推荐有 goods_sign: ${rlist[0].goods_sign ? '有' : '无'}`);
    console.log(`  goods_sign 值: ${rlist[0].goods_sign || ''}`);
  }

  // 4. 试更多订单接口路径
  const orderPaths = [
    '/pdd/order_list',
    '/pdd/orderdetails',
    '/pdd/order_detail',
    '/pdd/order/get',
    '/pdd/increment_order',
    '/pdd/order_increment',
    '/pdd/ddk_order_list',
  ];
  console.log(`\n--- 订单接口探测 ---`);
  const end = Math.floor(Date.now() / 1000);
  const start = end - 7 * 24 * 3600;
  for (const p of orderPaths) {
    try {
      const json = await call(p, { start_time: start, end_time: end, page: 1, page_size: 10 });
      const ok = json.code === 200 || json.code === 0;
      console.log(`  ${p}: code=${json.code} ${ok ? '✅' : '❌'} ${json.msg || ''}`);
    } catch (e) {
      console.log(`  ${p}: 网络错误 ${e.message}`);
    }
  }
})();
