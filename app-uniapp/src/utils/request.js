import { BASE_URL } from '../config.js';
import { getToken, clearToken } from './storage.js';

/**
 * uni.request 统一封装（替代 H5 的 axios 实例）
 *
 * 行为与 H5 拦截器对齐：
 *  - 自动带 Bearer token
 *  - 业务码 code===0 返回 data，否则 toast 并 reject
 *  - 商品列表类接口剔除佣金/价格为 0 的商品
 *  - 401 清登录态并跳登录页
 */

// 命中这些接口时，对返回列表过滤掉佣金≤0、价格≤0 的商品
const GOODS_LIST_PATHS = [
  '/api/goods/feed',
  '/api/goods/recommend',
  '/api/goods/search',
  '/api/goods/group',
  '/api/goods/groups',
  '/api/home/ranking',
  '/api/compare/list',
  '/api/compare/search',
  '/api/cart',
];

function isGoodsList(url) {
  return GOODS_LIST_PATHS.some((p) => url.includes(p)) || url.includes('/api/topics/');
}

function filterData(url, data) {
  if (!isGoodsList(url) || !data || typeof data !== 'object') return data;
  const keep = (g) => {
    const comm = Number(g.commission ?? g.estCommission ?? 0);
    const price = Number(g.price ?? g.finalPrice ?? g.couponPrice ?? g.actualPrice ?? 0);
    return comm > 0 && price > 0;
  };
  if (Array.isArray(data.list) && data.list.length && data.list[0]?.goodsId !== undefined) {
    return { ...data, list: data.list.filter(keep) };
  }
  if (Array.isArray(data) && data.length && data[0]?.goodsId !== undefined) {
    return data.filter(keep);
  }
  return data;
}

function toast(msg) {
  uni.showToast({ title: msg || '请求失败', icon: 'none', duration: 2000 });
}

function redirectLogin() {
  // 避免在登录页重复跳转
  const pages = getCurrentPages();
  const cur = pages[pages.length - 1];
  if (!cur || cur.route !== 'pages/login/login') {
    uni.reLaunch({ url: '/pages/login/login' });
  }
}

/**
 * 通用请求
 * @param {Object} opts { url, method, data, params(query), header, hideError }
 */
export function request(opts) {
  const {
    url,
    method = 'GET',
    data,
    params,
    header = {},
    hideError = false,
  } = opts;

  const token = getToken();
  if (token) header.Authorization = `Bearer ${token}`;

  // GET 的查询参数拼到 url
  let fullUrl = url;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + fullUrl,
      method: method.toUpperCase(),
      data,
      header,
      timeout: 15000,
      success: (res) => {
        const status = res.statusCode;
        const body = res.data;
        if (status === 401) {
          clearToken();
          if (!hideError) toast('登录已过期，请重新登录');
          redirectLogin();
          return reject(new Error('unauthorized'));
        }
        if (body && body.code === 0) {
          resolve(filterData(fullUrl, body.data));
          return;
        }
        const msg = body?.msg || `请求失败(${status})`;
        if (!hideError) toast(msg);
        reject(new Error(msg));
      },
      fail: (err) => {
        if (!hideError) toast(err.errMsg || '网络错误');
        reject(new Error(err.errMsg || 'network error'));
      },
    });
  });
}

export const get = (url, params, opts = {}) => request({ url, method: 'GET', params, ...opts });
export const post = (url, data, opts = {}) => request({ url, method: 'POST', data, ...opts });
export const del = (url, data, opts = {}) => request({ url, method: 'DELETE', data, ...opts });
export const put = (url, data, opts = {}) => request({ url, method: 'PUT', data, ...opts });

/**
 * 文件上传（头像 / 客服图片）
 * 小程序/App 选完文件得到临时路径后调用
 */
export function uploadFile(url, filePath, name = 'file', formData = {}) {
  const token = getToken();
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: BASE_URL + url,
      filePath,
      name,
      formData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data);
          if (body.code === 0) return resolve(body.data);
          toast(body?.msg || '上传失败');
          reject(new Error(body?.msg || 'upload failed'));
        } catch {
          toast('上传响应解析失败');
          reject(new Error('bad response'));
        }
      },
      fail: (err) => {
        toast(err.errMsg || '上传失败');
        reject(new Error(err.errMsg || 'upload error'));
      },
    });
  });
}

export default request;
