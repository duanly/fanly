<template>
  <div class="home-v2">
    <!-- 顶部：渐变背景 + 搜索 -->
    <div class="top-wrap">
      <div class="top-bg"></div>

      <div class="top-bar">
        <div class="search-box" @click="$router.push('/search')">
          <van-icon name="search" color="#ff4b3a" size="15" />
          <span class="ph">搜隐藏优惠券 · 搜什么都返</span>
        </div>
        <div class="top-actions">
          <div class="ta-item" @click="$router.push('/checkin')">
            <div class="ta-ico">🎁</div>
            <span>签到</span>
          </div>
        </div>
      </div>

      <!-- 开启返利卡片 -->
      <div class="auth-card">
        <div class="ac-head">
          <span class="ac-title">开启返利</span>
          <span class="ac-sub">授权后订单才认得到你</span>
        </div>
        <div class="ac-list">
          <div
            v-for="p in PLATS"
            :key="p.key"
            class="ac-item"
            :class="{ done: auth[p.key] === true }"
            @click="onPlatClick(p)"
          >
            <span class="ac-dot" :style="{ background: p.bg }">{{ p.short }}</span>
            <span class="ac-name">{{ p.name }}</span>
            <span class="ac-st">{{ auth[p.key] === true ? '已开启' : '去开启' }}</span>
          </div>
        </div>
      </div>

      <!-- 复制链接转链条 -->
      <div class="paste-bar" @click="goParse">
        <div class="pb-left">
          <span class="pb-ico">📋</span>
          <span>复制</span>
          <span class="pb-plats">
            <i v-for="p in PLATS" :key="p.key" class="pb-plat-dot" :style="{ background: p.bg }">{{ p.short }}</i>
          </span>
          <span>商品链接</span>
        </div>
        <div class="pb-right">
          <span>转链返现</span>
          <van-icon name="arrow" color="#ff4b3a" size="10" />
        </div>
      </div>

      <!-- Banner 轮播 -->
      <van-swipe class="banner-swipe" :autoplay="banners.length > 1 ? 4000 : 0" indicator-color="rgba(255,255,255,0.5)">
        <van-swipe-item v-for="b in banners" :key="b.id || b.title" @click="openLink(b)">
          <div class="banner-card" :style="{ background: b.image || b.bg || 'linear-gradient(135deg,#ff6b35,#f7931e)' }">
            <div class="bn-text">
              <div class="bn-tag">{{ b.subtitle || '限时活动' }}</div>
              <div class="bn-title">{{ b.title }}</div>
              <div class="bn-btn">
                <span>{{ bannerBtnText(b) }}</span>
                <van-icon name="arrow" color="#fff" size="10" />
              </div>
            </div>
          </div>
        </van-swipe-item>
      </van-swipe>
    </div>

    <!-- 全网比价入口 -->
    <div v-if="compare.length" class="cmp-card" @click="$router.push('/compare')">
      <div class="cmp-left">
        <div class="cmp-tag">⚖️ 全网比价</div>
        <div class="cmp-title">同款商品各平台到手价对比</div>
        <div class="cmp-sub">已收录 {{ compare.length }} 组比价 · 帮你选最便宜的</div>
      </div>
      <div class="cmp-right">
        <div v-if="topSave > 0" class="cmp-save">
          <span class="cs-n">¥{{ topSave }}</span>
          <span class="cs-t">最多省</span>
        </div>
        <van-icon name="arrow" color="#fff" />
      </div>
    </div>

    <!-- 品类宫格 -->
    <div class="sec-head-wrap cats-head">
      <span class="sec-title">全部分类 📒</span>
      <span class="sec-more">共 {{ catGroups.length }} 个</span>
    </div>
    <div class="section cats-section" ref="catsRef">
      <div class="grid-card">
        <van-swipe
          :autoplay="catPages.length > 1 ? 5000 : 0"
          indicator-color="rgba(255,75,58,0.3)"
          class="cat-swipe"
        >
          <van-swipe-item v-for="(pageItems, pi) in catPages" :key="pi">
            <div class="cat-page">
              <div
                v-for="e in pageItems"
                :key="e.key"
                class="cat-item"
                @click="openCat(e)"
              >
                <div class="cat-ico" :style="{ background: e.bg }">{{ e.icon }}</div>
                <div class="cat-name">{{ e.name }}</div>
              </div>
            </div>
          </van-swipe-item>
        </van-swipe>
      </div>
    </div>

    <!-- 品牌专区 -->
    <div v-if="brandTopics.length" class="sec-head-wrap brand-head">
      <span class="sec-title">品牌专区 🏷️</span>
      <span class="sec-more" @click="showAllBrands = true">全部品牌 ›</span>
    </div>
    <div v-if="brandTopics.length" class="section brand-section">
      <div class="brand-scroll">
        <div
          v-for="b in brandTopics"
          :key="b.id"
          class="brand-item"
          @click="$router.push(`/topic/${b.slug}`)"
        >
          <div class="b-ico" :style="{ background: b.bg || 'linear-gradient(135deg,#e0eafc,#cfdef3)' }">
            {{ b.icon || '🏷️' }}
          </div>
          <div class="b-name">{{ b.name.replace('品牌·', '') }}</div>
          <div class="b-cnt">{{ b.goodsCount || 0 }} 件</div>
        </div>
      </div>
    </div>

    <!-- 活动标签位（自动滚动） -->
    <div v-if="acts.length" class="sec-head-wrap act-head">
      <span class="sec-title">限时活动 🕙</span>
      <span class="sec-more" @click="showAllActs = true">全部活动 ›</span>
    </div>
    <div v-if="acts.length" class="section act-section">
      <div class="act-marquee" ref="marqueeRef">
        <div class="am-track" :style="{ transform: `translateX(${marqueeX}px)` }">
          <div
            v-for="(a, i) in marqueeActs"
            :key="a.key + '-' + i"
            class="act-card"
            @click="openLink(a)"
          >
            <div class="ac-ico" :style="{ background: a.bg || 'linear-gradient(135deg,#ff6b35,#f7931e)' }">
              {{ a.icon || '🎁' }}
            </div>
            <div class="ac-info">
              <div class="ac-title">{{ a.title }}</div>
              <div class="ac-sub">{{ a.subtitle || '限时特惠' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 好物推荐 -->
    <div class="sec-head-wrap rank-head">
      <span class="sec-title">好物推荐 👍</span>
      <span class="sec-more" @click="$router.push('/category/all')">全部 ›</span>
    </div>
    <div class="section rank-section">
      <van-tabs class="rank-tabs" v-model:active="rankIdx" color="#ff4b3a" line-width="16" @change="resetRank">
        <van-tab v-for="r in RANKS" :key="r.type" :title="r.name" />
      </van-tabs>

      <div v-if="rankTip" class="rank-tip">{{ rankTip }}</div>

      <van-list
        v-model:loading="rankLoading"
        :finished="rankFinished"
        finished-text="— 到底啦，已经帮你挑了这么多 —"
        @load="loadRank"
      >
        <div class="goods-list">
          <GoodsCard
            v-for="g in list"
            :key="g.platform + g.goodsId"
            :g="g"
            show-recommend
            @recommended="onRecommended"
          />
        </div>
      </van-list>

      <van-empty v-if="!rankLoading && !list.length" :description="emptyText" />
    </div>

    <!-- 悬浮返回顶部 -->
    <div v-show="showBackTop" class="back-top-fab" @click="scrollToTop">
      <van-icon name="arrow-up" size="18" />
    </div>

    <BeianFooter />

    <!-- 全部活动弹窗 -->
    <van-popup v-model:show="showAllActs" position="bottom" round :style="{ maxHeight: '75%' }">
      <div class="all-acts">
        <div class="aa-head">
          <div class="aa-title">全部活动</div>
          <van-icon name="cross" size="20" @click="showAllActs = false" />
        </div>
        <div class="aa-grid">
          <div
            v-for="a in acts"
            :key="a.key"
            class="aa-item"
            @click="openLink(a); showAllActs = false"
          >
            <div class="aa-ico" :style="{ background: a.bg || 'linear-gradient(135deg,#ff6b35,#f7931e)' }">
              {{ a.icon || '🎁' }}
            </div>
            <div class="aa-name">{{ a.title }}</div>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 全部品牌弹窗 -->
    <van-popup v-model:show="showAllBrands" position="bottom" round :style="{ maxHeight: '80%' }">
      <div class="all-brands">
        <div class="aa-head">
          <div class="aa-title">全部品牌</div>
          <van-icon name="cross" size="20" @click="showAllBrands = false" />
        </div>
        <div class="brand-grid">
          <div
            v-for="b in allBrands"
            :key="b.id"
            class="bg-item"
            @click="$router.push(`/topic/${b.slug}`); showAllBrands = false"
          >
            <div class="bg-ico" :style="{ background: b.bg || 'linear-gradient(135deg,#e0eafc,#cfdef3)' }">
              {{ b.icon || '🏷️' }}
            </div>
            <div class="bg-name">{{ b.name.replace('品牌·', '') }}</div>
          </div>
        </div>
        <div v-if="!allBrands.length" class="brand-empty">
          品牌标签正在积累中，先看看品类吧～
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { showToast } from 'vant';
import GoodsCard from '../components/GoodsCard.vue';
import BeianFooter from '../components/BeianFooter.vue';
import { PLATFORMS as PLATS } from '../utils/platform';

const router = useRouter();
const route = useRoute();

const STORAGE_KEY = 'home_rank_state';
const auth = reactive({});

const RANKS = [
  { type: 'hot', name: '🔥 热销榜', tip: '按近 7 天实付订单数排序，真金白银选出来的' },
  { type: 'rebate', name: '💰 返利榜', tip: '佣金绝对金额排序，不是比例——比例高的往往是便宜货' },
  { type: 'pick', name: '⭐️ 推荐榜', tip: '用户一人一票投出来的，再加运营手动权重' },
];

/** 后台没配 banner 时的兜底，不让首页开天窗 */
const FALLBACK_BANNERS = [
  { id: 'fb-1', title: '天天签到领金币', subtitle: '攒够就能换钱', image: 'linear-gradient(135deg,#ff8a3d,#ff3b30)', url: '/checkin', internal: true, btnText: '立即签到' },
  { id: 'fb-2', title: '全网比价', subtitle: '同款哪家最便宜，一眼看清', image: 'linear-gradient(135deg,#4a3aff,#7b3ad5)', url: '/compare', internal: true, btnText: '立即抢购' },
  { id: 'fb-3', title: '邀请好友赚钱', subtitle: '他买东西，你拿分成', image: 'linear-gradient(135deg,#ff6a9a,#ff3b6b)', url: '/agent', internal: true, btnText: '立即邀请' },
];

const banners = ref(FALLBACK_BANNERS);
const topics = ref([]);
const links = ref([]);
const cats = ref([]);
const groups = ref([]);
const compare = ref([]);
const topSave = ref(0);

const rankIdx = ref(0);
const list = ref([]);
const rankPage = ref(1);
const rankLoading = ref(false);
const rankFinished = ref(false);

const catsRef = ref(null);
const allAuth = computed(() => PLATS.every((p) => auth[p.key] === true));
const rankTip = computed(() => RANKS[rankIdx.value]?.tip || '');
const emptyText = computed(() =>
  RANKS[rankIdx.value].type === 'hot' ? '还没有真实订单数据，榜单在积累中' : '货架还在备货，先看看别的分区',
);

// 活动位
const acts = computed(() =>
  topics.value
    .filter((t) => t.type === 'activity' && t.status === 1)
    .slice(0, 10)
    .map((t) => ({
      key: `t-${t.slug}`,
      title: t.name,
      subtitle: t.intro || '',
      icon: t.icon || '🎁',
      bg: t.bg,
      url: `/topic/${t.slug}`,
      internal: true,
    })),
);

// 品牌专区：按商品数排序，取前 20 个展示
const brandTopics = computed(() =>
  topics.value
    .filter((t) => t.type === 'brand' && t.status === 1)
    .sort((a, b) => (b.goodsCount || 0) - (a.goodsCount || 0))
    .slice(0, 20),
);

// 所有品牌（弹窗里用）
const allBrands = computed(() =>
  topics.value
    .filter((t) => t.type === 'brand' && t.status === 1)
    .sort((a, b) => (b.goodsCount || 0) - (a.goodsCount || 0)),
);

// 跑马灯：复制多份实现无缝循环，必须偶数份才不跳
const marqueeActs = computed(() => {
  const arr = acts.value;
  if (!arr.length) return [];
  let reps = Math.ceil(10 / arr.length);
  if (reps < 2) reps = 2;
  if (reps % 2) reps += 1;
  return Array.from({ length: reps }, () => arr).flat();
});

// ── 跑马灯自动滚动 ──
const marqueeRef = ref(null);
const marqueeX = ref(0);
let marqueeRaf = 0;
let marqueeSpeed = 0.8; // px/frame，约 48px/s
let marqueeLastTime = 0;
let singleSetWidth = 0;

function measureMarquee() {
  const track = marqueeRef.value?.querySelector('.am-track');
  if (!track || !acts.value.length) return;
  const totalW = track.scrollWidth;
  let reps = Math.ceil(10 / acts.value.length);
  if (reps < 2) reps = 2;
  if (reps % 2) reps += 1;
  singleSetWidth = totalW / reps;
}

function marqueeLoop(ts) {
  if (!marqueeLastTime) marqueeLastTime = ts;
  const dt = ts - marqueeLastTime;
  marqueeLastTime = ts;
  if (singleSetWidth > 0) {
    marqueeX.value -= marqueeSpeed * (dt / 16.67);
    if (marqueeX.value <= -singleSetWidth) {
      marqueeX.value += singleSetWidth;
    }
  }
  marqueeRaf = requestAnimationFrame(marqueeLoop);
}

function startMarquee() {
  if (marqueeRaf) return;
  marqueeLastTime = 0;
  marqueeRaf = requestAnimationFrame(marqueeLoop);
}

function stopMarquee() {
  if (marqueeRaf) {
    cancelAnimationFrame(marqueeRaf);
    marqueeRaf = 0;
  }
}

// 全部活动弹窗
const showAllActs = ref(false);

// 全部品牌弹窗
const showAllBrands = ref(false);

// 返回顶部悬浮按钮
const showBackTop = ref(false);
function onScroll() {
  showBackTop.value = window.scrollY > 300;
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
let scrollHandler = null;

// 品类宫格
const catGroups = computed(() => {
  const out = [];
  const has = (url) => out.some((o) => o.url === url);

  // 品类标签（主力）
  topics.value
    .filter((t) => t.type === 'category' && t.status === 1)
    .forEach((t, i) => out.push({
      key: `topic-${t.slug}`,
      name: t.name,
      icon: t.icon || '📦',
      bg: t.bg || `hsl(${(i * 37) % 360}, 70%, 85%)`,
      url: `/topic/${t.slug}`,
      internal: true,
    }));

  // 不够 4 个的话用预设补，免得太空
  const PRESET = [
    { key: 'food', name: '美食生鲜', icon: '🍎', bg: 'linear-gradient(135deg,#ff9a56,#ff6b35)' },
    { key: 'beauty', name: '美妆个护', icon: '💄', bg: 'linear-gradient(135deg,#ff6b9d,#c44569)' },
    { key: 'home', name: '家居日用', icon: '🏠', bg: 'linear-gradient(135deg,#4ecdc4,#44a08d)' },
    { key: 'digital', name: '数码家电', icon: '📱', bg: 'linear-gradient(135deg,#667eea,#764ba2)' },
    { key: 'clothes', name: '服饰鞋包', icon: '👗', bg: 'linear-gradient(135deg,#f093fb,#f5576c)' },
    { key: 'baby', name: '母婴玩具', icon: '🧸', bg: 'linear-gradient(135deg,#a8edea,#fed6e3)' },
    { key: 'sport', name: '运动户外', icon: '⚽', bg: 'linear-gradient(135deg,#43cea2,#185a9d)' },
    { key: 'book', name: '图书文具', icon: '📚', bg: 'linear-gradient(135deg,#ffecd2,#fcb69f)' },
  ];

  if (out.length < 4) {
    for (const g of PRESET) {
      if (out.length >= 8) break;
      const url = `/group/${g.key}`;
      if (has(url)) continue;
      out.push({ ...g, key: `pre-${g.key}`, url, internal: true });
    }
  }

  return out;
});

const catPages = computed(() => {
  const all = catGroups.value;
  const pages = [];
  for (let i = 0; i < all.length; i += 8) pages.push(all.slice(i, i + 8));
  return pages.length ? pages : [[]];
});

function bannerStyle(b) {
  return b.image
    ? { backgroundImage: `url(${b.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: b.bg || 'linear-gradient(135deg,#ff6b35,#f7931e)' };
}
function bannerBtnText(b) {
  if (b.btnText) return b.btnText;
  return '立即抢购';
}

function goParse() {
  if (!localStorage.getItem('token')) {
    return router.push({ path: '/login', query: { redirect: '/parse' } });
  }
  router.push('/parse');
}

function goAuth(p) {
  if (!localStorage.getItem('token')) {
    return router.push({ path: '/login', query: { redirect: '/' } });
  }
  if (auth[p.key] === true) return showToast(`${p.name}已经开启了`);
  router.push({ path: `/auth/${p.key}`, query: { redirect: '/' } });
}

function onPlatClick(p) {
  // 统一跳转到平台专属货架页
  router.push(`/category/${p.key}`);
}

function openLink(a) {
  if (a.internal) {
    router.push(a.url);
  } else if (a.url) {
    window.open(a.url, '_blank');
  }
}

function openCat(e) {
  if (e.internal) router.push(e.url);
  else if (e.url) window.open(e.url, '_blank');
}

function scrollToCats() {
  catsRef.value?.scrollIntoView({ behavior: 'smooth' });
}

async function resetRank() {
  list.value = [];
  rankPage.value = 1;
  rankFinished.value = false;
  rankLoading.value = true;
  loadRank();
}

async function loadRank() {
  try {
    const r = await api.ranking(RANKS[rankIdx.value].type, {
      page: rankPage.value,
      pageSize: 20,
    });
    const rows = r.list || [];
    list.value.push(...rows);
    rankPage.value += 1;
    if (r.hasMore === false || rows.length < 20) rankFinished.value = true;
  } catch {
    rankFinished.value = true;
  } finally {
    rankLoading.value = false;
  }
}

function onRecommended(g) {
  // 推荐成功后不做特殊处理，卡片自己会更新
}

/** 侧边数据各自失败各自空，不互相牵连，更不能拖住主商品流 */
async function loadSide() {
  // 先加载授权状态
  if (localStorage.getItem('token')) {
    Promise.all(PLATS.map(async (p) => {
      try {
        const s = await api.authzStatus(p.key);
        auth[p.key] = !s.needAuth;
      } catch {
        auth[p.key] = undefined;
      }
    }));
  }

  const safe = async (fn, target, map) => {
    try {
      const v = await fn();
      target.value = map ? map(v) : v;
    } catch { /* 保持默认值 */ }
  };
  await Promise.all([
    safe(() => api.goodsGroups(), groups),
    safe(() => api.topics(), topics),
    safe(() => api.homeLinks('banner'), banners, (v) => (v?.length ? v : FALLBACK_BANNERS)),
    safe(() => api.homeLinks('entry'), links),
    safe(() => api.homeLinks('category'), cats),
    safe(() => api.compareGroups(), compare, (v) => v.list || v || []),
  ]);

  // 算一下全网最高省多少
  if (compare.value?.length) {
    let max = 0;
    for (const g of compare.value) {
      const prices = (g.items || []).map((i) => Number(i.couponPrice || i.price || 9999)).filter((n) => n > 0);
      if (prices.length >= 2) {
        const diff = Math.max(...prices) - Math.min(...prices);
        if (diff > max) max = diff;
      }
    }
    topSave.value = Math.round(max * 10) / 10;
  }
}

/** 从详情页返回时恢复榜单状态（tab、列表数据、滚动位置） */
function tryRestoreState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (typeof s.rankIdx !== 'number') return false;
    rankIdx.value = s.rankIdx;
    if (Array.isArray(s.list) && s.list.length) {
      list.value = s.list;
      rankPage.value = s.rankPage || 2;
      rankFinished.value = !!s.finished;
    }
    return true;
  } catch {
    return false;
  }
}

/** 离开去详情页之前保存榜单状态 */
function saveState() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      rankIdx: rankIdx.value,
      list: list.value,
      rankPage: rankPage.value,
      finished: rankFinished.value,
      scrollY: window.scrollY,
    }));
  } catch { /* storage 满了就算了 */ }
}

onBeforeRouteLeave((to, from, next) => {
  // 只有去商品详情页才保存状态，去别的页面（如搜索、收藏夹）清空
  if (to.path.startsWith('/goods/')) {
    saveState();
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  next();
});

onMounted(() => {
  loadSide();
  const restored = tryRestoreState();
  if (restored && list.value.length) {
    // 数据已恢复，下一帧滚动到之前的位置
    nextTick(() => {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s.scrollY) window.scrollTo(0, s.scrollY);
        } catch { /* ignore */ }
      }
    });
  } else {
    loadRank();
  }
  // 跑马灯：等 DOM 渲染完测量宽度再启动
  nextTick(() => {
    measureMarquee();
    startMarquee();
  });
  // 返回顶部按钮
  scrollHandler = onScroll;
  window.addEventListener('scroll', scrollHandler, { passive: true });
  onScroll();
});

onUnmounted(() => {
  stopMarquee();
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
});
</script>

<style scoped>
.home-v2 {
  background: #f7f8fa;
  padding-bottom: 20px;
  overflow-x: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* ========== 顶部渐变区 ========== */
.top-wrap {
  position: relative;
  padding: 0 12px 0;
}
.top-bg {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 420px;
  background: linear-gradient(180deg, #fff0ed 0%, #fff7f5 55%, #f7f8fa 100%);
  z-index: 0;
}

.top-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0 10px;
}
.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  background: #fff;
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(255, 75, 58, 0.1);
}
.search-box .ph {
  font-size: 13px;
  color: #999;
}
.top-actions {
  display: flex;
  gap: 14px;
}
.ta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: #333;
}
.ta-ico {
  font-size: 18px;
  line-height: 1;
}

/* 复制链接提示 */
.paste-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 14px;
  margin: 4px 0 12px;
  background: #fff;
  border-radius: 20px;
  font-size: 12px;
  color: #333;
  box-shadow: 0 2px 10px rgba(255, 75, 58, 0.08);
}
.pb-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pb-ico { font-size: 14px; }
.pb-plats {
  display: inline-flex;
  gap: 3px;
  margin: 0 2px;
}
.pb-plat-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 9px;
  font-weight: 600;
}
.pb-right {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #ff4b3a;
  font-weight: 600;
}

/* Banner */
.banner-swipe {
  position: relative;
  z-index: 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(255, 100, 50, 0.18);
}
.banner-card {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  color: #fff;
  position: relative;
}
.banner-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.08) 55%, transparent 100%);
}
.bn-text {
  position: relative;
  z-index: 1;
  text-align: center;
}
.bn-tag {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(255,255,255,0.25);
  border-radius: 999px;
  font-size: 11px;
  backdrop-filter: blur(4px);
}
.bn-title {
  font-size: 18px;
  font-weight: 700;
  margin-top: 6px;
  text-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.bn-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  padding: 4px 12px;
  background: #fff;
  color: #ff4b3a;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

/* ========== 通用 section ========== */
.section {
  margin: 8px 12px 0;
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px 14px;
  border: 2px solid #ff6b35;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.12);
  overflow: hidden;
}

/* 标题在卡片外面 */
.sec-head-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 12px 0;
}
.sec-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}
.sec-more {
  font-size: 13px;
  color: #969799;
}

/* 平台授权大卡片（在顶部渐变区内） */
.auth-card {
  position: relative;
  z-index: 1;
  margin-top: 10px;
  padding: 14px 14px 12px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(255, 75, 58, 0.1);
}
.ac-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.ac-title {
  font-size: 17px;
  font-weight: 700;
  color: #1a1a1a;
}
.ac-sub {
  font-size: 13px;
  color: #999;
}
.ac-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.ac-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 0 10px;
  border-radius: 12px;
  background: #f5f9f5;
  transition: transform 0.15s;
}
.ac-item:active { transform: scale(0.95); }
.ac-item.done {
  background: #f0f8f0;
}
.ac-dot {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}
.ac-name {
  font-size: 13px;
  color: #333;
  font-weight: 500;
}
.ac-st {
  font-size: 12px;
  color: #07c160;
  font-weight: 500;
}
.ac-item:not(.done) .ac-st {
  color: #ff4b3a;
}

/* ========== 比价卡片 ========== */
.cmp-card {
  margin: 12px 12px 0;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 14px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}
.cmp-tag {
  font-size: 11px;
  opacity: 0.85;
  margin-bottom: 4px;
}
.cmp-title {
  font-size: 16px;
  font-weight: 700;
}
.cmp-sub {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 4px;
}
.cmp-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cmp-save {
  text-align: right;
}
.cs-n {
  display: block;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}
.cs-t {
  font-size: 10px;
  opacity: 0.8;
}

/* ========== 活动跑马灯 ========== */
.act-section {
  border-color: #fff;
  box-shadow: 0 4px 12px rgba(124, 92, 255, 0.15);
}
.act-marquee {
  margin: 0 -14px;
  padding: 0 14px;
  overflow: hidden;
  position: relative;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
  -webkit-touch-callout: none;
}
.act-marquee:active {
  cursor: grabbing;
}
.act-marquee::before,
.act-marquee::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 20px;
  z-index: 2;
  pointer-events: none;
}
.act-marquee::before {
  left: 0;
  background: linear-gradient(90deg, #fff 0%, transparent 100%);
}
.act-marquee::after {
  right: 0;
  background: linear-gradient(-90deg, #fff 0%, transparent 100%);
}
.am-track {
  display: flex;
  gap: 10px;
  width: max-content;
  will-change: transform;
}
.act-card {
  flex: 0 0 auto;
  width: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  background: linear-gradient(135deg, #fff5f3 0%, #fff 100%);
  border-radius: 12px;
  border: 1px solid #ffe8e2;
  text-align: center;
}
.act-card:active {
  transform: scale(0.95);
}
.ac-ico {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 20px;
  color: #fff;
  flex-shrink: 0;
}
.ac-info {
  width: 100%;
  min-width: 0;
}
.ac-title {
  font-size: 12px;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ac-sub {
  font-size: 10px;
  color: #ff4b3a;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========== 品类宫格 ========== */
.grid-card {
  background: #fff;
  border-radius: 8px;
  padding: 8px 0 4px;
}
.cat-swipe {
  min-height: 150px;
}
.cat-page {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px 0;
  padding: 0 4px;
}
.cat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.cat-item:active { transform: scale(0.95); }
.cat-ico {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  font-size: 22px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.06);
  transition: transform 0.2s;
}
.cat-name {
  font-size: 12px;
  color: #333;
}

/* ========== 好物推荐 ========== */
.rank-section {
  border-color: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

/* ========== 榜单 tabs ========== */
.rank-tabs {
  margin: 0 -14px 10px;
  padding: 0 14px;
  font-weight: 600;
}
.rank-tip {
  font-size: 11px;
  color: #b0b3b8;
  margin-bottom: 8px;
}

/* ========== 返回顶部悬浮按钮 ========== */
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

/* ========== 商品列表 ========== */
.goods-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* ========== 全部活动弹窗 ========== */
.all-acts {
  display: flex;
  flex-direction: column;
}
.aa-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid #f2f2f2;
}
.aa-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}
.aa-grid {
  padding: 14px 12px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px 8px;
}
.aa-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.aa-item:active {
  transform: scale(0.95);
}
.aa-ico {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 20px;
  color: #fff;
  margin-bottom: 6px;
}
.aa-name {
  font-size: 12px;
  font-weight: 500;
  color: #1a1a1a;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  width: 100%;
}

/* ========== 品牌专区 ========== */
.brand-section {
  border-color: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  padding: 10px 14px 12px;
}
.brand-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  margin: 0 -14px;
  padding: 4px 14px 6px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.brand-scroll::-webkit-scrollbar { display: none; }
.brand-item {
  flex: 0 0 auto;
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.brand-item:active { transform: scale(0.95); }
.b-ico {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.b-name {
  font-size: 12px;
  font-weight: 500;
  color: #1a1a1a;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.b-cnt {
  font-size: 10px;
  color: #999;
}

/* 全部品牌弹窗 */
.all-brands {
  display: flex;
  flex-direction: column;
}
.brand-grid {
  padding: 14px 12px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px 8px;
}
.bg-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.bg-item:active { transform: scale(0.95); }
.bg-ico {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.bg-name {
  font-size: 12px;
  font-weight: 500;
  color: #1a1a1a;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  width: 100%;
}
.brand-empty {
  padding: 40px 0;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
