<template>
  <div class="madmin-pool">
    <!-- 顶部 tab -->
    <van-tabs v-model:active="activeStatus" sticky offset-top="0" @change="onTabChange">
      <van-tab title="已上架" name="1" />
      <van-tab title="待上架" name="3" />
      <van-tab title="已下架" name="0" />
    </van-tabs>

    <!-- 搜索栏 -->
    <div class="search-row">
      <van-search
        v-model="searchKw"
        placeholder="按商品标题搜索"
        shape="round"
        @search="onSearch"
        @clear="onSearch"
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
      <!-- 待上架、已下架：上架相关操作 -->
      <template v-if="activeStatus !== '1'">
        <van-button
          size="small"
          type="primary"
          :disabled="!pickedIds.length"
          @click="batchOnShelf"
        >批量上架</van-button>
        <van-button
          size="small"
          type="success"
          :disabled="!pickedIds.length"
          @click="openBatchTagShelf"
        >带标签上架</van-button>
      </template>
      <!-- 已上架：下架 / 打标签 -->
      <template v-if="activeStatus === '1'">
        <van-button
          size="small"
          type="warning"
          :disabled="!pickedIds.length"
          @click="openBatchTagEdit"
        >批量打标签</van-button>
        <van-button
          size="small"
          type="warning"
          plain
          :disabled="!pickedIds.length"
          @click="batchOffShelf"
        >批量下架</van-button>
      </template>
      <!-- 已下架：删除 -->
      <template v-if="activeStatus === '0'">
        <van-button
          size="small"
          type="danger"
          plain
          :disabled="!pickedIds.length"
          @click="batchRemove"
        >批量删除</van-button>
      </template>
    </div>

    <!-- 列表总数 -->
    <div v-if="currentTotal != null" class="list-count">
      共 {{ currentTotal }} 件 · 第 {{ currentPage }} 页
    </div>

    <!-- 已上架列表 -->
    <div v-if="activeStatus === '1'" class="list-wrap">
      <div v-if="states[1].loading" class="loading-bar">
        <van-loading size="18" /> 加载中...
      </div>
      <div class="goods-list">
        <div
          v-for="g in states[1].list"
          :key="g.id || g.curatedId"
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
              <span class="g-status" :class="statusClass(g.status)">{{ statusName(g.status) }}</span>
            </div>
            <div v-if="g._tagNames && g._tagNames.length" class="g-tags">
              <span
                v-for="(t, i) in g._tagNames.slice(0, 3)"
                :key="i"
                class="g-tag"
              >{{ t }}</span>
              <span
                v-if="g._tagNames.length > 3"
                class="g-tag more"
              >+{{ g._tagNames.length - 3 }}</span>
            </div>
            <div class="g-price-row">
              <div class="g-price">
                <span class="label">券后</span>
                <span class="price">¥{{ g.couponPrice || g.price || 0 }}</span>
              </div>
              <div class="g-comm">
                <span class="label">返利</span>
                <span class="comm">¥{{ g.commission || 0 }}</span>
              </div>
            </div>
          </div>
          <div v-if="!batchMode" class="g-actions" @click.stop>
            <van-button size="mini" type="primary" plain @click="openTagEditor(g, 'edit')">编辑标签</van-button>
            <van-button size="mini" type="warning" plain @click="offShelf(g)">下架</van-button>
          </div>
        </div>
      </div>
      <van-empty v-if="!states[1].loading && states[1].loaded && !states[1].list.length" description="暂无商品" />
      <div v-if="states[1].loaded && states[1].list.length && !states[1].finished" class="load-more-bar">
        <van-button
          block
          type="default"
          plain
          :loading="states[1].loading"
          @click="loadPage(1)"
        >加载更多</van-button>
      </div>
      <div v-if="states[1].finished && states[1].list.length" class="finished-tip">
        — 已经到底了 —
      </div>
    </div>

    <!-- 待上架列表 -->
    <div v-if="activeStatus === '3'" class="list-wrap">
      <div v-if="states[3].loading" class="loading-bar">
        <van-loading size="18" /> 加载中...
      </div>
      <div class="goods-list">
        <div
          v-for="g in states[3].list"
          :key="g.id || g.curatedId"
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
              <span class="g-status" :class="statusClass(g.status)">{{ statusName(g.status) }}</span>
            </div>
            <div v-if="g._tagNames && g._tagNames.length" class="g-tags">
              <span
                v-for="(t, i) in g._tagNames.slice(0, 3)"
                :key="i"
                class="g-tag"
              >{{ t }}</span>
              <span
                v-if="g._tagNames.length > 3"
                class="g-tag more"
              >+{{ g._tagNames.length - 3 }}</span>
            </div>
            <div class="g-price-row">
              <div class="g-price">
                <span class="label">券后</span>
                <span class="price">¥{{ g.couponPrice || g.price || 0 }}</span>
              </div>
              <div class="g-comm">
                <span class="label">返利</span>
                <span class="comm">¥{{ g.commission || 0 }}</span>
              </div>
            </div>
          </div>
          <div v-if="!batchMode" class="g-actions" @click.stop>
            <van-button size="mini" type="primary" @click="onShelf(g)">上架</van-button>
            <van-button size="mini" type="success" plain @click="openTagEditor(g, 'shelf')">带标签上架</van-button>
          </div>
        </div>
      </div>
      <van-empty v-if="!states[3].loading && states[3].loaded && !states[3].list.length" description="暂无商品" />
      <div v-if="states[3].loaded && states[3].list.length && !states[3].finished" class="load-more-bar">
        <van-button
          block
          type="default"
          plain
          :loading="states[3].loading"
          @click="loadPage(3)"
        >加载更多</van-button>
      </div>
      <div v-if="states[3].finished && states[3].list.length" class="finished-tip">
        — 已经到底了 —
      </div>
    </div>

    <!-- 已下架列表 -->
    <div v-if="activeStatus === '0'" class="list-wrap">
      <div v-if="states[0].loading" class="loading-bar">
        <van-loading size="18" /> 加载中...
      </div>
      <div class="goods-list">
        <div
          v-for="g in states[0].list"
          :key="g.id || g.curatedId"
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
              <span class="g-status" :class="statusClass(g.status)">{{ statusName(g.status) }}</span>
            </div>
            <div v-if="g._tagNames && g._tagNames.length" class="g-tags">
              <span
                v-for="(t, i) in g._tagNames.slice(0, 3)"
                :key="i"
                class="g-tag"
              >{{ t }}</span>
              <span
                v-if="g._tagNames.length > 3"
                class="g-tag more"
              >+{{ g._tagNames.length - 3 }}</span>
            </div>
            <div class="g-price-row">
              <div class="g-price">
                <span class="label">券后</span>
                <span class="price">¥{{ g.couponPrice || g.price || 0 }}</span>
              </div>
              <div class="g-comm">
                <span class="label">返利</span>
                <span class="comm">¥{{ g.commission || 0 }}</span>
              </div>
            </div>
          </div>
          <div v-if="!batchMode" class="g-actions" @click.stop>
            <van-button size="mini" type="primary" @click="onShelf(g)">上架</van-button>
            <van-button size="mini" type="success" plain @click="openTagEditor(g, 'shelf')">带标签上架</van-button>
            <van-button size="mini" type="danger" plain @click="removeGoods(g)">删除</van-button>
          </div>
        </div>
      </div>
      <van-empty v-if="!states[0].loading && states[0].loaded && !states[0].list.length" description="暂无商品" />
      <div v-if="states[0].loaded && states[0].list.length && !states[0].finished" class="load-more-bar">
        <van-button
          block
          type="default"
          plain
          :loading="states[0].loading"
          @click="loadPage(0)"
        >加载更多</van-button>
      </div>
      <div v-if="states[0].finished && states[0].list.length" class="finished-tip">
        — 已经到底了 —
      </div>
    </div>

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/agents" icon="friends-o">代理</van-tabbar-item>
      <van-tabbar-item to="/madmin/withdraws" icon="gold-coin-o">提现</van-tabbar-item>
    </van-tabbar>

    <!-- 标签编辑弹窗 -->
    <van-popup
      v-model:show="tagEditorShow"
      position="bottom"
      :style="{ height: '75%' }"
      round
    >
      <div class="picker-header">
        <span class="picker-title">{{ editorTitle }}</span>
        <van-icon name="cross" size="20" @click="tagEditorShow = false" />
      </div>
      <van-tabs v-model:active="editorTagType">
        <van-tab title="品类" name="category" />
        <van-tab title="活动" name="activity" />
        <van-tab title="运营" name="operation" />
        <van-tab title="品牌" name="brand" />
        <van-tab title="全部" name="" />
      </van-tabs>
      <div class="picker-search">
        <van-search v-model="editorTagKw" placeholder="搜索标签" shape="round" />
      </div>
      <div class="picker-list">
        <div
          v-for="t in filteredEditorTags"
          :key="t.id"
          class="picker-item"
          :class="{ picked: editorPickedIds.includes(t.id) }"
          @click="toggleEditorTopic(t)"
        >
          <span class="pi-ico">{{ t.icon || '🏷️' }}</span>
          <span class="pi-name">{{ t.name }}</span>
          <span class="pi-count">{{ t.goodsCount || 0 }}件</span>
          <van-icon v-if="editorPickedIds.includes(t.id)" name="success" color="#07c160" />
        </div>
      </div>
      <div class="picker-footer">
        <div class="editor-tip">
          已选 {{ editorPickedIds.length }} 个标签
          {{ editorMode === 'shelf' ? '（上架后将打上这些标签）' : '（将替换原有标签）' }}
        </div>
        <van-button type="primary" block :loading="editorLoading" @click="confirmTagEdit">
          确定
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast, showSuccessToast, showConfirmDialog } from 'vant';
import { adminApi } from '../../api';

