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
    </div>
    <div v-if="batchMode" class="batch-actions-row">
      <van-button size="small" type="warning" plain :disabled="!picked.length" @click="batchAdd(3)">
        加入待上架
      </van-button>
      <van-button size="small" type="primary" plain :disabled="!picked.length" @click="batchAdd(1)">
        直接上架
      </van-button>
      <van-button size="small" type="success" :disabled="!picked.length" @click="openBatchTagShelf">
        带标签上架
      </van-button>
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
          v-for="g in visibleList"
          :key="g.goodsId || g.id"
          class="goods-card"
          :class="{ selected: isPicked(g) }"
          @click="onCardClick(g)"
        >
          <div v-if="batchMode" class="check-wrap" @click.stop="togglePick(g)">
            <van-checkbox :model-value="isPicked(g)" />
          </div>
          <img
            :src="g.image"
            class="g-img"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
          />
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
          <div v-if="!batchMode" class="g-actions" @click.stop>
            <van-button
              size="mini"
              type="primary"
              :loading="addingIds.has(gKey(g))"
              @click="onShelfClick(g)"
            >上架</van-button>
            <van-button
              size="mini"
              type="success"
              plain
              :loading="addingIds.has(gKey(g))"
              @click="addGoods(g, 3)"
            >待上架</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !keyword && channel === 'all' && !visibleList.length" description="输入关键词开始搜索" />

    <!-- 悬浮按钮组：批量/取消 + 返回顶部 -->
    <div class="fab-group">
      <div
        v-if="batchMode"
        class="fab-item"
        @click="toggleBatchMode"
      >
        <van-icon name="close" size="20" />
      </div>
      <div
        v-else
        class="fab-item"
        @click="toggleBatchMode"
      >
        <van-icon name="records" size="20" />
      </div>
    </div>

    <!-- 返回顶部（右侧居中，和 H5 保持一致） -->
    <div
      v-show="showBackTop"
      class="back-top-fab"
      @click="scrollToTop"
    >
      <van-icon name="arrow-up" size="18" />
    </div>

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/search" icon="search">找商品</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/tags" icon="label-o">标签</van-tabbar-item>
    </van-tabbar>

    <!-- 上架时选择标签的弹窗 -->
    <van-popup
      v-model:show="tagPickerShow"
      position="bottom"
      :style="{ height: '70%' }"
      round
    >
      <div class="picker-header">
        <div class="picker-head-left">
          <span class="picker-title">带标签上架</span>
          <span class="picker-sub">{{ pickerGoods.length }} 件 · 已选 {{ pickerTagIds.length }} 标签</span>
        </div>
        <div class="picker-head-right">
          <van-button
            type="primary"
            size="small"
            :loading="pickerLoading"
            :disabled="!pickerTagIds.length"
            @click="confirmShelfWithTags"
          >
            确认上架
          </van-button>
          <van-icon name="cross" size="20" class="picker-close" @click="tagPickerShow = false" />
        </div>
      </div>
      <van-tabs v-model:active="pickerTagType">
        <van-tab title="品类" name="category" />
        <van-tab title="活动" name="activity" />
        <van-tab title="运营" name="operation" />
        <van-tab title="品牌" name="brand" />
        <van-tab title="全部" name="" />
      </van-tabs>
      <div class="picker-search">
        <van-search v-model="pickerTagKw" placeholder="搜索标签" shape="round" />
      </div>
      <div class="picker-list">
        <div
          v-for="t in filteredPickerTags"
          :key="t.id"
          class="picker-item"
          :class="{ picked: pickerTagIds.includes(t.id) }"
          @click="togglePickerTag(t)"
        >
          <span class="pi-ico">{{ t.icon || '🏷️' }}</span>
          <span class="pi-name">{{ t.name }}</span>
          <span class="pi-count">{{ t.goodsCount || 0 }}件</span>
          <van-icon v-if="pickerTagIds.includes(t.id)" name="success" color="#07c160" />
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { showToast, showSuccessToast, showConfirmDialog } from 'vant';
import { adminApi } from '../../api';

