<template>
  <div class="madmin-search">
    <!-- 顶部搜索栏 -->
    <div class="search-bar">
      <van-search
        v-model="keyword"
        placeholder="输入关键词搜索商品"
        @search="onSearch"
      />
    </div>

    <!-- 平台 + 渠道 + 排序 -->
    <div class="filter-section">
      <div class="platforms">
        <span
          v-for="p in platforms"
          :key="p.key"
          class="p-chip"
          :class="{ active: platform === p.key }"
          @click="switchPlatform(p.key)"
        >{{ p.name }}</span>
      </div>
      <van-dropdown-menu>
        <van-dropdown-item v-model="channel" :options="channelOptions" @change="onChannelChange" />
        <van-dropdown-item v-model="sort" :options="sortOptions" @change="onSortChange" />
      </van-dropdown-menu>
    </div>

    <!-- 批量模式操作栏 -->
    <div v-if="batchMode" class="batch-bar">
      <van-checkbox v-model="allChecked" @change="onCheckAll">全选</van-checkbox>
      <span class="picked-count">已选 {{ picked.length }} 件</span>
      <div class="batch-actions">
        <van-button size="small" type="warning" plain @click="batchAdd(3)">加入待上架</van-button>
        <van-button size="small" type="primary" @click="batchAdd(1)">直接上架</van-button>
      </div>
    </div>

    <!-- 商品列表 -->
    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <div class="goods-list">
        <div
          v-for="g in list"
          :key="g.goodsId || g.id"
          class="goods-card"
          :class="{ selected: isPicked(g) }"
          @click="batchMode ? togglePick(g) : showActionSheet(g)"
        >
          <div v-if="batchMode" class="check-wrap">
            <van-checkbox :model-value="isPicked(g)" />
          </div>
          <img :src="g.image" class="g-img" />
          <div class="g-info">
            <div class="g-title">{{ g.title }}</div>
            <div class="g-meta">
              <span class="g-platform">{{ platName(g.platform) }}</span>
              <span v-if="g.sales" class="g-sales">销量 {{ g.sales }}</span>
              <span v-if="g.shop" class="g-shop">{{ g.shop }}</span>
            </div>
            <div class="g-price-row">
              <div class="g-price">
                <span class="label">券后</span>
                <span class="price">¥{{ g.couponPrice || g.price }}</span>
              </div>
              <div class="g-comm">
                <span class="label">返利</span>
                <span class="comm">¥{{ g.commission || 0 }}</span>
              </div>
            </div>
          </div>
          <div v-if="!batchMode" class="g-action">
            <van-button
              size="small"
              type="primary"
              plain
              @click.stop="showActionSheet(g)"
            >加入</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !keyword && channel === 'all' && !list.length" description="输入关键词开始搜索" />

    <!-- 右下角批量模式切换按钮 -->
    <van-fab
      v-if="!batchMode"
      icon="records"
      :offset="['16px', '76px']"
      @click="toggleBatchMode"
    />

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/search" icon="search">找商品</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/tags" icon="label-o">标签</van-tabbar-item>
    </van-tabbar>

    <!-- 单条操作面板 -->
    <van-action-sheet
      v-model:show="showAddSheet"
      :actions="addActions"
      cancel-text="取消"
      @select="onAddAction"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { showToast, showSuccessToast, showConfirmDialog } from 'vant';
import { adminApi } from '../../api';

const platforms = [
  { key: 'PDD', name: '拼多多' },
  { key: 'TB', name: '淘宝' },
  { key: 'JD', name: '京东' },
  { key: 'VIP', name: '唯品会' },
];
function platName(p) {
  const m = { PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' };
  return m[p] || p;
}

const CHANNEL_OPTIONS = {
  PDD: [
    { text: '全品类搜索', value: 'all' },
    { text: '实时收益榜', value: 'earn' },
    { text: '实时热销榜', value: 'hot' },
    { text: '9块9特卖', value: 'cheap' },
    { text: '品牌好货', value: 'pick' },
  ],
  JD: [
    { text: '全品类搜索', value: 'all' },
    { text: '食品酒水', value: 'food' },
    { text: '家庭清洁', value: 'home_clean' },
    { text: '个护美妆', value: 'beauty' },
    { text: '医药保健', value: 'health' },
    { text: '生鲜', value: 'fresh' },
    { text: '数码家电', value: 'digital' },
    { text: '家居日用', value: 'home_life' },
    { text: '时尚生活', value: 'fashion' },
  ],
  TB: [
    { text: '全品类搜索', value: 'all' },
    { text: '实时收益榜', value: 'earn' },
    { text: '实时热销榜', value: 'hot' },
    { text: '品牌好货', value: 'pick' },
  ],
  VIP: [
    { text: '全品类搜索', value: 'all' },
    { text: '出单爆款', value: 'hot' },
    { text: '佣金榜', value: 'earn' },
    { text: '价格低到高', value: 'cheap' },
  ],
};

const sortOptions = [
  { text: '按佣金', value: 'rebate' },
  { text: '按销量', value: 'sales' },
  { text: '按价格', value: 'price' },
];

const keyword = ref('');
const platform = ref('PDD');
const channel = ref('all');
const sort = ref('rebate');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const batchMode = ref(false);
const picked = ref([]);
const allChecked = ref(false);
const active = ref('search');

const showAddSheet = ref(false);
const currentGoods = ref(null);
const addActions = [
  { name: '直接上架', id: 1 },
  { name: '加入待上架', id: 3 },
];

const channelOptions = computed(() => CHANNEL_OPTIONS[platform.value] || CHANNEL_OPTIONS.PDD);

let reqSeq = 0;

function switchPlatform(p) {
  platform.value = p;
  // 切平台时，如果当前 channel 在新平台里没有，重置为 all
  const valid = channelOptions.value.some((c) => c.value === channel.value);
  if (!valid) channel.value = 'all';
  reset();
}

function onChannelChange() {
  reset();
}

function onSortChange() {
  // 排序只对搜索（keyword 或 all 关键词搜索）生效
  reset();
}

function onSearch() {
  reset();
}

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  picked.value = [];
  allChecked.value = false;
}

