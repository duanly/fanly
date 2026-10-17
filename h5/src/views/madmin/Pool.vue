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

    <!-- 商品列表（三个状态各自的 van-list，tab 切换只是显示隐藏，不重新加载） -->
    <div class="list-wrap" :style="{ display: activeStatus === '1' ? 'block' : 'none' }">
      <van-list
        v-model:loading="states[1].loading"
        :finished="states[1].finished"
        finished-text="没有更多了"
        @load="loadPage(1)"
      >
        <GoodsList
          :goods="states[1].list"
          :status="1"
          :batch-mode="batchMode"
          :picked-ids="pickedIds"
          :topic-map="topicMap"
          :goods-topic-map="goodsTopicMap"
          @toggle-pick="togglePick"
          @edit-tags="openTagEditor"
          @go-detail="goDetail"
          @on-shelf="onShelf"
          @off-shelf="offShelf"
          @remove="removeGoods"
        />
      </van-list>
    </div>

    <div class="list-wrap" :style="{ display: activeStatus === '3' ? 'block' : 'none' }">
      <van-list
        v-model:loading="states[3].loading"
        :finished="states[3].finished"
        finished-text="没有更多了"
        @load="loadPage(3)"
      >
        <GoodsList
          :goods="states[3].list"
          :status="3"
          :batch-mode="batchMode"
          :picked-ids="pickedIds"
          :topic-map="topicMap"
          :goods-topic-map="goodsTopicMap"
          @toggle-pick="togglePick"
          @edit-tags="openTagEditor"
          @go-detail="goDetail"
          @on-shelf="onShelf"
          @off-shelf="offShelf"
          @remove="removeGoods"
        />
      </van-list>
    </div>

    <div class="list-wrap" :style="{ display: activeStatus === '0' ? 'block' : 'none' }">
      <van-list
        v-model:loading="states[0].loading"
        :finished="states[0].finished"
        finished-text="没有更多了"
        @load="loadPage(0)"
      >
        <GoodsList
          :goods="states[0].list"
          :status="0"
          :batch-mode="batchMode"
          :picked-ids="pickedIds"
          :topic-map="topicMap"
          :goods-topic-map="goodsTopicMap"
          @toggle-pick="togglePick"
          @edit-tags="openTagEditor"
          @go-detail="goDetail"
          @on-shelf="onShelf"
          @off-shelf="offShelf"
          @remove="removeGoods"
        />
      </van-list>
    </div>

    <van-empty v-if="!currentLoading && !currentList.length" description="暂无商品" />

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/agents" icon="friends-o">代理</van-tabbar-item>
      <van-tabbar-item to="/madmin/withdraws" icon="gold-coin-o">提现</van-tabbar-item>
    </van-tabbar>

    <!-- 标签编辑弹窗（单条/批量通用） -->
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
        <van-tab title="全部" name="" />
        <van-tab title="品类" name="category" />
        <van-tab title="品牌" name="brand" />
        <van-tab title="活动" name="activity" />
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
          已选 {{ editorPickedIds.length }} 个标签（将替换原有标签）
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
import { useRouter } from 'vue-router';
import { showToast, showSuccessToast, showConfirmDialog } from 'vant';
import { adminApi } from '../../api';

// ───────── 子组件：商品列表 ─────────
import { defineComponent, h } from 'vue';

