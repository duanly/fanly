<template>
  <div class="home-v2">
    <!-- 顶部：渐变背景 + 搜索 -->
    <div class="top-wrap">
      <div class="top-bg"></div>

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

      <div class="top-bar">
        <div class="search-box" @click="$router.push('/search')">
          <van-icon name="search" color="#ff4b3a" size="15" />
          <span class="ph">搜隐藏优惠券 · 搜什么都返</span>
        </div>
        <div class="top-actions">
          <div class="ta-item" @click="goParse">
            <div class="ta-ico">🔗</div>
            <span>转链</span>
          </div>
          <div class="ta-item" @click="$router.push('/checkin')">
            <div class="ta-ico">🎁</div>
            <span>签到</span>
          </div>
        </div>
      </div>

      <!-- 复制链接提示条 -->
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
          <span>领券返现</span>
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
                <span>立即抢购</span>
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

    <!-- 活动标签位（无缝跑马灯） -->
    <div v-if="acts.length" class="section act-section">
      <div class="sec-head">
        <span class="sec-title">🔥 限时活动</span>
        <span class="sec-more" @click="scrollToCats">更多 ›</span>
      </div>
      <div class="act-marquee">
        <div class="am-track" :style="{ animationDuration: marqueeDuration + 's' }">
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

    <!-- 品类宫格 -->
    <div class="section" ref="catsRef">
      <div class="sec-head">
        <span class="sec-title">📦 全部分类</span>
        <span class="sec-more">共 {{ catGroups.length }} 个</span>
      </div>
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

    <!-- 好物推荐 -->
    <div class="section rank-section">
      <div class="sec-head">
        <span class="sec-title">🏆 好物推荐</span>
        <span class="sec-more" @click="$router.push('/group/default')">全部 ›</span>
      </div>

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

    <BeianFooter />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import BeianFooter from '../components/BeianFooter.vue';
import { PLATFORMS as PLATS } from '../utils/platform';

const router = useRouter();
const auth = reactive({});

const RANKS = [
  { type: 'hot', name: '热销榜', tip: '按近 7 天实付订单数排序，真金白银选出来的' },
  { type: 'rebate', name: '返利最高', tip: '佣金绝对金额排序，不是比例——比例高的往往是便宜货' },
  { type: 'pick', name: '推荐榜', tip: '用户一人一票投出来的，再加运营手动权重' },
];

/** 后台没配 banner 时的兜底，不让首页开天窗 */
const FALLBACK_BANNERS = [
  { id: 'fb-1', title: '天天签到领金币', subtitle: '攒够就能换钱', image: 'linear-gradient(135deg,#ff8a3d,#ff3b30)', url: '/checkin', internal: true },
  { id: 'fb-2', title: '全网比价', subtitle: '同款哪家最便宜，一眼看清', image: 'linear-gradient(135deg,#4a3aff,#7b3ad5)', url: '/compare', internal: true },
  { id: 'fb-3', title: '邀请好友赚钱', subtitle: '他买东西，你拿分成', image: 'linear-gradient(135deg,#ff6a9a,#ff3b6b)', url: '/agent', internal: true },
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

// 跑马灯：复制多份实现无缝循环，必须偶数份才不跳
const marqueeActs = computed(() => {
  const arr = acts.value;
  if (!arr.length) return [];
  let reps = Math.ceil(8 / arr.length);
  if (reps < 2) reps = 2;
  if (reps % 2) reps += 1;
  return Array.from({ length: reps }, () => arr).flat();
});
// 数量越多动画越长，但有上下限
const marqueeDuration = computed(() => {
  const n = acts.value.length;
  return Math.max(25, n * 5);
});

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
  if (auth[p.key] === true) {
    // 已开启 → 跳转到搜索页（后续可加平台筛选）
    router.push('/search');
  } else {
    goAuth(p);
  }
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

onMounted(() => {
  loadSide();
  loadRank();
});
</script>

<style scoped>
.home-v2 {
  background: #f7f8fa;
  padding-bottom: 20px;
}

/* ========== 顶部渐变区 ========== */
.top-wrap {
  position: relative;
  padding: 0 12px 14px;
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
  margin: 14px 12px 0;
  background: #fff;
  border-radius: 14px;
  padding: 14px 14px 14px;
  border-top: 6px solid #ff6b35;
  border-left: 2px solid #ff6b35;
  border-right: 2px solid #ff6b35;
  border-bottom: 2px solid #ff6b35;
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.12);
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -14px -14px 12px;
  padding: 0 10px;
}
.sec-title {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #ff6b35 0%, #ff4b3a 100%);
  border-radius: 0 4px 14px 0;
  box-shadow: 2px 2px 6px rgba(255, 75, 58, 0.25);
}
.sec-title::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0;
  width: 4px;
  height: 100%;
  background: rgba(0,0,0,0.15);
  border-radius: 0 0 0 2px;
}
.sec-more {
  font-size: 12px;
  color: #999;
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
  border-top-color: #7c5cff;
  border-left-color: #7c5cff;
  border-right-color: #7c5cff;
  border-bottom-color: #7c5cff;
  box-shadow: 0 4px 12px rgba(124, 92, 255, 0.15);
}
.act-section .sec-title {
  background: linear-gradient(135deg, #7c5cff 0%, #5b3dff 100%);
  box-shadow: 2px 2px 6px rgba(124, 92, 255, 0.25);
}
.act-section .sec-title::before {
  background: rgba(0,0,0,0.12);
}
.act-marquee {
  margin: 0 -14px;
  padding: 0 14px;
  overflow: hidden;
  position: relative;
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
  animation: marquee-scroll linear infinite;
  width: max-content;
}
.act-marquee:hover .am-track {
  animation-play-state: paused;
}
@keyframes marquee-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.act-card {
  flex: 0 0 auto;
  width: 150px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #fff5f3 0%, #fff 100%);
  border-radius: 12px;
  border: 1px solid #ffe8e2;
}
.ac-ico {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 18px;
  color: #fff;
  flex-shrink: 0;
}
.ac-info {
  min-width: 0;
}
.ac-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ac-sub {
  font-size: 11px;
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
  border-top: 2px solid #fff;
  border-left: 2px solid #fff;
  border-right: 2px solid #fff;
  border-bottom: 2px solid #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}
.rank-section .sec-title {
  background: linear-gradient(135deg, #ff6b35 0%, #ff4b3a 100%);
  box-shadow: 2px 2px 6px rgba(255, 75, 58, 0.25);
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

/* ========== 商品列表 ========== */
.goods-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
