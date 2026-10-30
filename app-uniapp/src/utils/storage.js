/**
 * 本地存储统一封装（替代 H5 的 localStorage）
 */
export const storage = {
  get(key) {
    try {
      return uni.getStorageSync(key) || '';
    } catch {
      return '';
    }
  },
  set(key, value) {
    uni.setStorageSync(key, value);
  },
  remove(key) {
    uni.removeStorageSync(key);
  },
};

export const TOKEN_KEY = 'token';
export const ADMIN_TOKEN_KEY = 'adminToken';

export const getToken = () => storage.get(TOKEN_KEY);
export const setToken = (t) => storage.set(TOKEN_KEY, t);
export const clearToken = () => storage.remove(TOKEN_KEY);
