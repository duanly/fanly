import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import App from './App.vue';

const routes = [
  { path: '/login', component: () => import('./views/Login.vue'), meta: { plain: true } },
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: () => import('./views/Dashboard.vue') },
  { path: '/agents', component: () => import('./views/Agents.vue') },
  { path: '/orders', component: () => import('./views/Orders.vue') },
  { path: '/withdraws', component: () => import('./views/Withdraws.vue') },
  { path: '/config', component: () => import('./views/Config.vue') },
];

// hash 路由 + base 子路径，Caddy 只要把 /admin/* 指到静态目录即可
const router = createRouter({ history: createWebHashHistory('/admin/'), routes });

router.beforeEach((to) => {
  if (!to.meta.plain && !localStorage.getItem('adminToken')) return '/login';
  return true;
});

createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app');
