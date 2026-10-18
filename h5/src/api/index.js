import axios from 'axios';
import { showToast } from 'vant';

const http = axios.create({ baseURL: '/', timeout: 15000 });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body && body.code === 0) return body.data;
    showToast(body?.msg || '请求失败');
    return Promise.reject(new Error(body?.msg));
  },
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.msg || err.message;
    if (status === 401) {
      localStorage.removeItem('token');
      if (!location.hash.includes('/login')) location.hash = '#/login';
    } else {
      showToast(msg || '网络错误');
    }
    return Promise.reject(err);
  },
);

export const api = {
  sendSms: (mobile) => http.post('/api/auth/sms', { mobile }),
  login: (data) => http.post('/api/auth/login', data),
  profile: () => http.get('/api/auth/profile'),
  bindInviter: (inviteCode) => http.post('/api/auth/bind-inviter', { inviteCode }),

  recommend: (platform) => http.get('/api/goods/recommend', { params: { platform } }),
  // 首页流：后台选品池优先，池空时后端自动回落到平台榜单
  feed: (params) => http.get('/api/goods/feed', { params }),
  goodsGroups: () => http.get('/api/goods/groups'),
  topics: () => http.get('/api/topics').then((r) => r.list || r),
  topicGoods: (slug, params) => http.get(`/api/topics/${slug}/goods`, { params }),

  // 比价：比的是到手价（券后价 − 返利），不是券后价
  compareList: (params) => http.get('/api/compare/list', { params }),
  compareDetail: (id) => http.get(`/api/compare/${id}`),

  // 首页活动位和榜单
  homeLinks: (slot) => http.get('/api/home/links', { params: { slot } }),
  ranking: (type, params) => http.get('/api/home/ranking', {
    params: typeof params === 'object'
      ? { type, ...params }
      : { type, limit: params },  // 兼容旧调用：ranking(type, limit)
  }),

  compareCategories: () => http.get('/api/compare/categories'),
  compareSearch: (keyword) => http.get('/api/compare/search', { params: { keyword } }),

  // 购物车：先 cart() 秒出快照，再 cartRefresh() 后台更新价格
  cart: () => http.get('/api/cart'),
  cartCount: () => http.get('/api/cart/count'),
  cartRefresh: () => http.post('/api/cart/refresh'),
  cartAdd: (platform, goodsId) => http.post('/api/cart/add', { platform, goodsId }),
  cartRemove: (ids) => http.delete('/api/cart', { data: { ids } }),
  search: (params) => http.get('/api/goods/search', { params }),
  detail: (platform, goodsId) => http.get(`/api/goods/${platform}/${goodsId}`),
  convert: (platform, goodsId) => http.post('/api/link/convert', { platform, goodsId }),
  parse: (content) => http.post('/api/link/parse', { content }),

  // 平台授权（拼多多的推广位备案）
  authzStatus: (platform, force) =>
    http.get('/api/authz/status', { params: { platform, force: force ? 1 : undefined } }),
  authzUrl: (platform) => http.get('/api/authz/url', { params: { platform } }),

  orders: (params) => http.get('/api/orders', { params }),

  // 订单找回：下了单没返利的补救入口
  claimApply: (data) => http.post('/api/claim', data),
  claimList: (params) => http.get('/api/claim', { params }),

  // 签到与金币
  recommendGoods: (platform, goodsId) =>
    http.post('/api/goods/recommend', { platform, goodsId }),

  coinStatus: () => http.get('/api/coin/status'),
  checkin: () => http.post('/api/coin/checkin'),
  coinExchange: (coins) => http.post('/api/coin/exchange', { coins }),
  coinLedger: (params) => http.get('/api/coin/ledger', { params }),

  balance: () => http.get('/api/fund/balance'),
  summary: () => http.get('/api/fund/summary'),
  withdraws: (params) => http.get('/api/fund/withdraws', { params }),
  ledger: (params) => http.get('/api/fund/ledger', { params }),
  withdraw: (data) => http.post('/api/fund/withdraw', data),

  agentApply: (realName) => http.post('/api/agent/apply', { realName }),
  agentQrcode: () => http.get('/api/agent/qrcode'),
  agentInviteQrcode: () => http.get('/api/agent/invite-qrcode'),
  agentTeam: (params) => http.get('/api/agent/team', { params }),
  agentStats: () => http.get('/api/agent/stats'),
  agentInfo: (code) => http.get('/api/agent/info', { params: { code } }),
};

