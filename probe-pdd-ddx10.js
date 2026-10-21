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
  // 1. 用 goods_sign_list 搜索（确认搜索接口到底能不能返回数据）
  console.log('=== 1. 用 goods_sign_list 搜索 ===\n');
  const rec = await call('/pdd/recommend', { offset: 0, limit: 3, channel_type: 5, pid: PID });
  const signs = (rec.data?.list ?? []).map(g => g.goods_sign);
  console.log(`  从推荐拿到 3 个 goods_sign: ${signs.join(', ')}`);
  
  const r1 = await call('/pdd/goods_search', {
    goods_sign_list: JSON.stringify(signs),
    page: 1,
    page_size: 20,
    pid: PID,
  });
  const list1 = r1.data?.list ?? r1.data?.goods_list ?? [];
  console.log(`  goods_sign_list 搜索: code=${r1.code} list=${list1.length} ${r1.msg || ''}`);
  if (list1.length > 0) {
    console.log(`  ✅ 有结果！说明搜索接口本身没问题，是关键词搜索的问题`);
    console.log(`  首条: ${list1[0].goods_name?.slice(0, 40)}`);
  }

  // 2. 搜索：试试 page=1 page_size=100 拉满
  console.log('\n=== 2. 搜索 page_size=100 ===\n');
  const r2 = await call('/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 100,
    sort_type: 0,
    pid: PID,
  });
  const list2 = r2.data?.list ?? r2.data?.goods_list ?? [];
  console.log(`  code=${r2.code} list=${list2.length} ${r2.msg || ''}`);
  console.log(`  data 顶层字段: ${r2.data ? Object.keys(r2.data).join(', ') : '无data'}`);

  // 3. 搜索：试试不传 sort_type
  console.log('\n=== 3. 搜索 不带 sort_type ===\n');
  const r3 = await call('/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 20,
    pid: PID,
  });
  const list3 = r3.data?.list ?? r3.data?.goods_list ?? [];
  console.log(`  code=${r3.code} list=${list3.length} ${r3.msg || ''}`);

  // 4. 搜索：试试 is_brand_goods / activity_tags 等
  console.log('\n=== 4. 搜索 activity_tags ===\n');
  const r4 = await call('/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 20,
    sort_type: 0,
    pid: PID,
    activity_tags: JSON.stringify([7]), // 百亿补贴
  });
  const list4 = r4.data?.list ?? r4.data?.goods_list ?? [];
  console.log(`  code=${r4.code} list=${list4.length} ${r4.msg || ''}`);

  // 5. 用 goods_id 当关键词搜
  const goodsId = rec.data?.list?.[0]?.goods_id;
  if (goodsId) {
    console.log(`\n=== 5. 用 goods_id 当关键词搜索 (${goodsId}) ===\n`);
    const r5 = await call('/pdd/goods_search', {
      keyword: String(goodsId),
      page: 1,
      page_size: 10,
      pid: PID,
    });
    const list5 = r5.data?.list ?? r5.data?.goods_list ?? [];
    console.log(`  code=${r5.code} list=${list5.length} ${r5.msg || ''}`);
  }

  // 6. 转链带 custom_parameters：试不同的格式
  console.log('\n=== 6. 转链 custom_parameters 各种格式 ===\n');
  const gs = signs[0];
  const cpTests = [
    { custom_parameters: 'uid_test123' },
    { custom_parameters: '123' },
    { custom_parameters: '' },
    { custom_parameters: JSON.stringify({ uid: 'test' }) },
    { custom_parameters: 'test', generate_authority_url: 'true' },
  ];
  for (const cp of cpTests) {
    const r = await call('/pdd/convert', {
      p_id: PID,
      goods_sign: gs,
      generate_short_url: true,
      ...cp,
    });
    const ok = r.code === 200;
    console.log(`  cp=${JSON.stringify(cp.custom_parameters).slice(0,30)}: code=${r.code} ${ok ? '✅' : '❌'} ${r.data?.sub_msg || r.msg || ''}`);
  }
})();
