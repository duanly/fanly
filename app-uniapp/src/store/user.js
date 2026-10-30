import { defineStore } from 'pinia';
import { api } from '../api/index.js';
import { getToken, setToken, clearToken } from '../utils/storage.js';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    profile: null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
  },
  actions: {
    async login(data) {
      const r = await api.login(data);
      this.token = r.token;
      setToken(r.token);
      await this.fetchProfile();
      return r;
    },
    async fetchProfile() {
      if (!this.token) return null;
      try {
        this.profile = await api.profile();
        return this.profile;
      } catch {
        return null;
      }
    },
    logout() {
      this.token = '';
      this.profile = null;
      clearToken();
    },
  },
});
