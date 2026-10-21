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
  // 搜索：换热门关键词，看看是不是真的没结果
  console.log('=== 搜索：不同关键词（仅pid，无custom_parameters）===\n');
  const keywords = ['手机', '衣服', '零食', '水果', '口红', '奶粉', '纸巾'];
  for (const kw of keywords) {
    const r = await call('/pdd/goods_search', {
      keyword: kw,
      page: 1,
      page_size: 20,
      sort_type: 6, // 销量降序
      pid: PID,
    });
    const list = r.data?.list ?? r.data?.goods_list ?? [];
    const total = r.data?.total_results ?? r.data?.total ?? '?';
    console.log(`  ${kw}: code=${r.code} list=${list.length} total=${total} ${r.msg || ''}`);
    if (list.length > 0) {
      console.log(`    ✅ 有结果！首条: ${list[0].goods_name?.slice(0, 30)}`);
      console.log(`    goods_sign: ${list[0].goods_sign}`);
      console.log(`    所有顶层 data 字段: ${Object.keys(r.data).join(', ')}`);
      break;
    }
  }

  // 试试不传 pid 的搜索
  console.log('\n=== 搜索：不传 pid ===\n');
  const r2 = await call('/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 20,
    sort_type: 6,
  });
  const list2 = r2.data?.list ?? r2.data?.goods_list ?? [];
  console.log(`  纸巾: code=${r2.code} list=${list2.length} ${r2.msg || ''}`);
  if (list2.length > 0) {
    console.log(`  ✅ 有结果！首条: ${list2[0].goods_name?.slice(0, 40)}`);
    console.log(`  goods_sign: ${list2[0].goods_sign}`);
  }

  // 试试 with_coupon = false
  console.log('\n=== 搜索：with_coupon=false ===\n');
  const r3 = await call('/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 20,
    sort_type: 0,
    pid: PID,
    with_coupon: false,
  });
  const list3 = r3.data?.list ?? r3.data?.goods_list ?? [];
  console.log(`  code=${r3.code} list=${list3.length} ${r3.msg || ''}`);

  // 转链：不传 custom_parameters 试试
  console.log('\n=== 转链：不传 custom_parameters ===\n');
  const rec = await call('/pdd/recommend', { offset: 0, limit: 1, channel_type: 5, pid: PID });
  const gs = rec.data?.list?.[0]?.goods_sign;
  console.log(`  goods_sign: ${gs}`);
  
  const c = await call('/pdd/convert', {
    p_id: PID,
    goods_sign: gs,
    generate_short_url: true,
    generate_schema_url: true,
    multi_group: true,
  });
  console.log(`  code=${c.code} ${c.msg || ''}`);
  if (c.code === 200 && c.data) {
    console.log(`  ✅ 转链成功！字段: ${Object.keys(c.data).join(', ')}`);
    console.log(`  short_url: ${c.data.short_url || c.data.mobile_short_url || '无'}`);
  } else if (c.data?.sub_msg) {
    console.log(`  sub_msg: ${c.data.sub_msg}`);
  }
})();