// ───────── 管理后台（手机端） ─────────
// 独立的 axios 实例，用 adminToken，和用户端 token 互不干扰
const adminHttp = axios.create({ baseURL: '/', timeout: 15000 });

adminHttp.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('adminToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

adminHttp.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body && body.code === 0) return body.data;
    showToast(body?.msg || '请求失败');
    return Promise.reject(new Error(body?.msg));
  },
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.msg || err.message;
    if (status === 401) {
      localStorage.removeItem('adminToken');
      if (!location.hash.includes('/madmin/login')) location.hash = '#/madmin/login';
    } else {
      showToast(msg || '网络错误');
    }
    return Promise.reject(err);
  },
);

export const adminApi = {
  login: (data) => adminHttp.post('/api/admin/login', data),

  // 选品池
  curationSearch: (params) => adminHttp.get('/api/admin/curation/search', { params }),
  curationRecommend: (params) => adminHttp.get('/api/admin/curation/recommend', { params }),
  curationList: (params) => adminHttp.get('/api/admin/curation/list', { params }),
  curationAdd: (data) => adminHttp.post('/api/admin/curation/add', data),
  curationImportWithGoods: (data) => adminHttp.post('/api/admin/curation/import-with-goods', data),
  curationExistsBatch: (items) => adminHttp.post('/api/admin/curation/exists-batch', { items }),
  curationUpdate: (id, data) => adminHttp.post(`/api/admin/curation/${id}`, data),
  curationBatchOnShelf: (ids) => adminHttp.post('/api/admin/curation/batch-on-shelf', { ids }),
  curationBatchRemove: (ids) => adminHttp.post('/api/admin/curation/batch-remove', { ids }),
  curationRemove: (id) => adminHttp.delete(`/api/admin/curation/${id}`),
  curationDedup: () => adminHttp.post('/api/admin/curation/dedup'),
  curationRemoveOffShelf: () => adminHttp.post('/api/admin/curation/remove-off-shelf'),
  curationAutoTagAll: () => adminHttp.post('/api/admin/curation/auto-tag/all'),

  // 标签 / 专题
  topics: (type) => adminHttp.get('/api/admin/topics', { params: type ? { type } : undefined }),
  goodsTopics: (curatedId) => adminHttp.get(`/api/admin/topics/of-goods/${curatedId}`),
  goodsTopicsBatch: (curatedIds) =>
    adminHttp.post('/api/admin/topics/of-goods-batch', { curatedIds }),
  setGoodsTopics: (curatedId, topicIds) =>
    adminHttp.post(`/api/admin/topics/of-goods/${curatedId}`, { topicIds }),
  topicTagMany: (id, curatedIds) => adminHttp.post(`/api/admin/topics/${id}/tag-many`, { curatedIds }),
  topicUntagMany: (id, curatedIds) => adminHttp.post(`/api/admin/topics/${id}/untag-many`, { curatedIds }),
  topicGoods: (slug, params) => adminHttp.get(`/api/topics/${slug}/goods`, { params }),
  topicCreate: (data) => adminHttp.post('/api/admin/topics', data),
  topicUpdate: (id, data) => adminHttp.put(`/api/admin/topics/${id}`, data),
  topicRemove: (id) => adminHttp.delete(`/api/admin/topics/${id}`),

  // 订单
  orders: (params) => adminHttp.get('/api/admin/orders', { params }),

  // 代理
  agents: (params) => adminHttp.get('/api/admin/agents', { params }),
  updateAgent: (id, data) => adminHttp.post(`/api/admin/agents/${id}`, data),

  // 提现
  withdraws: (params) => adminHttp.get('/api/admin/withdraws', { params }),
  auditWithdraw: (id, pass, reason) => adminHttp.post(`/api/admin/withdraws/${id}/audit`, { pass, reason }),
  finishWithdraw: (id, success, channelOrderNo, failReason) =>
    adminHttp.post(`/api/admin/withdraws/${id}/finish`, { success, channelOrderNo, failReason }),

  // 对账
  reconcile: () => adminHttp.get('/api/admin/reconcile'),
};

export default http;
