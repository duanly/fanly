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
      <van-field
        v-model="account"
        label="收款账号"
        :placeholder="channel === 'WECHAT' ? '微信实名姓名' : '支付宝账号'"
      />
    </van-cell-group>

    <div class="muted" style="padding:12px 16px;line-height:1.8">
      · 手续费按金融通道实收收取，平台不加价<br />
      · 提交后进入人工审核，审核通过当日打款<br />
      · 若对应订单后续发生退款，返利会被冲销
    </div>

    <div style="padding:8px 16px">
      <van-button block round type="primary" color="#ff4b3a" :loading="submitting" @click="submit">
        确认提现
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';

const bal = ref(null);
const amount = ref('');
const channel = ref('WECHAT');
const account = ref('');
const submitting = ref(false);
const router = useRouter();
const money = (v) => (+(v || 0)).toFixed(2);

async function submit() {
  if (!+amount.value) return showToast('请输入金额');
  if (!account.value.trim()) return showToast('请填写收款账号');
  submitting.value = true;
  try {
    await api.withdraw({ amount: +amount.value, channel: channel.value, accountInfo: account.value.trim() });
    showToast('已提交，等待审核');
    router.replace('/ledger');
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => { bal.value = await api.balance(); });
</script>
