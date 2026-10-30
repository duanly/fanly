<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中…</view>

    <template v-else-if="g">
      <scroll-view scroll-y class="scroll" :show-scrollbar="false">
        <!-- 主图 -->
        <image class="hero" :src="g.image" mode="aspectFill" />

        <!-- 价格标题 -->
        <view class="block">
          <view class="price-line">
            <text class="price">¥{{ money(g.couponPrice) }}</text>
            <text v-if="g.price && g.price > g.couponPrice" class="strike">¥{{ money(g.price) }}</text>
            <text class="ref-tag">{{ platName(g.platform) }}参考价</text>
          </view>
          <view class="title">
            <text v-if="g.salesVolume > 1000" class="hot">🔥热销 </text>{{ g.title }}
          </view>
          <view class="sub">{{ g.shopName }} · 已售 {{ sales(g.salesVolume) }} 件</view>

          <view class="from-bar">
            <text class="from-dot" :style="{ background: platColor(g.platform) }">{{ platShort(g.platform) }}</text>
            <text class="from-text">本商品由{{ platName(g.platform) }}发货，点击购买跳转该平台下单</text>
          </view>
          <view class="price-note">
            实际价格以{{ platName(g.platform) }}结算为准，到手价以下单时为准。返利按联盟实际结算佣金计算。
          </view>
        </view>

        <!-- 返利明细 -->
        <view class="rebate-block">
          <view class="rebate-row"><text>优惠券</text><text class="r">-¥{{ money(g.couponAmount) }}</text></view>
          <view class="rebate-row"><text>预估返利</text><text class="r big">约 ¥{{ money(g.rebate) }}</text></view>
          <view class="rebate-row"><text>预估到手价</text><text class="r big">约 ¥{{ afterRebate }}</text></view>
          <view class="rebate-tip">返利为预估，确认收货后联盟结算，退款则无返利</view>
        </view>
        <view style="height: 160rpx"></view>
      </scroll-view>

      <!-- 底部操作条 -->
      <view class="buy-bar">
        <view class="fav" @click="addCart">
          <text class="fav-ico">⭐</text>
          <text class="fav-label">收藏</text>
        </view>
        <button class="buy-btn outline" :loading="adding" @click="addCart">加入收藏</button>
        <button class="buy-btn primary" :loading="converting" @click="buy">领券购买 返¥{{ money(g.rebate) }}</button>
      </view>
    </template>

    <view v-else class="offline">
      <text class="offline-emoji">📦</text>
      <text class="offline-text">商品已下架或退出推广</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { useUserStore } from '../../store/user.js';
import { useCartStore } from '../../store/cart.js';
import { money, sales } from '../../utils/format.js';
import { platName, platShort, platColor } from '../../utils/platform.js';

const userStore = useUserStore();
const cartStore = useCartStore();

const platform = ref('');
const goodsId = ref('');
const g = ref(null);
const loading = ref(true);
const converting = ref(false);
const adding = ref(false);

const afterRebate = computed(() =>
  g.value ? Math.max(0, Number(g.value.couponPrice) - Number(g.value.rebate)).toFixed(2) : '0.00',
);

async function load() {
  loading.value = true;
  try {
    g.value = await api.detail(platform.value, goodsId.value);
  } catch {
    g.value = null;
  } finally {
    loading.value = false;
  }
}

function requireLogin() {
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/login/login' });
    return false;
  }
  return true;
}

async function addCart() {
  if (!requireLogin()) return;
  adding.value = true;
  try {
    const r = await api.cartAdd(platform.value, goodsId.value);
    uni.showToast({ title: r?.already ? '已在收藏夹' : '已加入收藏', icon: 'none' });
    cartStore.sync();
  } finally {
    adding.value = false;
  }
}

async function buy() {
  if (!requireLogin()) return;
  converting.value = true;
  try {
    // 需要平台授权（拼多多等）时接口返回 needAuth
    const r = await api.convert(platform.value, goodsId.value);
    if (r?.needAuth) {
      uni.navigateTo({ url: `/pages/auth/auth?platform=${platform.value}` });
      return;
    }
    const link = r?.link;
    // 小程序内无法直接唤起竞品 App，统一引导复制口令/链接
    const payload =
      link?.password ||
      link?.shortUrl ||
      link?.shortH5 ||
      link?.longH5 ||
      link?.deeplink ||
      '';
    if (!payload) {
      uni.showToast({ title: '跳转链接获取失败', icon: 'none' });
      return;
    }
    uni.setClipboardData({
      data: payload,
      success: () =>
        uni.showModal({
          title: '已复制淘口令/链接',
          content: '打开对应 App 会自动弹出优惠，粘贴或等待识别即可下单',
          showCancel: false,
        }),
    });
  } finally {
    converting.value = false;
  }
}

onLoad((q) => {
  platform.value = q.platform || '';
  goodsId.value = q.goodsId || '';
  load();
});
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; }
.loading { padding: 120rpx 0; text-align: center; color: #999; }
.scroll { height: 100vh; }
.hero { width: 100%; height: 750rpx; background: #eee; }

.block { background: #fff; padding: 28rpx; }
.price-line { display: flex; align-items: baseline; gap: 16rpx; flex-wrap: wrap; }
.price { color: $brand; font-size: 56rpx; font-weight: 800; }
.strike { color: #999; font-size: 26rpx; text-decoration: line-through; }
.ref-tag {
  margin-left: auto;
  font-size: 22rpx;
  color: #999;
  border: 2rpx solid #eee;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.title { margin-top: 20rpx; font-size: 30rpx; line-height: 1.5; color: #1a1a1a; }
.hot { color: $brand; }
.sub { margin-top: 16rpx; font-size: 24rpx; color: #999; }
.from-bar {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #f7f9fc;
  border-radius: 12rpx;
  padding: 16rpx;
}
.from-dot {
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
  border-radius: 50%;
  flex-shrink: 0;
}
.from-text { font-size: 22rpx; color: #666; line-height: 1.5; }
.price-note { margin-top: 16rpx; font-size: 22rpx; color: #999; line-height: 1.6; }

.rebate-block {
  margin: 20rpx;
  background: #fff1ef;
  border-radius: 24rpx;
  padding: 8rpx 28rpx;
}
.rebate-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 2rpx solid rgba(255, 75, 58, 0.08);
  font-size: 28rpx;
}
.rebate-row:last-of-type { border-bottom: none; }
.r { color: $brand; font-weight: 700; }
.r.big { font-size: 34rpx; }
.rebate-tip { padding: 0 0 24rpx; font-size: 22rpx; color: #999; line-height: 1.6; }

.buy-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.fav {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 88rpx;
}
.fav-ico { font-size: 36rpx; }
.fav-label { font-size: 20rpx; color: #666; margin-top: 4rpx; }
.buy-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
  padding: 0;
  margin: 0;
}
.buy-btn::after { border: none; }
.buy-btn.outline { background: #fff; color: #ff976a; border: 2rpx solid #ff976a; flex: 0 0 220rpx; }
.buy-btn.primary { background: $brand; color: #fff; }

.offline { padding-top: 280rpx; display: flex; flex-direction: column; align-items: center; gap: 24rpx; }
.offline-emoji { font-size: 120rpx; }
.offline-text { color: #999; font-size: 28rpx; }
</style>
