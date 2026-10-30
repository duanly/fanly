<template>
  <view class="page">
    <view class="head">
      <view class="head-title">转链查返利</view>
      <view class="head-sub">把淘宝 / 京东 / 拼多多商品链接或口令粘贴到这里</view>
    </view>

    <view class="input-card">
      <textarea
        v-model="content"
        class="textarea"
        placeholder="粘贴商品链接 / 淘口令"
        :maxlength="500"
        auto-height
      />
      <view class="input-actions">
        <view class="read-btn" @click="readClipboard">
          <text>📋 读取剪贴板</text>
        </view>
      </view>
      <button class="submit" :loading="loading" @click="submit">查返利</button>
    </view>

    <!-- 结果 -->
    <view v-if="result" class="result">
      <view v-if="!result.ok" class="fail">
        <text class="fail-emoji">🔍</text>
        <text class="fail-text">{{ result.reason }}</text>
      </view>

      <template v-else>
        <goods-card :g="result.goods" />
        <view v-if="result.needAuth" class="auth-tip">
          需要先完成{{ result.platformName }}授权才能查到返利，已为你保留这单
        </view>
        <button v-if="result.needAuth" class="result-btn primary" @click="goAuth">去授权</button>
        <button v-else-if="result.link" class="result-btn primary" @click="copyLink">复制口令去购买</button>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../../api/index.js';
import { useUserStore } from '../../store/user.js';
import GoodsCard from '../../components/goods-card/goods-card.vue';

const userStore = useUserStore();
const content = ref('');
const loading = ref(false);
const result = ref(null);

function readClipboard() {
  uni.getClipboardData({
    success: (r) => {
      content.value = r.data || '';
      if (!r.data) uni.showToast({ title: '剪贴板为空', icon: 'none' });
    },
  });
}

async function submit() {
  if (!content.value.trim()) {
    uni.showToast({ title: '先粘贴商品链接', icon: 'none' });
    return;
  }
  if (!userStore.isLoggedIn) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  loading.value = true;
  result.value = null;
  try {
    result.value = await api.parse(content.value.trim());
  } finally {
    loading.value = false;
  }
}

function copyLink() {
  const link = result.value.link || {};
  const payload =
    link.password || link.shortUrl || link.shortH5 || link.longH5 || link.deeplink || '';
  if (!payload) {
    uni.showToast({ title: '链接获取失败', icon: 'none' });
    return;
  }
  uni.setClipboardData({
    data: payload,
    success: () =>
      uni.showModal({
        title: '已复制',
        content: '打开对应购物 App 会自动识别，下单后返利回到这里',
        showCancel: false,
      }),
  });
}

function goAuth() {
  uni.navigateTo({ url: `/pages/auth/auth?platform=${result.value.platform}` });
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 60rpx; }
.head { padding: 32rpx 32rpx 20rpx; }
.head-title { font-size: 40rpx; font-weight: 800; color: $brand; }
.head-sub { font-size: 24rpx; color: #999; margin-top: 8rpx; }

.input-card {
  margin: 0 24rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
}
.textarea {
  width: 100%;
  min-height: 200rpx;
  background: #f7f8fa;
  border-radius: 16rpx;
  padding: 20rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}
.input-actions { display: flex; justify-content: flex-end; margin: 16rpx 0; }
.read-btn {
  padding: 12rpx 24rpx;
  border: 2rpx solid $brand;
  color: $brand;
  border-radius: 999rpx;
  font-size: 24rpx;
}
.submit {
  height: 88rpx;
  line-height: 88rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 30rpx;
}
.submit::after { border: none; }

.result { margin: 24rpx; }
.fail {
  background: #fff;
  border-radius: 24rpx;
  padding: 80rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}
.fail-emoji { font-size: 96rpx; }
.fail-text { color: #999; font-size: 26rpx; }
.auth-tip {
  margin-top: 20rpx;
  background: #fff7e6;
  color: #8a613f;
  font-size: 24rpx;
  border-radius: 16rpx;
  padding: 20rpx;
  line-height: 1.6;
}
.result-btn {
  margin-top: 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
}
.result-btn::after { border: none; }
.result-btn.primary { background: $brand; color: #fff; }
</style>
