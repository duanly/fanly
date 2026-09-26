<template>
  <div class="goods-card" @click="go">
    <div class="img-wrap">
      <img :src="g.image" :alt="g.title" loading="lazy" />
      <!-- 来源只是个提示，不该跟商品抢注意力：右上角一个字，认得出就行 -->
      <span
        class="plat-badge"
        :style="{ background: platColor(g.platform) }"
        :title="platName(g.platform)"
      >{{ platShort(g.platform) }}</span>
      <span v-if="g.orderCount" class="hot-badge">{{ g.orderCount }} 人买过</span>
    </div>

    <div class="body">
      <div class="title">{{ g.title }}</div>
      <!--
        返利当主角，价格退成参考。
        理由：平台的满减、百亿补贴、PLUS 价、秒杀，联盟接口结构性地看不到，
        所以我们的券后价永远做不到跟 App 里一模一样。把信誉押在一个注定不准的
        数字上是必输的；而返利走实结佣金，平台结多少我们返多少，是我们唯一
        能打包票的数。押能兑现的那个。
      -->
      <div v-if="rebate > 0" class="rebate-hero">
        <span class="r-label">买了返</span>
        <span class="r-amt">¥{{ rebate }}</span>
      </div>

      <div class="price-line">
        <span class="p-amt" :class="{ lead: rebate <= 0 }">¥{{ g.couponPrice }}</span>
        <!-- 「参考价」三个字是关键：跳过去更便宜是惊喜，贵了也不算我们虚标 -->
        <span class="p-ref">{{ platName(g.platform) }}参考价</span>
        <span v-if="g.couponAmount > 0" class="tag-coupon">券 {{ g.couponAmount }}</span>
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
import { platColor, platName, platShort } from '../utils/platform';


const props = defineProps({
  g: { type: Object, required: true },
  showRecommend: { type: Boolean, default: false },
});

// 返利可能是 0（榜单里混进没佣金的商品），那种时候不能显示「买了返 ¥0」，
// 退回让价格当主角
const rebate = computed(() => Number(props.g?.rebate ?? 0));
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
/* 一个字的圆形小标，压在图片右上角，只做提示不抢商品视线 */
.plat-badge {
  position: absolute; right: 3px; top: 3px;
  width: 8px; height: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; opacity: .65;
  font-size: 6px; line-height: 1; font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .15);
}
/* 热销角标挪到左下，别跟来源标挤一起 */
.hot-badge {
  position: absolute; left: 6px; bottom: 6px;
  background: rgba(0, 0, 0, .5); color: #fff;
  font-size: 10px; padding: 3px 7px; border-radius: 999px;
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
