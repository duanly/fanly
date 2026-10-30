<template>
  <view class="page">
    <view v-if="g" class="head">
      <image :src="g.cover" class="cover" mode="aspectFill" />
      <view class="head-info">
        <view class="n">{{ g.name }}</view>
        <view v-if="g.spec" class="muted">{{ g.spec }}</view>
        <view class="muted sync">{{ syncText }}</view>
      </view>
    </view>

    <view
      v-for="(it, i) in g?.items || []"
      :key="it.platform + it.goodsId"
      class="row-card"
      :class="{ best: i === 0 }"
      @click="go(it)"
    >
      <view class="top">
        <text class="plat">{{ platName(it.platform) }}</text>
        <text v-if="i === 0" class="tag">最划算</text>
        <text v-else-if="diff(it) > 0" class="muted small">贵 ¥{{ diff(it) }}</text>
      </view>
      <view class="t">{{ it.title }}</view>
      <view class="nums">
        <view><view class="muted small">券后价</view><view class="v">¥{{ it.couponPrice }}</view></view>
        <view><view class="muted small">返利</view><view class="v rebate">−¥{{ it.rebate }}</view></view>
        <view><view class="muted small">到手价</view><view class="v final">¥{{ it.finalPrice }}</view></view>
      </view>
    </view>

    <view v-if="g" class="foot muted">
      价格为抓取时的快照，点进去以平台实时价为准。返利于确认收货并结算后到账。
    </view>
    <view v-else-if="!loading" class="empty">这个比价组不存在</view>
    <view v-if="loading" class="state">加载中…</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { platName } from '../../utils/platform.js';

const g = ref(null);
const loading = ref(true);

const syncText = computed(() => {
  const t = g.value?.syncedAt;
  if (!t) return '价格未同步';
  const min = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  if (min < 1) return '价格刚刚更新';
  if (min < 60) return `价格更新于 ${min} 分钟前`;
  return `价格更新于 ${Math.round(min / 60)} 小时前`;
});

function diff(it) {
  const best = g.value?.items?.[0]?.finalPrice ?? 0;
  return Math.round((it.finalPrice - best) * 100) / 100;
}
function go(it) {
  uni.navigateTo({ url: `/pages/goods/detail?platform=${it.platform}&goodsId=${it.goodsId}` });
}

onLoad(async (options) => {
  try {
    g.value = await api.compareDetail(options.id);
  } catch {} finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.head { display: flex; gap: 24rpx; background: #fff; padding: 28rpx 24rpx; }
.cover { width: 152rpx; height: 152rpx; border-radius: 16rpx; background: #eee; flex: none; }
.head-info { flex: 1; min-width: 0; }
.n { font-size: 32rpx; font-weight: 700; line-height: 1.4; }
.sync { font-size: 22rpx; margin-top: 12rpx; }
.row-card {
  background: #fff; margin: 20rpx 24rpx; border-radius: 24rpx;
  padding: 24rpx 28rpx; border: 2rpx solid transparent;
}
.row-card.best { border-color: $brand; }
.top { display: flex; align-items: center; gap: 16rpx; }
.plat { font-size: 28rpx; font-weight: 700; }
.tag { font-size: 20rpx; color: #fff; background: $brand; border-radius: 999rpx; padding: 4rpx 16rpx; }
.t { font-size: 24rpx; color: #646566; line-height: 1.4; margin: 12rpx 0 20rpx; }
.nums { display: flex; }
.nums > view { flex: 1; }
.v { font-size: 32rpx; font-weight: 700; margin-top: 4rpx; }
.v.rebate { color: #07c160; font-size: 30rpx; }
.v.final { color: $brand; font-size: 38rpx; }
.foot { padding: 28rpx 40rpx 48rpx; font-size: 22rpx; line-height: 1.7; }
.empty, .state { text-align: center; color: #999; font-size: 24rpx; padding: 80rpx 0; }
.muted { color: #969799; }
.small { font-size: 22rpx; }
</style>
