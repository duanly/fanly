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
  // 1. 确认搜索返回结构
  console.log('=== 1. 搜索返回结构确认 ===\n');
  const r = await call('/pdd/goods_search', {
    keyword: '纸巾',
    page: 1,
    page_size: 20,
    sort_type: 0,
    pid: PID,
  });
  console.log(`  code: ${r.code}`);
  console.log(`  typeof data: ${typeof r.data}`);
  console.log(`  Array.isArray(data): ${Array.isArray(r.data)}`);
  if (Array.isArray(r.data)) {
    console.log(`  data.length: ${r.data.length}`);
    if (r.data.length > 0) {
      console.log(`  ✅ 是数组！首条商品:`);
      console.log(`    goods_name: ${r.data[0].goods_name?.slice(0, 50)}`);
      console.log(`    goods_sign: ${r.data[0].goods_sign}`);
      console.log(`    min_group_price: ${r.data[0].min_group_price} 分`);
      console.log(`    promotion_rate: ${r.data[0].promotion_rate}‰`);
      console.log(`    字段: ${Object.keys(r.data[0]).slice(0, 15).join(', ')}...`);
    }
  }

  // 2. 推荐返回也是数组吗？
  console.log('\n=== 2. 推荐返回结构 ===\n');
  const r2 = await call('/pdd/recommend', { offset: 0, limit: 5, channel_type: 5, pid: PID });
  console.log(`  Array.isArray(data): ${Array.isArray(r2.data)}`);
  console.log(`  data.list?: ${r2.data?.list ? r2.data.list.length + '条' : '无此字段'}`);
  console.log(`  data.total: ${r2.data?.total}`);

  // 3. custom_parameters 规律测试
  console.log('\n=== 3. custom_parameters 哪些值能过 ===\n');
  const gs = r2.data?.list?.[0]?.goods_sign || (Array.isArray(r.data) ? r.data[0]?.goods_sign : null);
  console.log(`  测试用 goods_sign: ${gs}`);
  
  const cpValues = [
    '',           // 空
    'a',          // 单个字母
    '1',          // 单个数字
    'a1',         // 字母+数字
    '1a',         // 数字+字母
    'abc',        // 纯字母
    '123',        // 纯数字
    'test123',    // 字母+数字
    'uid_123',    // 带下划线
    'pos_001',    // 
    'hello world',// 带空格
    '测试',        // 中文
    'uid:123',    // 冒号
  ];
  
  const results = [];
  for (const cp of cpValues) {
    const resp = await call('/pdd/convert', {
      p_id: PID,
      goods_sign: gs,
      custom_parameters: cp,
      generate_short_url: true,
    });
    const ok = resp.code === 200;
    results.push({ cp, ok, msg: resp.code === -1 ? resp.data?.sub_msg?.slice(0, 30) : resp.msg });
    console.log(`  cp="${cp}": ${ok ? '✅' : '❌'} (code=${resp.code})`);
  }

  console.log('\n  规律: 纯数字开头/纯数字的可能会被拦截？');
  console.log(`  能过的: ${results.filter(r => r.ok).map(r => `"${r.cp}"`).join(', ')}`);
  console.log(`  不能过的: ${results.filter(r => !r.ok).map(r => `"${r.cp}"`).join(', ')}`);
})();
