<template>
  <div class="madmin-orders">
    <van-nav-bar
      title="订单管理"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <van-tabs v-model:active="status" sticky offset-top="46px" @change="onStatusChange">
      <van-tab title="全部" name="" />
      <van-tab title="已付款" name="1" />
      <van-tab title="已收货" name="2" />
      <van-tab title="已结算" name="3" />
      <van-tab title="已入账" name="5" />
      <van-tab title="已失效" name="4" />
    </van-tabs>

    <div class="search-row">
      <van-search
        v-model="keyword"
        placeholder="搜索订单号/商品"
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
      <div class="order-list">
        <div v-for="o in list" :key="o.id" class="order-card">
          <div class="order-head">
            <span class="order-platform">{{ platName(o.platform) }}</span>
            <span class="order-status" :class="'s-' + statusKey(o.orderStatus)">
              {{ statusName(o.orderStatus) }}
            </span>
          </div>
          <div class="order-body">
            <img v-if="o.goodsImg" :src="o.goodsImg" class="o-img" />
            <div class="o-info">
              <div class="o-title">{{ o.goodsTitle || o.title || '商品' }}</div>
              <div class="o-meta">
                <span>订单号: {{ o.platformOrderNo || o.id }}</span>
              </div>
              <div class="o-price-row">
                <div class="o-price">
                  <span class="label">金额</span>
                  <span class="num">¥{{ (+o.payAmount).toFixed(2) }}</span>
                </div>
                <div class="o-comm">
                  <span class="label">预估佣金</span>
                  <span class="num">¥{{ (+o.estCommission).toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="order-user">
            <div v-if="o.userId" class="ou-row">
              <van-icon name="user-o" size="12" color="#999" />
              <span class="ou-name">{{ o.userNickname || '—' }}</span>
              <span class="ou-phone">{{ o.userMobile || '' }}</span>
            </div>
            <span v-else style="color:#f56c6c;font-size:12px">未归属</span>
            <div v-if="o.agentId" class="ou-row ou-agent">
              <van-icon name="friends-o" size="12" color="#ff9800" />
              <span class="ou-agent-code">{{ o.agentCode }}</span>
              <span v-if="o.agentRealName || o.agentNickname" class="ou-agent-name">
                {{ o.agentRealName || o.agentNickname }}
              </span>
            </div>
          </div>
          <div class="order-foot">
            <span class="o-time">{{ formatTime(o.orderTime) }}</span>
            <van-button
              size="mini"
              type="primary"
              plain
              round
              @click.stop="openAssign(o)"
            >指派归属</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无订单" />

    <!-- 指派归属弹层 -->
    <van-popup
      v-model:show="showAssign"
      position="bottom"
      round
      :style="{ height: '70vh', padding: '16px 16px 0' }"
    >
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:16px;font-weight:600">指派订单归属人</div>
        <van-icon name="cross" size="20" @click="showAssign = false" />
      </div>
      <van-search
        v-model="assignKeyword"
        placeholder="搜索用户手机号/昵称/邀请码"
        shape="round"
        @search="onAssignSearch"
      />
      <div style="max-height:calc(70vh - 110px);overflow-y:auto">
        <div v-if="assignLoading" style="text-align:center;padding:20px;color:#999">
          <van-loading size="20px" /> 搜索中...
        </div>
        <div v-else-if="!assignList.length && assignSearched" style="text-align:center;padding:30px;color:#999">
          未找到用户
        </div>
        <div v-else>
          <div
            v-for="u in assignList"
            :key="u.id"
            class="assign-user-item"
            @click="doAssign(u)"
          >
            <div class="au-avatar">{{ (u.nickname || u.mobile || '用').slice(0,1) }}</div>
            <div class="au-info">
              <div class="au-name">{{ u.nickname || '—' }}</div>
              <div class="au-mobile">{{ u.mobile || '未绑定手机' }}</div>
            </div>
            <van-icon name="arrow" size="14" color="#ccc" />
          </div>
        </div>
      </div>
    </van-popup>

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
import { showToast, showConfirmDialog } from 'vant';
import { adminApi } from '../../api';

function platName(p) {
  const m = { PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' };
  return m[p] || p || '-';
}

function statusName(s) {
  const m = {
    1: '已付款', 2: '已收货', 3: '已结算',
    4: '已失效', 5: '已入账',
  };
  return m[s] || (s || '未知');
}

function statusKey(s) {
  if (s === 1) return 'paid';
  if (s === 2) return 'received';
  if (s === 3) return 'settled';
  if (s === 4) return 'invalid';
  if (s === 5) return 'credited';
  return 'unknown';
}

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const status = ref('');
const keyword = ref('');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const active = ref('orders');

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
    if (status.value) params.status = status.value;
    if (keyword.value.trim()) params.keyword = keyword.value.trim();

    const r = await adminApi.orders(params);
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

// ---- 指派归属 ----
const showAssign = ref(false);
const currentOrder = ref(null);
const assignKeyword = ref('');
const assignList = ref([]);
const assignLoading = ref(false);
const assignSearched = ref(false);

function openAssign(o) {
  currentOrder.value = o;
  assignKeyword.value = '';
  assignList.value = [];
  assignSearched.value = false;
  showAssign.value = true;
}

async function onAssignSearch() {
  if (!assignKeyword.value.trim()) {
    assignList.value = [];
    assignSearched.value = false;
    return;
  }
  assignLoading.value = true;
  try {
    const r = await adminApi.users({ keyword: assignKeyword.value.trim(), page: 1, pageSize: 20 });
    assignList.value = r.list || r || [];
    assignSearched.value = true;
  } catch (e) {
    showToast(e.message || '搜索失败');
  } finally {
    assignLoading.value = false;
  }
}

async function doAssign(u) {
  try {
    await showConfirmDialog({
      title: '确认指派',
      message: `将订单 ${currentOrder.value.platformOrderNo} 指派给 ${u.nickname || u.mobile}？`,
    });
    await adminApi.assignOrder(currentOrder.value.id, u.id);
    showToast('指派成功');
    showAssign.value = false;
    reset();
  } catch (e) {
    if (e !== 'cancel') {
      showToast(e.message || '指派失败');
    }
  }
}
</script>

<style scoped>
.madmin-orders {
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
.order-list {
  padding: 8px 12px;
}
.order-card {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  overflow: hidden;
}
.order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}
.order-platform {
  font-weight: 500;
  color: #333;
}
.order-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}
.order-status.s-paid { background: #e3f2fd; color: #1976d2; }
.order-status.s-received { background: #fff8e1; color: #f57c00; }
.order-status.s-settled { background: #e8f5e9; color: #388e3c; }
.order-status.s-credited { background: #e8f5e9; color: #2e7d32; }
.order-status.s-invalid { background: #f5f5f5; color: #999; }
.order-status.s-refund { background: #ffebee; color: #d32f2f; }
.order-body {
  display: flex;
  gap: 10px;
  padding: 12px;
}
.o-img {
  width: 70px;
  height: 70px;
  object-fit: cover;
  border-radius: 6px;
  flex: none;
}
.o-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.o-title {
  font-size: 14px;
  color: #333;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.o-meta {
  font-size: 11px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.o-price-row {
  display: flex;
  gap: 16px;
  margin-top: auto;
}
.o-price .label, .o-comm .label {
  font-size: 11px;
  color: #999;
  margin-right: 4px;
}
.o-price .num {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}
.o-comm .num {
  font-size: 14px;
  font-weight: 600;
  color: #ff9800;
}
.order-foot {
  padding: 8px 12px;
  border-top: 1px solid #f5f5f5;
  font-size: 12px;
  color: #999;
  text-align: right;
}
.order-user {
  padding: 10px 12px;
  border-top: 1px solid #f5f5f5;
  background: #fafafa;
  border-radius: 0 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ou-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.ou-name {
  color: #333;
  font-weight: 500;
}
.ou-phone {
  color: #999;
  font-size: 11px;
}
.ou-agent .ou-agent-code {
  color: #ff9800;
  font-weight: 600;
}
.ou-agent-name {
  color: #666;
  font-size: 11px;
}

.order-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.assign-user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  border-bottom: 1px solid #f5f5f5;
}
.au-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff976a, #ff4b3a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  flex-shrink: 0;
}
.au-info {
  flex: 1;
  min-width: 0;
}
.au-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}
.au-mobile {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}
</style>
