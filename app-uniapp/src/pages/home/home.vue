<template>
  <view class="home-v2">
    <!-- ══════════ 顶部渐变区 ══════════ -->
    <view class="top-wrap">
      <view class="top-bg"></view>

      <!-- 搜索 + 刷新 -->
      <view class="top-bar">
        <view class="search-box" @click="go('/pages/search/search')">
          <text class="search-icon">🔍</text>
          <text class="search-ph">搜隐藏优惠券 · 搜什么都返</text>
        </view>
        <view class="refresh-btn" @click="onRefresh">
          <text class="refresh-ico">↻</text>
        </view>
      </view>

      <!-- 开启返利卡片（JTK 本地生活不需要授权，只展示四个电商平台） -->
      <view class="auth-card">
        <view class="ac-head">
          <text class="ac-title">开启返利</text>
          <text class="ac-sub">授权后订单才认得到你</text>
        </view>
        <view class="ac-list">
          <view
            v-for="p in authPlats"
            :key="p.key"
            class="ac-item"
            :class="{ done: auth[p.key] === true }"
            @click="go(`/pages/category/category?platform=${p.key}`)"
          >
            <view class="ac-dot" :style="{ background: p.bg }">{{ p.short }}</view>
            <text class="ac-st">{{ auth[p.key] === true ? '已开启' : '去开启' }}</text>
          </view>
        </view>
      </view>

      <!-- Banner 轮播：后台配置优先，无配置时用兜底海报 -->
      <swiper
        class="banner-swipe"
        :autoplay="banners.length > 1"
        :interval="4000"
        :circular="banners.length > 1"
        :indicator-dots="banners.length > 1"
        indicator-color="rgba(255,255,255,0.5)"
        indicator-active-color="#ffffff"
      >
        <swiper-item v-for="b in banners" :key="b.id || b.title" @click="openLink(b)">
          <view class="banner-card" :style="bannerBg(b)">
            <text v-if="b.watermark" class="bn-watermark">{{ b.watermark }}</text>
            <view class="bn-text" :class="{ 'has-icons': (b.icons || []).length }">
              <text class="bn-tag">{{ b.subtitle || '限时活动' }}</text>
              <text class="bn-title">{{ b.title }}</text>
              <text v-if="b.desc" class="bn-desc">{{ b.desc }}</text>
              <view class="bn-btn">
                <text>{{ b.btnText || '立即抢购' }}</text>
                <text class="bn-arrow">›</text>
              </view>
            </view>
            <view v-if="(b.icons || []).length" class="bn-icons">
              <view
                v-for="(ic, i) in b.icons"
                :key="i"
                class="bi-dot"
                :style="biDotStyle(i)"
              >{{ ic }}</view>
            </view>
          </view>
        </swiper-item>
      </swiper>

      <!-- 签到 + 转链 -->
      <view class="entry-row">
        <view class="checkin-bar" @click="go('/pages/checkin/checkin')">
          <text class="cb-ico">🎁</text>
          <view class="cb-text">
            <text class="cb-title">每日签到领金币</text>
            <text class="cb-sub">攒够就能换钱</text>
          </view>
          <text class="cb-arrow">›</text>
        </view>
        <view class="parse-btn" @click="go('/pages/parse/parse')">
          <text class="pb-ico">💵</text>
          <text class="pb-label">转链</text>
        </view>
      </view>
    </view>

    <!-- ══════════ 本地生活宫格 ══════════ -->
    <view class="sec-head-wrap">
      <text class="sec-title">本地生活 🍔</text>
      <text class="sec-more" @click="openLocalLife('more')">全部 ›</text>
    </view>
    <view class="section ll-section pat">
      <image class="pat-bg" src="/static/bg/ll.png" mode="scaleToFill" />
      <swiper
        :autoplay="llPages.length > 1"
        :interval="5000"
        :circular="llPages.length > 1"
        :indicator-dots="llPages.length > 1"
        indicator-color="rgba(255,149,0,0.3)"
        indicator-active-color="#ff9500"
        class="ll-swipe"
      >
        <swiper-item v-for="(pageItems, pi) in llPages" :key="pi">
          <view class="ll-page">
            <view
              v-for="e in pageItems"
              :key="e.key"
              class="ll-item"
              @click="openLocalLife(e)"
            >
              <view class="ll-ico" :style="{ background: e.bg }">
                <app-icon :name="e.icon" :size="44" />
              </view>
              <text class="ll-name">{{ e.name }}</text>
              <text class="ll-tag">{{ e.tag }}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <!-- ══════════ 全网比价 ══════════ -->
    <view v-if="compare.length" class="cmp-card" @click="go('/pages/compare/compare')">
      <view class="cmp-left">
        <text class="cmp-tag">⚖️ 全网比价</text>
        <text class="cmp-title">同款商品各平台到手价对比</text>
        <text class="cmp-sub">已收录 {{ compare.length }} 组比价 · 帮你选最便宜的</text>
      </view>
      <view class="cmp-right">
        <view v-if="topSave > 0" class="cmp-save">
          <text class="cs-n">¥{{ topSave }}</text>
          <text class="cs-t">最多省</text>
        </view>
        <text class="cmp-arrow">›</text>
      </view>
    </view>

    <!-- ══════════ 品类宫格 ══════════ -->
    <view class="sec-head-wrap">
      <text class="sec-title">商品分类 🍡</text>
      <text class="sec-more">共 {{ catGroups.length }} 个</text>
    </view>
    <view class="section cats-section pat">
      <image class="pat-bg" src="/static/bg/cat.png" mode="scaleToFill" />
      <swiper
        :autoplay="catPages.length > 1"
        :interval="5000"
        :circular="catPages.length > 1"
        :indicator-dots="catPages.length > 1"
        indicator-color="rgba(255,75,58,0.3)"
        indicator-active-color="#ff4b3a"
        class="cat-swipe"
      >
        <swiper-item v-for="(pageItems, pi) in catPages" :key="pi">
          <view class="cat-page">
            <view
              v-for="e in pageItems"
              :key="e.key"
              class="cat-item"
              @click="openCat(e)"
            >
              <view
                class="cat-ico"
                :style="{ background: isImageUrl(e.icon) ? 'transparent' : e.bg }"
              >
                <app-icon :name="e.icon" :size="48" />
              </view>
              <text class="cat-name">{{ e.name }}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <!-- ══════════ 品牌专区 ══════════ -->
    <block v-if="brandTopics.length">
      <view class="sec-head-wrap">
        <text class="sec-title">品牌专区 ™️</text>
        <text class="sec-more" @click="showAllBrands = true">全部品牌 ›</text>
      </view>
      <view class="section brand-section pat">
        <image class="pat-bg" src="/static/bg/brand.png" mode="scaleToFill" />
        <swiper
          :autoplay="brandPages.length > 1"
          :interval="4000"
          :circular="brandPages.length > 1"
          :indicator-dots="brandPages.length > 1"
          indicator-color="rgba(255,75,58,0.3)"
          indicator-active-color="#ff4b3a"
          class="brand-swipe"
        >
          <swiper-item v-for="(pageItems, pi) in brandPages" :key="pi">
            <view class="brand-page">
              <view
                v-for="b in pageItems"
                :key="b.id"
                class="brand-item"
                @click="go(`/pages/topic/topic?slug=${b.slug}`)"
              >
                <view class="b-ico" :style="{ background: brandBg(b) }">
                  <app-icon :name="brandIcon(b)" :size="40" />
                </view>
                <text class="b-name">{{ brandName(b) }}</text>
              </view>
            </view>
          </swiper-item>
        </swiper>
      </view>
    </block>

    <!-- ══════════ 限时活动跑马灯 ══════════ -->
    <block v-if="acts.length">
      <view class="sec-head-wrap">
        <text class="sec-title">限时活动 ⏰</text>
        <text class="sec-more" @click="showAllActs = true">全部活动 ›</text>
      </view>
      <view class="section act-section pat">
        <image class="pat-bg" src="/static/bg/act.png" mode="scaleToFill" />
        <view
          class="act-marquee"
          @touchstart="marqueePause = true"
          @touchend="marqueePause = false"
        >
          <view
            class="am-track"
            :style="{
              width: marqueeTrackWidth,
              animationDuration: marqueeDuration + 's',
              animationPlayState: marqueePause ? 'paused' : 'running',
            }"
          >
            <view
              v-for="(a, i) in marqueeActs"
              :key="a.key + '-' + i"
              class="act-card"
              @click="openLink(a)"
            >
              <view
                class="ac-ico"
                :style="{ background: isImageUrl(a.icon) ? 'transparent' : (a.bg || 'linear-gradient(135deg,#ff6b35,#f7931e)') }"
              >
                <app-icon :name="a.icon || '🎁'" :size="40" />
              </view>
              <view class="ac-info">
                <text class="ac-title">{{ a.title }}</text>
                <text class="ac-sub">{{ a.subtitle || '限时特惠' }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </block>

    <!-- ══════════ 好物推荐榜单 ══════════ -->
    <view class="sec-head-wrap rank-head">
      <text class="sec-title">好物推荐 👍</text>
      <text class="sec-more" @click="go('/pages/category/category?platform=ALL')">全部 ›</text>
    </view>
    <view class="section rank-section">
      <!-- 榜单 tabs -->
      <view class="rank-tabs">
        <view
          v-for="(r, i) in RANKS"
          :key="r.type"
          class="rank-tab"
          :class="{ on: rankIdx === i }"
          @click="switchRank(i)"
        >{{ r.name }}</view>
      </view>

      <!-- 返利榜二级排序 -->
      <view v-if="currentRankType === 'rebate'" class="rebate-sort">
        <view
          class="rs-item"
          :class="{ on: rebateSortBy === 'amount' }"
          @click="switchRebateSort('amount')"
        >💰 返利金额</view>
        <view
          class="rs-item"
          :class="{ on: rebateSortBy === 'rate' }"
          @click="switchRebateSort('rate')"
        >📈 返佣比例</view>
      </view>

      <text v-if="rankTip" class="rank-tip">{{ rankTip }}</text>

      <view class="goods-grid">
        <goods-card v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
      </view>

      <view v-if="rankSoftLimitReached && !rankFinished && list.length" class="soft-limit-bar">
        <button class="soft-btn" @click="continueRankLoad">加载更多</button>
      </view>
      <view v-else-if="rankFinished && list.length" class="finished-text">
        — 更多好物去分类页逛逛 —
      </view>
      <view v-if="!rankLoading && !list.length" class="rank-empty">{{ emptyText }}</view>
      <view v-if="rankLoading" class="state">加载中…</view>
    </view>

    <!-- 悬浮返回顶部 -->
    <view v-show="showBackTop" class="back-top-fab" @click="scrollToTop">
      <text class="bt-ico">↑</text>
    </view>

    <!-- ══════════ 全部活动弹层 ══════════ -->
    <view v-if="showAllActs" class="sheet-mask" @click="showAllActs = false">
      <view class="sheet" @click.stop>
        <view class="aa-head">
          <text class="aa-title">全部活动</text>
          <text class="aa-close" @click="showAllActs = false">✕</text>
        </view>
        <scroll-view scroll-y class="aa-scroll">
          <view class="aa-grid">
            <view
              v-for="a in acts"
              :key="a.key"
              class="aa-item"
              @click="openLink(a); showAllActs = false"
            >
              <view
                class="aa-ico"
                :style="{ background: isImageUrl(a.icon) ? 'transparent' : (a.bg || gradientFromName(a.title)) }"
              >
                <app-icon :name="a.icon || '🎁'" :size="44" />
              </view>
              <text class="aa-name">{{ a.title }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- ══════════ 全部品牌弹层 ══════════ -->
    <view v-if="showAllBrands" class="sheet-mask" @click="showAllBrands = false">
      <view class="sheet" @click.stop>
        <view class="aa-head">
          <text class="aa-title">全部品牌</text>
          <text class="aa-close" @click="showAllBrands = false">✕</text>
        </view>
        <scroll-view scroll-y class="aa-scroll">
          <view v-if="allBrands.length" class="brand-grid">
            <view
              v-for="b in allBrands"
              :key="b.id"
              class="bg-item"
              @click="go(`/pages/topic/topic?slug=${b.slug}`); showAllBrands = false"
            >
              <view class="bg-ico" :style="{ background: brandBg(b) }">
                <app-icon :name="brandIcon(b)" :size="42" />
              </view>
              <text class="bg-name">{{ brandName(b) }}</text>
            </view>
          </view>
          <view v-else class="brand-empty">品牌标签正在积累中，先看看品类吧～</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { onShow, onReachBottom, onPageScroll } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { getToken } from '../../utils/storage.js';
import { PLATFORMS as PLATS } from '../../utils/platform.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';
import AppIcon from '../../components/app-icon/app-icon.vue';

/* ───────── 常量 ───────── */

const RANKS = [
  { type: 'hot', name: '🔥 热销榜', tip: '按近 7 天实付订单数排序，真金白银选出来的' },
  { type: 'rebate', name: '💰 返利榜' },
  { type: 'pick', name: '⭐️ 推荐榜', tip: '用户一人一票投出来的' },
];

/** 后台没配 banner 时的兜底海报（站内路由直接用 uni 路径） */
const FALLBACK_BANNERS = [
  {
    id: 'fb-1', subtitle: '每日签到', title: '天天签到领金币',
    desc: '连续签到 7 天 · 额外奖励翻倍 · 攒够直接提现',
    image: 'linear-gradient(135deg,#ff9f43,#ee5a24)',
    watermark: '🎁', icons: ['🗓️', '🪙', '🎁'],
    url: '/pages/checkin/checkin', internal: true, btnText: '立即签到',
  },
  {
    id: 'fb-2', subtitle: '本地生活', title: '吃喝玩乐都省钱',
    desc: '外卖 · 奶茶 · 电影 · 酒店 最高省 30%',
    image: 'linear-gradient(135deg,#7c4dff,#448aff)',
    watermark: '🍔', icons: ['🍔', '🎬', '🏨'],
    url: '/pages/local-life/local-life', internal: true, btnText: '立即抢购', tab: true,
  },
  {
    id: 'fb-3', subtitle: '购物返利', title: '网购先查返利',
    desc: '淘宝 · 京东 · 拼多多 · 唯品会 隐藏券 + 高额返利',
    image: 'linear-gradient(135deg,#ff3b30,#af52de)',
    watermark: '🛍️', icons: ['🛒', '🎫', '👗'],
    url: '/pages/category/category?platform=ALL', internal: true, btnText: '去逛逛',
  },
  {
    id: 'fb-4', subtitle: '邀请好友', title: '邀请好友一起做推广',
    desc: '好友下单赚佣金 · 长期分成 永久有效',
    image: 'linear-gradient(135deg,#ff4081,#d500f9)',
    watermark: '🧑‍🤝‍🧑', icons: ['👯', '🤝', '🪙'],
    url: '/pages/agent/agent', internal: true, btnText: '立即邀请',
  },
];

/** 本地生活宫格（tab/cat 预留：local-life 页暂未做 tabs，先统一进列表页） */
const LL_ITEMS = [
  { key: 'ele', name: '饿了么', icon: '🍜', tag: '领红包', bg: 'linear-gradient(135deg,#00b43c,#00963a)', tab: 'ele' },
  { key: 'mt', name: '美团券包', icon: '🎫', tag: '天天神券', bg: 'linear-gradient(135deg,#ffd100,#ff9500)', tab: 'mt' },
  { key: 'movie', name: '电影票', icon: '🎬', tag: '特惠看', bg: 'linear-gradient(135deg,#ff6b9d,#c44569)', tab: 'all' },
  { key: 'hotel', name: '酒店民宿', icon: '🏨', tag: '超值住', bg: 'linear-gradient(135deg,#4ecdc4,#44a08d)', tab: 'all' },
  { key: 'taxi', name: '打车出行', icon: '🚕', tag: '立减券', bg: 'linear-gradient(135deg,#f7931e,#ff6b35)', tab: 'all' },
  { key: 'coffee', name: '咖啡奶茶', icon: '☕', tag: '买一送一', bg: 'linear-gradient(135deg,#c44569,#f8b500)', tab: 'all' },
  { key: 'vip', name: '会员权益', icon: '✨', tag: '半价充', bg: 'linear-gradient(135deg,#667eea,#764ba2)', tab: 'all' },
  { key: 'ticket', name: '景点门票', icon: '🏞️', tag: '低价游', bg: 'linear-gradient(135deg,#4facfe,#00f2fe)', tab: 'all' },
];

/** 品类兜底（key 必须在 constants/groups.js 里存在） */
const PRESET_CATS = [
  { key: 'food', name: '美食生鲜', icon: '🍎', bg: 'linear-gradient(135deg,#ff9a56,#ff6b35)' },
  { key: 'beauty', name: '美妆个护', icon: '💄', bg: 'linear-gradient(135deg,#ff6b9d,#c44569)' },
  { key: 'daily', name: '家居日用', icon: '🏠', bg: 'linear-gradient(135deg,#4ecdc4,#44a08d)' },
  { key: 'digital', name: '数码家电', icon: '📱', bg: 'linear-gradient(135deg,#667eea,#764ba2)' },
  { key: 'travel', name: '旅行优惠', icon: '✈️', bg: 'linear-gradient(135deg,#43cea2,#185a9d)' },
  { key: 'car', name: '加油打车', icon: '🚗', bg: 'linear-gradient(135deg,#5b9cf8,#3a7bd5)' },
  { key: 'fun', name: '吃喝玩乐', icon: '🎮', bg: 'linear-gradient(135deg,#a05bf8,#7b3ad5)' },
  { key: 'cheap', name: '9块9特卖', icon: '💰', bg: 'linear-gradient(135deg,#ffb74d,#f57c00)' },
];

const GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#30cfd0,#330867)',
  'linear-gradient(135deg,#a8edea,#fed6e3)',
  'linear-gradient(135deg,#ffecd2,#fcb69f)',
  'linear-gradient(135deg,#84fab0,#8fd3f4)',
  'linear-gradient(135deg,#fccb90,#d57eeb)',
  'linear-gradient(135deg,#e0c3fc,#8ec5fc)',
  'linear-gradient(135deg,#f5576c,#f093fb)',
  'linear-gradient(135deg,#48c6ef,#6f86d6)',
  'linear-gradient(135deg,#ff9a9e,#fecfef)',
  'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
  'linear-gradient(135deg,#fbc2eb,#a6c1ee)',
];

/** tabBar 页面必须 switchTab，且不能带参数 */
const TAB_PAGES = [
  '/pages/home/home',
  '/pages/local-life/local-life',
  '/pages/cart/cart',
  '/pages/mine/mine',
];

/* ───────── 状态 ───────── */

const auth = reactive({});
const authPlats = computed(() => PLATS.filter((p) => p.key !== 'JTK'));

const banners = ref(FALLBACK_BANNERS);
const topics = ref([]);
const compare = ref([]);
const topSave = ref(0);

const rankIdx = ref(0);
const rebateSortBy = ref('amount');
const list = ref([]);
const rankPage = ref(1);
const rankLoading = ref(false);
const rankFinished = ref(false);

const RANK_SOFT_LIMIT_INITIAL = 10;
const RANK_SOFT_LIMIT_STEP = 5;
const rankSoftLimitPage = ref(RANK_SOFT_LIMIT_INITIAL);
const rankSoftLimitReached = ref(false);

const marqueePause = ref(false);
const showAllActs = ref(false);
const showAllBrands = ref(false);
const showBackTop = ref(false);

/* ───────── 计算属性 ───────── */

const currentRankType = computed(() => RANKS[rankIdx.value]?.type || 'hot');
const rankTip = computed(() => {
  if (currentRankType.value === 'rebate') {
    return rebateSortBy.value === 'rate'
      ? '按返佣比例排序，高比例商品手慢无'
      : '按佣金绝对金额排序，买到手省得最多';
  }
  return RANKS[rankIdx.value]?.tip || '';
});
const emptyText = computed(() =>
  RANKS[rankIdx.value].type === 'hot' ? '还没有真实订单数据，榜单在积累中' : '货架还在备货，先看看别的分区',
);

// 活动位：取前 10 个启用中的 activity 专题
const acts = computed(() =>
  topics.value
    .filter((t) => t.type === 'activity' && t.status === 1)
    .slice(0, 10)
    .map((t) => ({
      key: `t-${t.slug}`,
      title: t.name,
      subtitle: t.intro || '',
      icon: t.icon || '🎁',
      bg: t.bg || gradientFromName(t.name),
      url: `/pages/topic/topic?slug=${t.slug}`,
      internal: true,
    })),
);

// 品牌专区：按商品数取前 20
const brandTopics = computed(() =>
  topics.value
    .filter((t) => t.type === 'brand' && t.status === 1)
    .sort((a, b) => (b.goodsCount || 0) - (a.goodsCount || 0))
    .slice(0, 20),
);
const BRAND_PER_PAGE = 5;
const brandPages = computed(() => chunk(brandTopics.value, BRAND_PER_PAGE));
const allBrands = computed(() =>
  topics.value
    .filter((t) => t.type === 'brand' && t.status === 1)
    .sort((a, b) => (b.goodsCount || 0) - (a.goodsCount || 0)),
);

// 本地生活：每页 5 个
const llPages = computed(() => chunk(LL_ITEMS, 5));

// 品类宫格：后台品类专题优先，不足 4 个用预设补到 8 个；每页 8 个
const catGroups = computed(() => {
  const out = [];
  const has = (url) => out.some((o) => o.url === url);
  topics.value
    .filter((t) => t.type === 'category' && t.status === 1)
    .forEach((t, i) => out.push({
      key: `topic-${t.slug}`,
      name: t.name,
      icon: t.icon || '📦',
      bg: t.bg || `hsl(${(i * 37) % 360}, 70%, 85%)`,
      url: `/pages/topic/topic?slug=${t.slug}`,
      internal: true,
    }));
  if (out.length < 4) {
    for (const g of PRESET_CATS) {
      if (out.length >= 8) break;
      const url = `/pages/group/group?key=${g.key}`;
      if (has(url)) continue;
      out.push({ ...g, key: `pre-${g.key}`, url, internal: true });
    }
  }
  return out;
});
const catPages = computed(() => chunk(catGroups.value, 8));

// 跑马灯：复制偶数份做无缝循环
const marqueeActs = computed(() => {
  const arr = acts.value;
  if (!arr.length) return [];
  let reps = Math.ceil(10 / arr.length);
  if (reps < 2) reps = 2;
  if (reps % 2) reps += 1;
  return Array.from({ length: reps }, () => arr).flat();
});
const marqueeDuration = computed(() => {
  const n = acts.value.length;
  const dist = n * 108; // 每张卡约 100px + 8px 间距
  return Math.max(15, dist / 50); // 速度约 50px/s
});
// 卡片 152rpx(border-box) + gap 20rpx = 172rpx/个，显式宽度避免 WXSS 不支持 max-content
const marqueeTrackWidth = computed(() => `${marqueeActs.value.length * 172}rpx`);

/* ───────── 工具函数 ───────── */

function chunk(arr, size) {
  const pages = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages.length ? pages : [[]];
}

function isImageUrl(icon) {
  if (!icon) return false;
  return /^(https?:|\/)/.test(icon);
}

function gradientFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function brandName(t) {
  return t.name.replace(/^品牌[·•\-]/, '');
}
function brandIcon(t) {
  const name = brandName(t);
  if (t.icon && t.icon !== '🏷️') return t.icon;
  return name ? name.charAt(0) : '🏷️';
}
function brandBg(t) {
  if (t.bg && t.bg !== 'linear-gradient(135deg,#e0eafc,#cfdef3)') return t.bg;
  return gradientFromName(brandName(t));
}

/** banner 背景：图片 URL 走 backgroundImage，渐变串直接当 background */
function bannerBg(b) {
  const raw = b.image || b.bg || 'linear-gradient(135deg,#ff6b35,#f7931e)';
  if (/^(https?:|\/)/.test(raw)) {
    return { backgroundImage: `url(${raw})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background: raw };
}

/** 三个装饰圆点的错落定位（对齐 H5 nth-child） */
function biDotStyle(i) {
  const pos = [
    'top: 20rpx; right: 36rpx; transform: rotate(-8deg);',
    'top: 152rpx; right: 0;',
    'bottom: 20rpx; right: 40rpx; transform: rotate(8deg);',
  ];
  return pos[i] || '';
}

/** H5 站内路径 → uni 路由（兼容后台配置的 /xxx 老路径） */
function mapInternal(url) {
  if (!url) return '';
  let u = url.replace(/^#/, '');
  const rules = [
    [/^\/local-life(\?.*)?$/, '/pages/local-life/local-life'],
    [/^\/checkin$/, '/pages/checkin/checkin'],
    [/^\/parse$/, '/pages/parse/parse'],
    [/^\/agent$/, '/pages/agent/agent'],
    [/^\/compare$/, '/pages/compare/compare'],
    [/^\/search$/, '/pages/search/search'],
    [/^\/category\/all$/, '/pages/category/category?platform=ALL'],
    [/^\/category\/(.+)$/, (m) => `/pages/category/category?platform=${m[1].toUpperCase()}`],
    [/^\/group\/(.+)$/, (m) => `/pages/group/group?key=${m[1]}`],
    [/^\/topic\/(.+)$/, (m) => `/pages/topic/topic?slug=${m[1]}`],
  ];
  for (const [re, to] of rules) {
    const m = u.match(re);
    if (m) return typeof to === 'function' ? to(m) : to;
  }
  // 已经是 uni 路径（/pages/...）直接用
  if (u.startsWith('/pages/')) return u;
  return '';
}

/** 站内统一跳转：tabBar 页面 switchTab，其余 navigateTo */
function go(url) {
  if (!url) return;
  const path = url.split('?')[0];
  if (TAB_PAGES.includes(path)) {
    uni.switchTab({ url: path });
  } else {
    uni.navigateTo({ url });
  }
}

/** 活动位/banner 跳转：站内走路由，外链按端能力处理 */
function openLink(a) {
  if (!a.url) return;
  const isHttp = /^https?:\/\//.test(a.url);
  if (a.internal || (a.url.startsWith('/') && !isHttp)) {
    const mapped = mapInternal(a.url);
    if (mapped) {
      go(mapped);
      return;
    }
    // 后台误把外链标成站内：落到外链分流，不要点了没反应
    if (!isHttp) return;
  }
  // #ifdef APP-PLUS
  plus.runtime.openURL(a.url);
  // #endif
  // #ifdef H5
  window.open(a.url, '_blank');
  // #endif
  // #ifdef MP
  uni.setClipboardData({
    data: a.url,
    success: () => uni.showModal({
      title: '请在浏览器中打开',
      content: '链接已复制，粘贴到浏览器打开即可',
      showCancel: false,
    }),
  });
  // #endif
}

function openCat(e) {
  if (e.internal) go(e.url);
  else if (e.url) openLink(e);
}

function openLocalLife(item) {
  // local-life 是 tabBar 页，switchTab 不能带 query；用 storage 桥接 tab/cat
  if (item && typeof item === 'object' && item.key !== 'more') {
    const entry = { tab: item.tab || 'all' };
    if (entry.tab === 'all') entry.cat = item.key;
    uni.setStorageSync('ll-entry', entry);
  }
  uni.switchTab({ url: '/pages/local-life/local-life' });
}

/* ───────── 数据加载 ───────── */

async function loadAuth() {
  if (!getToken()) return;
  await Promise.all(authPlats.value.map(async (p) => {
    try {
      const s = await api.authzStatus(p.key);
      auth[p.key] = !s.needAuth;
    } catch {
      auth[p.key] = undefined;
    }
  }));
}

/** 侧边数据各自失败各自空，不互相牵连，更不能拖住主商品流 */
async function loadSide() {
  const safe = async (fn, apply) => {
    try {
      const v = await fn();
      apply(v);
    } catch { /* 保持默认值 */ }
  };
  await Promise.all([
    loadAuth(),
    safe(() => api.topics(), (v) => { topics.value = v?.list || []; }),
    safe(
      () => api.homeLinks('banner'),
      (v) => { if (Array.isArray(v) && v.length) banners.value = v; },
    ),
    safe(() => api.compareList(), (v) => {
      compare.value = v?.list || v || [];
    }),
  ]);

  // 全网最高省多少
  if (compare.value.length) {
    let max = 0;
    for (const g of compare.value) {
      const prices = (g.items || [])
        .map((i) => Number(i.couponPrice || i.price || 9999))
        .filter((n) => n > 0);
      if (prices.length >= 2) {
        const diff = Math.max(...prices) - Math.min(...prices);
        if (diff > max) max = diff;
      }
    }
    topSave.value = Math.round(max * 10) / 10;
  }
}

async function loadRank() {
  if (rankLoading.value) return;
  // 软上限：到了就停，让用户手动点继续
  if (rankPage.value > rankSoftLimitPage.value) {
    rankSoftLimitReached.value = true;
    return;
  }
  rankLoading.value = true;
  try {
    const r = await api.ranking(currentRankType.value, {
      page: rankPage.value,
      pageSize: 20,
      ...(currentRankType.value === 'rebate' ? { sortBy: rebateSortBy.value } : {}),
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

function resetRank() {
  list.value = [];
  rankPage.value = 1;
  rankFinished.value = false;
  rankSoftLimitPage.value = RANK_SOFT_LIMIT_INITIAL;
  rankSoftLimitReached.value = false;
  loadRank();
}

function switchRank(i) {
  if (rankIdx.value === i) return;
  rankIdx.value = i;
  resetRank();
}

function switchRebateSort(v) {
  if (rebateSortBy.value === v) return;
  rebateSortBy.value = v;
  resetRank();
}

function continueRankLoad() {
  rankSoftLimitPage.value += RANK_SOFT_LIMIT_STEP;
  rankSoftLimitReached.value = false;
  loadRank();
}

async function onRefresh() {
  uni.showLoading({ title: '刷新中' });
  try {
    await loadSide();
    resetRank();
  } finally {
    uni.hideLoading();
  }
}

function scrollToTop() {
  uni.pageScrollTo({ scrollTop: 0, duration: 200 });
}

/* ───────── 生命周期 ───────── */

let inited = false;
onShow(() => {
  // 页面在栈内保活，返回时榜单状态天然保留，只在首次进入时加载
  if (inited) return;
  inited = true;
  loadSide();
  loadRank();
});

onReachBottom(() => {
  if (!rankSoftLimitReached.value && !rankFinished.value) loadRank();
});

onPageScroll((e) => {
  showBackTop.value = e.scrollTop > 600;
});
</script>

<style lang="scss" scoped>
.home-v2 {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 40rpx;
  overflow-x: hidden;
}

/* ══════ 顶部渐变区 ══════ */
.top-wrap { position: relative; padding: 0 24rpx; }
.top-bg {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 800rpx;
  background: linear-gradient(180deg, #fff0ed 0%, #fff7f5 55%, #f7f8fa 100%);
  z-index: 0;
}
.top-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding-top: calc(24rpx + var(--status-bar-height, 0rpx));
}
.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 72rpx;
  padding: 0 28rpx;
  background: #fff;
  border-radius: 999rpx;
  box-shadow: 0 4rpx 20rpx rgba(255, 75, 58, 0.1);
}
.search-icon { font-size: 28rpx; }
.search-ph { font-size: 26rpx; color: #999; }
.refresh-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(255, 75, 58, 0.12);
}
.refresh-ico { font-size: 34rpx; color: $brand; font-weight: 700; }

/* 开启返利卡片 */
.auth-card {
  position: relative;
  z-index: 1;
  margin-top: 20rpx;
  padding: 20rpx 24rpx 18rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 8rpx 28rpx rgba(255, 75, 58, 0.1);
}
.ac-head {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.ac-title { font-size: 28rpx; font-weight: 700; color: #1a1a1a; }
.ac-sub { font-size: 22rpx; color: #999; }
.ac-list { display: flex; gap: 12rpx; }
.ac-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 0 12rpx;
  border-radius: 20rpx;
  background: #f7f8fa;
}
.ac-item.done { background: #f0f8f0; }
.ac-dot {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.1);
}
.ac-st { font-size: 20rpx; color: $brand; font-weight: 500; }
.ac-item.done .ac-st { color: #07c160; }

/* Banner */
.banner-swipe {
  position: relative;
  z-index: 1;
  height: 340rpx;
  margin-top: 20rpx;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 28rpx rgba(255, 100, 50, 0.18);
}
.banner-card {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 48rpx;
  color: #fff;
  position: relative;
  overflow: hidden;
}
.bn-watermark {
  position: absolute;
  left: -16rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 260rpx;
  opacity: 0.13;
  z-index: 0;
}
.bn-text {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bn-text.has-icons {
  align-self: stretch;
  align-items: flex-start;
  justify-content: center;
  padding-right: 152rpx;
}
.bn-tag {
  padding: 6rpx 24rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 999rpx;
  font-size: 22rpx;
}
.bn-title {
  font-size: 48rpx;
  font-weight: 800;
  margin-top: 14rpx;
  letter-spacing: 2rpx;
  text-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
}
.bn-text.has-icons .bn-title { font-size: 44rpx; }
.bn-desc {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
}
.bn-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 20rpx;
  padding: 10rpx 32rpx;
  background: #fff;
  color: $brand;
  font-size: 24rpx;
  font-weight: 700;
  border-radius: 999rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);
}
.bn-arrow { font-size: 26rpx; font-weight: 700; }
.bn-icons {
  position: absolute;
  top: 0; right: 24rpx; bottom: 0;
  width: 140rpx;
  z-index: 1;
}
.bi-dot {
  position: absolute;
  width: 80rpx;
  height: 80rpx;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.18);
}

/* 签到 + 转链 */
.entry-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: stretch;
  gap: 16rpx;
  margin: 20rpx 0;
}
.checkin-bar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 96rpx;
  padding: 0 24rpx;
  background: linear-gradient(135deg, #fff5e6, #fff0ed);
  border-radius: 999rpx;
  border: 2rpx solid #ffe0cc;
  box-shadow: 0 4rpx 20rpx rgba(255, 150, 50, 0.15);
}
.cb-ico { font-size: 36rpx; flex-shrink: 0; }
.cb-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.cb-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #ff6b35;
}
.cb-sub { font-size: 20rpx; color: #999; }
.cb-arrow { font-size: 32rpx; color: $brand; flex-shrink: 0; }
.parse-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 96rpx;
  border-radius: 999rpx;
  color: #fff;
  background: linear-gradient(135deg, #ff7a4d, #ff4b3a);
  box-shadow: 0 8rpx 24rpx rgba(255, 75, 58, 0.28);
}
.pb-ico { font-size: 34rpx; }
.pb-label { font-size: 28rpx; font-weight: 700; }

/* ══════ 通用 section / 标题 ══════ */
.sec-head-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 28rpx 24rpx 0;
}
.sec-title { font-size: 34rpx; font-weight: 700; color: #1a1a1a; }
.sec-more { font-size: 24rpx; color: #969799; }
.section {
  margin: 16rpx 24rpx 0;
  background: #fff;
  border-radius: 28rpx;
  padding: 24rpx 28rpx 28rpx;
  border: 2rpx solid #ffe0d6;
  box-shadow: 0 8rpx 24rpx rgba(255, 107, 53, 0.1);
  overflow: hidden;
}

/* S 形曲线彩底（移植 H5 pat-*：小程序 WXSS 不支持 SVG 背景，改用 image 铺 PNG） */
.pat {
  position: relative;
  background: transparent;
  border: none;
}
.pat-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
.ll-swipe,
.cat-swipe,
.brand-swipe,
.act-marquee {
  position: relative;
  z-index: 1;
}

/* ══════ 本地生活 ══════ */
.ll-swipe { height: 210rpx; }
.ll-page {
  display: flex;
  height: 100%;
  padding: 8rpx 8rpx;
}
.ll-item {
  flex: 0 0 20%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.ll-ico {
  width: 88rpx;
  height: 88rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.08);
}
.ll-name { font-size: 24rpx; color: #fff; font-weight: 500; }
.ll-tag {
  font-size: 18rpx;
  color: #ff6b35;
  background: #fff5f0;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
}

/* ══════ 比价卡片 ══════ */
.cmp-card {
  margin: 24rpx 24rpx 0;
  padding: 28rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 28rpx;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.3);
}
.cmp-left { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.cmp-tag { font-size: 22rpx; opacity: 0.85; margin-bottom: 8rpx; }
.cmp-title { font-size: 30rpx; font-weight: 700; }
.cmp-sub { font-size: 22rpx; opacity: 0.8; margin-top: 8rpx; }
.cmp-right { display: flex; align-items: center; gap: 16rpx; flex-shrink: 0; }
.cmp-save { text-align: right; }
.cs-n { font-size: 34rpx; font-weight: 700; line-height: 1; }
.cs-t { font-size: 20rpx; opacity: 0.8; }
.cmp-arrow { font-size: 36rpx; font-weight: 700; }

/* ══════ 品类宫格 ══════ */
.cat-swipe { height: 350rpx; }
.cat-page {
  display: flex;
  flex-wrap: wrap;
  height: 100%;
}
.cat-item {
  flex: 0 0 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 20rpx;
}
.cat-ico {
  width: 96rpx;
  height: 96rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.06);
  overflow: hidden;
}
.cat-name { font-size: 24rpx; color: #fff; }

/* ══════ 品牌专区 ══════ */
.brand-section { padding: 20rpx 16rpx; }
.brand-swipe { height: 190rpx; }
.brand-page {
  display: flex;
  justify-content: space-around;
  height: 100%;
  padding: 8rpx 16rpx;
}
.brand-item {
  flex: 0 0 auto;
  width: 120rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.b-ico {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.b-name {
  font-size: 22rpx;
  color: #fff;
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ══════ 活动跑马灯 ══════ */
.act-section {
  padding: 24rpx 0;
  box-shadow: 0 8rpx 24rpx rgba(255, 150, 50, 0.18);
}
.act-marquee {
  margin: 0 -28rpx;
  padding: 0 28rpx;
  overflow: hidden;
}
.am-track {
  display: flex;
  gap: 20rpx;
  box-sizing: border-box;
  animation: marquee-scroll 30s linear infinite;
}
@keyframes marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.act-card {
  flex: 0 0 auto;
  box-sizing: border-box;
  width: 152rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 12rpx;
  background: linear-gradient(135deg, #fff5f3 0%, #fff 100%);
  border-radius: 24rpx;
  border: 2rpx solid #ffe8e2;
}
.ac-ico {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  overflow: hidden;
}
.ac-info { width: 100%; min-width: 0; display: flex; flex-direction: column; }
.act-card .ac-title {
  font-size: 22rpx;
  font-weight: 600;
  color: #1a1a1a;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.act-card .ac-sub {
  font-size: 18rpx;
  color: $brand;
  margin-top: 4rpx;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ══════ 好物推荐 ══════ */
.rank-head { margin-bottom: 12rpx; }
.rank-section {
  border-color: #fff;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}
.rank-tabs {
  display: flex;
  gap: 40rpx;
  padding: 8rpx 8rpx 16rpx;
}
.rank-tab {
  font-size: 28rpx;
  font-weight: 600;
  color: #666;
  padding-bottom: 8rpx;
}
.rank-tab.on {
  color: $brand;
  font-size: 32rpx;
  font-weight: 800;
  border-bottom: 4rpx solid $brand;
}
.rebate-sort { display: flex; gap: 12rpx; margin: 4rpx 0 16rpx; }
.rs-item {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  font-weight: 600;
  color: #666;
  background: #f5f6f8;
  border: 2rpx solid #ebedf0;
  border-radius: 999rpx;
  padding: 10rpx 0;
}
.rs-item.on {
  color: #fff;
  background: linear-gradient(135deg, #ff6b35, #ff4b3a);
  border-color: $brand;
}
.rank-tip {
  display: block;
  font-size: 22rpx;
  color: #b0b3b8;
  margin-bottom: 12rpx;
}
.goods-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}
.soft-limit-bar { padding: 20rpx 32rpx 12rpx; }
.soft-btn {
  background: #fff;
  color: #666;
  border: 2rpx solid #ebedf0;
  border-radius: 999rpx;
  font-size: 26rpx;
}
.soft-btn::after { border: none; }
.finished-text {
  text-align: center;
  color: #b0b3b8;
  font-size: 22rpx;
  padding: 24rpx 0 8rpx;
}
.rank-empty {
  text-align: center;
  color: #999;
  font-size: 24rpx;
  padding: 60rpx 0;
}
.state { text-align: center; color: #999; font-size: 24rpx; padding: 30rpx; }

/* ══════ 返回顶部 ══════ */
.back-top-fab {
  position: fixed;
  right: 28rpx;
  bottom: 220rpx;
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: #fff;
  color: $brand;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);
  z-index: 200;
}
.bt-ico { font-size: 36rpx; font-weight: 700; }

/* ══════ 底部弹层 ══════ */
.sheet-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 300;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  max-height: 75vh;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  animation: sheet-up 0.22s ease-out;
}
@keyframes sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.aa-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
  border-bottom: 2rpx solid #f2f2f2;
}
.aa-title { font-size: 32rpx; font-weight: 600; color: #1a1a1a; }
.aa-close { font-size: 32rpx; color: #999; padding: 0 8rpx; }
.aa-scroll { max-height: 60vh; }
.aa-grid {
  padding: 28rpx 24rpx 48rpx;
  display: flex;
  flex-wrap: wrap;
}
.aa-item {
  flex: 0 0 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28rpx;
}
.aa-ico {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 12rpx;
  overflow: hidden;
}
.aa-name {
  font-size: 22rpx;
  color: #1a1a1a;
  max-width: 140rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.brand-grid {
  padding: 28rpx 24rpx 48rpx;
  display: flex;
  flex-wrap: wrap;
}
.bg-item {
  flex: 0 0 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32rpx;
}
.bg-ico {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 12rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.bg-name {
  font-size: 22rpx;
  color: #1a1a1a;
  max-width: 140rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.brand-empty {
  padding: 80rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}
</style>
