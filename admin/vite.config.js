import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // 部署在 /admin 子路径下
  base: '/admin/',
  plugins: [vue()],
  server: {
    host: true,
    port: 5174,
    // 图标库在仓库根 icons/，位于本项目根之外，必须放行 Vite 的文件访问白名单，
    // 否则 import.meta.glob 扫不到、后台图标选择器为空
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
});
