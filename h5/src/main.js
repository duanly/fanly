import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import Vant from 'vant';
import 'vant/lib/index.css';
import App from './App.vue';
import './style.css';

const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/search', component: () => import('./views/Search.vue') },
  { path: '/group/:key', component: () => import('./views/Group.vue') },
  { path: '/compare', component: () => import('./views/Compare.vue') },
  { path: '/cart', component: () => import('./views/Cart.vue') },
  { path: '/compare/:id', component: () => import('./views/CompareDetail.vue') },
  { path: '/parse', component: () => import('./views/Parse.vue'), meta: { auth: true } },
  { path: '/goods/:platform/:goodsId', component: () => import('./views/Detail.vue') },
  // 订单和我的不再强制跳登录，页面内给登录入口，底部导航栏才不会消失
  { path: '/orders', component: () => import('./views/Orders.vue') },
  { path: '/mine', component: () => import('./views/Mine.vue') },
  { path: '/agent', component: () => import('./views/Agent.vue'), meta: { auth: true } },
  { path: '/withdraw', component: () => import('./views/Withdraw.vue'), meta: { auth: true } },
  { path: '/ledger', component: () => import('./views/Ledger.vue'), meta: { auth: true } },
  { path: '/withdraws', component: () => import('./views/Withdraws.vue'), meta: { auth: true } },
  { path: '/auth/:platform', component: () => import('./views/Authorize.vue'), meta: { auth: true } },
  { path: '/login', component: () => import('./views/Login.vue') },
  { path: '/i/:code', component: () => import('./views/Invite.vue') },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  if (to.meta.auth && !localStorage.getItem('token')) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  return true;
});

createApp(App).use(router).use(Vant).mount('#app');
