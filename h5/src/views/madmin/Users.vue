<template>
  <div class="madmin-users">
    <van-nav-bar
      title="用户管理"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <div class="search-row">
      <van-search
        v-model="keyword"
        placeholder="搜索手机号/昵称/邀请码"
        shape="round"
        @search="onSearch"
      />
    </div>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <div class="user-list">
        <div v-for="u in list" :key="u.id" class="user-card" @click="openUser(u)">
          <div class="user-head">
            <div class="u-avatar">{{ avatarText(u) }}</div>
            <div class="u-info">
              <div class="u-name">
                {{ u.nickname || '—' }}
                <van-tag
                  v-if="u.agentLevel"
                  :type="agentTagType(u.agentLevel)"
                  size="small"
                  style="margin-left:6px"
                >
                  {{ agentLevelName(u.agentLevel) }}
                </van-tag>
              </div>
              <div class="u-mobile">{{ u.mobile || '未绑定手机' }}</div>
            </div>
            <van-icon name="arrow" size="14" color="#ccc" />
          </div>

          <div class="u-stats">
            <div class="u-stat">
              <div class="u-stat-num">¥{{ u.totalSpend }}</div>
              <div class="u-stat-label">消费总额</div>
            </div>
            <div class="u-stat">
              <div class="u-stat-num">{{ u.orderCount }}</div>
              <div class="u-stat-label">订单数</div>
            </div>
            <div class="u-stat">
              <div class="u-stat-num">¥{{ u.totalCommission }}</div>
              <div class="u-stat-label">返利总额</div>
            </div>
          </div>

          <div v-if="u.parentAgentCode" class="u-parent">
            <van-icon name="friends-o" size="12" color="#999" />
            <span>上级: {{ u.parentNickname || u.parentAgentCode }}</span>
            <span v-if="u.parentMobile" class="u-parent-phone">{{ u.parentMobile }}</span>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无用户" />

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/users" icon="user-o">用户</van-tabbar-item>
      <van-tabbar-item to="/madmin/agents" icon="friends-o">代理</van-tabbar-item>
    </van-tabbar>

    <!-- 用户详情弹层 -->
    <van-popup
      v-model:show="showDetail"
      position="bottom"
      round
      :style="{ padding: '20px 20px 30px', maxHeight: '80vh' }"
    >
      <div v-if="currentUser">
        <div style="font-size:17px;font-weight:700;margin-bottom:16px">用户详情</div>

        <div class="detail-row">
          <span class="detail-label">昵称</span>
          <span class="detail-value">{{ currentUser.nickname || '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">手机号</span>
          <span class="detail-value">{{ currentUser.mobile || '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">邀请码</span>
          <span class="detail-value">{{ currentUser.inviteCode || '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">代理等级</span>
          <span class="detail-value">
            <van-tag v-if="currentUser.agentLevel" :type="agentTagType(currentUser.agentLevel)">
              {{ agentLevelName(currentUser.agentLevel) }}
            </van-tag>
            <span v-else style="color:#999">普通用户</span>
          </span>
        </div>
        <div class="detail-row" v-if="currentUser.parentAgentCode">
          <span class="detail-label">上级代理</span>
          <span class="detail-value">
            {{ currentUser.parentNickname || currentUser.parentAgentCode }}
            <span style="color:#999;font-size:12px;margin-left:4px">
              {{ currentUser.parentMobile || '' }}
            </span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">余额</span>
          <span class="detail-value">¥{{ currentUser.balance || '0.00' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">返利中</span>
          <span class="detail-value">¥{{ currentUser.pending || '0.00' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">累计返利</span>
          <span class="detail-value">¥{{ currentUser.totalRebate || '0.00' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">消费总额</span>
          <span class="detail-value">¥{{ currentUser.totalSpend || '0.00' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">订单数</span>
          <span class="detail-value">{{ currentUser.orderCount || 0 }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">注册时间</span>
          <span class="detail-value">{{ formatTime(currentUser.createdAt) }}</span>
        </div>

        <div style="margin-top:20px;display:flex;gap:10px">
          <van-button
            block round plain type="primary"
            @click="viewOrders(currentUser)"
          >查看订单</van-button>
          <van-button
            block round type="primary" color="#ff4b3a"
            @click="assignOrders(currentUser)"
          >指派订单</van-button>
        </div>
        <div style="margin-top:10px">
          <van-button
            block round plain
            @click="onResetPassword(currentUser)"
          >重置密码</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { adminApi } from '../../api';

const router = useRouter();
const keyword = ref('');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const active = ref('users');

const showDetail = ref(false);
const currentUser = ref(null);

function avatarText(u) {
  return (u.nickname || u.mobile || '用').slice(0, 1);
}

function agentLevelName(l) {
  const names = { 0: '预备', 1: '白银', 2: '黄金', 3: '钻石' };
  return names[l] || '普通';
}

function agentTagType(l) {
  if (l >= 3) return 'danger';
  if (l >= 2) return 'warning';
  if (l >= 1) return 'primary';
  return 'default';
}

function formatTime(t) {
  if (!t) return '—';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let reqSeq = 0;

function onSearch() {
  reset();
}

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
}

async function onLoad() {
  const seq = ++reqSeq;
  try {
    const params = {
      page: page.value,
      pageSize,
    };
    if (keyword.value.trim()) params.keyword = keyword.value.trim();

    const r = await adminApi.users(params);
    if (seq !== reqSeq) return;
    const rows = r.list || r || [];
    list.value = list.value.concat(rows);
    page.value++;
    if (rows.length < pageSize) {
      finished.value = true;
    }
  } catch (e) {
    showToast(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openUser(u) {
  currentUser.value = u;
  showDetail.value = true;
}

function viewOrders(u) {
  showDetail.value = false;
  router.push({ path: '/madmin/orders', query: { userId: u.id } });
}

async function assignOrders(u) {
  try {
    const result = await showDialog({
      title: '指派订单给该用户',
      message: '请输入订单号（平台订单号）',
      showInput: true,
      inputPlaceholder: '请输入订单号',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      showCancelButton: true,
    });
    const orderNo = (result?.value || result?.inputValue || '').trim();
    if (!orderNo) return;
    // 先搜索该订单，再指派
    const r = await adminApi.orders({ keyword: orderNo, page: 1, pageSize: 10 });
    const orders = r.list || r || [];
    if (orders.length === 0) {
      showToast('未找到该订单');
      return;
    }
    const order = orders[0];
    await adminApi.assignOrder(order.id, u.id);
    showToast('指派成功');
    showDetail.value = false;
    reset();
  } catch (e) {
    if (e !== 'cancel') {
      showToast(e.message || '指派失败');
    }
  }
}

async function onResetPassword(u) {
  try {
    const result = await showDialog({
      title: '重置密码',
      message: '请输入新密码，留空则随机生成',
      showInput: true,
      inputValue: '000000',
      inputPlaceholder: '请输入新密码（6-20位）',
      confirmButtonText: '确定重置',
      cancelButtonText: '取消',
      showCancelButton: true,
    });
    const newPwd = (result?.value || result?.inputValue || '').trim();
    // 这里的确认是 Vant showDialog 的返回，cancel 时抛 'cancel'
    const r = await adminApi.resetUserPassword(u.id, newPwd || undefined);
    showDialog({
      title: '重置成功',
      message: `新密码：${r.newPassword}\n请告知用户及时修改。`,
      confirmButtonText: '复制并关闭',
    }).then(() => {
      if (navigator.clipboard && r.newPassword) {
        navigator.clipboard.writeText(r.newPassword).catch(() => {});
      }
    }).catch(() => {});
  } catch (e) {
    if (e !== 'cancel') {
      showToast(e.message || '重置失败');
    }
  }
}
</script>

<style scoped>
.madmin-users {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 60px;
}
.search-row {
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.search-row :deep(.van-search) {
  padding: 0;
}
.user-list {
  padding: 8px 12px;
}
.user-card {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  overflow: hidden;
}
.user-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
}
.u-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff976a, #ff4b3a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}
.u-info {
  flex: 1;
  min-width: 0;
}
.u-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  display: flex;
  align-items: center;
}
.u-mobile {
  font-size: 12px;
  color: #999;
  margin-top: 3px;
}
.u-stats {
  display: flex;
  justify-content: space-around;
  padding: 12px 0;
  border-top: 1px solid #f5f5f5;
  border-bottom: 1px solid #f5f5f5;
  background: #fafafa;
}
.u-stat {
  text-align: center;
  flex: 1;
}
.u-stat-num {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 2px;
}
.u-stat-label {
  font-size: 11px;
  color: #999;
}
.u-parent {
  padding: 10px 12px;
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 5px;
}
.u-parent-phone {
  color: #999;
  margin-left: 4px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}
.detail-label {
  color: #999;
  flex-shrink: 0;
}
.detail-value {
  color: #1a1a1a;
  text-align: right;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
