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
      <van-tab title="已付款" name="paid" />
      <van-tab title="已结算" name="settled" />
      <van-tab title="已失效" name="invalid" />
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
            <span class="order-status" :class="'s-' + statusKey(o.status)">
              {{ statusName(o.status) }}
            </span>
          </div>
          <div class="order-body">
            <img v-if="o.image" :src="o.image" class="o-img" />
            <div class="o-info">
              <div class="o-title">{{ o.goodsTitle || o.title || '商品' }}</div>
              <div class="o-meta">
                <span>订单号: {{ o.orderNo || o.id }}</span>
              </div>
              <div class="o-price-row">
                <div class="o-price">
                  <span class="label">金额</span>
                  <span class="num">¥{{ o.price || o.paidAmount || 0 }}</span>
                </div>
                <div class="o-comm">
                  <span class="label">返利</span>
                  <span class="num">¥{{ o.commission || 0 }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="order-foot">
            <span class="o-time">{{ formatTime(o.createdAt || o.orderTime) }}</span>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无订单" />

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
import { showToast } from 'vant';
import { adminApi } from '../../api';

function platName(p) {
  const m = { PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' };
  return m[p] || p || '-';
}

function statusName(s) {
  const m = {
    pending: '待付款', paid: '已付款', settled: '已结算',
    invalid: '已失效', refund: '已退款',
  };
  return m[s] || s || '未知';
}

function statusKey(s) {
  if (typeof s === 'number') {
    if (s === 1) return 'paid';
    if (s === 2) return 'settled';
    if (s === 0) return 'invalid';
  }
  return s || 'unknown';
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
.order-status.s-settled { background: #e8f5e9; color: #388e3c; }
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
</style>
