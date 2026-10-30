<template>
  <view class="page">
    <view v-if="!logged" class="need-login">
      <text class="nl-emoji">🧾</text>
      <text class="nl-title">登录后查看订单</text>
      <text class="nl-desc">登录后这里会显示你的每一笔返利订单及到账状态</text>
      <button class="nl-btn" @click="goLogin">立即登录</button>
    </view>

    <template v-else>
      <!-- 状态 tab -->
      <scroll-view scroll-x class="tabs" :show-scrollbar="false">
        <view
          v-for="(t, i) in tabs"
          :key="i"
          class="tab"
          :class="{ on: tab === i }"
          @click="switchTab(i)"
        >{{ t.label }}</view>
      </scroll-view>

      <view class="tip">
        <text>可返利→返利中→已到账，一般需 15~30 天</text>
        <text class="claim" @click="goClaim">买了没看到订单？去找回 ›</text>
      </view>

      <view v-for="o in list" :key="o.id" class="order">
        <image v-if="o.goodsImg" class="o-img" :src="o.goodsImg" mode="aspectFill" />
        <view v-else class="o-img o-img-ph">📦</view>
        <view class="o-main">
          <view class="o-title">{{ o.goodsTitle }}</view>
          <view class="o-meta">{{ platName(o.platform) }} · {{ fmtDate(o.orderTime) }}</view>
          <view class="o-no" @click="copyNo(o.platformOrderNo)">单号 {{ o.platformOrderNo }} ⎘</view>
          <view class="o-bottom">
            <text class="o-pay">实付 ¥{{ money(o.payAmount) }}</text>
            <view>
              <text class="o-status" :style="{ color: statusColor(o.orderStatus) }">{{ statusText(o.orderStatus) }} </text>
              <text class="o-rebate" :class="{ off: o.orderStatus === 4 }">¥{{ money(o.myRebate) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="loading" class="state">加载中…</view>
      <view v-else-if="finished && !list.length" class="state">还没有订单，去首页逛逛</view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { useUserStore } from '../../store/user.js';
import { money } from '../../utils/format.js';
import { platName } from '../../utils/platform.js';

const userStore = useUserStore();
const logged = ref(userStore.isLoggedIn);

const tabs = [
  { label: '全部', status: undefined },
  { label: '可返利', status: 1 },
  { label: '返利中', status: 2 },
  { label: '已到账', status: 5 },
  { label: '已失效', status: 4 },
];
const tab = ref(0);
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

const statusText = (s) => ({ 1: '可返利', 2: '返利中', 3: '结算中', 4: '已失效', 5: '已到账' }[s] || '');
const statusColor = (s) => ({ 1: '#ff976a', 2: '#1989fa', 4: '#c8c9cc', 5: '#07c160' }[s] || '#969799');
function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getMonth() + 1}/${x.getDate()}`;
}

async function load(reset = false) {
  if (loading.value) return;
  if (reset) {
    page.value = 1;
    finished.value = false;
    list.value = [];
  }
  if (finished.value) return;
  loading.value = true;
  try {
    const r = await api.orders({ status: tabs[tab.value].status, page: page.value, pageSize: 20 });
    const rows = r.list || [];
    list.value.push(...rows);
    page.value += 1;
    if (list.value.length >= (r.total || 0)) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

function switchTab(i) {
  if (tab.value === i) return;
  tab.value = i;
  load(true);
}

function copyNo(no) {
  uni.setClipboardData({ data: no, success: () => uni.showToast({ title: '订单号已复制', icon: 'none' }) });
}
function goLogin() { uni.navigateTo({ url: '/pages/login/login' }); }
function goClaim() { uni.navigateTo({ url: '/pages/claim/claim' }); }

onShow(() => {
  logged.value = userStore.isLoggedIn;
  if (logged.value && !list.value.length) load(true);
});
onReachBottom(() => logged.value && load());
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.need-login { padding-top: 200rpx; display: flex; flex-direction: column; align-items: center; padding-left: 60rpx; padding-right: 60rpx; }
.nl-emoji { font-size: 120rpx; }
.nl-title { font-size: 32rpx; font-weight: 700; margin-top: 24rpx; }
.nl-desc { font-size: 24rpx; color: #999; text-align: center; margin: 16rpx 0 40rpx; }
.nl-btn {
  width: 360rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 30rpx;
}
.nl-btn::after { border: none; }

.tabs {
  white-space: nowrap;
  background: #fff;
  padding: 0 16rpx;
}
.tab {
  display: inline-block;
  padding: 24rpx 28rpx;
  font-size: 28rpx;
  color: #666;
  position: relative;
}
.tab.on { color: $brand; font-weight: 800; font-size: 30rpx; }
.tab.on::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 8rpx;
  transform: translateX(-50%);
  width: 40rpx;
  height: 6rpx;
  background: $brand;
  border-radius: 3rpx;
}
.tip {
  margin: 16rpx 24rpx;
  padding: 16rpx 20rpx;
  background: #fff7e6;
  border-radius: 12rpx;
  font-size: 22rpx;
  color: #8a613f;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.claim { color: $brand; }

.order {
  background: #fff;
  margin: 16rpx 24rpx;
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  gap: 20rpx;
}
.o-img {
  width: 144rpx;
  height: 144rpx;
  border-radius: 16rpx;
  background: #f2f2f2;
  flex-shrink: 0;
}
.o-img-ph { display: flex; align-items: center; justify-content: center; font-size: 48rpx; }
.o-main { flex: 1; min-width: 0; }
.o-title { font-size: 26rpx; line-height: 1.4; color: #1a1a1a;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.o-meta { font-size: 22rpx; color: #999; margin-top: 8rpx; }
.o-no { font-size: 20rpx; color: #bbb; margin-top: 6rpx; }
.o-bottom { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12rpx; }
.o-pay { font-size: 22rpx; color: #999; }
.o-status { font-size: 22rpx; margin-right: 8rpx; }
.o-rebate { color: $brand; font-weight: 800; font-size: 28rpx; }
.o-rebate.off { text-decoration: line-through; opacity: 0.45; }
.state { text-align: center; color: #999; font-size: 24rpx; padding: 40rpx; }
</style>
