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
  console.log('=== 搜索接口参数排查 ===\n');

  const searchTests = [
    { keyword: '纸巾', page_size: 10, pid: PID, sort_type: 0 },
    { keyword: '纸巾', page_size: 10, pid: PID },
    { keyword: '纸巾', page_size: 10 },
    { keyword: '纸巾' },
    { kw: '纸巾', page_size: 10, pid: PID },
    { q: '纸巾', page_size: 10, pid: PID },
    { keyword: '纸巾', pageSize: 10, pid: PID },
    { keyword: '纸巾', page: 1, pageSize: 10, pid: PID },
    { keyword: '纸巾', page_no: 1, page_size: 10, pid: PID },
  ];

  for (const params of searchTests) {
    const json = await call('/pdd/goods_search', params);
    const data = json.data ?? json.result;
    const list = data?.list ?? data?.goods_list ?? (Array.isArray(data) ? data : null);
    const count = list ? list.length : -1;
    const hasData = count >= 0 && count > 0;
    console.log(`  params=${JSON.stringify(params)}`);
    console.log(`    code=${json.code} msg=${json.msg || ''} list=${count >= 0 ? count + '条' : '无列表字段'}`);
    if (json.code === -1 && json.data) {
      console.log(`    data 字段: ${typeof json.data === 'object' ? Object.keys(json.data).join(', ') : json.data}`);
      console.log(`    sub_msg: ${json.data?.sub_msg || json.data?.error_msg || ''}`);
    }
    console.log();
    if (hasData) break;
  }

  console.log('=== 订单接口更多路径探测 ===\n');

  const end = Math.floor(Date.now() / 1000);
  const start = end - 7 * 24 * 3600;

  const orderPaths = [
    '/pdd/order_detail_list',
    '/pdd/orderquery',
    '/pdd/order_query',
    '/pdd/query_order',
    '/pdd/pdd_order',
    '/pdd/pdd/order_list',
    '/pdd/orderinfo',
    '/pdd/order_info',
    '/pdd/total_order',
    '/pdd/commission_order',
    '/pdd/promotion_order',
    '/pdd/sales_order',
    '/pdd/api/order/list',
    '/pdd/open/order/list',
  ];

  for (const p of orderPaths) {
    try {
      const json = await call(p, { start_time: start, end_time: end, page: 1, page_size: 10 });
      const ok = json.code === 200 || json.code === 0;
      const isParamError = json.code === 4003 || (json.msg && json.msg.includes('参数'));
      const mark = ok ? '✅' : isParamError ? '⚠️ ' : '❌';
      console.log(`  ${p}: code=${json.code} ${mark} ${json.msg || ''}`);
      if (ok || isParamError) break;
    } catch (e) {
      // skip
    }
  }
})();
