import { defineStore } from 'pinia';
import { api } from '../api/index.js';
import { getToken } from '../utils/storage.js';

export const useCartStore = defineStore('cart', {
  state: () => ({
    count: 0,
  }),
  actions: {
    async sync() {
      if (!getToken()) {
        this.count = 0;
        return;
      }
      try {
        const r = await api.cartCount();
        this.count = r.count || 0;
      } catch {
        this.count = 0;
      }
    },
  },
});
