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
  const end = Math.floor(Date.now() / 1000);
  const start = end - 7 * 24 * 3600;

  // 订单列表接口 - 更多可能的路径
  const orderTests = [
    // 时间范围参数名变体
    { path: '/pdd/order_list', params: { startTime: start, endTime: end, page: 1, pageSize: 10 } },
    { path: '/pdd/order_list', params: { start_time: start, end_time: end, page_no: 1, page_size: 10 } },
    { path: '/pdd/order_list', params: { startUpdateTime: start, endUpdateTime: end, page: 1, page_size: 10 } },
    // 路径变体
    { path: '/pdd/orders', params: { start_time: start, end_time: end, page: 1, page_size: 10 } },
    { path: '/pdd/order/list', params: { start_time: start, end_time: end, page: 1, page_size: 10 } },
    { path: '/pdd/all_order', params: { start_time: start, end_time: end, page: 1, page_size: 10 } },
    { path: '/pdd/order_all', params: { start_time: start, end_time: end, page: 1, page_size: 10 } },
    { path: '/pdd/ddk/order/list', params: { start_time: start, end_time: end, page: 1, page_size: 10 } },
    // 淘宝风格的路径，拼多多可能也是类似的
    { path: '/pdd/order_details', params: { start_time: start, end_time: end, query_type: 4, page_size: 10 } },
    { path: '/pdd/tbk/order', params: { start_time: start, end_time: end, page_size: 10 } },
    // 搜索接口调试
    { path: '/pdd/goods_search', params: { keyword: '纸巾', page: 1, page_size: 20 } },
    { path: '/pdd/goods_search', params: { keyword: '纸巾', page_size: 20 } },
    { path: '/pdd/goods_search', params: { keyword: '纸巾' } },
    { path: '/pdd/search', params: { keyword: '纸巾', page: 1, page_size: 20 } },
  ];

  console.log('--- 订单 & 搜索接口探测 ---\n');
  for (const t of orderTests) {
    try {
      const json = await call(t.path, t.params);
      const code = json.code;
      const ok = code === 200 || code === 0;
      const data = json.data ?? json.result ?? json;
      const listLen = Array.isArray(data?.list) ? data.list.length
        : Array.isArray(data?.goods_list) ? data.goods_list.length
        : Array.isArray(data) ? data.length : -1;
      const hasList = listLen >= 0;
      const mark = ok ? (hasList ? `✅ (${listLen}条)` : '✅') : '❌';
      console.log(`${t.path}  params=${JSON.stringify(t.params).slice(0,80)}`);
      console.log(`  code=${code} ${mark} ${json.msg || ''}`);
      if (ok && hasList && listLen > 0) {
        const first = (data?.list ?? data?.goods_list ?? data)[0];
        console.log(`  首条字段: ${Object.keys(first).slice(0, 10).join(', ')}...`);
      }
      console.log();
    } catch (e) {
      console.log(`${t.path}: 错误 ${e.message}\n`);
    }
  }
})();
