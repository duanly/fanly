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
        <el-menu-item index="/curation">商品货架</el-menu-item>
        <el-menu-item index="/topics">标签管理</el-menu-item>
        <el-menu-item index="/compare">比价组</el-menu-item>
        <el-menu-item index="/home-ops">首页运营</el-menu-item>
        <el-menu-item index="/agents">代理管理</el-menu-item>
        <el-menu-item index="/users">用户管理</el-menu-item>
        <el-menu-item index="/realnames">实名审核</el-menu-item>
        <el-menu-item index="/orders">订单管理</el-menu-item>
        <el-menu-item index="/jutuike">聚推客订单</el-menu-item>
        <el-menu-item index="/claims">订单找回</el-menu-item>
        <el-menu-item index="/support">
          客服工作台<span
            v-if="staffUnread"
            style="display:inline-block;min-width:16px;padding:0 4px;margin-left:6px;height:16px;line-height:16px;text-align:center;background:#f56c6c;color:#fff;border-radius:8px;font-size:11px;font-weight:600;vertical-align:2px"
          >{{ staffUnread > 99 ? '99+' : staffUnread }}</span>
        </el-menu-item>
        <el-menu-item index="/level-requests">
          等级审核<span
            v-if="pendingLevelCount"
            style="display:inline-block;min-width:16px;padding:0 4px;margin-left:6px;height:16px;line-height:16px;text-align:center;background:#f56c6c;color:#fff;border-radius:8px;font-size:11px;font-weight:600;vertical-align:2px"
          >{{ pendingLevelCount > 99 ? '99+' : pendingLevelCount }}</span>
        </el-menu-item>
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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import { api } from './api';

const route = useRoute();
const router = useRouter();

// 等级审核待办数量（菜单红点）；登录后拉取并每分钟刷新
const pendingLevelCount = ref(0);
async function refreshPendingLevel() {
  if (!localStorage.getItem('token')) { pendingLevelCount.value = 0; return; }
  try {
    const r = await api.levelRequests({ status: 0, page: 1, size: 1 });
    pendingLevelCount.value = r.total || 0;
  } catch { /* ignore */ }
}

// 客服未读总条数（菜单红点；用户消息即使已自动回复仍计入，打开会话才清零）
const staffUnread = ref(0);
async function refreshStaffUnread() {
  if (!localStorage.getItem('token')) { staffUnread.value = 0; return; }
  try {
    const r = await api.supportUnreadTotal();
    staffUnread.value = r.total || 0;
  } catch { /* ignore */ }
}

let socket = null;
onMounted(() => {
  refreshPendingLevel();
  setInterval(refreshPendingLevel, 60000);

  refreshStaffUnread();
  // 任何客服消息/会话变更都重查未读（用户来信、自动回复、已读清零）
  socket = io({
    auth: { token: localStorage.getItem('token') },
    transports: ['websocket', 'polling'],
  });
  socket.on('support:message', refreshStaffUnread);
  socket.on('support:conversation', refreshStaffUnread);
});
onUnmounted(() => { socket?.disconnect(); });
const plain = computed(() => route.meta.plain);
const TITLES = {
  '/dashboard': '仪表盘',
  '/curation': '商品货架',
  '/topics': '标签管理',
  '/compare': '比价组',
  '/home-ops': '首页运营',
  '/agents': '代理管理',
  '/users': '用户管理',
  '/realnames': '实名审核',
  '/orders': '订单管理',
  '/jutuike': '聚推客订单',
  '/claims': '订单找回',
  '/support': '客服工作台',
  '/level-requests': '等级审核',
  '/withdraws': '提现审核',
  '/config': '系统参数',
};
const title = computed(() => TITLES[route.path] || '');

function logout() {
  localStorage.removeItem('adminToken');
  router.push('/login');
}
</script>