// ───────── 工具函数 ─────────
function platName(p) {
  return { PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' }[p] || p || '-';
}
function statusName(s) {
  return { 1: '已上架', 0: '人工下架', 2: '自动下架', 3: '待上架' }[s] || '未知';
}
function statusClass(s) {
  return { 1: 's-1', 3: 's-3', 0: 's-0', 2: 's-0' }[s] || '';
}

// ───────── 状态 ─────────
const router = useRouter();
const route = useRoute();
const active = ref('pool');

const activeStatus = ref('1');
const searchKw = ref('');
const batchMode = ref(false);
const pickedIds = ref([]);
const allChecked = ref(false);

const pageSize = 20;

// 三个状态各自独立的列表状态
const makeState = () => ({
  list: [],
  page: 1,
  loading: false,
  finished: false,
  loaded: false,
  total: 0,
});
const states = reactive({
  1: makeState(),
  3: makeState(),
  0: makeState(),
});

const topicMap = ref({});

const currentList = computed(() => states[activeStatus.value]?.list || []);
const currentTotal = computed(() => states[activeStatus.value]?.total ?? null);
const currentPage = computed(() => (states[activeStatus.value]?.page || 1) - 1);

function isPicked(g) {
  return pickedIds.value.includes(g.id || g.curatedId);
}

function onCardClick(g) {
  if (batchMode.value) {
    togglePick(g);
  } else {
    goDetail(g);
  }
}

// ───────── 标签加载 ─────────
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

// 把标签名挂到商品对象上
function applyTagsToGoods(goodsList, tagMap) {
  const tMap = topicMap.value;
  goodsList.forEach((g) => {
    const id = g.id || g.curatedId;
    const tids = tagMap[id] || [];
    g._tagNames = tids.map((tid) => tMap[tid]?.name).filter(Boolean);
  });
}

// 批量获取商品标签（分批，延迟加载）
async function loadGoodsTopics(statusVal, ids) {
  if (!ids.length) return;
  try {
    const chunkSize = 50;
    const allMap = {};
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const gtMap = await adminApi.goodsTopicsBatch(chunk);
      if (gtMap && typeof gtMap === 'object') {
        Object.assign(allMap, gtMap);
      }
    }
    const s = states[statusVal];
    if (s && s.list.length) {
      applyTagsToGoods(s.list, allMap);
    }
  } catch {
    // 标签加载失败不影响列表
  }
}

