<template>
  <div class="page">
    <!-- 顶部：搜索 + 转链 -->
    <div class="home-head">
      <div class="search-row">
        <div class="search-box" @click="$router.push('/search')">
          <van-icon name="search" color="#ff4b3a" size="16" style="margin-right:6px" />
          <input v-model="keyword" placeholder="搜隐藏优惠券" readonly />
          <span class="search-btn">搜索</span>
        </div>
        <div class="head-icon" @click="goParse">
          <van-icon name="exchange" size="20" />
          <span>转链</span>
        </div>
      </div>

      <!-- 口令粘贴条：返利平台的核心留存入口 -->
      <div class="paste-bar" @click="goParse">
        <span style="font-weight:600">复制</span>
        <span class="plats">
          <i class="plat-dot" style="background:#ff5000">淘</i>
          <i class="plat-dot" style="background:#e2231a">京</i>
          <i class="plat-dot" style="background:#e02e24">拼</i>
          <i class="plat-dot" style="background:#161823">抖</i>
        </span>
        <span style="font-weight:600">商品链接</span>
        <van-icon name="play" color="#ff4b3a" size="11" />
        <span class="cta">领券 + 返现 ›</span>
      </div>

      <van-swipe class="banner" :autoplay="4000" indicator-color="#fff">
        <van-swipe-item
          v-for="b in banners"
          :key="b.t1"
          :style="{ background: b.bg, height: '100%', display: 'grid', placeItems: 'center' }"
        >
          <div>
            <div class="t1">{{ b.t1 }}</div>
            <div class="t2">{{ b.t2 }}</div>
          </div>
        </van-swipe-item>
      </van-swipe>
    </div>

    <!-- 比价入口：没建比价组就不显示 -->
    <div v-if="compare.length" class="cmp-entry" @click="$router.push('/compare')">
      <div class="left">
        <div class="t">⚖️ 全网比价</div>
        <div class="s">同款商品各平台<b>到手价</b>对比 · {{ compare.length }} 组</div>
      </div>
      <div class="right">
        <div v-if="topSave > 0" class="save">最多省 ¥{{ topSave }}</div>
        <van-icon name="arrow" color="#fff" />
      </div>
    </div>

    <!-- 分类：一屏 8 个（两行四列），多了横滑翻页 -->
    <div class="grid-card">
      <div class="cat-scroll">
        <div class="cat-pages">
          <div v-for="(pageItems, pi) in catPages" :key="pi" class="cat-page">
            <div
              v-for="e in pageItems"
              :key="e.key"
              class="plat-item"
              @click="$router.push(`/group/${e.key}`)"
            >
              <div class="plat-icon" :style="{ background: e.bg }">{{ e.icon }}</div>
              <div class="l">{{ e.name }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="catPages.length > 1" class="cat-dots">
        <i v-for="(p, i) in catPages" :key="i" />
      </div>
    </div>

    <!-- 活动位：后台配的，没配就不占地方 -->
    <div v-if="links.length" class="act-row">
      <div v-for="a in links" :key="a.id" class="act-card" @click="openLink(a)">
        <div class="t">{{ a.title }}</div>
        <div class="s">{{ a.subtitle }}</div>
        <span class="emoji">{{ a.icon }}</span>
      </div>
    </div>

    <!-- 榜单 -->
    <van-tabs v-model:active="rankIdx" color="#ff4b3a" line-width="20" @change="loadRank">
      <van-tab v-for="r in RANKS" :key="r.type" :title="r.name" />
    </van-tabs>

    <div v-if="rankTip" class="rank-tip muted">{{ rankTip }}</div>

    <van-loading v-if="loading" style="padding:40px;text-align:center" />
    <div v-else class="goods-grid">
      <GoodsCard v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
    </div>

    <van-empty v-if="!loading && !list.length" :description="emptyText" />

    <BeianFooter />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import BeianFooter from '../components/BeianFooter.vue';
import { GRID_GROUPS, groupMeta } from '../constants/groups';

const RANKS = [
  { type: 'hot', name: '🔥 热销榜', tip: '按最近 7 天本站下单量排，不是平台的全站销量' },
  { type: 'rebate', name: '💰 返利榜', tip: '按到手返利排，返得最多的在前面' },
  { type: 'pick', name: '⭐️ 主编推荐', tip: '人工挑的，按后台权重排' },
];

const banners = [
  { t1: '天天领超级金币', t2: '最高得 100000 金币', bg: 'linear-gradient(135deg,#ff8a3d,#ff3b30)' },
  { t1: '大额券专区', t2: '券后 78 折起', bg: 'linear-gradient(135deg,#8b6b3d,#5d4322)' },
  { t1: '9.9 包邮', t2: '天天上新，买到就是赚到', bg: 'linear-gradient(135deg,#ff6a9a,#ff3b6b)' },
];

const router = useRouter();
const keyword = ref('');
const groups = ref([]);
const links = ref([]);
const compare = ref([]);
const list = ref([]);
const loading = ref(true);
const rankIdx = ref(0);

const rankTip = computed(() => RANKS[rankIdx.value]?.tip || '');
const emptyText = computed(() =>
  RANKS[rankIdx.value].type === 'hot'
    ? '还没有订单，热销榜攒够数据就出来了'
    : '后台还没选品',
);

const topSave = computed(() =>
  compare.value.reduce((m, g) => Math.max(m, g.maxSave || 0), 0),
);

/** 分类宫格：后台真有货的优先，一件都没选时退回预设，免得首页空一块 */
const catGroups = computed(() => {
  const real = groups.value.filter((g) => g.groupKey !== 'default' && g.onShelf > 0);
  if (!real.length) return GRID_GROUPS.slice(0, 8);
  return real.map((g, i) => groupMeta(g.groupKey, i));
});

/** 每页 8 个（两行四列），多出来的横滑翻页 */
const catPages = computed(() => {
  const all = catGroups.value;
  const pages = [];
  for (let i = 0; i < all.length; i += 8) pages.push(all.slice(i, i + 8));
  return pages.length ? pages : [[]];
});

function goParse() {
  if (!localStorage.getItem('token')) {
    return router.push({ path: '/login', query: { redirect: '/parse' } });
  }
  router.push('/parse');
}

function openLink(a) {
  if (!a.url) return showToast('这个活动还没配链接');
  if (a.internal) router.push(a.url);
  else window.open(a.url, '_blank');
}

async function loadRank() {
  loading.value = true;
  try {
    const r = await api.ranking(RANKS[rankIdx.value].type, 20);
    list.value = r.list || [];
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
}

/** 这三个都不该拖住首页主流，各自失败各自空，不互相牵连 */
async function loadSide() {
  const safe = async (fn, target) => {
    try { target.value = await fn(); } catch { target.value = []; }
  };
  await Promise.all([
    safe(() => api.goodsGroups(), groups),
    safe(() => api.homeLinks(), links),
    safe(() => api.compareList({ limit: 20 }), compare),
  ]);
}

onMounted(() => {
  loadRank();
  loadSide();
});
</script>
