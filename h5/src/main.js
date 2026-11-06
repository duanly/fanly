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
  { path: '/madmin/realnames', component: () => import('./views/madmin/Realnames.vue'), meta: { admin: true } },
  { path: '/madmin/support', component: () => import('./views/madmin/Support.vue'), meta: { admin: true } },
  { path: '/madmin/support-rules', component: () => import('./views/madmin/SupportRules.vue'), meta: { admin: true } },
  { path: '/madmin/support/:id', component: () => import('./views/madmin/SupportChat.vue'), meta: { admin: true } },
  { path: '/madmin/level-requests', component: () => import('./views/madmin/LevelRequests.vue'), meta: { admin: true } },
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

// /madmin.html 是运营中心独立 PWA 入口（真实路径，HTML 里静态写死 admin manifest），
// 桌面图标点开它，先把 hash 路由切到 /madmin；未登录会被上面的守卫带去 /madmin/login。
// 必须在 mount 前替换，避免首屏先按 '/' 解析一次。
if (location.pathname.endsWith('/madmin.html') && !location.hash) {
  router.replace('/madmin');
}

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

// ───────── PWA 双入口：用户端 vs 运营中心 ─────────
const USER_MANIFEST = '/manifest.json';
const ADMIN_MANIFEST = '/admin-manifest.json';
const USER_TITLE = '省钱猫 · 买啥都返现';
const ADMIN_TITLE = '运营中心';
const USER_THEME = '#ff3b30';
const ADMIN_THEME = '#ff4b3a';

const PWA_ASSETS = {
  user: {
    manifest: USER_MANIFEST,
    title: USER_TITLE,
    appTitle: '省钱猫',
    theme: USER_THEME,
    icon120: '/icons/icon-square-120.png',
    icon180: '/icons/icon-square-180.png',
    icon192: '/icons/icon-square-192.png',
    icon256: '/icons/icon-square-256.png',
  },
  admin: {
    manifest: ADMIN_MANIFEST,
    title: ADMIN_TITLE,
    appTitle: '运营中心',
    theme: ADMIN_THEME,
    icon120: '/icons/admin-icon-square-120.png',
    icon180: '/icons/admin-icon-square-180.png',
    icon192: '/icons/admin-icon-square-192.png',
    icon256: '/icons/admin-icon-square-256.png',
  },
};

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setAllLinkHref(selector, href) {
  document.querySelectorAll(selector).forEach((el) => el.setAttribute('href', href));
}

function setPwaMode(isAdmin) {
  const a = isAdmin ? PWA_ASSETS.admin : PWA_ASSETS.user;

  // manifest：删旧节点再插新节点。直接改 href 在部分国产浏览器上不会被重新读取，
  // 换成新节点能触发重新解析。
  document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
  const link = document.createElement('link');
  link.setAttribute('rel', 'manifest');
  link.setAttribute('href', a.manifest);
  document.head.appendChild(link);

  // iOS 桌面图标 / 标题（Safari 分享时按当前 DOM 读取）
  setAllLinkHref('link[rel="apple-touch-icon"]', a.icon180);
  setAllLinkHref('link[rel="apple-touch-icon"][sizes="120x120"]', a.icon120);
  setAllLinkHref('link[rel="apple-touch-icon"][sizes="180x180"]', a.icon180);
  setAllLinkHref('link[rel="apple-touch-icon-precomposed"]', a.icon180);
  setAllLinkHref('link[rel="icon"][sizes="192x192"]', a.icon192);
  setAllLinkHref('meta[itemprop="image"]', a.icon256);

  setMeta('apple-mobile-web-app-title', a.appTitle);
  setMeta('application-name', a.appTitle);
  setMeta('theme-color', a.theme);
  setMeta('apple-mobile-web-app-status-bar-style', 'default');

  document.title = a.title;
}

router.afterEach((to) => {
  setPwaMode(to.path.startsWith('/madmin'));
});

// 初始化：/madmin.html 入口或 #/madmin 哈希都算运营中心模式
setPwaMode(location.pathname.endsWith('/madmin.html') || location.hash.startsWith('#/madmin'));
