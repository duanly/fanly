<template>
  <div class="page">
    <van-nav-bar :title="platInfo?.name || '全部好物'" left-arrow fixed placeholder @click-left="back">
      <template #right>
        <van-icon name="search" size="20" @click="goSearch" />
      </template>
    </van-nav-bar>

    <!-- 筛选区：平台 tabs + 排序（吸顶） -->
    <div class="filter-sticky">
      <!-- 全部页的平台筛选 -->
      <div v-if="isAll" class="plat-tabs">
        <div
          class="plat-tab"
          :class="{ active: !filterPlatform }"
          @click="setFilterPlatform('')"
        >
          全部
        </div>
        <div
          v-for="p in PLATFORMS"
          :key="p.key"
          class="plat-tab"
          :class="{ active: filterPlatform === p.key }"
          @click="setFilterPlatform(p.key)"
        >
          {{ p.short }}
        </div>
      </div>

      <!-- 排序栏 -->
      <div class="sort-bar">
        <div
          v-for="s in SORTS"
          :key="s.key"
          class="sort-item"
          :class="{ active: sort === s.key || (s.key === 'price' && (sort === 'price_asc' || sort === 'price_desc')) }"
          @click="onSort(s.key)"
        >
          <span>{{ s.label }}</span>
          <span v-if="s.key === 'price'" class="sort-arrow">
            <van-icon name="arrow-down" :class="{ on: sort === 'price_desc' }" />
            <van-icon name="arrow-up" :class="{ on: sort === 'price_asc' }" />
          </span>
        </div>
      </div>
    </div>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="— 更多好物去搜索看看 —"
      @load="load"
    >
      <div class="goods-grid">
        <GoodsCard v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" :description="emptyText">
      <div class="muted" style="font-size:12px;padding:0 30px;line-height:1.6">
        运营正在努力选品中，敬请期待～
      </div>
    </van-empty>

    <div v-show="showBackTop" class="back-top-fab" @click="scrollToTop">
      <van-icon name="arrow-up" size="18" />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import { PLAT, PLATFORMS } from '../utils/platform';

const route = useRoute();
const router = useRouter();
const platform = ref(String(route.params.platform || '').toUpperCase());
const platInfo = ref(PLAT[platform.value]);
const isAll = platform.value === 'ALL' || !platInfo.value;

// 全部页的平台筛选（空 = 全部）
const filterPlatform = ref('');

const SORTS = [
  { key: 'default', label: '综合' },
  { key: 'sales_desc', label: '销量' },
  { key: 'commission_desc', label: '佣金' },
  { key: 'price', label: '价格' }, // 价格点两次切换升/降
];

const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);
const sort = ref('default');

const emptyText = computed(() => {
  if (isAll) return '暂无上架商品';
  return '该平台暂无上架商品';
});

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

function goSearch() {
  const q = { path: '/search' };
  if (!isAll) q.query = { platform: platform.value };
  router.push(q);
}

function onSort(key) {
  if (key === 'price') {
    // 价格：循环切换 default → desc → asc → default
    if (sort.value === 'price_desc') {
      sort.value = 'price_asc';
    } else if (sort.value === 'price_asc') {
      sort.value = 'default';
    } else {
      sort.value = 'price_desc';
    }
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

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  load();
  window.scrollTo({ top: 0 });
}

async function load() {
  // 最多加载 8 页（160 件），避免 DOM 太多手机卡顿
  if (page.value > 8) {
    finished.value = true;
    loading.value = false;
    return;
  }
  try {
    const params = {
      page: page.value,
      pageSize: 20,
    };
    // 实际传给后端的平台：单平台页传 platform，全部页传 filterPlatform（可能为空=全部）
    const effPlatform = isAll ? filterPlatform.value : platform.value;
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

function storageKey() {
  const platKey = isAll ? `all_${filterPlatform.value || 'all'}` : platform.value;
  return `cat_${platKey}_${sort.value}_state`;
}

function tryRestore() {
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.list) || !s.list.length) return false;
    list.value = s.list;
    page.value = s.page || 2;
    finished.value = !!s.finished;
    sort.value = s.sort || 'default';
    loading.value = false;
    return true;
  } catch {
    return false;
  }
}

function saveState() {
  try {
    // 只存前 40 件，多了序列化慢，也用不上
    const savedList = list.value.slice(0, 40);
    sessionStorage.setItem(storageKey(), JSON.stringify({
      list: savedList,
      page: Math.min(page.value, 3),
      finished: finished.value,
      sort: sort.value,
      scrollY: window.scrollY,
    }));
  } catch { /* ignore */ }
}

onBeforeRouteLeave((to, from, next) => {
  if (to.path.startsWith('/goods/')) {
    saveState();
  } else {
    // 清掉所有这个页面的缓存（不同 sort / filter 的）
    const prefix = isAll ? 'cat_all_' : `cat_${platform.value}_`;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) sessionStorage.removeItem(k);
    }
  }
  next();
});

const showBackTop = ref(false);
let scrollHandler = null;
function onPageScroll() {
  showBackTop.value = window.scrollY > 300;
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  const restored = tryRestore();
  if (!restored) {
    loading.value = true;
    load();
  } else {
    nextTick(() => {
      try {
        const s = JSON.parse(sessionStorage.getItem(storageKey()) || '{}');
        if (s.scrollY) window.scrollTo(0, s.scrollY);
      } catch { /* ignore */ }
    });
  }
  scrollHandler = onPageScroll;
  window.addEventListener('scroll', scrollHandler, { passive: true });
});

onUnmounted(() => {
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
});
</script>

<style scoped>
.filter-sticky {
  position: sticky;
  top: 46px;
  z-index: 50;
  background: #fff;
}

.plat-tabs {
  display: flex;
  gap: 8px;
  padding: 10px 12px 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.plat-tab {
  flex-shrink: 0;
  padding: 5px 14px;
  font-size: 13px;
  color: #666;
  background: #f5f6f8;
  border-radius: 999px;
  transition: all 0.15s;
}
.plat-tab.active {
  color: #fff;
  background: #ff4b3a;
  font-weight: 600;
}

.sort-bar {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #f2f2f2;
  padding: 0 10px;
}
.sort-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 40px;
  font-size: 13px;
  color: #666;
  position: relative;
}
.sort-item.active {
  color: #ff4b3a;
  font-weight: 600;
}
.sort-arrow {
  display: inline-flex;
  flex-direction: column;
  font-size: 8px;
  line-height: 1;
  color: #ccc;
}
.sort-arrow .on {
  color: #ff4b3a;
}

.goods-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 10px 12px;
}

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
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}
.back-top-fab:active {
  transform: translateY(-50%) scale(0.92);
  opacity: 0.8;
}
</style>
