import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import Vant from 'vant';
import 'vant/lib/index.css';
import App from './App.vue';
import './style.css';

const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/search', component: () => import('./views/Search.vue') },
  { path: '/category/:platform', component: () => import('./views/Category.vue') },
  { path: '/group/:key', component: () => import('./views/Group.vue') },
  // 通用专题页：后台每建一个专题就多一个 /topic/xxx，不用改代码也不用发版
  { path: '/topic/:slug', component: () => import('./views/Topic.vue') },
  { path: '/compare', component: () => import('./views/Compare.vue') },
  { path: '/local-life', component: () => import('./views/LocalLife.vue') },
  { path: '/cart', component: () => import('./views/Cart.vue') },
  { path: '/compare/:id', component: () => import('./views/CompareDetail.vue') },
  { path: '/parse', component: () => import('./views/Parse.vue'), meta: { auth: true } },
  { path: '/goods/:platform/:goodsId', component: () => import('./views/Detail.vue') },
  // 订单和我的不再强制跳登录，页面内给登录入口，底部导航栏才不会消失
  { path: '/orders', component: () => import('./views/Orders.vue') },
  { path: '/claim', component: () => import('./views/Claim.vue') },
  { path: '/checkin', component: () => import('./views/Checkin.vue'), meta: { auth: true } },
  { path: '/mine', component: () => import('./views/Mine.vue') },
  { path: '/realname', component: () => import('./views/RealName.vue'), meta: { auth: true } },
  { path: '/payment-method', component: () => import('./views/PaymentMethod.vue'), meta: { auth: true } },
  { path: '/change-password', component: () => import('./views/ChangePassword.vue'), meta: { auth: true } },
  { path: '/agent', component: () => import('./views/Agent.vue'), meta: { auth: true } },
  { path: '/withdraw', component: () => import('./views/Withdraw.vue'), meta: { auth: true } },
  { path: '/ledger', component: () => import('./views/Ledger.vue'), meta: { auth: true } },
  { path: '/withdraws', component: () => import('./views/Withdraws.vue'), meta: { auth: true } },
  { path: '/auth/:platform', component: () => import('./views/Authorize.vue'), meta: { auth: true } },
  { path: '/login', component: () => import('./views/Login.vue') },
  { path: '/i/:code', component: () => import('./views/Invite.vue') },
  { path: '/invite', component: () => import('./views/InviteQrcode.vue'), meta: { auth: true } },
  { path: '/support', component: () => import('./views/Support.vue'), meta: { auth: true } },

  // ───────── 手机端管理后台 ─────────
  { path: '/madmin/login', component: () => import('./views/madmin/Login.vue') },
  { path: '/madmin', component: () => import('./views/madmin/Home.vue'), meta: { admin: true } },
  { path: '/madmin/search', component: () => import('./views/madmin/Search.vue'), meta: { admin: true } },
  { path: '/madmin/pool', component: () => import('./views/madmin/Pool.vue'), meta: { admin: true } },
  { path: '/madmin/goods/:id', component: () => import('./views/madmin/GoodsDetail.vue'), meta: { admin: true } },
  { path: '/madmin/tags', component: () => import('./views/madmin/Tags.vue'), meta: { admin: true } },
  { path: '/madmin/tag/:slug', component: () => import('./views/madmin/TagGoods.vue'), meta: { admin: true } },
  { path: '/madmin/orders', component: () => import('./views/madmin/Orders.vue'), meta: { admin: true } },
  { path: '/madmin/jtk', component: () => import('./views/madmin/JtkOrders.vue'), meta: { admin: true } },
  { path: '/madmin/users', component: () => import('./views/madmin/Users.vue'), meta: { admin: true } },
  { path: '/madmin/agents', component: () => import('./views/madmin/Agents.vue'), meta: { admin: true } },
  { path: '/madmin/withdraws', component: () => import('./views/madmin/Withdraws.vue'), meta: { admin: true } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // 返回时记住滚动位置，前进或新打开时回到顶部
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  // 管理后台鉴权
  if (to.meta.admin && !localStorage.getItem('adminToken')) {
    return { path: '/madmin/login', query: { redirect: to.fullPath } };
  }
  // 用户端鉴权
  if (to.meta.auth && !localStorage.getItem('token')) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  return true;
});

createApp(App).use(router).use(Vant).mount('#app');

// ─── 注册 Service Worker（PWA 必需，Android 上才能触发安装提示） ───
if ('serviceWorker' in navigator && !location.hostname.includes('localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ─── PWA 安装提示（全局监听，避免组件加载晚了错过事件） ───
window.__pwaInstallPrompt = null;
window.__pwaCanInstall = false;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__pwaInstallPrompt = e;
    window.__pwaCanInstall = true;
    // 通知所有监听的组件
    window.dispatchEvent(new CustomEvent('pwa-install-ready'));
  });

  window.addEventListener('appinstalled', () => {
    window.__pwaInstallPrompt = null;
    window.__pwaCanInstall = false;
    window.dispatchEvent(new CustomEvent('pwa-install-changed'));
  });

  // 检查是否已安装（独立窗口运行）
  if (window.matchMedia('(display-mode: standalone)').matches) {
    window.__pwaCanInstall = false;
  }
}

// ───────── PWA 动态切换：管理后台 vs 用户端 ─────────
// 访问 /madmin/* 时切换成运营中心的 PWA 配置，这样可以单独添加到桌面
const USER_MANIFEST = '/manifest.json';
const ADMIN_MANIFEST = '/admin-manifest.json';
const USER_TITLE = '省钱猫 · 买啥都返现';
const ADMIN_TITLE = '运营中心';
const USER_THEME = '#ff3b30';
const ADMIN_THEME = '#ff4b3a';

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setPwaMode(isAdmin) {
  // manifest
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'manifest');
    document.head.appendChild(link);
  }
  link.setAttribute('href', isAdmin ? ADMIN_MANIFEST : USER_MANIFEST);

  // iOS PWA 相关
  setMeta('apple-mobile-web-app-title', isAdmin ? '运营中心' : '省钱猫');
  setMeta('theme-color', isAdmin ? ADMIN_THEME : USER_THEME);
  setMeta('apple-mobile-web-app-status-bar-style', 'default');

  // 文档标题
  document.title = isAdmin ? ADMIN_TITLE : USER_TITLE;
}

router.afterEach((to) => {
  const isAdmin = to.path.startsWith('/madmin');
  setPwaMode(isAdmin);
});

// 初始化时根据当前路径设置
setPwaMode(location.hash.startsWith('#/madmin'));
