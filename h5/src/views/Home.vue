<template>
  <div class="page">
    <!-- 顶部：搜索 + 转链/活动 -->
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
        <div class="head-icon" @click="toast('活动页还没做')">
          <van-icon name="chat-o" size="20" />
          <span>活动</span>
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

      <!-- 快捷入口横滑 -->
      <div class="chip-row">
        <div
          v-for="(p, i) in platforms"
          :key="p.key"
          class="chip"
          :class="{ active: platformIdx === i }"
          @click="switchPlatform(i)"
        >
          {{ p.name }}
        </div>
        <div class="chip" @click="toast('签到还没做')">签到领福利 ›</div>
      </div>

      <div v-if="groups.length > 1" class="chip-row">
        <div
          v-for="g in groups"
          :key="g.groupKey"
          class="chip"
          :class="{ active: groupKey === g.groupKey }"
          @click="switchGroup(g.groupKey)"
        >
          {{ groupLabel(g.groupKey) }}
        </div>
      </div>

      <!-- 轮播 -->
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

    <!-- 比价入口：没建比价组就不显示，别给用户一个点进去是空的东西 -->
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

    <!-- 分类宫格：每一格对应选品池的一个专题 -->
    <div class="grid-card">
      <div class="plat-grid">
        <div
          v-for="e in gridGroups"
          :key="e.key"
          class="plat-item"
          @click="$router.push(`/group/${e.key}`)"
        >
          <div class="plat-icon" :style="{ background: e.bg }">{{ e.icon }}</div>
          <div class="l">{{ e.name }}</div>
        </div>
      </div>
    </div>

    <!-- 活动入口 -->
    <div class="act-row">
      <div v-for="a in acts" :key="a.t" class="act-card" @click="toast(a.t + ' 还没做')">
        <div class="t">{{ a.t }}</div>
        <div class="s">{{ a.s }}</div>
        <span class="emoji">{{ a.icon }}</span>
      </div>
    </div>

    <!-- 商品流 -->
    <div class="section-title">
      {{ source === 'curated' ? '⭐️ 精选好货' : '🔥 今日推荐' }}
      <span v-if="platformIdx > 0" class="muted" style="font-weight:400">
        · {{ platforms[platformIdx].name }}
      </span>
    </div>

    <van-loading v-if="loading" style="padding:40px;text-align:center" />
    <div v-else class="goods-grid">
      <GoodsCard v-for="g in list" :key="g.goodsId" :g="g" />
    </div>

    <van-empty v-if="!loading && !list.length" description="暂无商品" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import { GRID_GROUPS, groupMeta } from '../constants/groups';

// 第一项是「全部」——统一货架的默认视图，用户不用关心商品来自哪家。
// 后面几项留给想筛的人，不做主导航。
const platforms = [
  { key: '', name: '全部' },
  { key: 'PDD', name: '拼多多' },
  { key: 'JD', name: '京东' },
  { key: 'TB', name: '淘宝' },
  { key: 'DY', name: '抖音' },
];

const banners = [
  { t1: '天天领超级金币', t2: '最高得 100000 金币', bg: 'linear-gradient(135deg,#ff8a3d,#ff3b30)' },
  { t1: '大额券专区', t2: '券后 78 折起', bg: 'linear-gradient(135deg,#8b6b3d,#5d4322)' },
  { t1: '9.9 包邮', t2: '天天上新，买到就是赚到', bg: 'linear-gradient(135deg,#ff6a9a,#ff3b6b)' },
];

