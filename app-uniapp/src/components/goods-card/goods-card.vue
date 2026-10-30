<template>
  <view class="card" @click="go">
    <view class="img-wrap">
      <image :src="g.image" class="img" mode="aspectFill" />
    </view>
    <view class="body">
      <view class="title">
        <text v-if="g.salesVolume > 1000" class="hot-tag">🔥热销</text>
        <text>{{ g.title }}</text>
      </view>

      <view class="rebate-row">
        <view class="plat-tag" :style="{ background: platColor(g.platform) }">
          {{ platShort(g.platform) }}
        </view>
        <view class="rebate-box">
          <text class="rebate-word">返</text>
          <text class="rebate-amt">
            <text class="ra-symbol">¥</text>{{ money(g.rebate) }}
          </text>
        </view>
      </view>

      <view class="price-row">
        <text v-if="g.couponAmount > 0" class="coupon-chip">券 ¥{{ money(g.couponAmount) }}</text>
        <text class="ref-label">参考价</text>
        <text class="ref-price">¥{{ money(g.couponPrice) }}</text>
        <text v-if="g.price > g.couponPrice" class="price-old">¥{{ money(g.price) }}</text>
      </view>

      <view class="foot">
        <text v-if="g.salesVolume > 0" class="sales">已售 {{ sales(g.salesVolume) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { money, sales } from '../../utils/format.js';
import { platColor, platShort } from '../../utils/platform.js';

const props = defineProps({ g: { type: Object, required: true } });

function go() {
  uni.navigateTo({
    url: `/pages/goods/detail?platform=${props.g.platform}&goodsId=${props.g.goodsId}`,
  });
}
</script>

<style lang="scss" scoped>
.card {
  background: #fafafa;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.img-wrap {
  position: relative;
  width: 100%;
  padding-top: 100%;
  overflow: hidden;
  background: #f7f8fa;
}
.img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.body {
  padding: 16rpx 20rpx 20rpx;
  background: #fff;
}
.title {
  font-size: 24rpx;
  line-height: 1.4;
  height: 68rpx;
  color: #333;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.hot-tag {
  display: inline-block;
  padding: 2rpx 8rpx;
  margin-right: 8rpx;
  background: #fff0ec;
  color: $brand;
  font-size: 20rpx;
  font-weight: 600;
  border-radius: 6rpx;
}
.rebate-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 16rpx;
}
.plat-tag {
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
  border-radius: 8rpx;
}
.rebate-box {
  display: flex;
  align-items: center;
}
.rebate-word {
  width: 40rpx;
  height: 36rpx;
  line-height: 32rpx;
  text-align: center;
  color: $brand;
  font-size: 24rpx;
  font-weight: 700;
  border: 3rpx solid $brand;
  border-radius: 6rpx;
}
.rebate-amt {
  color: $brand;
  font-weight: 800;
}
.ra-symbol { font-size: 26rpx; margin-left: 6rpx; }
.rebate-amt { font-size: 40rpx; letter-spacing: -1rpx; }
.price-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
}
.coupon-chip {
  padding: 2rpx 12rpx;
  background: #fff0ec;
  color: $brand;
  font-size: 20rpx;
  border: 2rpx solid #ffd9d3;
  border-radius: 8rpx;
}
.ref-label { font-size: 20rpx; color: #999; }
.ref-price { font-size: 26rpx; font-weight: 600; color: #666; }
.price-old { font-size: 20rpx; color: #bbb; text-decoration: line-through; }
.foot {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid #f5f6f8;
}
.sales { font-size: 22rpx; color: #999; }
</style>
