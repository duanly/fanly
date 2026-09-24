<template>
  <div class="page">
    <van-nav-bar title="签到领金币" left-arrow fixed placeholder @click-left="back" />

    <NeedLogin v-if="!logged" title="登录后签到" desc="每天签到领金币，攒够了换钱" />

    <template v-else-if="s">
      <div class="ck-hero">
        <div class="coins">{{ s.coins }}</div>
        <div class="lab">我的金币</div>
        <div class="worth">
          约值 ¥{{ s.exchangeable.toFixed(2) }} · {{ s.exchangeRate }} 金币 = 1 元
        </div>
      </div>

      <div class="ck-card">
        <div class="ck-head">
          <span class="t">连续签到 <b>{{ s.streak }}</b> 天</span>
          <span class="muted">连着签，每天多给 {{ bonus }} 金币</span>
        </div>

        <!-- 七天进度：连续签到的钩子要看得见 -->
        <div class="week">
          <div v-for="d in week" :key="d.day" class="cell" :class="{ done: d.done, today: d.isToday }">
            <div class="c">{{ d.done ? '✓' : d.coins }}</div>
            <div class="d">{{ d.label }}</div>
          </div>
        </div>

        <van-button
          block round type="danger" color="#ff4b3a"
          :disabled="s.checked" :loading="signing"
          style="margin-top:16px"
          @click="doCheckin"
        >
          {{ s.checked ? `今天已签到 +${s.todayCoins}` : `签到领 ${s.nextCoins} 金币` }}
        </van-button>
      </div>

      <div class="ck-card">
        <div class="ck-head"><span class="t">金币换钱</span></div>
        <div class="muted" style="line-height:1.7;margin-bottom:12px">
          满 {{ s.exchangeMin }} 金币可兑换，{{ s.exchangeRate }} 金币换 1 元，
          换出来的钱直接进余额，可以提现。
        </div>
        <van-field
          v-model="exCoins"
          type="digit"
          :placeholder="`输入金币数，需为 ${s.exchangeRate} 的整数倍`"
          class="ex-field"
        />
        <van-button
          block round plain
          :disabled="!canExchange" :loading="exchanging"
          style="margin-top:10px"
          @click="doExchange"
        >
          {{ exMoney > 0 ? `兑换 ¥${exMoney.toFixed(2)}` : '兑换' }}
        </van-button>
      </div>

      <div v-if="ledger.length" class="sec">金币记录</div>
      <van-cell-group v-if="ledger.length" inset>
        <van-cell
          v-for="l in ledger"
          :key="l.id"
          :title="l.remark || l.bizType"
          :label="fmt(l.createdAt)"
        >
          <template #value>
            <span :style="{ color: l.amount >= 0 ? '#ff4b3a' : '#333', fontWeight: 600 }">
              {{ l.amount >= 0 ? '+' : '' }}{{ l.amount }}
            </span>
          </template>
        </van-cell>
      </van-cell-group>
    </template>

    <van-loading v-else style="padding:60px;text-align:center" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import NeedLogin from '../components/NeedLogin.vue';

const router = useRouter();
const logged = ref(!!localStorage.getItem('token'));
const s = ref(null);
const ledger = ref([]);
const signing = ref(false);
const exchanging = ref(false);
const exCoins = ref('');

const bonus = computed(() => 5);
const exMoney = computed(() =>
  s.value ? (Number(exCoins.value) || 0) / s.value.exchangeRate : 0);
const canExchange = computed(() => {
  const n = Number(exCoins.value) || 0;
  return s.value && n >= s.value.exchangeMin && n <= s.value.coins && n % s.value.exchangeRate === 0;
});

const fmt = (d) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '');

/** 最近七天的打卡格子：已签的打勾，今天高亮，未来的显示能得多少 */
const week = computed(() => {
  if (!s.value) return [];
  const done = new Set(s.value.days);
  const out = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const day = d.toLocaleDateString('sv-SE');
    out.push({
      day,
      done: done.has(day),
      isToday: i === 0,
      label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
      coins: s.value.nextCoins,
    });
  }
  return out;
});

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

async function load() {
  if (!logged.value) return;
  s.value = await api.coinStatus();
  try {
    const r = await api.coinLedger();
    ledger.value = r.list || [];
  } catch { ledger.value = []; }
}

async function doCheckin() {
  signing.value = true;
  try {
    const r = await api.checkin();
    showToast(r.already ? '今天已经签过了' : `签到成功，+${r.coins} 金币`);
    await load();
  } finally {
    signing.value = false;
  }
}

async function doExchange() {
  exchanging.value = true;
  try {
    const r = await api.coinExchange(Number(exCoins.value));
    showToast(`已兑换 ¥${r.money}，进你的余额了`);
    exCoins.value = '';
    await load();
  } finally {
    exchanging.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ck-hero {
  background: linear-gradient(135deg, #ff8a3d, #ff3b30);
  color: #fff;
  padding: 26px 16px 24px;
  text-align: center;
}
.ck-hero .coins { font-size: 42px; font-weight: 800; line-height: 1.1; }
.ck-hero .lab { font-size: 13px; opacity: .9; margin-top: 4px; }
.ck-hero .worth { font-size: 12px; opacity: .85; margin-top: 8px; }

.ck-card { background: #fff; margin: 12px; border-radius: 12px; padding: 16px; }
.ck-head { display: flex; align-items: baseline; justify-content: space-between; }
.ck-head .t { font-size: 15px; font-weight: 700; }
.ck-head .t b { color: #ff4b3a; font-size: 18px; }
.ck-head .muted { font-size: 11px; }

.week { display: flex; gap: 5px; margin-top: 14px; }
.cell {
  flex: 1; text-align: center;
  background: #f7f8fa; border-radius: 8px; padding: 8px 0;
}
.cell .c { font-size: 14px; font-weight: 700; color: #c8c9cc; }
.cell .d { font-size: 10px; color: #969799; margin-top: 2px; }
.cell.done { background: #fff1ee; }
.cell.done .c { color: #ff4b3a; }
.cell.today { outline: 1px solid #ff4b3a; }

.ex-field { background: #f7f8fa; border-radius: 8px; padding: 8px 12px; }
.sec { padding: 14px 16px 6px; font-size: 15px; font-weight: 700; }
</style>
