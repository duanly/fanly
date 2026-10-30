<template>
  <view class="page">
    <view class="search-bar">
      <view class="box">
        <text class="ico">🔍</text>
        <input
          v-model="kw"
          class="input"
          placeholder="搜隐藏优惠券 · 搜什么都返"
          confirm-type="search"
          @confirm="doSearch"
        />
      </view>
    </view>

    <view v-if="list.length" class="grid">
      <goods-card v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
    </view>
    <view v-else-if="searched && !loading" class="empty">没有找到相关商品</view>

    <view v-if="loading" class="state">加载中…</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';

const kw = ref('');
const list = ref([]);
const page = ref(1);
const finished = ref(false);
const loading = ref(false);
const searched = ref(false);

async function load(reset = false) {
  if (loading.value || !kw.value.trim()) return;
  if (reset) {
    page.value = 1;
    finished.value = false;
    list.value = [];
  }
  if (finished.value) return;
  loading.value = true;
  try {
    const r = await api.search({ keyword: kw.value.trim(), page: page.value, pageSize: 20 });
    const rows = r.list || [];
    list.value.push(...rows);
    page.value += 1;
    if (rows.length < 20) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

function doSearch() {
  searched.value = true;
  load(true);
}

onReachBottom(() => load());
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.search-bar { padding: 16rpx 24rpx; background: #fff; }
.box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 72rpx;
  background: #f7f8fa;
  border-radius: 999rpx;
  padding: 0 28rpx;
}
.ico { font-size: 28rpx; }
.input { flex: 1; font-size: 26rpx; }
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  padding: 20rpx 24rpx;
}
.empty, .state { text-align: center; color: #999; font-size: 24rpx; padding: 80rpx 0; }
</style>
