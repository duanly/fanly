<template>
  <view class="page">
    <view v-if="list.length" class="grid">
      <goods-card v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
    </view>
    <view v-else-if="!loading" class="empty">
      <view class="empty-icon">🛒</view>
      <view class="empty-text">收藏夹还是空的</view>
      <navigator url="/pages/home/home" open-type="switchTab" class="empty-btn">去首页逛逛</navigator>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { useCartStore } from '../../store/cart.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';

const list = ref([]);
const loading = ref(false);
const cartStore = useCartStore();

async function load() {
  loading.value = true;
  try {
    const r = await api.cart();
    list.value = r.list || [];
    cartStore.sync();
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
}

onShow(load);
</script>

<style lang="scss" scoped>
.page { padding: 16rpx 24rpx; }
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}
.empty { padding-top: 200rpx; text-align: center; }
.empty-icon { font-size: 96rpx; }
.empty-text { color: #999; font-size: 26rpx; margin: 24rpx 0 40rpx; }
.empty-btn {
  display: inline-block;
  padding: 18rpx 48rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 28rpx;
}
</style>
