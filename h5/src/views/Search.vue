<template>
  <div class="page">
    <van-search
      v-model="keyword"
      placeholder="搜你想买的东西"
      show-action
      @search="reset"
      @cancel="$router.back()"
    />

    <van-tabs v-model:active="platformIdx" color="#ff4b3a" line-width="20" @change="reset">
      <van-tab v-for="p in platforms" :key="p.key" :title="p.name" />
    </van-tabs>

    <van-dropdown-menu active-color="#ff4b3a">
      <van-dropdown-item v-model="sort" :options="sortOptions" @change="reset" />
    </van-dropdown-menu>

    <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="load">
      <div class="goods-grid">
        <GoodsCard v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
      </div>
    </van-list>

    <div v-show="showBackTop" class="back-top-fab" @click="scrollToTop">
      <van-icon name="arrow-up" size="18" />
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import { PLATFORMS } from '../utils/platform';

const route = useRoute();
const STORAGE_KEY = 'search_state';

const platforms = [{ key: 'ALL', name: '全部' }, ...PLATFORMS];
const sortOptions = [
  { text: '综合排序', value: '' },
  { text: '销量优先', value: 'sales' },
  { text: '返利最高', value: 'rebate' },
  { text: '价格最低', value: 'price' },
];

const keyword = ref('');
const platformIdx = ref(0);
const sort = ref('');
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

// 请求序号：每次 reset 加 1，过期的请求结果直接丢弃，
// 避免快速切换 tab 时旧请求的结果窜到当前列表里
let reqSeq = 0;

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  reqSeq += 1; // 序号自增，之前的请求结果作废
  load();
}

async function load() {
  const seq = reqSeq; // 记下当前请求的序号
  try {
    const r = await api.search({
      platform: platforms[platformIdx.value].key,
      keyword: keyword.value,
      page: page.value,
      pageSize: 20,
      sort: sort.value,
    });
    // 序号变了说明用户切了 tab / 改了排序，这个结果已经过期了，扔掉
    if (seq !== reqSeq) return;
    const rows = r.list || [];
    list.value.push(...rows);
    page.value += 1;
    if (rows.length < 20 || page.value > 5) finished.value = true;
  } catch {
    if (seq === reqSeq) finished.value = true;
  } finally {
    if (seq === reqSeq) loading.value = false;
  }
}

function tryRestore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s.keyword) return false;
    keyword.value = s.keyword;
    platformIdx.value = s.platformIdx || 0;
    sort.value = s.sort || '';
    if (Array.isArray(s.list) && s.list.length) {
      list.value = s.list;
      page.value = s.page || 2;
      finished.value = !!s.finished;
      loading.value = false;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function saveState() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      keyword: keyword.value,
      platformIdx: platformIdx.value,
      sort: sort.value,
      list: list.value,
      page: page.value,
      finished: finished.value,
      scrollY: window.scrollY,
    }));
  } catch { /* ignore */ }
}

onBeforeRouteLeave((to, from, next) => {
  if (to.path.startsWith('/goods/')) {
    saveState();
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  next();
});

onMounted(() => {
  // 如果 URL 带了 platform 参数，先切到对应 tab（会清空历史）
  const qp = route.query.platform;
  if (qp) {
    const idx = platforms.findIndex((p) => p.key === String(qp).toUpperCase());
    if (idx >= 0) {
      platformIdx.value = idx;
      sessionStorage.removeItem(STORAGE_KEY);
      loading.value = true;
      load();
      return;
    }
  }
  const restored = tryRestore();
  if (restored) {
    nextTick(() => {
      try {
        const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
        if (s.scrollY) window.scrollTo(0, s.scrollY);
      } catch { /* ignore */ }
    });
  }
});

// 返回顶部
const showBackTop = ref(false);
let scrollHandler = null;
function onPageScroll() {
  showBackTop.value = window.scrollY > 300;
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  scrollHandler = onPageScroll;
  window.addEventListener('scroll', scrollHandler, { passive: true });
});

onUnmounted(() => {
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
});
</script>

<style scoped>
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
