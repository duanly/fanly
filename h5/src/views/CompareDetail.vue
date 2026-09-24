<template>
  <div class="page">
    <van-nav-bar title="比价详情" left-arrow fixed placeholder @click-left="back" />

    <van-loading v-if="loading" style="padding:50px;text-align:center" />

    <template v-else-if="g">
      <div class="head">
        <img :src="g.cover" />
        <div>
          <div class="n">{{ g.name }}</div>
          <div v-if="g.spec" class="muted">{{ g.spec }}</div>
          <div class="muted" style="font-size:11px;margin-top:6px">{{ syncText }}</div>
        </div>
      </div>

      <div
        v-for="(it, i) in g.items"
        :key="it.platform + it.goodsId"
        class="row-card"
        :class="{ best: i === 0 }"
        @click="go(it)"
      >
        <div class="top">
          <span class="plat">{{ platformName(it.platform) }}</span>
          <span v-if="i === 0" class="tag">最划算</span>
          <span v-else-if="diff(it) > 0" class="muted" style="font-size:11px">
            贵 ¥{{ diff(it) }}
          </span>
        </div>

        <div class="t">{{ it.title }}</div>

        <div class="nums">
          <div>
            <div class="muted">券后价</div>
            <div class="v">¥{{ it.couponPrice }}</div>
          </div>
          <div>
            <div class="muted">返利</div>
            <div class="v rebate">−¥{{ it.rebate }}</div>
          </div>
          <div>
            <div class="muted">到手价</div>
            <div class="v final">¥{{ it.finalPrice }}</div>
          </div>
        </div>
      </div>

      <div class="foot muted">
        价格为抓取时的快照，点进去以平台实时价为准。返利于确认收货并结算后到账。
      </div>
    </template>

    <van-empty v-else description="这个比价组不存在" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { platName as platformName } from '../utils/platform';

const route = useRoute();
const router = useRouter();
const g = ref(null);
const loading = ref(true);

const syncText = computed(() => {
  const t = g.value?.syncedAt;
  if (!t) return '价格未同步';
  const min = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  if (min < 1) return '价格刚刚更新';
  if (min < 60) return `价格更新于 ${min} 分钟前`;
  return `价格更新于 ${Math.round(min / 60)} 小时前`;
});

const diff = (it) => {
  const best = g.value?.items?.[0]?.finalPrice ?? 0;
  return Math.round((it.finalPrice - best) * 100) / 100;
};

const go = (it) => router.push(`/goods/${it.platform}/${it.goodsId}`);

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/compare');
}

onMounted(async () => {
  try {
    g.value = await api.compareDetail(route.params.id);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.head {
  display: flex; gap: 12px;
  background: #fff; padding: 14px 12px;
}
.head img { width: 76px; height: 76px; border-radius: 8px; object-fit: cover; background: #eee; }
.head .n { font-size: 16px; font-weight: 700; line-height: 1.4; }

.row-card {
  background: #fff;
  margin: 10px 12px;
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid transparent;
}
.row-card.best { border-color: #ff4b3a; }
.row-card .top { display: flex; align-items: center; gap: 8px; }
.plat { font-size: 14px; font-weight: 700; }
.tag {
  font-size: 10px; color: #fff; background: #ff4b3a;
  border-radius: 999px; padding: 2px 8px;
}
.row-card .t {
  font-size: 12px; color: #646566; line-height: 1.4;
  margin: 6px 0 10px; max-height: 34px; overflow: hidden;
}
.nums { display: flex; }
.nums > div { flex: 1; }
.nums .muted { font-size: 11px; }
.nums .v { font-size: 16px; font-weight: 700; margin-top: 2px; }
.nums .rebate { color: #07c160; font-size: 15px; }
.nums .final { color: #ff4b3a; font-size: 19px; }

.foot { padding: 14px 20px 24px; font-size: 11px; line-height: 1.7; }
</style>
