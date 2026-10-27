import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 图标目录在仓库根 icons/，位于本项目根之外
const ICONS_DIR = join(__dirname, '../icons');

/**
 * 虚拟图标模块插件：用 Node fs 直接读 icons/*.svg，
 * 绕开 import.meta.glob 对「项目根之外目录」在 dev 下的扫描限制。
 * 暴露 virtual:icon-lib → { ICON_MAP, ICON_NAMES }
 */
function iconLibPlugin() {
  const VIRTUAL_ID = 'virtual:icon-lib';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;

  function loadMap() {
    const map = {};
    for (const f of readdirSync(ICONS_DIR)) {
 if (!f.endsWith('.svg')) continue;
      const name = f.replace(/\.svg$/, '');
      map[name] = readFileSync(join(ICONS_DIR, f), 'utf-8');
    }
    return map;
  }

  return {
    name: 'shared-icon-lib',
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : null),
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const map = loadMap();
      return `export const ICON_MAP = ${JSON.stringify(map)};`
        + `export const ICON_NAMES = Object.keys(ICON_MAP).sort();`;
    },
    configureServer(server) {
      server.watcher.add(ICONS_DIR);
      server.watcher.on('all', (_e, file) => {
        if (typeof file === 'string' && file.startsWith(ICONS_DIR) && file.endsWith('.svg')) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) server.reloadModule(mod);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), iconLibPlugin()],
  server: {
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
});
