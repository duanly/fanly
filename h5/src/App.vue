<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>

  <van-tabbar v-if="showTab" v-model="active" active-color="#ff4b3a" route>
    <van-tabbar-item to="/" icon="shop-o">首页</van-tabbar-item>
    <van-tabbar-item to="/search" icon="search">搜索</van-tabbar-item>
    <van-tabbar-item to="/orders" icon="orders-o">订单</van-tabbar-item>
    <van-tabbar-item to="/mine" icon="user-o">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const active = ref(0);
// 详情页、登录页、落地页不显示底部导航
const showTab = computed(() => !/^\/(goods|login|i)\//.test(route.path) && route.path !== '/login');
</script>
