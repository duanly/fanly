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

  recommend: (platform) => http.get('/api/goods/recommend', { params: { platform } }),
  // 首页流：后台选品池优先，池空时后端自动回落到平台榜单
  feed: (params) => http.get('/api/goods/feed', { params }),
  goodsGroups: () => http.get('/api/goods/groups'),
  search: (params) => http.get('/api/goods/search', { params }),
  detail: (platform, goodsId) => http.get(`/api/goods/${platform}/${goodsId}`),
  convert: (platform, goodsId) => http.post('/api/link/convert', { platform, goodsId }),
  parse: (content) => http.post('/api/link/parse', { content }),

  orders: (params) => http.get('/api/orders', { params }),

  balance: () => http.get('/api/fund/balance'),
  summary: () => http.get('/api/fund/summary'),
  withdraws: (params) => http.get('/api/fund/withdraws', { params }),
  ledger: (params) => http.get('/api/fund/ledger', { params }),
  withdraw: (data) => http.post('/api/fund/withdraw', data),

  agentApply: (realName) => http.post('/api/agent/apply', { realName }),
  agentQrcode: () => http.get('/api/agent/qrcode'),
  agentTeam: (params) => http.get('/api/agent/team', { params }),
  agentStats: () => http.get('/api/agent/stats'),
  agentInfo: (code) => http.get('/api/agent/info', { params: { code } }),
};

export default http;
