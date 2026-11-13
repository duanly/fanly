<template>
  <view class="page">
    <view v-for="w in list" :key="w.id" class="wd-card">
      <view class="wd-top">
        <view>
          <view class="wd-amount">¥{{ money(w.amount) }}</view>
          <view class="muted">
            {{ channelName(w.channel) }}
            <text v-if="w.fee > 0"> · 手续费 ¥{{ money(w.fee) }}，到手 ¥{{ money(w.received) }}</text>
          </view>
        </view>
        <text class="wd-status" :style="{ color: STATUS[w.status]?.color || '#999' }">
          {{ STATUS[w.status]?.text || '—' }}
        </text>
      </view>

      <!-- 被驳回/失败时把原因摆出来，不然用户一定来问 -->
      <view v-if="w.failReason" class="wd-reason">{{ w.failReason }}</view>

      <view class="wd-foot muted">
        <text>{{ fmtTime(w.createdAt) }}</text>
        <text v-if="w.channelOrderNo">流水号 {{ w.channelOrderNo }}</text>
      </view>
    </view>

    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="finished && !list.length" class="empty">
      <text class="empty-ico">💸</text>
      <view class="empty-text">还没有提现记录</view>
      <button class="empty-btn" @click="goWithdraw">去提现</button>
    </view>
    <view v-else-if="finished" class="state">没有更多了</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { money, fmtTime } from '../../utils/format.js';

// 对应后端 WithdrawStatus（与 H5 Withdraws.vue 一致）
const STATUS = {
  1: { text: '审核中', color: '#ff976a' },
  2: { text: '审核通过', color: '#1989fa' },
  3: { text: '打款中', color: '#1989fa' },
  4: { text: '已到账', color: '#07c160' },
  5: { text: '打款失败', color: '#ee0a24' },
  6: { text: '已驳回', color: '#969799' },
};
const channelName = (c) => ({ WECHAT: '微信', ALIPAY: '支付宝' }[c] || c);

const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

async function load() {
  if (loading.value || finished.value) return;
  loading.value = true;
  try {
    const r = await api.withdraws({ page: page.value, pageSize: 20 });
    list.value.push(...(r.list || []));
    page.value += 1;
    if (list.value.length >= (r.total || 0)) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

function goWithdraw() {
  uni.navigateTo({ url: '/pages/fund/withdraw' });
}

onShow(() => { if (!list.value.length) load(); });
onReachBottom(() => load());
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding: 20rpx 0 40rpx; }
.wd-card {
  background: #fff;
  margin: 20rpx 24rpx;
  border-radius: 24rpx;
  padding: 28rpx;
}
.wd-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.wd-amount { font-size: 38rpx; font-weight: 700; color: #1a1a1a; }
.muted { color: #999; font-size: 24rpx; margin-top: 8rpx; }
.wd-status { font-size: 26rpx; font-weight: 600; }
.wd-reason {
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background: #fff7f5;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #ee0a24;
  line-height: 1.5;
}
.wd-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 16rpx;
  font-size: 22rpx;
}
.state { text-align: center; color: #999; font-size: 24rpx; padding: 40rpx; }
.empty { text-align: center; padding: 120rpx 0 60rpx; }
.empty-ico { font-size: 96rpx; }
.empty-text { color: #999; font-size: 26rpx; margin-top: 20rpx; }
.empty-btn {
  margin-top: 32rpx;
  width: 320rpx;
  height: 80rpx;
  line-height: 80rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 28rpx;
}
.empty-btn::after { border: none; }
</style>
