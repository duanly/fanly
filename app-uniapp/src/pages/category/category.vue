<template>
  <view class="page">
    <view class="filter">
      <!-- 全部页：平台筛选 -->
      <scroll-view v-if="isAll" class="plat-tabs" scroll-x>
        <view class="plat-tab" :class="{ active: !filterPlatform }" @click="setFilterPlatform('')">全部</view>
        <view
          v-for="pl in PLATFORMS"
          :key="pl.key"
          class="plat-tab"
          :class="{ active: filterPlatform === pl.key }"
          @click="setFilterPlatform(pl.key)"
        >{{ pl.short }}</view>
      </scroll-view>

      <!-- 排序 -->
      <view class="sort-bar">
        <view
          v-for="srt in SORTS"
          :key="srt.key"
          class="sort-item"
          :class="{ active: isSortActive(srt.key) }"
          @click="onSort(srt.key)"
        >
          <text>{{ srt.label }}</text>
        </view>
      </view>
    </view>

    <view v-if="list.length" class="goods-grid">
      <goods-card v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
    </view>
    <view v-else-if="!loading" class="empty">
      {{ isAll ? '暂无上架商品' : '该平台暂无上架商品' }}
      <view class="tip">运营正在努力选品中，敬请期待～</view>
    </view>
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="finished && list.length" class="state">— 更多好物去搜索看看 —</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';
import { PLATFORMS, platName } from '../../utils/platform.js';

const platform = ref('ALL');
const filterPlatform = ref('');
const isAll = computed(() => platform.value === 'ALL');

const SORTS = [
  { key: 'default', label: '综合' },
  { key: 'sales_desc', label: '销量' },
  { key: 'commission_desc', label: '佣金' },
  { key: 'price', label: '价格' },
];

const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);
const sort = ref('default');

function isSortActive(key) {
  if (key === 'price') return sort.value === 'price_asc' || sort.value === 'price_desc';
  return sort.value === key;
}

async function load() {
  if (loading.value || finished.value) return;
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: 20 };
    const effPlatform = isAll.value ? filterPlatform.value : platform.value;
    if (effPlatform) params.platform = effPlatform;
    if (sort.value !== 'default') params.sort = sort.value;
    const r = await api.feed(params);
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
function onSort(key) {
  if (key === 'price') {
    if (sort.value === 'price_desc') sort.value = 'price_asc';
    else if (sort.value === 'price_asc') sort.value = 'default';
    else sort.value = 'price_desc';
  } else {
    sort.value = sort.value === key ? 'default' : key;
  }
  reset();
}
function setFilterPlatform(p) {
  if (filterPlatform.value === p) return;
  filterPlatform.value = p;
  reset();
}

onLoad((options) => {
  platform.value = String(options.platform || 'ALL').toUpperCase();
  uni.setNavigationBarTitle({
    title: options.platform ? platName(platform.value) : '全部好物',
  });
  load();
});
onReachBottom(load);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.filter { background: #fff; }
.plat-tabs { white-space: nowrap; padding: 20rpx 24rpx 8rpx; }
.plat-tab {
  display: inline-block;
  padding: 10rpx 28rpx; margin-right: 16rpx;
  font-size: 26rpx; color: #666; background: #f5f6f8; border-radius: 999rpx;
}
.plat-tab.active { color: #fff; background: $brand; font-weight: 600; }
.sort-bar { display: flex; border-bottom: 2rpx solid #f2f2f2; }
.sort-item { flex: 1; text-align: center; height: 80rpx; line-height: 80rpx; font-size: 26rpx; color: #666; }
.sort-item.active { color: $brand; font-weight: 600; }
.goods-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; padding: 20rpx 24rpx; }
.empty { text-align: center; color: #999; font-size: 26rpx; padding: 100rpx 60rpx; }
.tip { font-size: 22rpx; margin-top: 20rpx; }
.state { text-align: center; color: #999; font-size: 22rpx; padding: 32rpx; }
</style>
