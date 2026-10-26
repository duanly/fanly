import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // 部署在 /admin 子路径下
  base: '/admin/',
  plugins: [vue()],
  resolve: {
    alias: {
      // 共享图标库：用绝对路径别名，避免相对 ../../../ 在 glob 运行时解析不到项目外文件
      '@icons': fileURLToPath(new URL('../icons', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5174,
    // 图标库在仓库根 icons/、位于本项目根之外，放行 Vite 文件白名单
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
});