// ───────── 列表加载 ─────────
async function loadPage(statusVal) {
  const s = states[statusVal];
  if (!s || s.loading || s.finished) return;

  s.loading = true;
  try {
    const r = await adminApi.curationList({
      status: Number(statusVal),
      keyword: searchKw.value.trim() || undefined,
      page: s.page,
      pageSize,
    });
    const rows = r?.list || r || [];
    s.list = s.list.concat(rows);
    s.total = r?.total ?? s.total;
    s.page++;
    s.loaded = true;
    if (rows.length < pageSize) {
      s.finished = true;
    }
    // 标签延迟加载，不阻塞首屏
    if (rows.length) {
      const ids = rows.map((g) => g.id || g.curatedId).filter(Boolean);
      setTimeout(() => {
        loadGoodsTopics(statusVal, ids);
      }, 300);
    }
  } catch {
    // 错误已由拦截器 toast
    s.finished = true;
  } finally {
    s.loading = false;
  }
}

function onTabChange() {
  const s = states[activeStatus.value];
  if (!s.loaded && !s.loading) {
    loadPage(activeStatus.value);
  }
  // 重置批量选择
  batchMode.value = false;
  pickedIds.value = [];
  allChecked.value = false;
}

function onSearch() {
  const s = states[activeStatus.value];
  s.list = [];
  s.page = 1;
  s.finished = false;
  s.loaded = false;
  s.total = 0;
  loadPage(activeStatus.value);
}

