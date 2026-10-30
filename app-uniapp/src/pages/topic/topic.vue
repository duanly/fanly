<template>
  <view class="page">
    <!-- 专题头 -->
    <view class="topic-head" :style="headStyle">
      <view class="th-name">{{ topic.name }}</view>
      <view v-if="topic.intro" class="th-intro">{{ topic.intro }}</view>
      <view v-if="countdownText" class="th-countdown">⏰ {{ countdownText }}</view>
    </view>

    <!-- 规则 -->
    <view v-if="topic.description" class="desc-block" @click="descExpanded = !descExpanded">
      <view class="desc-title">
        <text>活动规则</text>
        <text class="arrow">{{ descExpanded ? '▲' : '▼' }}</text>
      </view>
      <view v-show="descExpanded" class="desc-content">{{ topic.description }}</view>
    </view>

    <!-- 排序 -->
    <view class="sort-row">
      <view
        v-for="srt in SORTS"
        :key="srt.key"
        class="sort-item"
        :class="{ on: sort === srt.key }"
        @click="switchSort(srt.key)"
      >{{ srt.name }}</view>
      <text v-if="total" class="muted count">共 {{ total }} 件</text>
    </view>

    <view v-if="list.length" class="goods-grid">
      <goods-card v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
    </view>
    <view v-else-if="!loading" class="empty">
      {{ activityEnded ? '活动已结束，看看其他专题吧' : '这个专题还在备货，换个分区看看' }}
    </view>
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="finished && list.length" class="state">没有更多了</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';

const SORTS = [
  { key: 'rebate', name: '返利最高' },
  { key: 'price', name: '价格最低' },
];

let slug = '';
const topic = ref({});
const list = ref([]);
const total = ref(0);
const page = ref(0);
const sort = ref('rebate');
const loading = ref(false);
const finished = ref(false);
const descExpanded = ref(false);
const countdownText = ref('');
let countdownTimer = null;

const headStyle = computed(() => {
  if (topic.value.cover) return { background: `center/cover no-repeat url(${topic.value.cover})` };
  return { background: topic.value.bg || 'linear-gradient(135deg,#ff8a3d,#ff5000)' };
});

const activityEnded = computed(() => {
  if (!topic.value.endAt) return false;
  return Date.now() > new Date(topic.value.endAt).getTime();
});

function updateCountdown() {
  if (!topic.value.endAt) { countdownText.value = ''; return; }
  const end = new Date(topic.value.endAt).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) {
    countdownText.value = '活动已结束';
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    return;
  }
  if (topic.value.startAt && now < new Date(topic.value.startAt).getTime()) {
    countdownText.value = '活动未开始';
    return;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  if (d > 0) countdownText.value = `距结束 ${d} 天 ${h} 小时`;
  else countdownText.value = `距结束 ${h}:${pad(m)}:${pad(s)}`;
}
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  if (!topic.value.endAt) return;
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

async function load() {
  if (loading.value || finished.value) return;
  loading.value = true;
  try {
    const r = await api.topicGoods(slug, { sort: sort.value, page: page.value + 1 });
    page.value += 1;
    topic.value = r.topic || {};
    list.value.push(...(r.list || []));
    total.value = r.total || 0;
    if (list.value.length >= total.value) finished.value = true;
    startCountdown();
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

function reset() {
  list.value = [];
  page.value = 0;
  total.value = 0;
  finished.value = false;
  load();
}
function switchSort(k) {
  if (sort.value === k) return;
  sort.value = k;
  reset();
}

onLoad((options) => {
  slug = options.slug || '';
  uni.setNavigationBarTitle({ title: '专题' });
  reset();
});
onReachBottom(load);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.topic-head { padding: 40rpx 32rpx; color: #fff; text-align: center; }
.th-name { font-size: 38rpx; font-weight: 700; }
.th-intro { font-size: 24rpx; opacity: .9; margin-top: 10rpx; }
.th-countdown {
  display: inline-block; margin-top: 20rpx;
  padding: 8rpx 20rpx; background: rgba(0, 0, 0, .25);
  border-radius: 999rpx; font-size: 24rpx;
}
.desc-block { background: #fff; margin: 16rpx 24rpx; border-radius: 20rpx; padding: 20rpx 28rpx; }
.desc-title { display: flex; justify-content: space-between; align-items: center; font-size: 26rpx; color: #666; }
.arrow { font-size: 20rpx; }
.desc-content { margin-top: 16rpx; font-size: 26rpx; line-height: 1.7; color: #333; white-space: pre-wrap; }
.sort-row { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 24rpx; }
.sort-item {
  font-size: 26rpx; color: #666;
  padding: 8rpx 24rpx; border-radius: 999rpx; background: #fff;
}
.sort-item.on { color: #fff; background: $brand; font-weight: 600; }
.count { margin-left: auto; font-size: 24rpx; }
.goods-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; padding: 0 24rpx; }
.empty, .state { text-align: center; color: #999; font-size: 24rpx; padding: 60rpx 40rpx; }
.muted { color: #999; }
</style>
