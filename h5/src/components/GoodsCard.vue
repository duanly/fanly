<template>
  <div class="goods-card" @click="go">
    <div class="img-wrap">
      <img :src="g.image" :alt="g.title" loading="lazy" />
      <span class="plat-badge" :style="{ background: PLAT[g.platform]?.bg }">
        {{ PLAT[g.platform]?.name || g.platform }}
      </span>
      <span v-if="g.orderCount" class="hot-badge">{{ g.orderCount }} 人买过</span>
    </div>

    <div class="body">
      <div class="title">{{ g.title }}</div>
      <div class="row">
        <div>
          <span class="muted" style="font-size:11px">券后</span>
          <span class="price" style="font-size:17px">¥{{ g.couponPrice }}</span>
        </div>
        <span class="strike">¥{{ g.price }}</span>
      </div>
      <div class="row">
        <span class="tag-coupon">券 {{ g.couponAmount }}</span>
        <span class="tag-earn">买了返 ¥{{ g.rebate ?? 0 }}</span>
      </div>

      <div class="foot">
        <div
          v-if="g.compareGroupId"
          class="cmp-badge"
          @click.stop="$router.push(`/compare/${g.compareGroupId}`)"
        >
          ⚖️ 多平台比价 ›
        </div>
        <span v-else class="muted">已售 {{ g.salesVolume }}</span>

        <div
          v-if="showRecommend"
          class="rec-btn"
          :class="{ mine: times > 0, full: full }"
          @click.stop="doRecommend"
        >
          👍 {{ score > 0 ? score : '推荐' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';

const PLAT = {
  PDD: { name: '拼多多', bg: '#e02e24' },
  JD: { name: '京东', bg: '#e2231a' },
  TB: { name: '淘宝', bg: '#ff5000' },
  DY: { name: '抖音', bg: '#161823' },
};

const props = defineProps({
  g: { type: Object, required: true },
  showRecommend: { type: Boolean, default: false },
});
const emit = defineEmits(['recommended']);

const router = useRouter();
const go = () => router.push(`/goods/${props.g.platform}/${props.g.goodsId}`);

// 本地覆盖服务端值，点完立刻看到数字变，不等下一次拉取
const localScore = ref(null);
const localTimes = ref(null);
const busy = ref(false);

const score = computed(() => localScore.value ?? props.g.recommendScore ?? 0);
const times = computed(() => localTimes.value ?? props.g.myRecommend ?? 0);
const full = computed(() => times.value >= 5);

async function doRecommend() {
  if (!localStorage.getItem('token')) return router.push('/login');
  if (busy.value) return;
  busy.value = true;
  try {
    const r = await api.recommendGoods(props.g.platform, props.g.goodsId);
    localScore.value = r.recommendScore;
    localTimes.value = r.myTimes;
    showToast(r.remain > 0 ? `推荐成功，还能推 ${r.remain} 次` : '推荐成功');
    emit('recommended', props.g);
  } catch (e) {
    showToast(e?.response?.data?.msg || '推荐失败');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.img-wrap { position: relative; }
.plat-badge {
  position: absolute; left: 6px; top: 6px;
  color: #fff; font-size: 10px; line-height: 1;
  padding: 3px 6px; border-radius: 4px;
}
.hot-badge {
  position: absolute; right: 6px; top: 6px;
  background: rgba(0, 0, 0, .55); color: #fff;
  font-size: 10px; padding: 3px 6px; border-radius: 4px;
}
.foot {
  display: flex; align-items: center;
  justify-content: space-between; margin-top: 6px;
}
.cmp-badge {
  font-size: 11px; color: #4a3aff;
  background: #eeecff; border-radius: 999px; padding: 2px 8px;
}
.rec-btn {
  font-size: 11px; color: #969799;
  border: 1px solid #ebedf0; border-radius: 999px;
  padding: 2px 9px; white-space: nowrap;
}
.rec-btn.mine { color: #ff4b3a; border-color: #ffd9d3; background: #fff5f3; }
.rec-btn.full { opacity: .5; }
</style>
