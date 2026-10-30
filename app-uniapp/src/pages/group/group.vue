<template>
  <view class="page">
    <scroll-view class="chip-row" scroll-x>
      <view
        v-for="(pl, i) in platforms"
        :key="pl.key"
        class="chip"
        :class="{ active: platformIdx === i }"
        @click="switchPlatform(i)"
      >{{ pl.name }}</view>
    </scroll-view>

    <view v-if="list.length" class="goods-grid">
      <goods-card v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
    </view>
    <view v-else-if="!loading" class="empty">
      <view>这个专题还没选品</view>
      <view class="tip">运营在后台选品池把商品加入「{{ meta.name }}」后就会显示在这里</view>
    </view>
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="finished && list.length" class="state">没有更多了</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';
import { groupMeta } from '../../constants/groups.js';
import { PLATFORMS } from '../../utils/platform.js';

const platforms = [{ key: '', name: '全部' }, ...PLATFORMS.map((p) => ({ key: p.key, name: p.name }))];

const key = ref('default');
const meta = ref(groupMeta('default'));
const platformIdx = ref(0);
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

async function load() {
  if (loading.value || finished.value) return;
  loading.value = true;
  try {
    const r = await api.feed({
      group: key.value,
      platform: platforms[platformIdx.value].key || undefined,
      page: page.value,
      pageSize: 20,
    });
    const rows = r.list || [];
    list.value.push(...rows);
    page.value += 1;
    if (r.hasMore === false || rows.length < 20) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  load();
}
function switchPlatform(i) {
  platformIdx.value = i;
  reset();
}

onLoad((options) => {
  key.value = String(options.key || 'default');
  meta.value = groupMeta(key.value);
  uni.setNavigationBarTitle({ title: meta.value.name });
  load();
});
onReachBottom(load);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.chip-row { white-space: nowrap; background: #fff; padding: 20rpx 24rpx; }
.chip {
  display: inline-block;
  padding: 10rpx 28rpx; margin-right: 16rpx;
  font-size: 26rpx; color: #666; background: #f5f6f8; border-radius: 999rpx;
}
.chip.active { color: #fff; background: $brand; font-weight: 600; }
.goods-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; padding: 20rpx 24rpx; }
.empty { text-align: center; color: #999; font-size: 26rpx; padding: 100rpx 60rpx; }
.tip { font-size: 22rpx; margin-top: 20rpx; line-height: 1.7; }
.state { text-align: center; color: #999; font-size: 22rpx; padding: 32rpx; }
</style>
