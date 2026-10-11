<template>
  <div class="page">
    <van-nav-bar :title="topic.name || '专题'" left-arrow fixed placeholder @click-left="back">
      <template #right>
        <van-icon v-if="topic.shareImage" name="share-o" size="18" @click="showShare = true" />
      </template>
    </van-nav-bar>

    <!-- 顶部 banner 轮播 -->
    <van-swipe
      v-if="banners.length"
      class="topic-banners"
      :autoplay="4000"
      indicator-color="rgba(255,255,255,0.6)"
    >
      <van-swipe-item v-for="(b, i) in banners" :key="i" @click="openBanner(b)">
        <div class="banner-slide" :style="bannerStyle(b)">
          <div class="bs-text" v-if="b.title">
            <div class="bs-sub">{{ b.subtitle || '' }}</div>
            <div class="bs-title">{{ b.title }}</div>
          </div>
        </div>
      </van-swipe-item>
    </van-swipe>

    <div class="topic-head" :style="headStyle">
      <div class="th-icon" v-if="topic.icon && !topic.cover && !banners.length">{{ topic.icon }}</div>
      <div class="th-name">{{ topic.name }}</div>
      <div v-if="topic.intro" class="th-intro">{{ topic.intro }}</div>

      <!-- 活动倒计时 -->
      <div v-if="countdownText" class="th-countdown">
        <van-icon name="clock-o" size="14" />
        <span>{{ countdownText }}</span>
      </div>
    </div>

    <!-- 活动规则 -->
    <div v-if="topic.description" class="desc-block" @click="descExpanded = !descExpanded">
      <div class="desc-title">
        <van-icon name="info-o" size="14" />
        <span>活动规则</span>
        <van-icon :name="descExpanded ? 'arrow-up' : 'arrow-down'" size="12" />
      </div>
      <div v-show="descExpanded" class="desc-content">{{ topic.description }}</div>
    </div>

    <!--
      只给「返利最高 / 价格最低」两个排法，不放筛选器。
      目标用户是不熟悉返利的县城用户，多一个控件就多一层「这是干什么的」。
      真要筛，搜索页已经有了。
    -->
    <div class="sort-row">
      <div
        v-for="s in SORTS"
        :key="s.key"
        class="sort-item"
        :class="{ on: sort === s.key }"
        @click="switchSort(s.key)"
      >{{ s.name }}</div>
      <span v-if="total" class="muted count">共 {{ total }} 件</span>
    </div>

    <!-- 活动已结束提示 -->
    <van-empty
      v-if="activityEnded && !list.length"
      description="活动已结束，看看其他专题吧"
    />

    <van-list
      v-else
      v-model:loading="loading"
      :finished="finished"
      finished-text=""
      @load="load"
    >
      <div class="goods-grid">
        <GoodsCard
          v-for="g in list"
          :key="g.platform + g.goodsId"
          :g="g"
          show-recommend
        />
      </div>
    </van-list>

    <van-empty
      v-if="!loading && !list.length && !activityEnded"
      description="这个专题还在备货，换个分区看看"
    />

    <van-back-top right="16" bottom="110" />

    <BeianFooter />

    <!-- 分享海报弹层 -->
    <van-popup v-model:show="showShare" position="bottom" round>
      <div class="share-sheet">
        <div class="share-title">分享海报</div>
        <img v-if="topic.shareImage" :src="topic.shareImage" class="share-img" />
        <div class="muted share-tip">长按图片保存，发给朋友</div>
        <van-button block round color="#ff4b3a" style="margin-top:12px" @click="showShare = false">
          关闭
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import BeianFooter from '../components/BeianFooter.vue';

const SORTS = [
  { key: 'rebate', name: '返利最高' },
  { key: 'price', name: '价格最低' },
];

const route = useRoute();
const router = useRouter();
const topic = ref({});
const list = ref([]);
const total = ref(0);
const page = ref(0);
const sort = ref('rebate');
const loading = ref(false);
const finished = ref(false);
const descExpanded = ref(false);
const showShare = ref(false);
const homeBanners = ref([]);
// 保留变量但不再用于 banner 兜底，后续可删

// 倒计时
const countdownText = ref('');
let countdownTimer = null;

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

const topicBanners = computed(() => Array.isArray(topic.value.banners) ? topic.value.banners.filter((b) => b.image) : []);
// 专题没配 banner 就不显示，不再用首页兜底
const banners = computed(() => topicBanners.value);

