<template>
  <div class="madmin-agents">
    <van-nav-bar
      title="代理管理"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <van-tabs v-model:active="status" sticky offset-top="46px" @change="onStatusChange">
      <van-tab title="全部" name="" />
      <van-tab title="正常" name="1" />
      <van-tab title="待审核" name="0" />
      <van-tab title="已禁用" name="2" />
    </van-tabs>

    <div class="search-row">
      <van-search
        v-model="keyword"
        placeholder="搜索手机号/邀请码"
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
      <div class="agent-list">
        <div v-for="a in list" :key="a.id" class="agent-card">
          <div class="agent-head">
            <div class="a-info">
              <div class="a-mobile">{{ a.mobile || '未知' }}</div>
              <div class="a-code">邀请码: {{ a.inviteCode || '-' }}</div>
            </div>
            <van-tag :type="statusTagType(a.status)" size="medium">
              {{ statusName(a.status) }}
            </van-tag>
          </div>
          <div class="agent-stats">
            <div class="a-stat">
              <div class="a-stat-num">{{ a.teamCount || 0 }}</div>
              <div class="a-stat-label">团队人数</div>
            </div>
            <div class="a-stat">
              <div class="a-stat-num">¥{{ a.totalCommission || '0.00' }}</div>
              <div class="a-stat-label">累计返利</div>
            </div>
            <div class="a-stat">
              <div class="a-stat-num">L{{ a.level || 1 }}</div>
              <div class="a-stat-label">等级</div>
            </div>
          </div>
          <div class="agent-actions">
            <van-button
              v-if="a.status === 0"
              size="small"
              type="success"
              @click="auditAgent(a, 1)"
            >通过</van-button>
            <van-button
              v-if="a.status === 0"
              size="small"
              type="danger"
              plain
              @click="auditAgent(a, 2)"
            >拒绝</van-button>
            <van-button
              v-if="a.status === 1"
              size="small"
              type="warning"
              plain
              @click="auditAgent(a, 2)"
            >禁用</van-button>
            <van-button
              v-if="a.status === 2"
              size="small"
              type="primary"
              @click="auditAgent(a, 1)"
            >恢复</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无代理" />

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/agents" icon="friends-o">代理</van-tabbar-item>
      <van-tabbar-item to="/madmin/withdraws" icon="gold-coin-o">提现</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { showToast, showConfirmDialog, showSuccessToast } from 'vant';
import { adminApi } from '../../api';

function statusName(s) {
  const m = { 0: '待审核', 1: '正常', 2: '已禁用' };
  return m[s] || '未知';
}

function statusTagType(s) {
  if (s === 1) return 'success';
  if (s === 0) return 'warning';
  return 'danger';
}

const status = ref('');
const keyword = ref('');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const active = ref('agents');

let reqSeq = 0;

function onStatusChange() {
  reset();
}

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
    if (status.value !== '') params.status = Number(status.value);
    if (keyword.value.trim()) params.keyword = keyword.value.trim();

    const r = await adminApi.agents(params);
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

async function auditAgent(a, targetStatus) {
  const actionMap = { 1: '通过', 2: '禁用/拒绝' };
  try {
    await showConfirmDialog({
      title: '确认操作',
      message: `确定${actionMap[targetStatus] || '修改'}这个代理？`,
    });
    await adminApi.updateAgent(a.id, { status: targetStatus });
    showSuccessToast('操作成功');
    a.status = targetStatus;
  } catch (e) {
    if (e === 'cancel') return;
  }
}
</script>

<style scoped>
.madmin-agents {
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
.agent-list {
  padding: 8px 12px;
}
.agent-card {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  padding: 14px;
}
.agent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.a-info {
  flex: 1;
  min-width: 0;
}
.a-mobile {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}
.a-code {
  font-size: 12px;
  color: #999;
}
.agent-stats {
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
  border-top: 1px solid #f5f5f5;
  border-bottom: 1px solid #f5f5f5;
  margin-bottom: 10px;
}
.a-stat {
  text-align: center;
}
.a-stat-num {
  font-size: 16px;
  font-weight: 600;
  color: #ff4b3a;
  margin-bottom: 4px;
}
.a-stat-label {
  font-size: 11px;
  color: #999;
}
.agent-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
