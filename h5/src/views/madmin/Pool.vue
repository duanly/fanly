<template>
  <div class="madmin-pool">
    <!-- 顶部 tab -->
    <van-tabs v-model:active="status" sticky offset-top="0" @change="onStatusChange">
      <van-tab title="已上架" name="1" />
      <van-tab title="待上架" name="3" />
      <van-tab title="已下架" name="0" />
    </van-tabs>

    <!-- 搜索栏 -->
    <div class="search-row">
      <van-search
        v-model="keyword"
        placeholder="按商品标题搜索"
        shape="round"
        @search="onSearch"
      />
      <van-button size="small" type="default" plain @click="toggleBatch">
        {{ batchMode ? '取消' : '批量' }}
      </van-button>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="batchMode" class="batch-bar">
      <van-checkbox v-model="allChecked" @change="onCheckAll">全选</van-checkbox>
      <span class="picked-count">已选 {{ pickedIds.length }} 件</span>
    </div>
    <div v-if="batchMode" class="batch-actions">
      <van-button
        size="small"
        type="success"
        :disabled="!pickedIds.length"
        @click="batchOnShelf"
      >批量上架</van-button>
      <van-button
        size="small"
        type="success"
        :disabled="!pickedIds.length"
        @click="openBatchTagShelf"
      >带标签上架</van-button>
      <van-button
        size="small"
        type="warning"
        :disabled="!pickedIds.length"
        @click="batchOffShelf"
      >批量下架</van-button>
      <van-button
        size="small"
        type="danger"
        plain
        :disabled="!pickedIds.length"
        @click="batchRemove"
      >批量删除</van-button>
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
          :key="g.id || g.curatedId"
          class="goods-card"
          :class="{ selected: pickedIds.includes(g.id || g.curatedId) }"
          @click="batchMode ? togglePick(g) : goDetail(g)"
        >
          <div v-if="batchMode" class="check-wrap">
            <van-checkbox :model-value="pickedIds.includes(g.id || g.curatedId)" />
          </div>
          <img :src="g.image" class="g-img" />
          <div class="g-info">
            <div class="g-title">{{ g.title }}</div>
            <div class="g-meta">
              <span class="g-platform">{{ platName(g.platform) }}</span>
              <span v-if="g.sales" class="g-sales">销量 {{ g.sales }}</span>
              <span class="g-status" :class="statusClass(g.status)">
                {{ statusName(g.status) }}
              </span>
            </div>
            <div v-if="getGoodsTopics(g).length" class="g-tags">
              <span
                v-for="t in getGoodsTopics(g).slice(0, 3)"
                :key="t.id"
                class="g-tag"
              >{{ t.name }}</span>
              <span v-if="getGoodsTopics(g).length > 3" class="g-tag more">
                +{{ getGoodsTopics(g).length - 3 }}
              </span>
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
          <div v-if="!batchMode" class="g-actions">
            <van-button
              v-if="g.status !== 1"
              size="mini"
              type="primary"
              @click.stop="onShelf(g)"
            >上架</van-button>
            <van-button
              v-if="g.status !== 1"
              size="mini"
              type="success"
              plain
              @click.stop="openTagForShelf([g])"
            >带标签上架</van-button>
            <van-button
              v-if="g.status === 1"
              size="mini"
              type="warning"
              plain
              @click.stop="offShelf(g)"
            >下架</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/search" icon="search">找商品</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/tags" icon="label-o">标签</van-tabbar-item>
    </van-tabbar>

    <!-- 上架选标签弹窗 -->
    <van-popup
      v-model:show="tagShelfShow"
      position="bottom"
      :style="{ height: '70%' }"
      round
    >
      <div class="picker-header">
        <span class="picker-title">选择标签后上架</span>
        <van-icon name="cross" size="20" @click="tagShelfShow = false" />
      </div>
      <van-tabs v-model:active="shelfTagType">
        <van-tab title="全部" name="" />
        <van-tab title="品类" name="category" />
        <van-tab title="品牌" name="brand" />
        <van-tab title="活动" name="activity" />
      </van-tabs>
      <div class="picker-search">
        <van-search v-model="shelfTagKw" placeholder="搜索标签" shape="round" />
      </div>
      <div class="picker-list">
        <div
          v-for="t in filteredShelfTags"
          :key="t.id"
          class="picker-item"
          :class="{ picked: shelfPickedTopicIds.includes(t.id) }"
          @click="toggleShelfTopic(t)"
        >
          <span class="pi-ico">{{ t.icon || '🏷️' }}</span>
          <span class="pi-name">{{ t.name }}</span>
          <van-icon v-if="shelfPickedTopicIds.includes(t.id)" name="success" color="#07c160" />
        </div>
      </div>
      <div class="picker-footer">
        <van-button type="primary" block :loading="shelfTagLoading" @click="confirmShelfWithTags">
          确认上架（{{ shelfGoodsIds.length }} 件）
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showConfirmDialog, showSuccessToast } from 'vant';
import { adminApi } from '../../api';

