<template>
  <router-view v-if="plain" />

  <el-container v-else style="height:100vh">
    <el-aside width="200px" style="background:#1f2937">
      <div style="color:#fff;font-size:17px;font-weight:600;padding:18px 20px">返利平台</div>
      <el-menu
        :default-active="route.path"
        router
        background-color="#1f2937"
        text-color="#c6cdd8"
        active-text-color="#fff"
      >
        <el-menu-item index="/dashboard">仪表盘</el-menu-item>
        <el-menu-item index="/curation">选品池</el-menu-item>
        <el-menu-item index="/compare">比价组</el-menu-item>
        <el-menu-item index="/agents">代理管理</el-menu-item>
        <el-menu-item index="/orders">订单管理</el-menu-item>
        <el-menu-item index="/withdraws">提现审核</el-menu-item>
        <el-menu-item index="/config">系统参数</el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="background:#fff;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between">
        <span style="font-weight:600">{{ title }}</span>
        <el-button link @click="logout">退出登录</el-button>
      </el-header>
      <el-main style="background:#f5f6f8">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const plain = computed(() => route.meta.plain);
const TITLES = {
  '/dashboard': '仪表盘',
  '/curation': '选品池',
  '/compare': '比价组',
  '/agents': '代理管理',
  '/orders': '订单管理',
  '/withdraws': '提现审核',
  '/config': '系统参数',
};
const title = computed(() => TITLES[route.path] || '');

function logout() {
  localStorage.removeItem('adminToken');
  router.push('/login');
}
</script>
