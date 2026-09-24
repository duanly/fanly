<template>
  <div class="page">
    <van-nav-bar title="全网比价" left-arrow fixed placeholder @click-left="back" />

    <div class="cmp-intro">
      比的是<b>到手价</b>（券后价 − 返利），不是券后价。
      各平台佣金不一样，经常券后便宜的那家反而更贵。
    </div>

    <van-loading v-if="loading" style="padding:50px;text-align:center" />

    <template v-else>
      <div
        v-for="g in list"
        :key="g.id"
        class="cmp-card"
        @click="$router.push(`/compare/${g.id}`)"
      >
        <img :src="g.cover" loading="lazy" />
        <div class="body">
          <div class="n">{{ g.name }}</div>
          <div v-if="g.spec" class="muted sp">{{ g.spec }}</div>

          <div class="plats">
            <span v-for="p in g.platforms" :key="p" class="pt">{{ platformName(p) }}</span>
          </div>

          <div class="row">
            <div>
              <span class="muted" style="font-size:11px">最低到手</span>
              <span class="price" style="font-size:18px">¥{{ g.best?.finalPrice }}</span>
              <span class="muted" style="font-size:11px">· {{ platformName(g.best?.platform) }}</span>
            </div>
            <span v-if="g.maxSave > 0" class="save">比最贵省 ¥{{ g.maxSave }}</span>
          </div>
        </div>
      </div>

      <van-empty v-if="!list.length" description="还没有比价商品">
        <div class="muted" style="font-size:12px;padding:0 30px;line-height:1.6">
          去后台「比价组」建一组，把同款商品从各平台挑进去
        </div>
      </van-empty>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';

const platformName = (p) => ({ PDD: '拼多多', JD: '京东', TB: '淘宝', DY: '抖音' }[p] || p || '');
const list = ref([]);
const loading = ref(true);
const router = useRouter();

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

onMounted(async () => {
  try {
    list.value = await api.compareList();
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.cmp-intro {
  margin: 10px 12px 0;
  padding: 10px 12px;
  background: #fff7f5;
  border-radius: 8px;
  color: #a8613f;
  font-size: 12px;
  line-height: 1.6;
}
.cmp-intro b { color: #ff4b3a; }

.cmp-card {
  display: flex;
  gap: 10px;
  background: #fff;
  margin: 10px 12px;
  border-radius: 12px;
  padding: 12px;
}
.cmp-card img {
  width: 86px; height: 86px; flex: none;
  border-radius: 8px; object-fit: cover; background: #eee;
}
.cmp-card .body { flex: 1; min-width: 0; }
.cmp-card .n { font-size: 14px; font-weight: 600; line-height: 1.4; }
.cmp-card .sp { font-size: 11px; margin-top: 2px; }

.plats { display: flex; gap: 5px; margin: 6px 0; flex-wrap: wrap; }
.pt {
  font-size: 10px; color: #969799;
  border: 1px solid #ebedf0; border-radius: 4px;
  padding: 1px 5px;
}
.cmp-card .row {
  display: flex; align-items: baseline;
  justify-content: space-between; margin-top: 4px;
}
.save {
  font-size: 11px; color: #fff; background: #ff4b3a;
  border-radius: 999px; padding: 2px 8px; white-space: nowrap;
}
</style>
