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
    <van-tabbar-item to="/search" icon="search">选品</van-tabbar-item>
    <van-tabbar-item to="/orders" icon="orders-o">订单</van-tabbar-item>
    <van-tabbar-item to="/mine" icon="user-o">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const active = ref(0);

// 只有这几个主 Tab 显示底部栏；二级页面（详情、提现、登录等）不显示
const TAB_PATHS = ['/', '/search', '/orders', '/mine'];
const showTab = computed(() => TAB_PATHS.includes(route.path));
</script>
