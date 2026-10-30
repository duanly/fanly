<template>
  <view class="page">
    <!-- 顶部渐变区 -->
    <view class="top-bg">
      <view class="search-box" @click="goSearch">
        <text class="search-icon">🔍</text>
        <text class="search-ph">搜隐藏优惠券 · 搜什么都返</text>
      </view>
    </view>

    <!-- 榜单 tabs -->
    <view class="tabs">
      <view
        v-for="t in tabs"
        :key="t.type"
        class="tab"
        :class="{ on: current === t.type }"
        @click="switchTab(t.type)"
      >{{ t.name }}</view>
    </view>

    <view class="grid">
      <goods-card v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
    </view>

    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="!list.length" class="state">榜单在积累中，先看看别的分区</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';

const tabs = [
  { type: 'hot', name: '🔥热销榜' },
  { type: 'rebate', name: '💰返利榜' },
  { type: 'pick', name: '⭐推荐榜' },
];

const current = ref('hot');
const list = ref([]);
const page = ref(1);
const finished = ref(false);
const loading = ref(false);

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
    const r = await api.ranking(current.value, { page: page.value, pageSize: 20 });
    const rows = r.list || [];
    list.value.push(...rows);
    if (rows.length < 20) finished.value = true;
    page.value += 1;
  } finally {
    loading.value = false;
  }
}

function switchTab(type) {
  if (current.value === type) return;
  current.value = type;
  load(true);
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/search' });
}

onReachBottom(() => load());
onShow(() => {
  if (!list.value.length) load(true);
});
</script>

<style lang="scss" scoped>
.page { padding-bottom: 40rpx; }
.top-bg {
  background: linear-gradient(180deg, #fff0ed 0%, #fff7f5 60%, #f7f8fa 100%);
  padding: 0 24rpx 20rpx;
}
.search-box {
  margin-top: calc(24rpx + var(--status-bar-height, 0rpx));
  padding-top: 24rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 28rpx;
  background: #fff;
  border-radius: 999rpx;
  box-shadow: 0 4rpx 20rpx rgba(255, 75, 58, 0.1);
}
.search-icon { font-size: 28rpx; }
.search-ph { font-size: 26rpx; color: #999; }
.tabs {
  display: flex;
  background: #f7f8fa;
  padding: 0 8rpx;
}
.tab {
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-muted;
}
.tab.on { color: $brand; font-size: 32rpx; font-weight: 800; }
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  padding: 16rpx 24rpx;
}
.state { text-align: center; color: #999; font-size: 24rpx; padding: 40rpx; }
</style>
