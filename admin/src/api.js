import axios from 'axios';
import { ElMessage } from 'element-plus';

const http = axios.create({ baseURL: '/', timeout: 20000 });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('adminToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  (res) => {
    if (res.data?.code === 0) return res.data.data;
    ElMessage.error(res.data?.msg || '请求失败');
    return Promise.reject(new Error(res.data?.msg));
  },
  (err) => {
    const status = err.response?.status;
    if (status === 401) {
      localStorage.removeItem('adminToken');
      location.hash = '#/login';
    } else {
      ElMessage.error(err.response?.data?.msg || err.message);
    }
    return Promise.reject(err);
  },
);

export const api = {
  login: (data) => http.post('/api/admin/login', data),

  config: () => http.get('/api/admin/config'),
  setConfig: (key, value) => http.post('/api/admin/config', { key, value }),

  agents: (params) => http.get('/api/admin/agents', { params }),
  updateAgent: (id, data) => http.post(`/api/admin/agents/${id}`, data),

  orders: (params) => http.get('/api/admin/orders', { params }),
  syncOrders: (hours) => http.post('/api/admin/orders/sync', { hours }),

  withdraws: (params) => http.get('/api/admin/withdraws', { params }),
  auditWithdraw: (id, pass, reason) => http.post(`/api/admin/withdraws/${id}/audit`, { pass, reason }),
  finishWithdraw: (id, success, channelOrderNo, failReason) =>
    http.post(`/api/admin/withdraws/${id}/finish`, { success, channelOrderNo, failReason }),

  reconcile: () => http.get('/api/admin/reconcile'),

  // 选品池
  curationSearch: (params) => http.get('/api/admin/curation/search', { params }),
  curationRecommend: (params) => http.get('/api/admin/curation/recommend', { params }),
  curationList: (params) => http.get('/api/admin/curation/list', { params }),
  curationGroups: () => http.get('/api/admin/curation/groups'),
  curationAdd: (data) => http.post('/api/admin/curation/add', data),
  curationUpdate: (id, data) => http.post(`/api/admin/curation/${id}`, data),
  curationRefresh: (id) => http.post(`/api/admin/curation/${id}/refresh`),
  curationRefreshAll: () => http.post('/api/admin/curation/refresh-all'),
  curationRemove: (id) => http.delete(`/api/admin/curation/${id}`),

  // 比价组
  compareList: (params) => http.get('/api/admin/compare/list', { params }),
  compareSave: (data) => http.post('/api/admin/compare/save', data),
  compareAddMembers: (id, curatedIds) => http.post(`/api/admin/compare/${id}/members`, { curatedIds }),
  compareRemoveMember: (id, curatedId) => http.delete(`/api/admin/compare/${id}/members/${curatedId}`),
  compareRemove: (id) => http.delete(`/api/admin/compare/${id}`),

  // 首页运营
  homeLinks: () => http.get('/api/admin/home/links'),
  homeLinkSave: (data) => http.post('/api/admin/home/links', data),
  homeLinkRemove: (id) => http.delete(`/api/admin/home/links/${id}`),

  // 订单找回
  claimList: (params) => http.get('/api/admin/claim', { params }),
  claimAudit: (id, pass, reason) => http.post(`/api/admin/claim/${id}/audit`, { pass, reason }),
  claimRetry: () => http.post('/api/admin/claim/retry'),
};