function bannerStyle(b) {
  const isUrl = /^https?:|^data:/.test(b.image || '');
  return isUrl
    ? { backgroundImage: `url(${b.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: b.image || b.bg || 'linear-gradient(135deg,#ff6b35,#f7931e)' };
}

const headStyle = computed(() => {
  // 有 banners 或者有 cover 时不用渐变底色
  if (banners.value.length) return { display: 'none' };
  if (topic.value.cover) return { background: `center/cover no-repeat url(${topic.value.cover})` };
  return { background: topic.value.bg || 'linear-gradient(135deg,#ff8a3d,#ff5000)' };
});

const activityEnded = computed(() => {
  if (!topic.value.endAt) return false;
  return Date.now() > new Date(topic.value.endAt).getTime();
});

function updateCountdown() {
  if (!topic.value.endAt) { countdownText.value = ''; return; }
  const end = new Date(topic.value.endAt).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) {
    countdownText.value = '活动已结束';
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    return;
  }
  // 活动还没开始
  if (topic.value.startAt && now < new Date(topic.value.startAt).getTime()) {
    countdownText.value = '活动未开始';
    return;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) countdownText.value = `距结束 ${d} 天 ${h} 小时`;
  else countdownText.value = `距结束 ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  if (!topic.value.endAt) return;
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

function openBanner(b) {
  if (!b?.url) return;
  if (b.internal) router.push(b.url);
  else window.open(b.url, '_blank');
}

async function load() {
  loading.value = true;
  try {
    const r = await api.topicGoods(route.params.slug, { sort: sort.value, page: page.value + 1 });
    page.value += 1;
    topic.value = r.topic || {};
    list.value = [...list.value, ...(r.list || [])];
    total.value = r.total || 0;
    // 服务端分页，靠总数判断到底，别拿本页长度猜——猜错就是无限加载
    if (list.value.length >= total.value) finished.value = true;
    startCountdown();
  } catch (e) {
    finished.value = true;
    if (!list.value.length) showToast(e?.message || '专题加载失败');
  } finally {
    loading.value = false;
  }
}

function switchSort(k) {
  if (sort.value === k) return;
  sort.value = k;
  reset();
}

function reset() {
  list.value = [];
  page.value = 0;
  total.value = 0;
  finished.value = false;
  load();
}

// 加载首页 banner 兜底（已停用，保留代码）
async function loadHomeBanners() {
  return;
  try {
    const r = await api.homeLinks('banner');
    if (r?.length) homeBanners.value = r;
  } catch { /* 没有就不用 */ }
}

function storageKey() {
  return `topic_${route.params.slug}_state`;
}

function tryRestore() {
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!Array.isArray(s.list) || !s.list.length) return false;
    sort.value = s.sort || 'rebate';
    list.value = s.list;
    page.value = s.page || 1;
    total.value = s.total || 0;
    finished.value = !!s.finished;
    loading.value = false;
    if (s.topic) topic.value = s.topic;
    startCountdown();
    return true;
  } catch {
    return false;
  }
}

function saveState() {
  try {
    sessionStorage.setItem(storageKey(), JSON.stringify({
      sort: sort.value,
      list: list.value,
      page: page.value,
      total: total.value,
      finished: finished.value,
      topic: topic.value,
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

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});

// 从一个专题直接跳另一个专题时，组件会复用，必须自己重置
watch(() => route.params.slug, (slug, oldSlug) => {
  if (oldSlug) sessionStorage.removeItem(`topic_${oldSlug}_state`);
  reset();
});

// 挂载时先尝试恢复，没有就重新加载
onMounted(() => {
  const restored = tryRestore();
  if (restored) {
    nextTick(() => {
      try {
        const s = JSON.parse(sessionStorage.getItem(storageKey()) || '{}');
        if (s.scrollY) window.scrollTo(0, s.scrollY);
      } catch { /* ignore */ }
    });
  } else {
    reset();
  }
});

// 加载首页 banner 兜底
loadHomeBanners();
</script>

<style scoped>
.topic-banners {
  width: 100%;
}
.banner-slide {
  width: 100%;
  height: 180px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  color: #fff;
}
.banner-slide::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.08) 55%, transparent 100%);
}
.bs-text {
  position: relative;
  z-index: 1;
}
.bs-sub {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 4px;
}
.bs-title {
  font-size: 22px;
  font-weight: 700;
  text-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.topic-head {
  padding: 18px 16px 20px;
  color: #fff;
  text-align: center;
}
.th-icon { font-size: 30px; line-height: 1; }
.th-name { font-size: 19px; font-weight: 700; margin-top: 6px; }
.th-intro { font-size: 12px; opacity: .9; margin-top: 5px; }
.th-countdown {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  padding: 4px 10px;
  background: rgba(0,0,0,0.25);
  border-radius: 999px;
  font-size: 12px;
}

.desc-block {
  background: #fff;
  margin: 0 12px 8px;
  border-radius: 10px;
  padding: 10px 14px;
}
.desc-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
}
.desc-title .van-icon:last-child { margin-left: auto; }
.desc-content {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #333;
  white-space: pre-wrap;
}

.sort-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
}
.sort-item {
  font-size: 13px;
  color: #666;
  padding: 4px 12px;
  border-radius: 999px;
  background: #f5f6f8;
}
.sort-item.on {
  color: #fff;
  background: var(--brand);
  font-weight: 600;
}
.count { margin-left: auto; }

.share-sheet {
  padding: 16px 20px 30px;
  text-align: center;
}
.share-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.share-img {
  width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: 10px;
  background: #f5f6f8;
}
.share-tip { margin-top: 8px; }
</style>
