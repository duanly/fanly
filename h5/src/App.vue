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
    class="app-tabbar"
  >
    <van-tabbar-item to="/" icon="shop-o">首页</van-tabbar-item>
    <van-tabbar-item to="/local-life" icon="shop-collect-o">本地生活</van-tabbar-item>
    <van-tabbar-item to="/cart" icon="star-o" :badge="cartBadge">收藏夹</van-tabbar-item>
    <van-tabbar-item to="/mine" icon="user-o">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
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
  // 管理后台整个模块都不显示用户端 tabbar
  if (p.startsWith('/madmin')) return false;
  // 商品详情页底部是「加入购物车 / 领券购买」条，被常驻 tabbar 盖住会点不到。
  // 这里是下单的临门一脚，只留购买条；要回首页走左上角返回。
  if (p.startsWith('/goods/')) return false;
  // 客服聊天页全屏，走 nav-bar 返回，不显示底部 tab
  if (p.startsWith('/support')) return false;
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

<style>
/* 底部 tabbar 永远在最上层，确保可见 */
.app-tabbar {
  z-index: 999 !important;
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
}
/* 修复 iOS 下 tabbar 点击不灵敏：扩大可点击区域 */
.app-tabbar .van-tabbar-item {
  min-height: 50px;
  padding-top: 4px;
  padding-bottom: 2px;
  touch-action: manipulation;
}
</style>
