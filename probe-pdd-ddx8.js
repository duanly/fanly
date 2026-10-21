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
  console.log('=== 搜索：各种参数组合 ===\n');

  const tests = [
    // 只传 pid，不传 custom_parameters
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID },
    // pid + custom_parameters (JSON格式)
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID, custom_parameters: JSON.stringify({ uid: 'test' }) },
    // pid + custom_parameters (纯字符串)
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID, custom_parameters: 'test' },
    // 用 p_id
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, p_id: PID, custom_parameters: 'test' },
    // 用 pid + custom_parameters + search_id
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID, custom_parameters: 'test', search_id: '' },
    // source_id
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID, source_id: 'test' },
    // 试试不传 sort_type，只传 pid + keyword + page_size
    { keyword: '纸巾', page_size: 20, pid: PID },
    // 试试 with_coupon: true
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID, with_coupon: true, custom_parameters: 'test' },
    // 试试 is_brand_goods
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID, custom_parameters: 'test', merchant_type: 2 },
  ];

  for (let i = 0; i < tests.length; i++) {
    const p = tests[i];
    const r = await call('/pdd/goods_search', p);
    const list = r.data?.list ?? r.data?.goods_list ?? [];
    const ok = r.code === 200 && list.length > 0;
    console.log(`  [${i+1}] keys: ${Object.keys(p).join(',')}`);
    console.log(`      code=${r.code} list=${list.length} ${ok ? '✅' : ''} ${r.msg || ''}`);
    if (r.code === -1 && r.data?.sub_msg) {
      console.log(`      sub_msg: ${r.data.sub_msg}`);
    }
    if (ok) {
      console.log(`      首条: ${list[0].goods_name?.slice(0, 30)}`);
      break;
    }
  }

  console.log('\n=== 转链：各种参数组合 ===\n');

  const rec = await call('/pdd/recommend', { offset: 0, limit: 1, channel_type: 5, pid: PID });
  const gs = rec.data?.list?.[0]?.goods_sign;
  console.log(`  goods_sign: ${gs}`);

  const convertTests = [
    { p_id: PID, goods_sign: gs, custom_parameters: 'test123', generate_short_url: true, generate_schema_url: true },
    { p_id: PID, goods_sign: gs, custom_parameters: JSON.stringify({ uid: 'test' }), generate_short_url: true },
    { p_id: PID, goods_sign: gs, custom_parameters: 'test123' },
    { p_id: PID, goods_sign: gs, custom_parameters: 'test123', multi_group: true, generate_short_url: true },
    { p_id: PID, goods_sign: gs, custom_parameters: 'test123', generate_short_url: true, generate_we_app: false },
  ];

  for (let i = 0; i < convertTests.length; i++) {
    const p = convertTests[i];
    const r = await call('/pdd/convert', p);
    const ok = r.code === 200;
    console.log(`  [${i+1}] keys: ${Object.keys(p).join(',')}`);
    console.log(`      code=${r.code} ${ok ? '✅' : ''} ${r.msg || ''}`);
    if (r.code === -1 && r.data?.sub_msg) {
      console.log(`      sub_msg: ${r.data.sub_msg} (sub_code: ${r.data.sub_code})`);
    }
    if (ok && r.data) {
      console.log(`      字段: ${Object.keys(r.data).join(', ')}`);
      console.log(`      short_url: ${r.data.short_url || r.data.mobile_short_url || '无'}`);
    }
    if (ok) break;
  }
})();
