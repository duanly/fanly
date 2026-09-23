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
};
