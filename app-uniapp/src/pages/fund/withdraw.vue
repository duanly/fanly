<template>
  <view class="page">
    <view class="wallet">
      <view class="sub">可提现余额（元）</view>
      <view class="big">{{ money(bal?.balance) }}</view>
    </view>

    <view class="card">
      <view class="field">
        <text class="label">提现金额</text>
        <input v-model="amount" type="digit" class="input" placeholder="最低 10 元" />
        <text class="all" @click="amount = String(Math.floor(+(bal?.balance || 0)))">全部</text>
      </view>
      <view class="field">
        <text class="label">到账方式</text>
        <view class="channels">
          <text class="ch" :class="{ on: channel === 'WECHAT' }" @click="channel = 'WECHAT'">微信</text>
          <text class="ch" :class="{ on: channel === 'ALIPAY' }" @click="channel = 'ALIPAY'">支付宝</text>
        </view>
      </view>
    </view>

    <view v-if="paymentInfo" class="pay-info">
      <view class="pi-row"><text class="pi-l">收款人</text><text class="pi-v">{{ paymentInfo.realName }}</text></view>
      <image class="pi-qr" :src="paymentInfo.qrCode" mode="aspectFill" @click="previewQr" />
      <view v-if="channel === 'ALIPAY' && paymentInfo.alipayAccount" class="pi-row">
        <text class="pi-l">支付宝</text><text class="pi-v">{{ paymentInfo.alipayAccount }}</text>
      </view>
    </view>
    <view v-else class="pay-empty" @click="goPayMethod">
      <text>⚠️ 尚未设置收款信息，点击去设置</text>
    </view>

    <view class="tips">
      · 手续费按金融通道实收，平台不加价
      · 提交后人工审核，通过当日打款
      · 对应订单退款，返利会被冲销
    </view>

    <button class="submit" :loading="submitting" :disabled="!paymentInfo" @click="submit">
      {{ paymentInfo ? '确认提现' : '请先设置收款信息' }}
    </button>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';

const bal = ref(null);
const amount = ref('');
const channel = ref('WECHAT');
const submitting = ref(false);
const payMethod = ref(null);

const money = (v) => Number(v || 0).toFixed(2);

const paymentInfo = computed(() => {
  if (!payMethod.value) return null;
  if (channel.value === 'WECHAT') {
    const w = payMethod.value.wechat;
    if (!w?.realName || !w?.qrCode) return null;
    return { realName: w.realName, qrCode: w.qrCode };
  }
  const a = payMethod.value.alipay;
  if (!a?.realName || !a?.qrCode) return null;
  return { realName: a.realName, qrCode: a.qrCode, alipayAccount: a.alipayAccount };
});

async function load() {
  try {
    const [b, p] = await Promise.all([api.balance(), api.getPaymentMethod().catch(() => null)]);
    bal.value = b;
    payMethod.value = p;
  } catch {}
}
function previewQr() {
  if (!paymentInfo.value?.qrCode) return;
  uni.previewImage({ urls: [paymentInfo.value.qrCode] });
}
async function submit() {
  if (!Number(amount.value)) return uni.showToast({ title: '请输入金额', icon: 'none' });
  if (!paymentInfo.value) return uni.showToast({ title: '请先设置收款信息', icon: 'none' });
  submitting.value = true;
  try {
    await api.withdraw({ amount: Number(amount.value), channel: channel.value });
    uni.showToast({ title: '已提交，等待审核', icon: 'none' });
    setTimeout(() => uni.redirectTo({ url: '/pages/fund/balance' }), 800);
  } finally {
    submitting.value = false;
  }
}
function goPayMethod() { uni.navigateTo({ url: '/pages/fund/payment-method' }); }
onShow(load);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 60rpx; }
.wallet {
  margin: 24rpx;
  padding: 48rpx 40rpx 56rpx;
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  color: #fff;
  border-radius: 28rpx;
}
.sub { font-size: 26rpx; opacity: 0.85; }
.big { font-size: 72rpx; font-weight: 800; margin-top: 12rpx; }

.card { margin: 24rpx; background: #fff; border-radius: 24rpx; padding: 8rpx 28rpx; }
.field {
  display: flex;
  align-items: center;
  padding: 32rpx 0;
  border-bottom: 2rpx solid #f5f6f8;
}
.field:last-child { border-bottom: none; }
.label { width: 160rpx; font-size: 28rpx; color: #333; }
.input { flex: 1; font-size: 28rpx; }
.all { color: $brand; font-size: 24rpx; padding: 8rpx 16rpx; border: 2rpx solid $brand; border-radius: 999rpx; }
.channels { display: flex; gap: 20rpx; flex: 1; }
.ch {
  padding: 12rpx 32rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  border: 2rpx solid #ddd;
  color: #666;
}
.ch.on { border-color: $brand; color: $brand; background: #fff1ef; }

.pay-info { margin: 24rpx; background: #fff; border-radius: 24rpx; padding: 28rpx 32rpx; }
.pi-row { display: flex; justify-content: space-between; padding: 16rpx 0; font-size: 28rpx; }
.pi-l { color: #999; }
.pi-v { color: #333; font-weight: 600; }
.pi-qr { width: 128rpx; height: 128rpx; border-radius: 12rpx; border: 2rpx solid #eee; margin-top: 16rpx; }
.pay-empty {
  margin: 24rpx;
  background: #fff7e6;
  color: #8a613f;
  font-size: 26rpx;
  border-radius: 24rpx;
  padding: 36rpx 32rpx;
}
.tips { padding: 8rpx 40rpx; font-size: 22rpx; color: #999; line-height: 2; }
.submit {
  margin: 24rpx;
  height: 92rpx;
  line-height: 92rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 32rpx;
}
.submit[disabled] { background: #ccc; }
.submit::after { border: none; }
</style>
