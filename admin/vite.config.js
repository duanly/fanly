import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // 部署在 /admin 子路径下
  base: '/admin/',
  plugins: [vue()],
  server: {
    host: true,
    port: 5174,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
});
