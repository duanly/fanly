<template>
  <div class="goods-card-v2" @click="go">
    <div class="img-wrap">
      <img :src="g.image" :alt="g.title" loading="lazy" />
      <!-- 热销标（保留在图上，不挡主体） -->
      <span v-if="showHot && g.salesVolume > 1000" class="hot-tag">🔥 热销</span>
    </div>

    <div class="body">
      <div class="title">{{ g.title }}</div>

      <!-- 返利（核心卖点，放大突出） -->
      <div class="rebate-block">
        <span class="plat-tag" :style="{ background: platColor(g.platform) }">{{ platShort(g.platform) }}</span>
        <span class="rebate-text">返</span>
        <span class="rebate-amt">
          <span class="ra-symbol">¥</span>
          <span class="ra-num">{{ rebate }}</span>
        </span>
        <span class="rebate-label">买了就返</span>
      </div>

      <!-- 价格（参考价，缩小） -->
      <div class="price-block">
        <span v-if="g.couponAmount > 0" class="coupon-chip">
          券 <b>¥{{ g.couponAmount }}</b>
        </span>
        <span class="ref-label">参考价</span>
        <span class="ref-price">¥{{ g.couponPrice }}</span>
        <span v-if="g.price && g.price > g.couponPrice" class="price-old">¥{{ g.price }}</span>
      </div>
      <div v-if="g.couponAmount > 0" class="price-tip">实际价格以平台结算为准</div>

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
  background: #f7f8fa;
}
.img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 热销标 */
.hot-tag {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 2px 6px;
  background: rgba(0,0,0,0.55);
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

/* ===== 返利区（核心卖点，放大突出） ===== */
.rebate-block {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.plat-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  border-radius: 4px;
  flex-shrink: 0;
}
.rebate-text {
  font-size: 13px;
  font-weight: 700;
  color: #ff4b3a;
}
.rebate-amt {
  display: inline-flex;
  align-items: baseline;
  color: #ff4b3a;
  font-weight: 700;
  line-height: 1;
}
.ra-symbol {
  font-size: 13px;
  margin-right: 1px;
}
.ra-num {
  font-size: 20px;
  letter-spacing: -0.5px;
}
.rebate-label {
  font-size: 10px;
  color: #ff8a66;
  margin-left: 2px;
}

/* ===== 价格区（参考价，做小做淡） ===== */
.price-block {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.coupon-chip {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 1px 6px;
  background: #fff0ec;
  color: #ff4b3a;
  font-size: 10px;
  border-radius: 4px;
  border: 1px solid #ffd9d3;
}
.coupon-chip b {
  font-weight: 700;
  font-size: 11px;
}
.ref-label {
  font-size: 10px;
  color: #999;
}
.ref-price {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  line-height: 1;
}
.price-old {
  font-size: 10px;
  color: #bbb;
  text-decoration: line-through;
}
.price-tip {
  margin-top: 3px;
  font-size: 9px;
  color: #c0c4cc;
  line-height: 1.2;
}

/* 底部 */
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f5f6f8;
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