// ───────── 批量模式 ─────────
function toggleBatch() {
  batchMode.value = !batchMode.value;
  pickedIds.value = [];
  allChecked.value = false;
}

function togglePick(g) {
  const id = g.id || g.curatedId;
  const idx = pickedIds.value.indexOf(id);
  if (idx >= 0) {
    pickedIds.value.splice(idx, 1);
  } else {
    pickedIds.value.push(id);
  }
  allChecked.value =
    pickedIds.value.length === currentList.value.length && currentList.value.length > 0;
}

function onCheckAll() {
  if (allChecked.value) {
    pickedIds.value = currentList.value.map((g) => g.id || g.curatedId);
  } else {
    pickedIds.value = [];
  }
}

// ───────── 单条操作 ─────────
function goDetail(g) {
  const id = g.id || g.curatedId;
  sessionStorage.setItem('madmin_goods_' + id, JSON.stringify(g));
  router.push(`/madmin/goods/${id}`);
}

async function onShelf(g) {
  const id = g.id || g.curatedId;
  try {
    await adminApi.curationBatchOnShelf([id]);
    showSuccessToast('已上架');
    moveGoods(g, activeStatus.value, '1');
  } catch {
    // 错误已 toast
  }
}

async function offShelf(g) {
  try {
    await showConfirmDialog({
      title: '下架商品',
      message: `确定下架「${(g.title || '').slice(0, 20)}...」吗？`,
    });
    const id = g.id || g.curatedId;
    await adminApi.curationUpdate(id, { status: 0 });
    showSuccessToast('已下架');
    moveGoods(g, activeStatus.value, '0');
  } catch (e) {
    if (e === 'cancel') return;
  }
}

async function removeGoods(g) {
  try {
    await showConfirmDialog({
      title: '删除商品',
      message: '确定从选品池删除这个商品？此操作不可恢复。',
      confirmButtonText: '删除',
      confirmButtonColor: '#ee0a24',
    });
    const id = g.id || g.curatedId;
    await adminApi.curationRemove(id);
    showSuccessToast('已删除');
    const s = states[activeStatus.value];
    s.list = s.list.filter((x) => (x.id || x.curatedId) !== id);
    if (s.total) s.total--;
  } catch (e) {
    if (e === 'cancel') return;
  }
}

