<template>
  <div class="goods-card-v2" @click="go">
    <div class="img-wrap">
      <img :src="g.image" :alt="g.title" loading="lazy" />
      <!-- 券标 -->
      <span v-if="g.couponAmount > 0" class="coupon-tag">
        <span class="ct-yen">¥</span>
        <span class="ct-amt">{{ g.couponAmount }}</span>
        <span class="ct-label">券</span>
      </span>
      <!-- 热销标 -->
      <span v-if="showHot && g.salesVolume > 1000" class="hot-tag">🔥 热销</span>
    </div>

    <div class="body">
      <div class="title">{{ g.title }}</div>

      <!-- 返利 -->
      <div v-if="rebate > 0" class="rebate-row">
        <span class="rebate-tag" :style="{ background: platColor(g.platform) }">{{ platShort(g.platform) }}返</span>
        <span class="rebate-amt">¥{{ rebate }}</span>
        <span class="rebate-label">买了就返</span>
      </div>

      <!-- 价格行 -->
      <div class="price-row">
        <span class="price-symbol">¥</span>
        <span class="price-amt">{{ g.couponPrice }}</span>
        <span v-if="g.price && g.price > g.couponPrice" class="price-old">¥{{ g.price }}</span>
      </div>

      <div class="foot">
        <span class="sales">已售 {{ formatSales(g.salesVolume) }}</span>
        <div
          v-if="showRecommend"
          class="rec-btn"
          :class="{ mine: times > 0, full: full }"
          @click.stop="doRecommend"
        >
          {{ times > 0 ? '已推荐' : '👍 推荐' }}
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
import { platColor, platShort } from '../utils/platform';

const props = defineProps({
  g: { type: Object, required: true },
  showRecommend: { type: Boolean, default: false },
  showHot: { type: Boolean, default: true },
});

const rebate = computed(() => Number(props.g?.rebate ?? 0));
const emit = defineEmits(['recommended']);

const router = useRouter();
const go = () => router.push(`/goods/${props.g.platform}/${props.g.goodsId}`);

const localScore = ref(null);
const localTimes = ref(null);
const busy = ref(false);

const score = computed(() => localScore.value ?? props.g.recommendScore ?? 0);
const times = computed(() => localTimes.value ?? props.g.myRecommend ?? 0);
const full = computed(() => times.value >= 5);

function formatSales(n) {
  if (!n) return 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n;
}

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
.goods-card-v2 {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transition: transform 0.15s, box-shadow 0.15s;
}
.goods-card-v2:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

/* 图片区 */
.img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: #f5f6f8;
}
.img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 返利行 */
.rebate-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}
.rebate-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  height: 16px;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 4px;
  line-height: 1;
  white-space: nowrap;
}
.coupon-tag {
  position: absolute;
  right: 0;
  top: 8px;
  display: flex;
  align-items: center;
  padding: 2px 6px 2px 4px;
  background: linear-gradient(135deg, #ff6b35, #ff4b3a);
  color: #fff;
  border-radius: 4px 0 0 4px;
  box-shadow: -2px 2px 6px rgba(255, 75, 58, 0.3);
}
.coupon-tag::before {
  content: '';
  position: absolute;
  left: -3px;
  top: 0;
  width: 3px;
  height: 100%;
  background: radial-gradient(circle at 1.5px 3px, #ff4b3a 1.5px, transparent 1.5px);
  background-size: 100% 6px;
}
.ct-yen {
  font-size: 9px;
  opacity: 0.9;
  margin-right: 1px;
}
.ct-amt {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}
.ct-label {
  font-size: 9px;
  margin-left: 2px;
  opacity: 0.9;
}

/* 热销标 */
.hot-tag {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 2px 6px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 10px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}

/* 内容区 */
.body {
  padding: 8px 10px 10px;
}
.title {
  font-size: 12px;
  line-height: 1.4;
  height: 34px;
  color: #333;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 返利行 */
.rebate-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}
.rebate-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, #ff9a56, #ff6b35);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 4px;
}
.rebate-amt {
  font-size: 14px;
  font-weight: 700;
  color: #ff4b3a;
  line-height: 1;
}
.rebate-label {
  font-size: 10px;
  color: #ff8a66;
}

/* 价格行 */
.price-row {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-top: 6px;
}
.price-symbol {
  font-size: 12px;
  font-weight: 600;
  color: #ff4b3a;
}
.price-amt {
  font-size: 18px;
  font-weight: 700;
  color: #ff4b3a;
  line-height: 1;
}
.price-old {
  margin-left: 4px;
  font-size: 11px;
  color: #bbb;
  text-decoration: line-through;
}

/* 底部 */
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.sales {
  font-size: 11px;
  color: #999;
}
.rec-btn {
  font-size: 11px;
  color: #969799;
  border: 1px solid #ebedf0;
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}
.rec-btn.mine {
  color: #ff4b3a;
  border-color: #ffd9d3;
  background: #fff5f3;
}
.rec-btn.full { opacity: .5; }
</style>
