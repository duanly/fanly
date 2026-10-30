<template>
  <view class="page">
    <view class="cmp-head">
      <view class="search-box">
        <text class="s-ico">🔍</text>
        <input v-model="keyword" class="s-input" placeholder="搜商品，有同款会一起比价" confirm-type="search" @confirm="doSearch" />
        <text class="s-btn" @click="doSearch">搜索</text>
      </view>
    </view>

    <scroll-view class="chip-row" scroll-x>
      <view
        v-for="c in cats"
        :key="c.key"
        class="chip"
        :class="{ active: cat === c.key }"
        @click="switchCat(c.key)"
      >
        {{ c.name }}<text v-if="c.total" class="n">{{ c.total }}</text>
      </view>
    </scroll-view>

    <view class="cmp-intro">
      比的是<text class="hl">到手价</text>（券后价 − 返利），不是券后价。各平台佣金不一样，经常券后便宜的那家反而更贵。
    </view>

    <template v-if="searched && groups.length">
      <view class="sec-title">找到 {{ groups.length }} 组可比价</view>
    </template>

    <view v-for="g in groups" :key="g.id" class="cmp-card" @click="goDetail(g.id)">
      <image :src="g.cover" class="cover" mode="aspectFill" />
      <view class="body">
        <view class="n">{{ g.name }}</view>
        <view v-if="g.spec" class="muted sp">{{ g.spec }}</view>
        <view class="plats">
          <text v-for="pl in g.platforms" :key="pl" class="pt">{{ platName(pl) }}</text>
        </view>
        <view class="row">
          <view>
            <text class="muted small">最低到手 </text>
            <text class="price">¥{{ g.best?.finalPrice }}</text>
            <text class="muted small"> · {{ platName(g.best?.platform) }}</text>
          </view>
          <text v-if="g.maxSave > 0" class="save">省 ¥{{ g.maxSave }}</text>
        </view>
      </view>
    </view>

    <template v-if="searched && goods.length">
      <view class="sec-title">全网商品 <text class="muted fw-normal">· 按到手返利排</text></view>
      <view class="goods-grid">
        <goods-card v-for="g in goods" :key="g.platform + g.goodsId" :g="g" />
      </view>
    </template>

    <view v-if="!loading && !groups.length && !goods.length" class="empty">
      {{ searched ? '没搜到，换个词试试' : '这个品类还没有比价商品' }}
    </view>
    <view v-if="loading" class="state">加载中…</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';
import { CATEGORIES } from '../../constants/groups.js';
import { platName } from '../../utils/platform.js';

const keyword = ref('');
const cat = ref('');
const cats = ref([{ key: '', name: '全部' }]);
const groups = ref([]);
const goods = ref([]);
const loading = ref(false);
const searched = ref(false);

async function loadCats() {
  try {
    const rows = await api.compareCategories();
    const stat = Object.fromEntries(rows.map((r) => [r.key, r.total]));
    const used = CATEGORIES.filter((c) => stat[c.key]);
    cats.value = [{ key: '', name: '全部' }, ...used.map((c) => ({ ...c, total: stat[c.key] }))];
  } catch {}
}

async function loadList() {
  loading.value = true;
  searched.value = false;
  goods.value = [];
  try {
    groups.value = await api.compareList({ group: cat.value || undefined, limit: 30 });
  } catch {
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function switchCat(k) {
  cat.value = k;
  keyword.value = '';
  loadList();
}

async function doSearch() {
  const k = keyword.value.trim();
  if (!k) return loadList();
  loading.value = true;
  searched.value = true;
  try {
    const [g, s] = await Promise.all([
      api.compareSearch(k).catch(() => []),
      api.search({ platform: 'ALL', keyword: k, pageSize: 20 }).catch(() => ({ list: [] })),
    ]);
    groups.value = g || [];
    goods.value = s.list || [];
  } finally {
    loading.value = false;
  }
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/compare/detail?id=${id}` });
}

onShow(() => {
  loadCats();
  if (!groups.value.length) loadList();
});
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.cmp-head { background: #fff; padding: 20rpx 24rpx; }
.search-box { display: flex; align-items: center; gap: 12rpx; background: #f7f8fa; border-radius: 999rpx; padding: 0 28rpx; height: 72rpx; }
.s-ico { font-size: 28rpx; }
.s-input { flex: 1; font-size: 26rpx; }
.s-btn { color: $brand; font-size: 28rpx; font-weight: 600; flex-shrink: 0; }
.chip-row { white-space: nowrap; background: #fff; padding: 12rpx 24rpx; }
.chip {
  display: inline-block;
  padding: 10rpx 28rpx; margin-right: 16rpx;
  font-size: 26rpx; color: #666; background: #f5f6f8; border-radius: 999rpx;
}
.chip.active { color: #fff; background: $brand; font-weight: 600; }
.chip .n { margin-left: 8rpx; opacity: .6; font-size: 22rpx; }
.cmp-intro {
  margin: 20rpx 24rpx 0; padding: 20rpx 24rpx;
  background: #fff7f5; border-radius: 16rpx;
  color: #a8613f; font-size: 24rpx; line-height: 1.6;
}
.hl { color: $brand; }
.sec-title { padding: 32rpx 28rpx 8rpx; font-size: 30rpx; font-weight: 700; }
.fw-normal { font-weight: 400; }
.cmp-card { display: flex; gap: 20rpx; background: #fff; margin: 20rpx 24rpx; border-radius: 24rpx; padding: 24rpx; }
.cover { width: 172rpx; height: 172rpx; flex: none; border-radius: 16rpx; background: #eee; }
.body { flex: 1; min-width: 0; }
.n { font-size: 28rpx; font-weight: 600; line-height: 1.4; }
.sp { font-size: 22rpx; margin-top: 4rpx; }
.plats { display: flex; gap: 10rpx; margin: 12rpx 0; flex-wrap: wrap; }
.pt { font-size: 20rpx; color: #969799; border: 2rpx solid #ebedf0; border-radius: 8rpx; padding: 2rpx 10rpx; }
.row { display: flex; align-items: baseline; justify-content: space-between; margin-top: 8rpx; }
.small { font-size: 22rpx; }
.price { font-size: 36rpx; font-weight: 800; color: #1a1a1a; }
.save { font-size: 22rpx; color: #fff; background: $brand; border-radius: 999rpx; padding: 4rpx 16rpx; white-space: nowrap; }
.goods-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; padding: 8rpx 24rpx; }
.empty, .state { text-align: center; color: #999; font-size: 24rpx; padding: 80rpx 40rpx; }
.muted { color: #969799; }
</style>
