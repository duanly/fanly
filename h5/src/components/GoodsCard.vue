<template>
  <div class="goods-card" @click="go">
    <img :src="g.image" :alt="g.title" loading="lazy" />
    <div class="body">
      <div class="title">{{ g.title }}</div>
      <div class="row">
        <div>
          <span class="muted">券后</span>
          <span class="price" style="font-size:17px">¥{{ g.couponPrice }}</span>
        </div>
        <span class="strike">¥{{ g.price }}</span>
      </div>
      <div class="row">
        <span class="tag-coupon">券 {{ g.couponAmount }} 元</span>
        <span class="tag-rebate">返 ¥{{ g.rebate ?? 0 }}</span>
      </div>
      <div class="muted" style="margin-top:4px">已售 {{ g.salesVolume }} 件</div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
const props = defineProps({ g: { type: Object, required: true } });
const router = useRouter();
const go = () => router.push(`/goods/${props.g.platform}/${props.g.goodsId}`);
</script>