const GoodsList = defineComponent({
  name: 'GoodsList',
  props: {
    goods: { type: Array, default: () => [] },
    status: { type: [Number, String], default: 1 },
    batchMode: { type: Boolean, default: false },
    pickedIds: { type: Array, default: () => [] },
    topicMap: { type: Object, default: () => ({}) },
    goodsTopicMap: { type: Object, default: () => ({}) },
  },
  emits: ['toggle-pick', 'edit-tags', 'go-detail', 'on-shelf', 'off-shelf', 'remove'],
  setup(props, { emit }) {
    const platName = (p) => ({ PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' }[p] || p);
    const statusName = (s) => ({ 1: '已上架', 0: '人工下架', 2: '自动下架', 3: '待上架' }[s] || '未知');
    const statusClass = (s) => ({ 1: 's-1', 3: 's-3', 0: 's-0', 2: 's-0' }[s] || '');

    const getTags = (g) => {
      const id = g.id || g.curatedId;
      const tids = props.goodsTopicMap[id] || [];
      return tids.map((tid) => props.topicMap[tid]).filter(Boolean);
    };

    const isPicked = (g) => props.pickedIds.includes(g.id || g.curatedId);

    return () => h('div', { class: 'goods-list' },
      props.goods.map((g) => {
        const id = g.id || g.curatedId;
        const tags = getTags(g);
        return h('div', {
          class: ['goods-card', { selected: isPicked(g) }],
          onClick: () => {
            if (props.batchMode) emit('toggle-pick', g);
            else emit('go-detail', g);
          },
        }, [
          props.batchMode && h('div', { class: 'check-wrap' }, [
            h('van-checkbox', { modelValue: isPicked(g) }),
          ]),
          h('img', { class: 'g-img', src: g.image }),
          h('div', { class: 'g-info' }, [
            h('div', { class: 'g-title' }, g.title),
            h('div', { class: 'g-meta' }, [
              h('span', { class: 'g-platform' }, platName(g.platform)),
              g.sales && h('span', { class: 'g-sales' }, `销量 ${g.sales}`),
              h('span', { class: ['g-status', statusClass(g.status)] }, statusName(g.status)),
            ]),
            tags.length > 0 && h('div', { class: 'g-tags' },
              tags.slice(0, 3).map((t) => h('span', { class: 'g-tag', key: t.id }, t.name)),
              tags.length > 3 && h('span', { class: 'g-tag more' }, `+${tags.length - 3}`),
            ),
            h('div', { class: 'g-price-row' }, [
              h('div', { class: 'g-price' }, [
                h('span', { class: 'label' }, '券后'),
                h('span', { class: 'price' }, `¥${g.couponPrice || g.price}`),
              ]),
              h('div', { class: 'g-comm' }, [
                h('span', { class: 'label' }, '返利'),
                h('span', { class: 'comm' }, `¥${g.commission || 0}`),
              ]),
            ]),
          ]),
          !props.batchMode && h('div', { class: 'g-actions' }, [
            // 待上架/已下架：上架 + 带标签上架
            String(props.status) !== '1' && h('van-button', {
              size: 'mini', type: 'primary',
              onClick: (e) => { e.stopPropagation(); emit('on-shelf', g); },
            }, '上架'),
            String(props.status) !== '1' && h('van-button', {
              size: 'mini', type: 'success', plain: true,
              onClick: (e) => { e.stopPropagation(); emit('edit-tags', g, 'shelf'); },
            }, '带标签上架'),
            // 已上架：编辑标签 + 下架
            String(props.status) === '1' && h('van-button', {
              size: 'mini', type: 'primary', plain: true,
              onClick: (e) => { e.stopPropagation(); emit('edit-tags', g, 'edit'); },
            }, '编辑标签'),
            String(props.status) === '1' && h('van-button', {
              size: 'mini', type: 'warning', plain: true,
              onClick: (e) => { e.stopPropagation(); emit('off-shelf', g); },
            }, '下架'),
            // 已下架：删除
            String(props.status) === '0' && h('van-button', {
              size: 'mini', type: 'danger', plain: true,
              onClick: (e) => { e.stopPropagation(); emit('remove', g); },
            }, '删除'),
          ]),
        ]);
      }),
    );
  },
});

// ───────── 主逻辑 ─────────

const router = useRouter();
const active = ref('pool');

const activeStatus = ref('1');
const searchKw = ref('');
const batchMode = ref(false);
const pickedIds = ref([]);
const allChecked = ref(false);

// 三个状态各自独立的列表状态
const makeState = () => ({
  list: [],
  page: 1,
  loading: false,
  finished: false,
  loaded: false, // 是否加载过第一页
});
const states = reactive({
  1: makeState(),
  3: makeState(),
  0: makeState(),
});

const topicMap = ref({});
const goodsTopicMap = ref({});

// 当前激活状态的计算属性
const currentList = computed(() => states[activeStatus.value]?.list || []);
const currentLoading = computed(() => states[activeStatus.value]?.loading);

// 页大小
const pageSize = 20;

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

// 批量获取商品标签
async function loadGoodsTopics(ids) {
  if (!ids.length) return;
  try {
    const gtMap = await adminApi.goodsTopicsBatch(ids);
    Object.assign(goodsTopicMap.value, gtMap || {});
  } catch {
    // 标签加载失败不影响列表
  }
}

function getGoodsTags(id) {
  const tids = goodsTopicMap.value[id] || [];
  return tids.map((tid) => topicMap.value[tid]).filter(Boolean);
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
    const rows = r.list || r || [];
    s.list = s.list.concat(rows);
    s.page++;
    s.loaded = true;
    if (rows.length < pageSize) {
      s.finished = true;
    }
    // 批量加载标签
    if (rows.length) {
      const ids = rows.map((g) => g.id || g.curatedId);
      loadGoodsTopics(ids);
    }
  } catch (e) {
    showToast(e.message || '加载失败');
  } finally {
    s.loading = false;
  }
}

function onTabChange() {
  const s = states[activeStatus.value];
  // 切 tab 时：如果还没加载过，触发加载
  if (!s.loaded && !s.loading) {
    loadPage(activeStatus.value);
  }
  // 重置批量选择
  batchMode.value = false;
  pickedIds.value = [];
  allChecked.value = false;
}

function onSearch() {
  // 搜索时重置当前 tab 的列表
  const s = states[activeStatus.value];
  s.list = [];
  s.page = 1;
  s.finished = false;
  s.loaded = false;
  // 手动触发第一页加载
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
  allChecked.value = pickedIds.value.length === currentList.value.length && currentList.value.length > 0;
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
  sessionStorage.setItem('madmin_goods_' + (g.id || g.curatedId), JSON.stringify(g));
  router.push(`/madmin/goods/${g.id || g.curatedId}`);
}

async function onShelf(g) {
  try {
    await adminApi.curationBatchOnShelf([g.id || g.curatedId]);
    showSuccessToast('已上架');
    // 从当前列表移除，加到已上架列表
    moveGoods(g, activeStatus.value, '1');
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
    await adminApi.curationRemove(g.id || g.curatedId);
    showSuccessToast('已删除');
    // 从当前列表移除
    const s = states[activeStatus.value];
    const id = g.id || g.curatedId;
    s.list = s.list.filter((x) => (x.id || x.curatedId) !== id);
  } catch (e) {
    if (e === 'cancel') return;
  }
}

// 把商品从一个状态移到另一个状态（前端即时更新，避免切换 tab 才看到变化）
function moveGoods(g, fromStatus, toStatus) {
  const id = g.id || g.curatedId;
  const from = states[fromStatus];
  const to = states[toStatus];
  // 从 from 移除
  from.list = from.list.filter((x) => (x.id || x.curatedId) !== id);
  // 加到 to 列表顶部
  const copy = { ...g, status: Number(toStatus) };
  if (to.loaded) {
    to.list.unshift(copy);
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
    // 前端移动
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
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
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
    // 从当前列表移除
    const s = states[activeStatus.value];
    const idSet = new Set(ids);
    s.list = s.list.filter((g) => !idSet.has(g.id || g.curatedId));
    pickedIds.value = [];
    allChecked.value = false;
  } catch (e) {
    if (e !== 'cancel') throw e;
  }
}

function batchMove(fromStatus, toStatus, ids) {
  const from = states[fromStatus];
  const to = states[toStatus];
  const idSet = new Set(ids);
  const moved = from.list.filter((g) => idSet.has(g.id || g.curatedId));
  from.list = from.list.filter((g) => !idSet.has(g.id || g.curatedId));
  if (to.loaded) {
    moved.forEach((g) => { g.status = Number(toStatus); });
    to.list = [...moved, ...to.list];
  }
}

// ───────── 标签编辑弹窗 ─────────
const tagEditorShow = ref(false);
const editorTagType = ref('');
const editorTagKw = ref('');
const editorPickedIds = ref([]);
const editorLoading = ref(false);
let editorMode = 'edit'; // 'edit' = 编辑标签, 'shelf' = 带标签上架
let editorGoods = []; // 当前编辑的商品数组

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
    all = all.filter((t) => t.name.toLowerCase().includes(kw));
  }
  return all;
});

