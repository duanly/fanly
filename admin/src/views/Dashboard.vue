<template>
  <el-row :gutter="16">
    <el-col v-for="c in cards" :key="c.label" :span="6">
      <el-card shadow="never">
        <div style="color:#999;font-size:13px">{{ c.label }}</div>
        <div style="font-size:26px;font-weight:700;margin-top:6px" :style="{ color: c.color }">
          {{ c.value }}
        </div>
      </el-card>
    </el-col>
  </el-row>

  <el-card shadow="never" style="margin-top:16px">
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>运维操作</span>
        <div>
          <el-button size="small" :loading="syncing" @click="doSync">手动拉单（近 24h）</el-button>
          <el-button size="small" :loading="checking" @click="doReconcile">立即对账</el-button>
        </div>
      </div>
    </template>

    <div v-if="reconcileResult === null && !syncResult" style="color:#999;font-size:13px">
      拉单会把近 24 小时有变更的订单同步进来；对账用资金流水重放每个账号的余额，对不上会列出来。
    </div>

    <el-alert
      v-if="reconcileResult !== null"
      :type="reconcileResult.length ? 'error' : 'success'"
      :closable="false"
      :title="reconcileResult.length
        ? `对账不一致：${reconcileResult.length} 个账号，流水重放与余额对不上`
        : '对账通过：所有账号余额与资金流水一致'"
    />
    <el-table v-if="reconcileResult?.length" :data="reconcileResult" size="small" style="margin-top:10px">
      <el-table-column prop="userId" label="用户 ID" width="100" />
      <el-table-column prop="balance" label="记录余额" />
      <el-table-column prop="replayed" label="流水重放" />
    </el-table>

    <el-table v-if="syncResult" :data="syncResult" size="small" style="margin-top:10px">
      <el-table-column prop="platform" label="平台" width="100" />
      <el-table-column label="拉到订单数">
        <template #default="{ row }">
          <span :style="{ color: row.count < 0 ? '#f56c6c' : '' }">
            {{ row.count < 0 ? '失败' : row.count }}
          </span>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-card shadow="never" style="margin-top:16px">
    <template #header>待办</template>
    <el-descriptions :column="3" border>
      <el-descriptions-item label="待审核代理">{{ pendingAgents }}</el-descriptions-item>
      <el-descriptions-item label="待审核提现">{{ pendingWithdraws }}</el-descriptions-item>
      <el-descriptions-item label="当前返利比例">{{ userRate }}</el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const orders = ref({ list: [], total: 0 });
const agents = ref({ list: [], total: 0 });
const withdraws = ref({ list: [], total: 0 });
const config = ref([]);
const syncing = ref(false);
const checking = ref(false);
const syncResult = ref(null);
const reconcileResult = ref(null);

const money = (v) => (+(v || 0)).toFixed(2);
const pendingAgents = computed(() => agents.value.list.filter((a) => a.status === 0).length);
const pendingWithdraws = computed(() => withdraws.value.list.filter((w) => w.status === 1).length);
const userRate = computed(() => {
  const c = config.value.find((x) => x.key === 'rebate.user_rate');
  return c ? `${(+c.value * 100).toFixed(0)}%` : '—';
});

const cards = computed(() => {
  const valid = orders.value.list.filter((o) => o.orderStatus !== 4);
  const gmv = valid.reduce((s, o) => s + +o.payAmount, 0);
  const commission = valid.reduce((s, o) => s + +(o.settleCommission || o.estCommission), 0);
  return [
    { label: '订单总数', value: orders.value.total, color: '' },
    { label: 'GMV（本页）', value: `¥${money(gmv)}`, color: '' },
    { label: '平台佣金（本页）', value: `¥${money(commission)}`, color: '#ff4b3a' },
    { label: '代理总数', value: agents.value.total, color: '' },
  ];
});

async function doSync() {
  syncing.value = true;
  try {
    syncResult.value = await api.syncOrders(24);
    ElMessage.success('拉单完成');
    load();
  } finally {
    syncing.value = false;
  }
}

async function doReconcile() {
  checking.value = true;
  try {
    reconcileResult.value = await api.reconcile();
  } finally {
    checking.value = false;
  }
}

async function load() {
  [orders.value, agents.value, withdraws.value, config.value] = await Promise.all([
    api.orders({ page: 1, pageSize: 100 }),
    api.agents({ page: 1 }),
    api.withdraws({ page: 1 }),
    api.config(),
  ]);
}

onMounted(load);
</script>
