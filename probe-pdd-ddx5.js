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

(async () => {
  console.log('=== 1. 搜索接口（加 sort_type）===\n');
  const s = await call('/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 10,
    pid: PID,
    sort_type: 0,
  });
  console.log(`  code: ${s.code}, msg: ${s.msg || ''}`);
  const list = s.data?.list ?? s.data?.goods_list ?? [];
  console.log(`  商品数: ${list.length}`);
  if (list.length > 0) {
    const g = list[0];
    console.log(`  首条 goods_sign: ${g.goods_sign}`);
    console.log(`  首条 goods_name: ${g.goods_name}`);
    console.log(`  首条 min_group_price: ${g.min_group_price} 分`);
    console.log(`  首条 promotion_rate: ${g.promotion_rate}‰`);
    console.log(`  首条 coupon_discount: ${g.coupon_discount} 分`);
    console.log(`  首条 has_coupon: ${g.has_coupon}`);
    console.log(`  首条 sales_tip: ${g.sales_tip}`);
    console.log(`  首条 mall_name: ${g.mall_name}`);
    console.log(`  首条所有字段: ${Object.keys(g).sort().join(', ')}`);
  }

  console.log('\n=== 2. 推荐接口 ===\n');
  const r = await call('/pdd/recommend', {
    offset: 0,
    limit: 10,
    channel_type: 5,
    pid: PID,
  });
  console.log(`  code: ${r.code}, msg: ${r.msg || ''}`);
  const rlist = r.data?.list ?? [];
  console.log(`  商品数: ${rlist.length}, total: ${r.data?.total}`);
  if (rlist.length > 0) {
    console.log(`  首条所有字段: ${Object.keys(rlist[0]).sort().join(', ')}`);
  }

  console.log('\n=== 3. 订单列表接口 ===\n');
  const end = Math.floor(Date.now() / 1000);
  const start = end - 7 * 24 * 3600;
  const o = await call('/pdd/orderlist', {
    start_update_time: start,
    end_update_time: end,
    page_size: 10,
    page: 1,
  });
  console.log(`  code: ${o.code}, msg: ${o.msg || ''}`);
  const olist = o.data?.list ?? o.data?.order_list ?? o.data ?? [];
  const arr = Array.isArray(olist) ? olist : (Array.isArray(o.data) ? o.data : []);
  console.log(`  订单数: ${arr.length}`);
  console.log(`  total_count: ${o.data?.total_count ?? o.data?.total ?? '无'}`);
  if (arr.length > 0) {
    const od = arr[0];
    console.log(`  首条所有字段: ${Object.keys(od).sort().join(', ')}`);
    console.log(`  order_sn: ${od.order_sn}`);
    console.log(`  order_status: ${od.order_status} (${od.order_status_desc || ''})`);
    console.log(`  goods_name: ${od.goods_name}`);
    console.log(`  promotion_amount: ${od.promotion_amount} 分`);
    console.log(`  order_amount: ${od.order_amount} 分`);
    console.log(`  custom_parameters: ${od.custom_parameters || '(空)'}`);
    console.log(`  p_id: ${od.p_id || od.pid || ''}`);
  } else if (o.data && typeof o.data === 'object') {
    console.log(`  data 字段: ${Object.keys(o.data).join(', ')}`);
  }

  console.log('\n=== 4. 转链 ===\n');
  if (list.length > 0 && list[0].goods_sign) {
    const goodsSign = list[0].goods_sign;
    const c = await call('/pdd/convert', {
      p_id: PID,
      goods_sign: goodsSign,
      custom_parameters: JSON.stringify({ uid: 'test123' }),
      generate_short_url: true,
      generate_schema_url: true,
      multi_group: true,
    });
    console.log(`  code: ${c.code}, msg: ${c.msg || ''}`);
    const cd = c.data;
    if (cd && typeof cd === 'object') {
      console.log(`  所有字段: ${Object.keys(cd).sort().join(', ')}`);
      console.log(`  short_url: ${cd.short_url || ''}`);
      console.log(`  mobile_short_url: ${cd.mobile_short_url || ''}`);
      console.log(`  schema_url: ${cd.schema_url || ''}`);
      console.log(`  url: ${cd.url || ''}`);
    }
  }
})();
