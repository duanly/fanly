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
  // 搜索：试不同参数
  console.log('=== 搜索参数调试 ===\n');
  const searchTests = [
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0 },
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, with_coupon: false },
    { keyword: '苹果', page: 1, page_size: 20, sort_type: 0 },
    { keyword: '手机', page: 1, page_size: 20, sort_type: 0 },
    { keyword: '纸巾', page: 1, page_size: 20 },
    { keyword: '纸巾', page_size: 20, sort_type: 6 },
  ];
  for (const p of searchTests) {
    const r = await call('/pdd/goods_search', p);
    const list = r.data?.list ?? r.data?.goods_list ?? [];
    const total = r.data?.total_results ?? r.data?.total ?? '?';
    console.log(`  ${JSON.stringify(p)}`);
    console.log(`    code=${r.code} list=${list.length} total=${total} ${r.msg || ''}`);
    if (r.code === -1 && r.data?.sub_msg) {
      console.log(`    sub_msg: ${r.data.sub_msg}`);
    }
  }

  // 订单：24小时内
  console.log('\n=== 订单（24小时内）===\n');
  const end = Math.floor(Date.now() / 1000);
  const start = end - 20 * 3600;
  const o = await call('/pdd/orderlist', {
    start_update_time: start,
    end_update_time: end,
    page_size: 20,
    page: 1,
  });
  console.log(`  code: ${o.code}, msg: ${o.msg || ''}`);
  const olist = o.data?.list ?? [];
  console.log(`  订单数: ${olist.length}`);
  console.log(`  total_count: ${o.data?.total_count ?? '?'}`);
  if (olist.length > 0) {
    const od = olist[0];
    console.log(`  首条字段: ${Object.keys(od).sort().join(', ')}`);
    console.log(`  order_sn: ${od.order_sn}`);
    console.log(`  order_status: ${od.order_status} ${od.order_status_desc || ''}`);
    console.log(`  goods_name: ${od.goods_name}`);
    console.log(`  promotion_amount: ${od.promotion_amount} 分`);
    console.log(`  p_id: ${od.p_id || od.pid || ''}`);
    console.log(`  custom_parameters: ${od.custom_parameters || '(空)'}`);
  }

  // 转链
  console.log('\n=== 转链（用推荐里的商品）===\n');
  const rec = await call('/pdd/recommend', { offset: 0, limit: 3, channel_type: 5, pid: PID });
  const rlist = rec.data?.list ?? [];
  if (rlist.length > 0 && rlist[0].goods_sign) {
    const gs = rlist[0].goods_sign;
    console.log(`  商品: ${rlist[0].goods_name}`);
    console.log(`  goods_sign: ${gs}`);
    const c = await call('/pdd/convert', {
      p_id: PID,
      goods_sign: gs,
      custom_parameters: JSON.stringify({ uid: 'test123' }),
      generate_short_url: true,
      generate_schema_url: true,
      multi_group: true,
    });
    console.log(`  code: ${c.code}, msg: ${c.msg || ''}`);
    const cd = c.data;
    if (cd && typeof cd === 'object') {
      console.log(`  字段: ${Object.keys(cd).sort().join(', ')}`);
      console.log(`  short_url: ${cd.short_url || cd.mobile_short_url || '无'}`);
      console.log(`  mobile_short_url: ${cd.mobile_short_url || '无'}`);
      console.log(`  schema_url: ${cd.schema_url ? '有' : '无'}`);
    }
  }
})();