function moveGoods(g, fromStatus, toStatus) {
  const id = g.id || g.curatedId;
  const from = states[fromStatus];
  const to = states[toStatus];
  from.list = from.list.filter((x) => (x.id || x.curatedId) !== id);
  if (from.total) from.total--;
  const copy = { ...g, status: Number(toStatus) };
  if (to.loaded) {
    to.list.unshift(copy);
    to.total = (to.total || 0) + 1;
  }
}

// ───────── 批量操作 ─────────
async function batchOnShelf() {
  if (!pickedIds.value.length) return;
  try {
    await showConfirmDialog({
      title: '批量上架',
      message: `确定上架 ${pickedIds.value.length} 件商品？`,
    });
    const ids = [...pickedIds.value];
    for (let i = 0; i < ids.length; i += 50) {
      await adminApi.curationBatchOnShelf(ids.slice(i, i + 50));
    }
    showSuccessToast(`已上架 ${ids.length} 件`);
    batchMove(activeStatus.value, '1', ids);
    pickedIds.value = [];
    allChecked.value = false;
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
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      await Promise.all(chunk.map((id) => adminApi.curationUpdate(id, { status: 0 })));
    }
    showSuccessToast('操作完成');
    batchMove(activeStatus.value, '0', ids);
    pickedIds.value = [];
    allChecked.value = false;
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
    const s = states[activeStatus.value];
    const idSet = new Set(ids);
    s.list = s.list.filter((g) => !idSet.has(g.id || g.curatedId));
    if (s.total) s.total -= ids.length;
    pickedIds.value = [];
    allChecked.value = false;
  } catch (e) {
    if (e !== 'cancel') throw e;
  }
}

function batchMove(fromStatus, toStatus, ids, tagNames) {
  const from = states[fromStatus];
  const to = states[toStatus];
  const idSet = new Set(ids);
  const moved = from.list.filter((g) => idSet.has(g.id || g.curatedId));
  from.list = from.list.filter((g) => !idSet.has(g.id || g.curatedId));
  if (from.total) from.total -= ids.length;
  if (to.loaded) {
    moved.forEach((g) => {
      g.status = Number(toStatus);
      if (tagNames) g._tagNames = [...tagNames];
    });
    to.list = [...moved, ...to.list];
    to.total = (to.total || 0) + ids.length;
  }
}

// ───────── 标签编辑弹窗 ─────────
const tagEditorShow = ref(false);
const editorTagType = ref('category');
const editorTagKw = ref('');
const editorPickedIds = ref([]);
const editorLoading = ref(false);
let editorMode = 'edit';
let editorGoods = [];

const editorTitle = computed(() => {
  if (editorMode === 'shelf') {
    return `带标签上架（${editorGoods.length} 件）`;
  }
  return editorGoods.length > 1
    ? `批量打标签（${editorGoods.length} 件）`
    : '编辑标签';
});

const filteredEditorTags = computed(() => {
  let all = Object.values(topicMap.value);
  if (editorTagType.value) {
    all = all.filter((t) => t.type === editorTagType.value);
  }
  if (editorTagKw.value.trim()) {
    const kw = editorTagKw.value.trim().toLowerCase();
    all = all.filter((t) => (t.name || '').toLowerCase().includes(kw));
  }
  return all;
});

function openTagEditor(g, mode) {
  editorMode = mode || 'edit';
  editorGoods = [g];
  const tagNames = g._tagNames || [];
  const nameToId = {};
  Object.values(topicMap.value).forEach((t) => { nameToId[t.name] = t.id; });
  editorPickedIds.value = tagNames.map((n) => nameToId[n]).filter(Boolean);
  editorTagType.value = 'category';
  editorTagKw.value = '';
  tagEditorShow.value = true;
}

