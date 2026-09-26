<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>

  <!-- 四个主 Tab 常驻底部，iPhone 安全区已适配 -->
  <van-tabbar
    v-if="showTab"
    v-model="active"
    active-color="#ff4b3a"
    inactive-color="#999"
    route
    fixed
    placeholder
    safe-area-inset-bottom
  >
    <van-tabbar-item to="/" icon="shop-o">首页</van-tabbar-item>
    <van-tabbar-item to="/compare" icon="balance-list-o">比价</van-tabbar-item>
    <van-tabbar-item to="/cart" icon="shopping-cart-o" :badge="cartBadge">购物车</van-tabbar-item>
    <van-tabbar-item to="/mine" icon="user-o">我的</van-tabbar-item>
  </van-tabbar>

  <!-- 从电商 App 复制完回来，自动提示查返利 -->
  <ClipboardWatcher v-if="showTab" />
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ClipboardWatcher from './components/ClipboardWatcher.vue';
import { api } from './api';
import { cartCount, setCartCount } from './utils/cart-badge';

const route = useRoute();
const active = ref(0);

// 底部导航栏常驻：除登录、平台授权、邀请落地页这几个流程页外，所有页面都显示。
// 这样从详情、提现、订单等子页面能一键切回主 Tab，不用层层返回。
const showTab = computed(() => {
  const p = route.path;
  if (p === '/login') return false;
  if (p.startsWith('/auth/')) return false;
  if (p.startsWith('/i/')) return false;
  return true;
});

const cartBadge = computed(() => (cartCount.value > 0 ? String(cartCount.value) : ''));

async function syncBadge() {
  if (!localStorage.getItem('token')) return setCartCount(0);
  try {
    const r = await api.cartCount();
    setCartCount(r.count || 0);
  } catch {
    setCartCount(0);
  }
}

// 切主 Tab 时对一次角标——加购发生在详情页，回来数字得是新的
watch(showTab, (v) => { if (v) syncBadge(); }, { immediate: true });
</script>