const entries = [
  { l: '旅行优惠', icon: '🏔', bg: 'linear-gradient(135deg,#5ec26a,#34a853)' },
  { l: '加油打车', icon: '🚗', bg: 'linear-gradient(135deg,#5b9cf8,#3a7bd5)' },
  { l: '吃喝玩乐', icon: '🎮', bg: 'linear-gradient(135deg,#a05bf8,#7b3ad5)' },
  { l: '大牌秒杀', icon: '⚡️', bg: 'linear-gradient(135deg,#ff6a6a,#e23b3b)' },
  { l: '省钱外卖', icon: '🍔', bg: 'linear-gradient(135deg,#4fc3f7,#2196f3)' },
  { l: '拼多多', icon: '拼', bg: 'linear-gradient(135deg,#ff5f5f,#e02e24)', p: 0 },
  { l: '京东', icon: '京', bg: 'linear-gradient(135deg,#f45c5c,#e2231a)', p: 1 },
  { l: '淘宝', icon: '淘', bg: 'linear-gradient(135deg,#ff8a3d,#ff5000)', p: 2 },
  { l: '唯品会', icon: '唯', bg: 'linear-gradient(135deg,#f06ba8,#e4007f)' },
  { l: '抖音', icon: '抖', bg: 'linear-gradient(135deg,#3a3a45,#161823)', p: 3 },
];

const acts = [
  { t: '新人 0 元购', s: '限首单', icon: '🎁' },
  { t: '营销日历', s: '大促预告', icon: '📅' },
  { t: '超级爆品', s: '低价冲量', icon: '🔥' },
  { t: '签到领福利', s: '最高 666', icon: '💰' },
  { t: '在线点餐', s: '外卖红包', icon: '🍜' },
];

const platformIdx = ref(0);
// 专题清单是写死的常量，不是接口拉的——首页宫格要秒出，
// 而且后台选品时也用同一份，key 必须两边一致
const groups = ref([]);
const groupKey = ref('default');
/** curated=读的选品池，recommend=池子空回落到了平台榜单 */
const source = ref('');
const compare = ref([]);
const list = ref([]);
const loading = ref(true);
const keyword = ref('');
const router = useRouter();
const toast = (m) => showToast(m);
const go = (g) => router.push(`/goods/${g.platform}/${g.goodsId}`);

function switchPlatform(i) {
  platformIdx.value = i;
  load();
}

function switchGroup(k) {
  groupKey.value = k;
  load();
}

const groupLabel = (k) => (k === 'default' ? '精选' : groupMeta(k).name);

/**
 * 宫格显示后台真正有货的专题（含后台自建的，比如「婴儿」）。
 * 一件都没选的时候退回预设清单，不然新装的站首页是一片空白。
 */
/** 比价里最大的一笔差价，拿来当首页钩子 */
const topSave = computed(() =>
  compare.value.reduce((m, g) => Math.max(m, g.maxSave || 0), 0),
);

const gridGroups = computed(() => {
  const real = groups.value.filter((g) => g.groupKey !== 'default' && g.onShelf > 0);
  if (!real.length) return GRID_GROUPS.slice(0, 10);
  return real.slice(0, 10).map((g, i) => groupMeta(g.groupKey, i));
});

function onEntry(e) {
  if (e.p !== undefined) switchPlatform(e.p);
  else toast(e.l + ' 还没做');
}

/** 转链统一走独立页面，那里有粘贴框、历史记录和结果卡 */
function goParse() {
  if (!localStorage.getItem('token')) {
    return router.push({ path: '/login', query: { redirect: '/parse' } });
  }
  router.push('/parse');
}

async function load() {
  loading.value = true;
  try {
    // platformIdx 为 0 是「全部」，不传 platform 就是跨平台混排
    const r = await api.feed({
      group: groupKey.value,
      platform: platformIdx.value === 0 ? undefined : platforms[platformIdx.value].key,
      limit: 20,
    });
    list.value = r.list || [];
    source.value = r.source;
    newbie.value = (r.list || []).slice(0, 3);
  } finally {
    loading.value = false;
  }
}

/** 专题是后台配出来的，没配就不显示这一行，首页保持干净 */
async function loadGroups() {
  try {
    groups.value = await api.goodsGroups();
  } catch {
    groups.value = [];
  }
}

async function loadCompare() {
  try {
    compare.value = await api.compareList({ limit: 20 });
  } catch {
    compare.value = [];
  }
}

onMounted(() => {
  load();
  loadGroups();
  loadCompare();
});
</script>
