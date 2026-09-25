<template>
  <div class="page">
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
        <div class="head-icon" @click="$router.push('/checkin')">
          <van-icon name="gift-o" size="20" />
          <span>签到</span>
        </div>
      </div>

      <!--
        平台授权：摆在最显眼的地方，就是为了拉新时当面能教会。
        没授权的订单认不到人，这一步比什么都重要。
      -->
      <div class="auth-row">
        <div class="ar-title">
          <span>开启返利</span>
          <span class="muted">授权后订单才认得到你</span>
        </div>
        <div class="ar-plats">
          <div
            v-for="p in PLATS"
            :key="p.key"
            class="ar-item"
            :class="{ done: auth[p.key] === true }"
            @click="goAuth(p)"
          >
            <span class="dot" :style="{ background: p.bg }">{{ p.short }}</span>
            <span class="n">{{ p.name }}</span>
            <span class="st">{{ auth[p.key] === true ? '已开启' : '去开启' }}</span>
          </div>
        </div>
      </div>

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
          :key="b.id || b.title"
          :style="bannerStyle(b)"
          @click="openLink(b)"
        >
          <div>
            <div class="t1">{{ b.title }}</div>
            <div class="t2">{{ b.subtitle }}</div>
          </div>
        </van-swipe-item>
      </van-swipe>
    </div>

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

    <div v-if="acts.length" class="act-row">
      <div v-for="a in acts" :key="a.key" class="act-card" @click="openLink(a)">
        <div class="t">{{ a.title }}</div>
        <div class="s">{{ a.subtitle }}</div>
        <span class="emoji">{{ a.icon }}</span>
      </div>
    </div>

    <div class="grid-card">
      <div class="cat-scroll">
        <div class="cat-pages">
          <div v-for="(pageItems, pi) in catPages" :key="pi" class="cat-page">
            <div
              v-for="e in pageItems"
              :key="e.key"
              class="plat-item"
              @click="openCat(e)"
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

    <van-tabs v-model:active="rankIdx" color="#ff4b3a" line-width="20" @change="loadRank">
      <van-tab v-for="r in RANKS" :key="r.type" :title="r.name" />
    </van-tabs>

    <div v-if="rankTip" class="rank-tip muted">{{ rankTip }}</div>

    <van-loading v-if="loading" style="padding:40px;text-align:center" />
    <div v-else class="goods-grid">
      <GoodsCard
        v-for="g in list"
        :key="g.platform + g.goodsId"
        :g="g"
        show-recommend
        @recommended="onRecommended"
      />
    </div>

    <van-empty v-if="!loading && !list.length" :description="emptyText" />

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
import { GRID_GROUPS, groupMeta } from '../constants/groups';
import { PLATFORMS as PLATS } from '../utils/platform';

const RANKS = [
  { type: 'hot', name: '🔥 热销榜', tip: '按最近 7 天本站下单量排；数据还少的时候用平台销量补齐' },
  { type: 'rebate', name: '💰 返利榜', tip: '按买了能返多少排，返得最多的在前面' },
  { type: 'pick', name: '⭐️ 推荐榜', tip: '大家推荐次数最多的，你也可以给喜欢的商品点推荐' },
];

/** 后台一条 banner 都没配时的兜底，不让首页开天窗 */
const FALLBACK_BANNERS = [
  { title: '天天签到领金币', subtitle: '攒够就能换钱', image: 'linear-gradient(135deg,#ff8a3d,#ff3b30)', url: '/checkin', internal: true },
  { title: '全网比价', subtitle: '同款哪家最便宜，一眼看清', image: 'linear-gradient(135deg,#4a3aff,#7b3ad5)', url: '/compare', internal: true },
  { title: '邀请好友赚钱', subtitle: '他买东西，你拿分成', image: 'linear-gradient(135deg,#ff6a9a,#ff3b6b)', url: '/agent', internal: true },
];

const router = useRouter();
const keyword = ref('');
const groups = ref([]);
const cats = ref([]);
const links = ref([]);
const topics = ref([]);
const banners = ref(FALLBACK_BANNERS);
const compare = ref([]);
const list = ref([]);
const loading = ref(true);
const rankIdx = ref(0);
const auth = reactive({});

const rankTip = computed(() => RANKS[rankIdx.value]?.tip || '');
const emptyText = computed(() =>
  RANKS[rankIdx.value].type === 'hot'
    ? '还没有订单，热销榜攒够数据就出来了'
    : '后台还没选品',
);
const topSave = computed(() => compare.value.reduce((m, g) => Math.max(m, g.maxSave || 0), 0));

