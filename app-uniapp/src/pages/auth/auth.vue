<template>
  <view class="page">
    <view class="auth-hero">
      <view class="icon">🔑</view>
      <view class="t">还差一步，去{{ platformName }}授权一下</view>
      <view class="s">
        {{ platformName }}要求先完成一次授权，才能把订单和你的账号对上。
        <text class="b">不授权就下单，返利认不到你头上。</text>
      </view>
    </view>

    <view class="auth-steps">
      <view class="step"><text class="i">1</text><text>点下面的按钮，会跳到{{ platformName }}</text></view>
      <view class="step"><text class="i">2</text><text>在{{ platformName }}里点「同意 / 授权」</text></view>
      <view class="step"><text class="i">3</text><text>回到这里，点「我已完成授权」</text></view>
    </view>

    <view class="auth-note">
      只需要做一次，之后所有订单都会自动算给你。授权不会拿到你的账号密码。
    </view>

    <view class="btns">
      <button class="primary" :loading="loading" :disabled="!authUrl" @click="go">去{{ platformName }}授权</button>
      <button class="plain" :loading="checking" @click="recheck">我已完成授权</button>
    </view>

    <view v-if="err" class="auth-err">{{ err }}</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { platName } from '../../utils/platform.js';

const platform = ref('PDD');
const platformName = ref('拼多多');
const authUrl = ref('');
const loading = ref(true);
const checking = ref(false);
const err = ref('');
let redirect = '';

async function load() {
  loading.value = true;
  err.value = '';
  try {
    const r = await api.authzUrl(platform.value);
    authUrl.value = r.shortUrl || r.schemaUrl || '';
    if (!authUrl.value) err.value = '没拿到授权链接，稍后再试';
  } catch (e) {
    err.value = e?.message || '生成授权链接失败';
  } finally {
    loading.value = false;
  }
}

function go() {
  if (!authUrl.value) return;
  // #ifdef H5
  window.location.href = authUrl.value;
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(authUrl.value);
  // #endif
  // #ifdef MP
  // 小程序不能直接唤起竞品 App：复制授权链接，提示去浏览器打开
  uni.setClipboardData({
    data: authUrl.value,
    success: () => uni.showModal({
      title: '请在浏览器中打开',
      content: '授权链接已复制，粘贴到手机浏览器打开后完成授权',
      showCancel: false,
    }),
  });
  // #endif
}

async function recheck() {
  checking.value = true;
  try {
    const s = await api.authzStatus(platform.value, true);
    if (s.bound) {
      uni.showToast({ title: '授权成功', icon: 'success' });
      setTimeout(() => {
        if (redirect) uni.redirectTo({ url: redirect });
        else uni.reLaunch({ url: '/pages/home/home' });
      }, 800);
    } else {
      uni.showToast({ title: '还没查到授权记录，稍等几秒再试', icon: 'none' });
    }
  } finally {
    checking.value = false;
  }
}

onLoad((options) => {
  platform.value = (options.platform || 'PDD').toUpperCase();
  platformName.value = platName(platform.value);
  redirect = options.redirect || '';
  load();
});
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; }
.auth-hero {
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  color: #fff; padding: 56rpx 40rpx 48rpx; text-align: center;
}
.icon { font-size: 76rpx; }
.t { font-size: 36rpx; font-weight: 700; margin-top: 20rpx; }
.s { font-size: 26rpx; line-height: 1.7; opacity: .92; margin-top: 16rpx; }
.b { opacity: 1; }
.auth-steps { background: #fff; margin: 24rpx; border-radius: 24rpx; padding: 32rpx 36rpx; }
.step { display: flex; align-items: center; gap: 20rpx; padding: 14rpx 0; font-size: 28rpx; }
.i {
  flex: none; width: 42rpx; height: 42rpx; line-height: 42rpx;
  border-radius: 50%; background: $brand; color: #fff;
  font-size: 24rpx; text-align: center;
}
.auth-note { padding: 0 40rpx 32rpx; font-size: 24rpx; color: #999; line-height: 1.6; }
.btns { padding: 0 32rpx; }
.primary {
  height: 92rpx; line-height: 92rpx; border-radius: 999rpx;
  background: $brand; color: #fff; font-size: 30rpx;
}
.primary::after, .plain::after { border: none; }
.plain {
  margin-top: 24rpx; height: 92rpx; line-height: 92rpx; border-radius: 999rpx;
  background: #fff; color: #333; font-size: 30rpx; border: 2rpx solid #ddd;
}
.auth-err {
  margin: 28rpx 32rpx; padding: 20rpx 24rpx;
  background: #fff7f5; border-radius: 16rpx;
  color: #ee0a24; font-size: 24rpx;
}
</style>