// 打开单条标签编辑器
function openTagEditor(g, mode) {
  editorMode = mode || 'edit';
  editorGoods = [g];
  // 预填已有标签
  const id = g.id || g.curatedId;
  editorPickedIds.value = [...(goodsTopicMap.value[id] || [])];
  editorTagType.value = '';
  editorTagKw.value = '';
  tagEditorShow.value = true;
}

// 打开批量标签编辑
function openBatchTagEdit() {
  if (!pickedIds.value.length) {
    showToast('请先勾选商品');
    return;
  }
  editorMode = 'edit';
  const currentGoods = currentList.value.filter((g) => pickedIds.value.includes(g.id || g.curatedId));
  editorGoods = currentGoods;
  // 批量编辑：预填空（因为多个商品标签可能不一样，以最终选择为准）
  // 取交集作为预填充
  if (currentGoods.length === 1) {
    const id = currentGoods[0].id || currentGoods[0].curatedId;
    editorPickedIds.value = [...(goodsTopicMap.value[id] || [])];
  } else {
    editorPickedIds.value = [];
  }
  editorTagType.value = '';
  editorTagKw.value = '';
  tagEditorShow.value = true;
}

// 打开批量带标签上架
function openBatchTagShelf() {
  if (!pickedIds.value.length) {
    showToast('请先勾选商品');
    return;
  }
  editorMode = 'shelf';
  const currentGoods = currentList.value.filter((g) => pickedIds.value.includes(g.id || g.curatedId));
  editorGoods = currentGoods;
  editorPickedIds.value = [];
  editorTagType.value = '';
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

    if (editorMode === 'shelf') {
      // 带标签上架：先上架，再打标签
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
        `上架 ${ids.length} 件${editorPickedIds.value.length ? `，打了 ${editorPickedIds.value.length} 个标签` : ''}`,
      );
      // 前端移动
      batchMove(activeStatus.value, '1', ids);
      // 更新标签缓存
      ids.forEach((id) => {
        goodsTopicMap.value[id] = [...editorPickedIds.value];
      });
    } else {
      // 编辑标签：逐个设置（全量替换）
      for (const id of ids) {
        await adminApi.setGoodsTopics(id, editorPickedIds.value);
        goodsTopicMap.value[id] = [...editorPickedIds.value];
      }
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
onMounted(async () => {
  await loadAllTopics();
  // 默认加载第一个 tab
  loadPage(activeStatus.value);
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
.list-wrap {
  min-height: 200px;
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