function openBatchTagEdit() {
  if (!pickedIds.value.length) {
    showToast('请先勾选商品');
    return;
  }
  editorMode = 'edit';
  const currentGoods = currentList.value.filter((g) =>
    pickedIds.value.includes(g.id || g.curatedId),
  );
  editorGoods = currentGoods;
  if (currentGoods.length === 1) {
    const tagNames = currentGoods[0]._tagNames || [];
    const nameToId = {};
    Object.values(topicMap.value).forEach((t) => { nameToId[t.name] = t.id; });
    editorPickedIds.value = tagNames.map((n) => nameToId[n]).filter(Boolean);
  } else {
    editorPickedIds.value = [];
  }
  editorTagType.value = 'category';
  editorTagKw.value = '';
  tagEditorShow.value = true;
}

function openBatchTagShelf() {
  if (!pickedIds.value.length) {
    showToast('请先勾选商品');
    return;
  }
  editorMode = 'shelf';
  const currentGoods = currentList.value.filter((g) =>
    pickedIds.value.includes(g.id || g.curatedId),
  );
  editorGoods = currentGoods;
  editorPickedIds.value = [];
  editorTagType.value = 'category';
  editorTagKw.value = '';
  tagEditorShow.value = true;
}

function toggleEditorTopic(t) {
  const idx = editorPickedIds.value.indexOf(t.id);
  if (idx >= 0) {
    editorPickedIds.value.splice(idx, 1);
  } else {
    editorPickedIds.value.push(t.id);
  }
}

async function confirmTagEdit() {
  if (!editorGoods.length) return;
  editorLoading.value = true;
  try {
    const ids = editorGoods.map((g) => g.id || g.curatedId);
    const tMap = topicMap.value;
    const pickedNames = editorPickedIds.value.map((id) => tMap[id]?.name).filter(Boolean);

    if (editorMode === 'shelf') {
      for (let i = 0; i < ids.length; i += 50) {
        await adminApi.curationBatchOnShelf(ids.slice(i, i + 50));
      }
      if (editorPickedIds.value.length) {
        for (const tid of editorPickedIds.value) {
          for (let i = 0; i < ids.length; i += 50) {
            await adminApi.topicTagMany(tid, ids.slice(i, i + 50));
          }
        }
      }
      showSuccessToast(
        `上架 ${ids.length} 件${
          editorPickedIds.value.length ? `，打了 ${editorPickedIds.value.length} 个标签` : ''
        }`,
      );
      batchMove(activeStatus.value, '1', ids, pickedNames);
    } else {
      for (const id of ids) {
        await adminApi.setGoodsTopics(id, editorPickedIds.value);
      }
      const idSet = new Set(ids);
      const s = states[activeStatus.value];
      s.list.forEach((g) => {
        if (idSet.has(g.id || g.curatedId)) {
          g._tagNames = [...pickedNames];
        }
      });
      showSuccessToast(`已更新 ${ids.length} 件商品的标签`);
    }

    tagEditorShow.value = false;
    pickedIds.value = [];
    allChecked.value = false;
  } finally {
    editorLoading.value = false;
  }
}

// ───────── 初始化 ─────────
onMounted(() => {
  if (route.query.status) {
    const s = String(route.query.status);
    if (['1', '3', '0'].includes(s)) {
      activeStatus.value = s;
    }
  }
  // 并发加载
  loadAllTopics();
  const s = states[activeStatus.value];
  if (!s.loaded && !s.loading) {
    loadPage(activeStatus.value);
  }
});
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
  overflow-x: auto;
}
.list-count {
  padding: 6px 14px;
  font-size: 12px;
  color: #999;
}
.list-wrap {
  min-height: 200px;
}
.loading-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  font-size: 13px;
  color: #999;
}
.goods-list {
  padding: 0 12px;
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
.load-more-bar {
  padding: 12px;
}
.finished-tip {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: #ccc;
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
  max-height: 45vh;
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
.picker-footer {
  padding: 12px 16px;
  border-top: 1px solid #eee;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
.editor-tip {
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
  text-align: center;
}
</style>