const route = useRoute();
const router = useRouter();

function platName(p) {
  const m = { PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' };
  return m[p] || p;
}
function statusName(s) {
  const m = { 1: '已上架', 0: '人工下架', 2: '自动下架', 3: '待上架' };
  return m[s] || '未知';
}
function statusClass(s) {
  return {
    's-1': s === 1,
    's-3': s === 3,
    's-0': s === 0 || s === 2,
  };
}

const status = ref(route.query.status ? String(route.query.status) : '1');
const keyword = ref('');
const list = ref([]);
const topicMap = ref({}); // { topicId: topicObj }
const goodsTopicMap = ref({}); // { curatedId: [topicId, ...] }
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const batchMode = ref(false);
const pickedIds = ref([]);
const allChecked = ref(false);
const active = ref('pool');

let reqSeq = 0;

function onStatusChange() {
  reset();
}

async function loadAllTopics() {
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

function getGoodsTopics(g) {
  const id = g.id || g.curatedId;
  const tids = goodsTopicMap.value[id] || [];
  return tids.map((tid) => topicMap.value[tid]).filter(Boolean);
}

function onSearch() {
  reset();
}

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  pickedIds.value = [];
  allChecked.value = false;
}

async function onLoad() {
  const seq = ++reqSeq;
  try {
    const r = await adminApi.curationList({
      status: Number(status.value),
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize,
    });
    if (seq !== reqSeq) return;
    const rows = r.list || r || [];
    list.value = list.value.concat(rows);

    // 批量获取这些商品的标签
    if (rows.length) {
      const ids = rows.map((g) => g.id || g.curatedId);
      try {
        const gtMap = await adminApi.goodsTopicsBatch(ids);
        Object.assign(goodsTopicMap.value, gtMap || {});
      } catch {
        // 标签加载失败不影响列表
      }
    }

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

function toggleBatch() {
  batchMode.value = !batchMode.value;
  if (!batchMode.value) {
    pickedIds.value = [];
    allChecked.value = false;
  }
}

function togglePick(g) {
  const id = g.id || g.curatedId;
  const idx = pickedIds.value.indexOf(id);
  if (idx >= 0) {
    pickedIds.value.splice(idx, 1);
  } else {
    pickedIds.value.push(id);
  }
  allChecked.value = pickedIds.value.length === list.value.length && list.value.length > 0;
}

function onCheckAll() {
  if (allChecked.value) {
    pickedIds.value = list.value.map((g) => g.id || g.curatedId);
  } else {
    pickedIds.value = [];
  }
}

function goDetail(g) {
  sessionStorage.setItem('madmin_goods_' + (g.id || g.curatedId), JSON.stringify(g));
  router.push(`/madmin/goods/${g.id || g.curatedId}`);
}

async function onShelf(g) {
  try {
    await adminApi.curationBatchOnShelf([g.id || g.curatedId]);
    showSuccessToast('已上架');
    g.status = 1;
  } catch (e) {
    // 错误已 toast
  }
}

async function offShelf(g) {
  try {
    await showConfirmDialog({
      title: '下架商品',
      message: `确定下架「${g.title.slice(0, 20)}...」吗？`,
    });
    await adminApi.curationUpdate(g.id || g.curatedId, { status: 0 });
    showSuccessToast('已下架');
    g.status = 0;
  } catch (e) {
    if (e !== 'cancel') { /* error already toasted */ }
  }
}

async function batchOnShelf() {
  if (!pickedIds.value.length) return;
  try {
    await showConfirmDialog({
      title: '批量上架',
      message: `确定上架 ${pickedIds.value.length} 件商品？`,
    });
    // 分批处理，每批 50
    const ids = [...pickedIds.value];
    let done = 0;
    for (let i = 0; i < ids.length; i += 50) {
      await adminApi.curationBatchOnShelf(ids.slice(i, i + 50));
      done += Math.min(50, ids.length - i);
    }
    showSuccessToast(`已上架 ${done} 件`);
    reset();
  } catch (e) {
    if (e !== 'cancel') throw e;
  }
}

async function batchOffShelf() {
  if (!pickedIds.value.length) return;
  try {
    await showConfirmDialog({
      title: '批量下架',
      message: `确定下架 ${pickedIds.value.length} 件商品？`,
    });
    const ids = [...pickedIds.value];
    // 下架是逐个更新的，分批 50
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      // 用 batch-remove 的逻辑不对——下架是 status=0 不是删除
      // 逐个更新
      await Promise.all(chunk.map((id) => adminApi.curationUpdate(id, { status: 0 })));
    }
    showSuccessToast('操作完成');
    reset();
  } catch (e) {
    if (e !== 'cancel') throw e;
  }
}

async function batchRemove() {
  if (!pickedIds.value.length) return;
  try {
    await showConfirmDialog({
      title: '批量删除',
      message: `确定从选品池删除 ${pickedIds.value.length} 件商品？此操作不可恢复。`,
      confirmButtonText: '删除',
      confirmButtonColor: '#ee0a24',
    });
    const ids = [...pickedIds.value];
    for (let i = 0; i < ids.length; i += 50) {
      await adminApi.curationBatchRemove(ids.slice(i, i + 50));
    }
    showSuccessToast('已删除');
    reset();
  } catch (e) {
    if (e !== 'cancel') throw e;
  }
}

// ───────── 带标签上架 ─────────
const tagShelfShow = ref(false);
const shelfTagType = ref('');
const shelfTagKw = ref('');
const shelfPickedTopicIds = ref([]);
const shelfGoodsIds = ref([]);
const shelfTagLoading = ref(false);

const filteredShelfTags = computed(() => {
  let all = Object.values(topicMap.value);
  if (shelfTagType.value) {
    all = all.filter((t) => t.type === shelfTagType.value);
  }
  if (shelfTagKw.value.trim()) {
    const kw = shelfTagKw.value.trim().toLowerCase();
    all = all.filter((t) => t.name.toLowerCase().includes(kw));
  }
  return all;
});

function openTagForShelf(goodsArr) {
  shelfGoodsIds.value = goodsArr.map((g) => g.id || g.curatedId);
  // 预填充已有标签（取并集）
  const existing = new Set();
  goodsArr.forEach((g) => {
    const tids = goodsTopicMap.value[g.id || g.curatedId] || [];
    tids.forEach((t) => existing.add(t));
  });
  shelfPickedTopicIds.value = [...existing];
  shelfTagType.value = '';
  shelfTagKw.value = '';
  tagShelfShow.value = true;
}

function openBatchTagShelf() {
  const goods = list.value.filter((g) => pickedIds.value.includes(g.id || g.curatedId));
  if (!goods.length) {
    showToast('请先勾选商品');
    return;
  }
  openTagForShelf(goods);
}

function toggleShelfTopic(t) {
  const idx = shelfPickedTopicIds.value.indexOf(t.id);
  if (idx >= 0) {
    shelfPickedTopicIds.value.splice(idx, 1);
  } else {
    shelfPickedTopicIds.value.push(t.id);
  }
}

async function confirmShelfWithTags() {
  if (!shelfGoodsIds.value.length) return;
  shelfTagLoading.value = true;
  try {
    const ids = [...shelfGoodsIds.value];
    // 1. 批量上架（每批 50）
    for (let i = 0; i < ids.length; i += 50) {
      await adminApi.curationBatchOnShelf(ids.slice(i, i + 50));
    }
    // 2. 批量打标签（每个标签下每批 50）
    if (shelfPickedTopicIds.value.length) {
      for (const tid of shelfPickedTopicIds.value) {
        for (let i = 0; i < ids.length; i += 50) {
          await adminApi.topicTagMany(tid, ids.slice(i, i + 50));
        }
      }
    }
    showSuccessToast(
      `上架 ${ids.length} 件${shelfPickedTopicIds.value.length ? `，打了 ${shelfPickedTopicIds.value.length} 个标签` : ''}`,
    );
    tagShelfShow.value = false;
    reset();
  } finally {
    shelfTagLoading.value = false;
  }
}

onMounted(async () => {
  await loadAllTopics();
  reset();
});
watch(status, reset);
</script>

<style scoped>
.madmin-pool {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 60px;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.search-row :deep(.van-search) {
  flex: 1;
  padding: 0;
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
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #eee;
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
.g-status {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
}
.g-status.s-1 { background: #e8f5e9; color: #4caf50; }
.g-status.s-3 { background: #fff3e0; color: #ff9800; }
.g-status.s-0 { background: #f5f5f5; color: #999; }
.g-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.g-tag {
  font-size: 10px;
  padding: 1px 5px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 3px;
  line-height: 1.4;
}
.g-tag.more {
  background: #f5f5f5;
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
.g-actions {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}
.picker-title {
  font-size: 16px;
  font-weight: 600;
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
.picker-footer {
  padding: 12px 16px;
  border-top: 1px solid #eee;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
</style>
