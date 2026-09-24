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
        <span class="tag-earn">赚 ¥{{ g.rebate ?? 0 }}</span>
      </div>

      <!-- 有比价组就给个入口：「别家还有」是点进去的理由 -->
      <div
        v-if="g.compareGroupId"
        class="cmp-badge"
        @click.stop="$router.push(`/compare/${g.compareGroupId}`)"
      >
        ⚖️ 多平台比价 ›
      </div>
      <div v-else class="muted" style="margin-top:5px">
        已售 {{ g.salesVolume }} 件 · 到手约 ¥{{ afterRebate }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const PLAT = {
  PDD: { name: '拼多多', bg: '#e02e24' },
  JD: { name: '京东', bg: '#e2231a' },
  TB: { name: '淘宝', bg: '#ff5000' },
  DY: { name: '抖音', bg: '#161823' },
};

const props = defineProps({ g: { type: Object, required: true } });
const router = useRouter();
const go = () => router.push(`/goods/${props.g.platform}/${props.g.goodsId}`);
const afterRebate = computed(() =>
  (props.g.couponPrice - (props.g.rebate ?? 0)).toFixed(2),
);
</script>

<style scoped>
.img-wrap { position: relative; }
.plat-badge {
  position: absolute;
  left: 6px;
  top: 6px;
  color: #fff;
  font-size: 10px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 4px;
}
.hot-badge {
  position: absolute;
  right: 6px;
  top: 6px;
  background: rgba(0, 0, 0, .55);
  color: #fff;
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 4px;
}
.cmp-badge {
  margin-top: 5px;
  display: inline-block;
  font-size: 11px;
  color: #4a3aff;
  background: #eeecff;
  border-radius: 999px;
  padding: 2px 8px;
}
</style>
