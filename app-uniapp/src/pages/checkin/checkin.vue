<template>
  <view class="page">
    <view v-if="!logged" class="need-login">
      <text class="nl-emoji">🎁</text>
      <text class="nl-title">登录后签到</text>
      <text class="nl-desc">每天签到领金币，攒够了换钱</text>
      <button class="nl-btn" @click="goLogin">立即登录</button>
    </view>

    <template v-else-if="s">
      <!-- 金币头 -->
      <view class="hero">
        <view class="coins">{{ s.coins }}</view>
        <view class="lab">我的金币</view>
        <view class="worth">约值 ¥{{ s.exchangeable?.toFixed(2) }} · {{ s.exchangeRate }} 金币 = 1 元</view>
      </view>

      <!-- 签到卡 -->
      <view class="card">
        <view class="card-head">
          <text class="t">连续签到 {{ s.streak }} 天</text>
          <text class="muted">连着签每天多给</text>
        </view>
        <view class="week">
          <!-- 近 7 天日期与后端返回的本月已签日期数组 days 匹配 -->
          <view
            v-for="d in last7"
            :key="d.day"
            class="day"
            :class="{ done: s.days.includes(d.day), today: d.day === s.today }"
          >
            <text class="d-lbl">{{ d.label }}</text>
            <text class="d-mark">{{ s.days.includes(d.day) ? '✓' : '' }}</text>
          </view>
        </view>
        <button class="checkin-btn" :disabled="s.checked" :loading="signing" @click="doCheckin">
          {{ s.checked ? `今天已签到 +${s.todayCoins}` : `签到领 ${s.nextCoins} 金币` }}
        </button>
      </view>

      <!-- 兑换卡 -->
      <view class="card">
        <view class="card-head"><text class="t">金币换钱</text></view>
        <view class="muted ex-tip">满 {{ s.exchangeMin }} 金币可兑换，{{ s.exchangeRate }} 金币 = 1 元，直接进余额可提现</view>
        <input v-model="exCoins" type="digit" class="ex-input" :placeholder="`输入金币数，需为 ${s.exchangeRate} 的整数倍`" />
        <button class="ex-btn" :disabled="!canExchange" :loading="exchanging" @click="doExchange">
          {{ exMoney > 0 ? `兑换 ¥${exMoney.toFixed(2)}` : '兑换' }}
        </button>
      </view>

      <!-- 金币记录 -->
      <view v-if="ledger.length" class="sec-title">金币记录</view>
      <view v-if="ledger.length" class="ledger">
        <view v-for="l in ledger" :key="l.id" class="ledger-row">
          <view>
            <view class="l-title">{{ l.remark || l.bizType }}</view>
            <view class="l-time">{{ l.createdAt }}</view>
          </view>
          <text class="l-amount" :class="{ neg: l.amount < 0 }">{{ l.amount >= 0 ? '+' : '' }}{{ l.amount }}</text>
        </view>
      </view>
    </template>

    <view v-else class="loading">加载中…</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { useUserStore } from '../../store/user.js';

const userStore = useUserStore();
const logged = computed(() => userStore.isLoggedIn);
const s = ref(null);
const signing = ref(false);
const exchanging = ref(false);
const exCoins = ref('');
const ledger = ref([]);

// 近 7 天（含今天）的日期串与星期标签，日期串格式与后端 days 一致（YYYY-MM-DD）
const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const last7 = computed(() => {
  const pad = (n) => String(n).padStart(2, '0');
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      label: WEEK_NAMES[d.getDay()],
    });
  }
  return out;
});

const canExchange = computed(() => {
  const n = Number(exCoins.value) || 0;
  return n > 0 && n <= (s.value?.coins || 0);
});
const exMoney = computed(() => {
  const n = Number(exCoins.value) || 0;
  return s.value ? n / s.value.exchangeRate : 0;
});

async function load() {
  try {
    s.value = await api.coinStatus();
    const lr = await api.coinLedger({ page: 1, pageSize: 20 });
    ledger.value = lr.list || [];
  } catch {}
}
async function doCheckin() {
  signing.value = true;
  try {
    await api.checkin();
    uni.showToast({ title: '签到成功', icon: 'success' });
    await load();
  } finally {
    signing.value = false;
  }
}
async function doExchange() {
  if (!canExchange.value) return;
  exchanging.value = true;
  try {
    await api.coinExchange(Number(exCoins.value));
    uni.showToast({ title: '兑换成功', icon: 'success' });
    exCoins.value = '';
    await load();
  } finally {
    exchanging.value = false;
  }
}
function goLogin() { uni.navigateTo({ url: '/pages/login/login' }); }
onShow(() => { if (logged.value) load(); });
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.need-login { padding-top: 200rpx; display: flex; flex-direction: column; align-items: center; padding-left: 60rpx; padding-right: 60rpx; }
.nl-emoji { font-size: 120rpx; }
.nl-title { font-size: 32rpx; font-weight: 700; margin-top: 24rpx; }
.nl-desc { font-size: 24rpx; color: #999; margin: 16rpx 0 40rpx; }
.nl-btn { width: 360rpx; height: 88rpx; line-height: 88rpx; background: $brand; color: #fff; border-radius: 999rpx; font-size: 30rpx; }
.nl-btn::after { border: none; }

.hero {
  margin: 24rpx;
  padding: 60rpx 32rpx;
  background: linear-gradient(135deg, #ff9f43, #ee5a24);
  border-radius: 28rpx;
  text-align: center;
  color: #fff;
}
.coins { font-size: 80rpx; font-weight: 800; }
.lab { font-size: 26rpx; opacity: 0.9; }
.worth { font-size: 22rpx; opacity: 0.8; margin-top: 12rpx; }

.card {
  margin: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
}
.card-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24rpx; }
.card-head .t { font-size: 30rpx; font-weight: 700; }
.muted { font-size: 22rpx; color: #999; }
.week { display: flex; justify-content: space-between; margin-bottom: 24rpx; }
.day {
  width: 72rpx;
  height: 88rpx;
  border-radius: 16rpx;
  background: #f7f8fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  color: #bbb;
  font-size: 22rpx;
}
.d-mark { font-size: 24rpx; line-height: 1; }
.day.done { background: $brand; color: #fff; }
.day.today { border: 4rpx solid $brand; color: $brand; }
.checkin-btn {
  height: 88rpx;
  line-height: 88rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 30rpx;
}
.checkin-btn::after { border: none; }
.ex-tip { line-height: 1.7; margin-bottom: 20rpx; }
.ex-input {
  background: #f7f8fa;
  border-radius: 16rpx;
  padding: 24rpx;
  font-size: 28rpx;
  margin-bottom: 20rpx;
}
.ex-btn {
  height: 84rpx;
  line-height: 84rpx;
  border: 2rpx solid $brand;
  color: $brand;
  border-radius: 999rpx;
  font-size: 28rpx;
  background: #fff;
}
.ex-btn::after { border: none; }
.sec-title { padding: 16rpx 32rpx; font-size: 28rpx; font-weight: 700; }
.ledger { margin: 0 24rpx; background: #fff; border-radius: 24rpx; padding: 0 28rpx; }
.ledger-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 2rpx solid #f5f6f8;
}
.ledger-row:last-child { border-bottom: none; }
.l-title { font-size: 28rpx; }
.l-time { font-size: 22rpx; color: #999; margin-top: 6rpx; }
.l-amount { font-weight: 700; color: $brand; font-size: 30rpx; }
.l-amount.neg { color: #333; }
.loading { padding: 120rpx 0; text-align: center; color: #999; }
</style>
