<template>
  <div class="goods-card" @click="go">
    <img :src="g.image" :alt="g.title" loading="lazy" />
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
      <div class="muted" style="margin-top:5px">
        已售 {{ g.salesVolume }} 件 · 到手约 ¥{{ afterRebate }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({ g: { type: Object, required: true } });
const router = useRouter();
const go = () => router.push(`/goods/${props.g.platform}/${props.g.goodsId}`);
const afterRebate = computed(() =>
  (props.g.couponPrice - (props.g.rebate ?? 0)).toFixed(2),
);
</script>
