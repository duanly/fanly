<template>
  <div class="madmin-home">
    <!-- 顶部数据概览 -->
    <div class="header">
      <div class="header-top">
        <div class="title">运营中心</div>
        <div class="logout" @click="onLogout">
          <van-icon name="log-out" />
        </div>
      </div>
      <div class="stats">
        <div class="stat-item">
          <div class="stat-num">{{ stats.onShelf || 0 }}</div>
          <div class="stat-label">已上架</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ stats.pending || 0 }}</div>
          <div class="stat-label">待上架</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">{{ stats.offShelf || 0 }}</div>
          <div class="stat-label">已下架</div>
        </div>
      </div>
    </div>

    <!-- 功能入口 -->
    <div class="section">
      <div class="grid">
        <div class="grid-item" @click="$router.push('/madmin/search')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#667eea,#764ba2)">
            <van-icon name="search" />
          </div>
          <div class="grid-name">找商品</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/pool')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#f093fb,#f5576c)">
            <van-icon name="shop-collect-o" />
          </div>
          <div class="grid-name">选品池</div>
        </div>
        <div class="grid-item" @click="$router.push('/madmin/tags')">
          <div class="grid-ico" style="background: linear-gradient(135deg,#4facfe,#00f2fe)">
            <van-icon name="label-o" />
          </div>
          <div class="grid-name">标签管理</div>
        </div>
        <div class="grid-item" @click="goPull">
          <div class="grid-ico" style="background: linear-gradient(135deg,#43e97b,#38f9d7)">
            <van-icon name="down" />
          </div>
          <div class="grid-name">自动拉取</div>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="section">
      <div class="sec-title">快捷操作</div>
      <div class="quick-list">
        <div class="quick-item" @click="$router.push('/madmin/pool?status=3')">
          <div class="q-left">
            <van-icon name="clock-o" color="#ff9800" />
            <span>待上架商品</span>
          </div>
          <van-icon name="arrow" />
        </div>
        <div class="quick-item" @click="$router.push('/madmin/pool?status=1')">
          <div class="q-left">
            <van-icon name="success" color="#4caf50" />
            <span>已上架商品</span>
          </div>
          <van-icon name="arrow" />
        </div>
        <div class="quick-item" @click="onDedup">
          <div class="q-left">
            <van-icon name="orders-o" color="#2196f3" />
            <span>商品去重</span>
          </div>
          <van-icon name="arrow" />
        </div>
        <div class="quick-item" @click="onCleanOff">
          <div class="q-left">
            <van-icon name="delete-o" color="#f44336" />
            <span>清理下架商品</span>
          </div>
          <van-icon name="arrow" />
        </div>
      </div>
    </div>

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/search" icon="search">找商品</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/tags" icon="label-o">标签</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import { adminApi } from '../../api';

const router = useRouter();
const active = ref(0);
const stats = reactive({ onShelf: 0, pending: 0, offShelf: 0 });

async function loadStats() {
  try {
    // 分别拉三个状态的总数
    const [r1, r3, r0] = await Promise.all([
      adminApi.curationList({ status: 1, pageSize: 1 }),
      adminApi.curationList({ status: 3, pageSize: 1 }),
      adminApi.curationList({ status: 0, pageSize: 1 }),
    ]);
    stats.onShelf = r1.total || 0;
    stats.pending = r3.total || 0;
    stats.offShelf = r0.total || 0;
  } catch {
    // 失败就显示 0
  }
}

function goPull() {
  showToast('自动拉取请在 PC 后台操作');
}

async function onDedup() {
  try {
    await showConfirmDialog({
      title: '商品去重',
      message: '将按平台+商品ID 去重，保留最新的一条。确认继续？',
    });
    await adminApi.curationDedup();
    showToast('去重完成');
    loadStats();
  } catch (e) {
    if (e !== 'cancel') showToast(e.message || '操作失败');
  }
}

async function onCleanOff() {
  try {
    await showConfirmDialog({
      title: '清理下架商品',
      message: '将删除所有已下架的商品（包括人工下架和自动下架）。确认继续？',
    });
    await adminApi.curationRemoveOffShelf();
    showToast('清理完成');
    loadStats();
  } catch (e) {
    if (e !== 'cancel') showToast(e.message || '操作失败');
  }
}

async function onLogout() {
  try {
    await showConfirmDialog({
      title: '退出登录',
      message: '确定要退出管理后台吗？',
    });
    localStorage.removeItem('adminToken');
    router.replace('/madmin/login');
  } catch {
    // cancel
  }
}

onMounted(loadStats);
</script>

<style scoped>
.madmin-home {
  padding-bottom: 60px;
  min-height: 100vh;
  background: #f5f6f8;
}
.header {
  background: linear-gradient(135deg, #ff4b3a 0%, #ff6b35 100%);
  padding: 44px 16px 48px;
  color: #fff;
  border-radius: 0 0 20px 20px;
}
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.title {
  font-size: 20px;
  font-weight: 600;
}
.logout {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.stats {
  display: flex;
  justify-content: space-around;
}
.stat-item {
  text-align: center;
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  opacity: 0.85;
  margin-top: 4px;
}
.section {
  margin: 12px;
  background: #fff;
  border-radius: 14px;
  padding: 16px;
}
.sec-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1a1a1a;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.grid-item:active { transform: scale(0.95); }
.grid-ico {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
}
.grid-name {
  font-size: 12px;
  color: #666;
}
.quick-list {
  margin: 0 -8px;
}
.quick-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px;
  border-bottom: 1px solid #f5f5f5;
}
.quick-item:last-child { border-bottom: none; }
.quick-item:active { background: #f9f9f9; }
.q-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #333;
}
</style>
