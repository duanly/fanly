<template>
  <view class="page">
    <!-- 顶部汇总（字段对齐后端 /fund/summary） -->
    <view class="wallet">
      <view class="w-row">
        <view class="w-item">
          <view class="w-num">{{ money(summary?.pending) }}</view>
          <view class="w-lbl">待结算佣金</view>
        </view>
        <view class="w-item">
          <view class="w-num">{{ money(summary?.totalEarned) }}</view>
          <view class="w-lbl">累计已到账</view>
        </view>
        <view class="w-item">
          <view class="w-num">{{ money(summary?.balance) }}</view>
          <view class="w-lbl">可提现</view>
        </view>
      </view>
      <view class="w-sub">
        <text>本月已到账 ¥{{ money(summary?.monthEarned) }}</text>
        <text>本月提现 ¥{{ money(summary?.monthWithdraw) }}</text>
      </view>
      <button class="withdraw-btn" @click="goWithdraw">去提现</button>
    </view>

    <view class="sec-title">资金明细</view>
    <view v-if="list.length" class="ledger">
      <view v-for="l in list" :key="l.id" class="l-row">
        <view class="l-left">
          <view class="l-type">{{ typeText(l.bizType) }}</view>
          <view class="l-time">{{ fmtTime(l.createdAt) }}<text v-if="l.remark"> · {{ l.remark }}</text></view>
        </view>
        <view class="l-right">
          <text class="l-amount" :class="{ neg: +l.amount < 0 }">
            {{ +l.amount >= 0 ? '+' : '' }}{{ money(l.amount) }}
          </text>
          <view class="l-status">余额 {{ money(l.balanceAfter) }}</view>
        </view>
      </view>
    </view>
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="!list.length" class="state">暂无明细</view>
    <view v-else-if="finished" class="state">没有更多了</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { money, fmtTime } from '../../utils/format.js';

const summary = ref(null);
const list = ref([]);
const page = ref(1);
const finished = ref(false);
const loading = ref(false);

const TYPE = {
  REBATE: '订单返利',
  AGENT_BONUS: '团队分成',
  WITHDRAW: '提现',
  WITHDRAW_REFUND: '提现退回',
  REVERSE: '订单失效冲销',
  ADJUST: '人工调帐',
};
const typeText = (t) => TYPE[t] || t || '明细';

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
    const [sum, lr] = await Promise.all([
      list.value.length ? Promise.resolve(summary.value) : api.summary(),
      api.ledger({ page: page.value, pageSize: 20 }),
    ]);
    if (!list.value.length) summary.value = sum;
    const rows = lr.list || [];
    list.value.push(...rows);
    page.value += 1;
    if (list.value.length >= (lr.total || 0)) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}
function goWithdraw() { uni.navigateTo({ url: '/pages/fund/withdraw' }); }

onShow(() => { if (!list.value.length) load(true); });
onReachBottom(() => load());
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.wallet {
  margin: 24rpx;
  padding: 48rpx 32rpx 40rpx;
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  border-radius: 28rpx;
  color: #fff;
}
.w-row { display: flex; }
.w-item { flex: 1; text-align: center; }
.w-num { font-size: 38rpx; font-weight: 800; }
.w-lbl { font-size: 22rpx; opacity: 0.85; margin-top: 8rpx; }
.w-sub { display: flex; justify-content: center; gap: 40rpx; font-size: 22rpx; opacity: .85; margin-top: 24rpx; }
.withdraw-btn {
  margin-top: 32rpx;
  height: 84rpx;
  line-height: 84rpx;
  background: #fff;
  color: $brand;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 700;
}
.withdraw-btn::after { border: none; }

.sec-title { padding: 16rpx 32rpx; font-size: 30rpx; font-weight: 700; }
.ledger { margin: 0 24rpx; background: #fff; border-radius: 24rpx; padding: 0 28rpx; }
.l-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 2rpx solid #f5f6f8;
}
.l-row:last-child { border-bottom: none; }
.l-type { font-size: 28rpx; color: #1a1a1a; }
.l-time { font-size: 22rpx; color: #999; margin-top: 6rpx; }
.l-right { text-align: right; }
.l-amount { font-size: 32rpx; font-weight: 700; color: $brand; }
.l-amount.neg { color: #333; }
.l-status { font-size: 20rpx; color: #999; margin-top: 4rpx; }
.state { text-align: center; color: #999; font-size: 24rpx; padding: 40rpx; }
</style>
