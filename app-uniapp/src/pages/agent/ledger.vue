<template>
  <view class="page">
    <view class="filter">
      <picker :range="typeNames" @change="onType">
        <view class="picker">{{ typeNames[typeIdx] }}<text class="arrow">▾</text></view>
      </picker>
    </view>

    <view v-if="list.length" class="list">
      <view v-for="l in list" :key="l.id" class="row">
        <view class="left">
          <view class="type">{{ typeName(l.bizType) }}</view>
          <view class="time">{{ fmtTime(l.createdAt) }}<text v-if="l.remark"> · {{ l.remark }}</text></view>
        </view>
        <view class="right">
          <view class="amount" :class="{ neg: +l.amount < 0 }">
            {{ +l.amount >= 0 ? '+' : '' }}{{ money(l.amount) }}
          </view>
          <view class="bal">余额 {{ money(l.balanceAfter) }}</view>
        </view>
      </view>
    </view>
    <view v-else-if="!loading" class="empty">还没有资金记录</view>
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="finished && list.length" class="state">没有更多了</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { money, fmtTime } from '../../utils/format.js';

const NAMES = {
  REBATE: '订单返利',
  AGENT_BONUS: '团队分成',
  WITHDRAW: '提现',
  WITHDRAW_REFUND: '提现退回',
  REVERSE: '订单失效冲销',
  ADJUST: '人工调帐',
};
const typeName = (t) => NAMES[t] || t || '明细';
const typeNames = ['全部类型', ...Object.values(NAMES)];
const typeKeys = ['', ...Object.keys(NAMES)];
const typeIdx = ref(0);

const list = ref([]);
const page = ref(1);
const finished = ref(false);
const loading = ref(false);

function onType(e) {
  typeIdx.value = Number(e.detail.value);
  load(true);
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
    // bizType 在服务端筛，前端筛会让分页 total 对不上
    const bizType = typeKeys[typeIdx.value];
    const r = await api.ledger({ page: page.value, pageSize: 20, bizType: bizType || undefined });
    list.value.push(...(r.list || []));
    page.value += 1;
    if (list.value.length >= (r.total || 0)) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

onShow(() => { if (!list.value.length) load(true); });
onReachBottom(() => load());
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.filter { padding: 20rpx 24rpx; }
.picker {
  display: inline-block;
  background: #fff;
  border-radius: 999rpx;
  padding: 14rpx 32rpx;
  font-size: 26rpx;
  color: #333;
}
.arrow { color: #999; margin-left: 12rpx; }
.list { margin: 0 24rpx; background: #fff; border-radius: 24rpx; padding: 0 28rpx; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 28rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.row:last-child { border-bottom: none; }
.type { font-size: 28rpx; color: #1a1a1a; }
.time { font-size: 22rpx; color: #999; margin-top: 8rpx; }
.right { text-align: right; }
.amount { font-size: 32rpx; font-weight: 700; color: $brand; }
.amount.neg { color: #333; }
.bal { font-size: 20rpx; color: #999; margin-top: 4rpx; }
.empty { text-align: center; color: #999; font-size: 24rpx; padding: 80rpx 0; }
.state { text-align: center; color: #999; font-size: 22rpx; padding: 32rpx; }
</style>