const bannerStyle = (b) => ({
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  background: /^https?:|^data:/.test(b.image || '')
    ? `center/cover no-repeat url(${b.image})`
    : (b.image || 'linear-gradient(135deg,#ff8a3d,#ff3b30)'),
});

/** 分区优先用后台配的；没配就退回「池子里真有货的专题」；再没有才用预设 */
/**
 * 活动位 = slot=activity 的专题 + home_link 里的外链。
 * 专题走站内 /topic/xxx，真外链（比如跳京东的活动页）还得靠 home_link。
 */
const acts = computed(() => [
  ...topics.value.filter((t) => t.slot === 'activity').map((t) => ({
    key: `t-${t.slug}`,
    title: t.name,
    subtitle: t.intro || '',
    icon: t.icon || '🎁',
    url: `/topic/${t.slug}`,
    internal: true,
  })),
  ...links.value.map((l) => ({ ...l, key: `l-${l.id}` })),
]);

/**
 * 宫格来源四级：slot=grid 的专题 → 后台配的 category 链接 →
 * 池子里真有货的老 groupKey → 预设补齐到 8 个。
 *
 * 为什么一定要补满 8 个：宫格靠整齐吃饭，缺一格整行都塌，看着像没做完。
 * 预设专题点进去就算暂时没货也有空态兜着，比留个窟窿好。
 */
const catGroups = computed(() => {
  const out = [];
  const has = (url) => out.some((o) => o.url === url);

  topics.value
    .filter((t) => t.slot === 'grid')
    .forEach((t, i) => out.push({
      key: `topic-${t.slug}`,
      name: t.name,
      icon: t.icon || '📦',
      bg: t.bg || groupMeta(t.slug, i).bg,
      url: `/topic/${t.slug}`,
      internal: true,
    }));

  cats.value.forEach((c, i) => {
    const url = c.url || '';
    if (!url || has(url)) return;
    out.push({
      key: `cat-${c.id ?? i}`,
      name: c.title,
      icon: c.icon || '📦',
      bg: c.image || groupMeta(url.replace(/^\/(group|topic)\//, ''), i).bg,
      url,
      internal: c.internal,
    });
  });

  groups.value
    .filter((g) => g.groupKey !== 'default' && g.onShelf > 0)
    .forEach((g, i) => {
      const url = `/group/${g.groupKey}`;
      if (has(url)) return;
      out.push({ ...groupMeta(g.groupKey, i), key: `grp-${g.groupKey}`, url, internal: true });
    });

  for (const g of GRID_GROUPS) {
    if (out.length >= 8) break;
    const url = `/group/${g.key}`;
    if (has(url)) continue;
    out.push({ ...g, key: `pre-${g.key}`, url, internal: true });
  }

  return out;
});

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

function goAuth(p) {
  if (!localStorage.getItem('token')) {
    return router.push({ path: '/login', query: { redirect: '/' } });
  }
  if (auth[p.key] === true) return showToast(`${p.name}已经开启了`);
  router.push({ path: `/auth/${p.key}`, query: { redirect: '/' } });
}

function openLink(a) {
  if (!a?.url) return;
  if (a.internal) router.push(a.url);
  else window.open(a.url, '_blank');
}

const openCat = (e) => openLink(e);

function onRecommended(g) {
  // 推荐榜当前页要立刻看到名次变化，其他榜不用动
  if (RANKS[rankIdx.value].type === 'pick') loadRank();
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

/** 侧边数据各自失败各自空，不互相牵连，更不能拖住主商品流 */
async function loadSide() {
  const safe = async (fn, target, map) => {
    try {
      const v = await fn();
      target.value = map ? map(v) : v;
    } catch { /* 保持默认值 */ }
  };
  await Promise.all([
    safe(() => api.goodsGroups(), groups),
    safe(() => api.topics(), topics),
    safe(() => api.homeLinks('entry'), links),
    safe(() => api.homeLinks('category'), cats),
    safe(() => api.homeLinks('banner'), banners, (v) => (v?.length ? v : FALLBACK_BANNERS)),
    safe(() => api.compareList({ limit: 20 }), compare),
  ]);
}

async function loadAuth() {
  if (!localStorage.getItem('token')) return;
  await Promise.all(PLATS.map(async (p) => {
    try {
      const s = await api.authzStatus(p.key);
      auth[p.key] = !s.needAuth;
    } catch {
      auth[p.key] = undefined;
    }
  }));
}

onMounted(() => {
  loadRank();
  loadSide();
  loadAuth();
});
</script>
