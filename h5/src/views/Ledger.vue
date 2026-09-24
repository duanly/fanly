<template>
  <div class="page">
    <van-nav-bar title="资金明细" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-dropdown-menu active-color="#ff4b3a">
      <van-dropdown-item v-model="type" :options="TYPE_OPTIONS" @change="reset" />
    </van-dropdown-menu>

    <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="load">
      <van-cell-group inset style="margin-bottom:10px">
        <van-cell
          v-for="l in list"
          :key="l.id"
          :title="typeName(l.bizType)"
          :label="`${fmt(l.createdAt)}${l.remark ? ' · ' + l.remark : ''}`"
        >
          <template #value>
            <div>
              <div :style="{ color: +l.amount >= 0 ? '#ff4b3a' : '#333', fontWeight: 600 }">
                {{ +l.amount >= 0 ? '+' : '' }}{{ (+l.amount).toFixed(2) }}
              </div>
              <div class="muted">余额 {{ (+l.balanceAfter).toFixed(2) }}</div>
            </div>
          </template>
        </van-cell>
      </van-cell-group>
    </van-list>

    <van-empty v-if="finished && !list.length" description="还没有资金记录" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../api';

const NAMES = {
  REBATE: '订单返利',
  AGENT_BONUS: '团队分成',
  WITHDRAW: '提现',
  WITHDRAW_REFUND: '提现退回',
  REVERSE: '订单失效冲销',
  ADJUST: '人工调帐',
};
const typeName = (t) => NAMES[t] || t;
const fmt = (d) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '');

const TYPE_OPTIONS = [
  { text: '全部类型', value: '' },
  ...Object.entries(NAMES).map(([value, text]) => ({ text, value })),
];

const type = ref('');
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  load();
}

async function load() {
  try {
    const r = await api.ledger({ page: page.value, pageSize: 20 });
    const rows = (r.list || []);
    // 后端暂时不支持按类型筛，条数不多先在前端过滤，
    // 数据量上来了再把 bizType 加到接口参数上
    list.value.push(...(type.value ? rows.filter((l) => l.bizType === type.value) : rows));
    page.value += 1;
    if (list.value.length >= r.total) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}
</script>
