import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import Vant from 'vant';
import 'vant/lib/index.css';
import App from './App.vue';
import './style.css';

const routes = [
  { path: '/', component: () => import('./views/Home.vue'), meta: { tab: 'home' } },
  { path: '/search', component: () => import('./views/Search.vue') },
  { path: '/goods/:platform/:goodsId', component: () => import('./views/Detail.vue') },
  { path: '/orders', component: () => import('./views/Orders.vue'), meta: { tab: 'orders', auth: true } },
  { path: '/mine', component: () => import('./views/Mine.vue'), meta: { tab: 'mine', auth: true } },
  { path: '/agent', component: () => import('./views/Agent.vue'), meta: { auth: true } },
  { path: '/withdraw', component: () => import('./views/Withdraw.vue'), meta: { auth: true } },
  { path: '/ledger', component: () => import('./views/Ledger.vue'), meta: { auth: true } },
  { path: '/login', component: () => import('./views/Login.vue') },
  { path: '/i/:code', component: () => import('./views/Invite.vue') },
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to) => {
  if (to.meta.auth && !localStorage.getItem('token')) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  return true;
});

createApp(App).use(router).use(Vant).mount('#app');
