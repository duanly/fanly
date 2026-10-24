<template>
  <div class="page">
    <van-nav-bar title="提现" left-arrow fixed placeholder @click-left="$router.back()" />

    <div class="wallet">
      <div class="sub">可提现余额（元）</div>
      <div class="big">{{ money(bal?.balance) }}</div>
    </div>

    <van-cell-group inset>
      <van-field
        v-model="amount"
        type="number"
        label="提现金额"
        placeholder="最低 10 元，单笔上限 800 元"
      >
        <template #button>
          <van-button size="small" @click="amount = String(Math.floor(+bal.balance))">全部</van-button>
        </template>
      </van-field>

      <van-field name="channel" label="到账方式">
        <template #input>
          <van-radio-group v-model="channel" direction="horizontal">
            <van-radio name="WECHAT">微信</van-radio>
            <van-radio name="ALIPAY">支付宝</van-radio>
          </van-radio-group>
        </template>
      </van-field>
    </van-cell-group>

    <!-- 收款信息展示 -->
    <div v-if="paymentInfo" class="pay-info">
      <div class="pay-info-row">
        <span class="pay-label">收款人</span>
        <span class="pay-value">{{ paymentInfo.realName }}</span>
      </div>
      <div class="pay-info-row">
        <span class="pay-label">收款码</span>
        <img :src="paymentInfo.qrCode" class="pay-qr" @click="previewQr" />
      </div>
      <div v-if="channel === 'ALIPAY' && paymentInfo.alipayAccount" class="pay-info-row">
        <span class="pay-label">支付宝账号</span>
        <span class="pay-value">{{ paymentInfo.alipayAccount }}</span>
      </div>
    </div>

    <!-- 未设置提示 -->
    <div v-else class="pay-empty">
      <van-icon name="warning-o" size="18" color="#ff8a00" />
      <span>尚未设置{{ channel === 'WECHAT' ? '微信' : '支付宝' }}收款信息</span>
      <van-button type="primary" color="#ff4b3a" size="small" @click="$router.push('/payment-method')">
        去设置
      </van-button>
    </div>

    <div class="muted" style="padding:12px 16px;line-height:1.8">
      · 手续费按金融通道实收收取，平台不加价<br />
      · 提交后进入人工审核，审核通过当日打款<br />
      · 若对应订单后续发生退款，返利会被冲销
    </div>

    <div style="padding:8px 16px">
      <van-button
        block
        round
        type="primary"
        color="#ff4b3a"
        :loading="submitting"
        :disabled="!paymentInfo"
        @click="submit"
      >
        {{ paymentInfo ? '确认提现' : '请先设置收款信息' }}
      </van-button>
    </div>

    <van-image-preview v-model:show="previewShow" :images="previewImages" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';

const bal = ref(null);
const amount = ref('');
const channel = ref('WECHAT');
const submitting = ref(false);
const payMethod = ref(null);
const router = useRouter();
const previewShow = ref(false);
const previewImages = ref([]);
const money = (v) => (+(v || 0)).toFixed(2);

const paymentInfo = computed(() => {
  if (!payMethod.value) return null;
  if (channel.value === 'WECHAT') {
    const w = payMethod.value.wechat;
    if (!w?.realName || !w?.qrCode) return null;
    return { realName: w.realName, qrCode: w.qrCode };
  } else {
    const a = payMethod.value.alipay;
    if (!a?.realName || !a?.qrCode) return null;
    return { realName: a.realName, qrCode: a.qrCode, alipayAccount: a.alipayAccount };
  }
});

async function load() {
  [bal.value, payMethod.value] = await Promise.all([
    api.balance(),
    api.getPaymentMethod().catch(() => null),
  ]);
}

function previewQr() {
  if (!paymentInfo.value?.qrCode) return;
  previewImages.value = [{ src: paymentInfo.value.qrCode }];
  previewShow.value = true;
}

async function submit() {
  if (!+amount.value) return showToast('请输入金额');
  if (!paymentInfo.value) return showToast('请先设置收款信息');
  submitting.value = true;
  try {
    await api.withdraw({ amount: +amount.value, channel: channel.value });
    showToast('已提交，等待审核');
    router.replace('/ledger');
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6f8;
}
.wallet {
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  color: #fff;
  padding: 24px 20px 28px;
  margin: 12px 12px 0;
  border-radius: 14px;
}
.wallet .sub {
  font-size: 13px;
  opacity: 0.85;
}
.wallet .big {
  font-size: 32px;
  font-weight: 700;
  margin-top: 6px;
}
.pay-info {
  background: #fff;
  margin: 12px 12px 0;
  padding: 14px 16px;
  border-radius: 12px;
}
.pay-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}
.pay-label {
  color: #666;
}
.pay-value {
  color: #333;
  font-weight: 500;
}
.pay-qr {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  cursor: pointer;
  object-fit: cover;
  border: 1px solid #eee;
}
.pay-empty {
  background: #fff;
  margin: 12px 12px 0;
  padding: 20px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}
.pay-empty :last-child {
  margin-left: auto;
}
.muted {
  color: #999;
  font-size: 12px;
}
</style>
