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
  // 先看看转链的详细报错
  console.log('=== 转链详细错误 ===\n');
  const rec = await call('/pdd/recommend', { offset: 0, limit: 1, channel_type: 5, pid: PID });
  const gs = rec.data?.list?.[0]?.goods_sign;
  console.log(`  goods_sign: ${gs}`);

  const convertTests = [
    { p_id: PID, goods_sign: gs, custom_parameters: 'test123', generate_short_url: true },
    { pid: PID, goods_sign: gs, custom_parameters: 'test123', generate_short_url: true },
    { p_id: PID, goods_sign_list: [gs], custom_parameters: 'test123', generate_short_url: true },
  ];
  for (const p of convertTests) {
    const r = await call('/pdd/convert', p);
    console.log(`  params: ${Object.keys(p).join(',')}`);
    console.log(`    code=${r.code} msg=${r.msg || ''}`);
    if (r.data) {
      console.log(`    sub_msg: ${r.data.sub_msg || r.data.error_msg || ''}`);
      console.log(`    sub_code: ${r.data.sub_code || ''}`);
    }
    console.log();
  }

  // 搜索：试不同 pid 参数名
  console.log('=== 搜索 pid 参数名测试 ===\n');
  const searchTests = [
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID, custom_parameters: 'test' },
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, p_id: PID, custom_parameters: 'test' },
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID },
    { keyword: '纸巾', page: 1, page_size: 20, sort_type: 0, pid: PID, custom_parameters: JSON.stringify({ uid: 'test' }) },
  ];
  for (const p of searchTests) {
    const r = await call('/pdd/goods_search', p);
    const list = r.data?.list ?? r.data?.goods_list ?? [];
    console.log(`  params keys: ${Object.keys(p).join(',')}`);
    console.log(`    code=${r.code} list=${list.length} ${r.msg || ''}`);
    if (r.code === -1 && r.data) {
      console.log(`    sub_msg: ${r.data.sub_msg || ''}`);
    }
  }

  // 订单：确认返回结构
  console.log('\n=== 订单返回完整结构 ===\n');
  const end = Math.floor(Date.now() / 1000);
  const start = end - 20 * 3600;
  const o = await call('/pdd/orderlist', {
    start_update_time: start,
    end_update_time: end,
    page_size: 20,
    page: 1,
  });
  console.log(`  code: ${o.code}`);
  console.log(`  data 类型: ${typeof o.data}`);
  if (o.data && typeof o.data === 'object') {
    console.log(`  data 字段: ${Object.keys(o.data).join(', ')}`);
    if (Array.isArray(o.data.list)) console.log(`  list 长度: ${o.data.list.length}`);
  }
})();