const platforms = [
  { key: 'PDD', name: '拼多多' },
  { key: 'TB', name: '淘宝' },
  { key: 'JD', name: '京东' },
  { key: 'VIP', name: '唯品会' },
];
function platName(p) {
  return { PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' }[p] || p;
}
function gKey(g) {
  return `${g.platform}:${g.goodsId || g.id}`;
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

// 已成功加入的商品 key 集合（从列表移除的）
const removedKeys = ref(new Set());
// 正在加入中的商品 key 集合
const addingIds = ref(new Set());

// 返回顶部
const showBackTop = ref(false);
function onScroll() {
  showBackTop.value = window.scrollY > 300;
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 标签选择器
const topicMap = ref({});
const tagPickerShow = ref(false);
const pickerTagType = ref('category');
const pickerTagKw = ref('');
const pickerTagIds = ref([]);
const pickerLoading = ref(false);
const pickerGoods = ref([]); // 要上架的商品数组

const channelOptions = computed(() => CHANNEL_OPTIONS[platform.value] || CHANNEL_OPTIONS.PDD);

const visibleList = computed(() =>
  list.value.filter((g) => !removedKeys.value.has(gKey(g))),
);

const filteredPickerTags = computed(() => {
  let all = Object.values(topicMap.value);
  if (pickerTagType.value) {
    all = all.filter((t) => t.type === pickerTagType.value);
  }
  if (pickerTagKw.value.trim()) {
    const kw = pickerTagKw.value.trim().toLowerCase();
    all = all.filter((t) => (t.name || '').toLowerCase().includes(kw));
  }
  return all;
});

let reqSeq = 0;

function switchPlatform(p) {
  platform.value = p;
  const valid = channelOptions.value.some((c) => c.value === channel.value);
  if (!valid) channel.value = 'all';
  reset();
}

function onChannelChange() {
  reset();
}

function onSortChange() {
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
  removedKeys.value = new Set();
  addingIds.value = new Set();
}

async function onLoad() {
  const seq = ++reqSeq;
  try {
    let r;
    const useSearch = keyword.value.trim() || channel.value === 'all';

    if (useSearch) {
      const params = {
        platform: platform.value,
        keyword: keyword.value.trim() || undefined,
        sort: sort.value,
        page: page.value,
        pageSize,
      };
      r = await adminApi.curationSearch(params);
    } else {
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

    // 过滤掉已经在选品池中的商品（隐藏但后台仍然更新数据）
    if (rows.length) {
      filterExistingGoods(rows);
    }
  } catch (e) {
    showToast(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

// 批量检查并隐藏已在选品池中的商品
async function filterExistingGoods(goods) {
  try {
    const items = goods.map((g) => ({ platform: g.platform, goodsId: g.goodsId || g.id }));
    const existsMap = await adminApi.curationExistsBatch(items);
    if (existsMap && typeof existsMap === 'object') {
      goods.forEach((g) => {
        const key = `${g.platform}:${g.goodsId || g.id}`;
        const curatedId = existsMap[key];
        if (curatedId) {
          removedKeys.value.add(gKey(g));
        }
      });
    }
  } catch {
    // 检查失败不影响列表展示
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

function onCardClick(g) {
  if (batchMode.value) {
    togglePick(g);
  }
  // 非批量模式下点击卡片不做操作（按钮独立响应）
}

function togglePick(g) {
  const idx = picked.value.findIndex((p) => p.goodsId === g.goodsId && p.platform === g.platform);
  if (idx >= 0) {
    picked.value.splice(idx, 1);
  } else {
    picked.value.push(g);
  }
  allChecked.value = picked.value.length === visibleList.value.length && visibleList.value.length > 0;
}

function onCheckAll() {
  if (allChecked.value) {
    picked.value = [...visibleList.value];
  } else {
    picked.value = [];
  }
}

// 批量带标签上架
function openBatchTagShelf() {
  if (!picked.value.length) {
    showToast('请先勾选商品');
    return;
  }
  pickerGoods.value = [...picked.value];
  pickerTagIds.value = [];
  pickerTagType.value = 'category';
  pickerTagKw.value = '';
  tagPickerShow.value = true;
}

// 上架按钮点击：提示打标签
function onShelfClick(g) {
  if (addingIds.value.has(gKey(g))) return;
  pickerGoods.value = [g];
  pickerTagIds.value = [];
  pickerTagType.value = 'category';
  pickerTagKw.value = '';
  tagPickerShow.value = true;
}

function togglePickerTag(t) {
  const idx = pickerTagIds.value.indexOf(t.id);
  if (idx >= 0) {
    pickerTagIds.value.splice(idx, 1);
  } else {
    pickerTagIds.value.push(t.id);
  }
}

// 带标签上架确认
async function confirmShelfWithTags() {
  if (!pickerGoods.value.length) return;
  pickerLoading.value = true;
  try {
    // 标记 loading
    pickerGoods.value.forEach((g) => addingIds.value.add(gKey(g)));

    // 导入并上架
    const goods = pickerGoods.value;
    let success = 0;
    let skipped = 0;
    const chunkSize = 50;

    for (let i = 0; i < goods.length; i += chunkSize) {
      const chunk = goods.slice(i, i + chunkSize);
      try {
        const r = await adminApi.curationImportWithGoods({
          platform: chunk[0].platform,
          goods: chunk,
          targetStatus: 1, // 直接上架
        });
        success += r.added || 0;
        skipped += r.skipped || 0;
      } catch {
        // 继续下一批
      }
    }

    // 打标签
    if (pickerTagIds.value.length && success > 0) {
      // 先查出这些商品在选品池的 id
      try {
        const items = goods.map((g) => ({ platform: g.platform, goodsId: g.goodsId || g.id }));
        const existsMap = await adminApi.curationExistsBatch(items);
        for (const tid of pickerTagIds.value) {
          const curatedIds = Object.values(existsMap || {}).filter(Boolean);
          if (curatedIds.length) {
            for (let i = 0; i < curatedIds.length; i += 50) {
              await adminApi.topicTagMany(tid, curatedIds.slice(i, i + 50));
            }
          }
        }
      } catch {
        // 标签失败不影响上架结果
      }
    }

    // 从列表移除
    goods.forEach((g) => removedKeys.value.add(gKey(g)));

    showSuccessToast(
      `上架成功 ${success} 件${skipped ? `，已存在 ${skipped} 件` : ''}`,
    );
    tagPickerShow.value = false;
  } finally {
    pickerLoading.value = false;
    pickerGoods.value.forEach((g) => addingIds.value.delete(gKey(g)));
  }
}

// 直接加入待上架 / 直接上架
async function addGoods(g, targetStatus) {
  if (addingIds.value.has(gKey(g))) return;
  addingIds.value.add(gKey(g));
  try {
    const r = await adminApi.curationImportWithGoods({
      platform: g.platform,
      goods: [g],
      targetStatus,
    });
    const success = r.added || 0;
    const skipped = r.skipped || 0;
    if (success > 0) {
      showSuccessToast(targetStatus === 1 ? '已上架' : '已加入待上架');
    } else if (skipped > 0) {
      showToast('已在选品池中');
    }
  } catch {
    // 错误已 toast
  } finally {
    // 无论成功失败，都从搜索列表移除（避免重复操作）
    removedKeys.value.add(gKey(g));
    addingIds.value.delete(gKey(g));
  }
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
    const goods = picked.value;
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
      } catch {
        // 继续下一批
      }
    }

    // 从列表移除
    goods.forEach((g) => removedKeys.value.add(gKey(g)));

    showSuccessToast(
      `完成：新增 ${success} 件${skipped ? `，已存在 ${skipped} 件` : ''}`,
    );
    picked.value = [];
    allChecked.value = false;
  } catch (e) {
    if (e !== 'cancel') throw e;
  }
}

// 加载标签列表
async function loadTopics() {
  try {
    const r = await adminApi.topics();
    const all = r.list || r || [];
    const map = {};
    all.forEach((t) => { map[t.id] = t; });
    topicMap.value = map;
  } catch {
    // ignore
  }
}

onMounted(() => {
  loadTopics();
  window.addEventListener('scroll', onScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
});
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
  padding: 10px 0;
  overflow-x: auto;
}
.p-chip {
  flex: none;
  padding: 5px 14px;
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  border-radius: 16px;
}
.p-chip.active {
  color: #fff;
  background: linear-gradient(135deg, #ff4b3a, #ff6b35);
  font-weight: 500;
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
.batch-actions-row {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  background: #fff9e6;
  border-bottom: 1px solid #ffe082;
  justify-content: center;
}
.goods-list {
  padding: 8px 12px;
}
.goods-card {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
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
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  flex: none;
  background: #f5f5f5;
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
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #999;
  flex-wrap: wrap;
}
.g-platform {
  padding: 1px 5px;
  background: #f5f5f5;
  border-radius: 3px;
}
.g-price-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-top: auto;
}
.g-price .label,
.g-comm .label {
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
.g-actions {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

/* 批量模式切换按钮（右下角） */
.fab-group {
  position: fixed;
  right: 16px;
  bottom: 80px;
  z-index: 300;
}
.fab-item {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff4b3a;
}
.fab-item:active {
  transform: scale(0.95);
}

/* 返回顶部（右侧垂直居中，和 H5 一致） */
.back-top-fab {
  position: fixed;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fff;
  color: #ff4b3a;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 200;
  transition: opacity 0.2s, transform 0.2s;
}
.back-top-fab:active {
  transform: translateY(-50%) scale(0.92);
  opacity: 0.8;
}

/* 标签选择器 */
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  gap: 12px;
}
.picker-head-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.picker-title {
  font-size: 16px;
  font-weight: 600;
}
.picker-sub {
  font-size: 12px;
  color: #999;
}
.picker-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}
.picker-close {
  color: #999;
}
.picker-search {
  padding: 8px 12px;
  border-bottom: 1px solid #f5f5f5;
}
.picker-search :deep(.van-search) {
  padding: 0;
}
.picker-list {
  max-height: 40vh;
  overflow-y: auto;
}
.picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;
}
.picker-item.picked {
  background: #f0f9eb;
}
.pi-ico {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: #f5f5f5;
  flex: none;
}
.pi-name {
  flex: 1;
  font-size: 14px;
  color: #333;
}
.pi-count {
  font-size: 12px;
  color: #999;
}
</style>
