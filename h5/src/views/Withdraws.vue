<template>
  <div class="page">
    <van-nav-bar title="提现记录" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="load">
      <div v-for="w in list" :key="w.id" class="wd-card">
        <div class="wd-top">
          <div>
            <div class="wd-amount">¥{{ w.amount.toFixed(2) }}</div>
            <div class="muted">
              {{ channelName(w.channel) }}
              <span v-if="w.fee > 0"> · 手续费 ¥{{ w.fee.toFixed(2) }}，到手 ¥{{ w.received.toFixed(2) }}</span>
            </div>
          </div>
          <span class="wd-status" :style="{ color: STATUS[w.status]?.color }">
            {{ STATUS[w.status]?.text || '—' }}
          </span>
        </div>

        <!-- 被驳回/失败时把原因摆出来，不然用户一定来问 -->
        <div v-if="w.failReason" class="wd-reason">{{ w.failReason }}</div>

        <div class="wd-foot muted">
          <span>{{ fmt(w.createdAt) }}</span>
          <span v-if="w.channelOrderNo">流水号 {{ w.channelOrderNo }}</span>
        </div>
      </div>
    </van-list>

    <van-empty v-if="finished && !list.length" description="还没有提现记录">
      <van-button round type="primary" size="small" @click="$router.push('/withdraw')">
        去提现
      </van-button>
    </van-empty>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../api';

// 对应后端 WithdrawStatus
const STATUS = {
  1: { text: '审核中', color: '#ff976a' },
  2: { text: '审核通过', color: '#1989fa' },
  3: { text: '打款中', color: '#1989fa' },
  4: { text: '已到账', color: '#07c160' },
  5: { text: '打款失败', color: '#ee0a24' },
  6: { text: '已驳回', color: '#969799' },
};
const channelName = (c) => ({ WECHAT: '微信', ALIPAY: '支付宝' }[c] || c);
const fmt = (d) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '');

const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

async function load() {
  try {
    const r = await api.withdraws({ page: page.value, pageSize: 20 });
    list.value.push(...(r.list || []));
    page.value += 1;
    if (list.value.length >= r.total) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.wd-card {
  background: #fff;
  margin: 10px 12px;
  border-radius: 12px;
  padding: 14px;
}
.wd-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.wd-amount {
  font-size: 19px;
  font-weight: 700;
}
.wd-status {
  font-size: 13px;
  font-weight: 600;
}
.wd-reason {
  margin-top: 8px;
  padding: 8px 10px;
  background: #fff7f5;
  border-radius: 6px;
  font-size: 12px;
  color: #ee0a24;
  line-height: 1.5;
}
.wd-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
}
</style>