async function onLoad() {
  const seq = ++reqSeq;
  try {
    let r;
    const useSearch = keyword.value.trim() || channel.value === 'all';

    if (useSearch) {
      // 搜索模式：keyword 或 全品类返利搜索
      const params = {
        platform: platform.value,
        keyword: keyword.value.trim() || undefined,
        sort: sort.value,
        page: page.value,
        pageSize,
      };
      r = await adminApi.curationSearch(params);
    } else {
      // 榜单模式：按 channel 调 recommend 接口
      r = await adminApi.curationRecommend({
        platform: platform.value,
        channel: channel.value,
        page: page.value,
        pageSize,
      });
    }

    if (seq !== reqSeq) return;
    const rows = r.list || r || [];
    list.value = list.value.concat(rows);
    page.value++;
    if (rows.length < pageSize) {
      finished.value = true;
    }
  } catch (e) {
    showToast(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function toggleBatchMode() {
  batchMode.value = !batchMode.value;
  if (!batchMode.value) {
    picked.value = [];
    allChecked.value = false;
  }
}

function isPicked(g) {
  return picked.value.some((p) => p.goodsId === g.goodsId && p.platform === g.platform);
}

function togglePick(g) {
  const idx = picked.value.findIndex((p) => p.goodsId === g.goodsId && p.platform === g.platform);
  if (idx >= 0) {
    picked.value.splice(idx, 1);
  } else {
    picked.value.push(g);
  }
  allChecked.value = picked.value.length === list.value.length && list.value.length > 0;
}

function onCheckAll() {
  if (allChecked.value) {
    picked.value = [...list.value];
  } else {
    picked.value = [];
  }
}

function showActionSheet(g) {
  currentGoods.value = g;
  showAddSheet.value = true;
}

async function onAddAction(action) {
  if (!currentGoods.value) return;
  await importGoods([currentGoods.value], action.id);
  currentGoods.value = null;
}

async function batchAdd(targetStatus) {
  if (!picked.value.length) {
    showToast('请先勾选商品');
    return;
  }
  try {
    await showConfirmDialog({
      title: '批量入库',
      message: `将 ${targetStatus === 1 ? '直接上架' : '加入待上架'} ${picked.value.length} 件商品，确认？`,
    });
    await importGoods(picked.value, targetStatus);
    picked.value = [];
    allChecked.value = false;
  } catch (e) {
    if (e !== 'cancel') throw e;
  }
}

// 把商品数据导入选品池，分批处理（每批 50 条）
async function importGoods(goods, targetStatus) {
  if (!goods.length) return 0;
  let success = 0;
  let skipped = 0;
  const chunkSize = 50;

  for (let i = 0; i < goods.length; i += chunkSize) {
    const chunk = goods.slice(i, i + chunkSize);
    try {
      const r = await adminApi.curationImportWithGoods({
        platform: chunk[0].platform,
        goods: chunk,
        targetStatus,
      });
      success += r.added || 0;
      skipped += r.skipped || 0;
    } catch (e) {
      // 继续下一批
    }
  }

  showSuccessToast(
    `完成：新增 ${success} 件${skipped ? `，已存在 ${skipped} 件` : ''}`,
  );
  return success;
}
</script>

<style scoped>
.madmin-search {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 60px;
}
.search-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
}
.filter-section {
  background: #fff;
  padding: 0 12px;
  border-bottom: 1px solid #eee;
}
.platforms {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 0 4px;
}
.p-chip {
  flex: none;
  padding: 5px 14px;
  border-radius: 16px;
  background: #f5f5f5;
  font-size: 13px;
  color: #666;
}
.p-chip.active {
  background: #ff4b3a;
  color: #fff;
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff9e6;
  padding: 8px 12px;
  border-bottom: 1px solid #ffe082;
}
.picked-count {
  flex: 1;
  font-size: 13px;
  color: #666;
}
.batch-actions {
  display: flex;
  gap: 8px;
}
.goods-list {
  padding: 8px;
}
.goods-card {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  position: relative;
}
.goods-card.selected {
  background: #e3f2fd;
}
.check-wrap {
  display: flex;
  align-items: center;
  flex: none;
}
.g-img {
  width: 90px;
  height: 90px;
  object-fit: cover;
  border-radius: 8px;
  flex: none;
}
.g-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.g-title {
  font-size: 14px;
  color: #333;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.g-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: #999;
  align-items: center;
  flex-wrap: wrap;
}
.g-platform {
  padding: 1px 5px;
  background: #f5f5f5;
  border-radius: 3px;
}
.g-shop {
  color: #999;
}
.g-price-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-top: auto;
}
.g-price .label, .g-comm .label {
  font-size: 11px;
  color: #999;
  margin-right: 4px;
}
.g-price .price {
  font-size: 16px;
  font-weight: 600;
  color: #ff4b3a;
}
.g-comm .comm {
  font-size: 14px;
  font-weight: 600;
  color: #ff9800;
}
.g-action {
  flex: none;
  display: flex;
  align-items: center;
}
</style>
