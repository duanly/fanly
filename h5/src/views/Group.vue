<template>
  <div class="page">
    <van-nav-bar :title="title" left-arrow fixed placeholder @click-left="back" />

    <div class="chip-row" style="padding:10px 12px 2px">
      <div
        v-for="(p, i) in platforms"
        :key="p.key"
        class="chip"
        :class="{ active: platformIdx === i }"
        @click="switchPlatform(i)"
      >
        {{ p.name }}
      </div>
    </div>

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

    <van-empty v-if="!loading && !list.length" description="这个专题还没选品">
      <div class="muted" style="font-size:12px;padding:0 30px;line-height:1.6">
        去后台「选品池」搜商品，加入时把专题填成 {{ key }} 就会显示在这里
      </div>
    </van-empty>

    <div v-show="showBackTop" class="back-top-fab" @click="scrollToTop">
      <van-icon name="arrow-up" size="18" />
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import { groupMeta } from '../constants/groups';
import { PLATFORMS } from '../utils/platform';

const platforms = [{ key: '', name: '全部' }, ...PLATFORMS];

const route = useRoute();
const router = useRouter();
const key = ref(String(route.params.key || 'default'));
const title = ref(groupMeta(key.value).name);
const platformIdx = ref(0);
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

function switchPlatform(i) {
  platformIdx.value = i;
  reset();
}

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  load();
}

async function load() {
  // 最多加载 8 页（160 件），避免 DOM 太多手机卡顿
  if (page.value > 8) {
    finished.value = true;
    loading.value = false;
    return;
  }
  try {
    const r = await api.feed({
      group: key.value,
      platform: platforms[platformIdx.value].key || undefined,
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
  return `group_${key.value}_state`;
}

function tryRestore() {
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.list) || !s.list.length) return false;
    platformIdx.value = s.platformIdx || 0;
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
    // 只存前 40 件，多了序列化慢，也用不上
    const savedList = list.value.slice(0, 40);
    sessionStorage.setItem(storageKey(), JSON.stringify({
      platformIdx: platformIdx.value,
      list: savedList,
      page: Math.min(page.value, 3),
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

// 从一个分组跳到另一个分组时组件会复用，得跟着路由重新拉
// 返回顶部
const showBackTop = ref(false);
let scrollHandler = null;
function onPageScroll() {
  showBackTop.value = window.scrollY > 300;
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

watch(() => route.params.key, (v, oldV) => {
  if (oldV) sessionStorage.removeItem(`group_${oldV}_state`);
  key.value = String(v || 'default');
  title.value = groupMeta(key.value).name;
  reset();
});

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
