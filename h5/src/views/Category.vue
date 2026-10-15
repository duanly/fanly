<template>
  <div class="page">
    <van-nav-bar :title="platInfo?.name || '商品'" left-arrow fixed placeholder @click-left="back">
      <template #right>
        <van-icon name="search" size="20" @click="goSearch" />
      </template>
    </van-nav-bar>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="load"
    >
      <div class="goods-grid">
        <GoodsCard v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="该平台暂无上架商品">
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
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import { PLAT } from '../utils/platform';

const route = useRoute();
const router = useRouter();
const platform = ref(String(route.params.platform || '').toUpperCase());
const platInfo = ref(PLAT[platform.value]);

const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

function goSearch() {
  router.push({ path: '/search', query: { platform: platform.value } });
}

async function load() {
  try {
    const r = await api.feed({
      platform: platform.value,
      page: page.value,
      pageSize: 20,
    });
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
  return `cat_${platform.value}_state`;
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
    loading.value = false;
    return true;
  } catch {
    return false;
  }
}

function saveState() {
  try {
    sessionStorage.setItem(storageKey(), JSON.stringify({
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
    sessionStorage.removeItem(storageKey());
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
