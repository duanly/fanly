<template>
  <el-card shadow="never">
    <template #header>
      <div style="display:flex;gap:10px;align-items:center">
        <el-select v-model="platform" placeholder="全部平台" clearable size="small" style="width:130px" @change="load">
          <el-option value="PDD" label="拼多多" />
          <el-option value="JD" label="京东" />
          <el-option value="TB" label="淘宝" />
          <el-option value="DY" label="抖音" />
        </el-select>
        <el-select v-model="status" placeholder="全部状态" clearable size="small" style="width:130px" @change="load">
          <el-option :value="1" label="已付款" />
          <el-option :value="2" label="已收货" />
          <el-option :value="3" label="已结算" />
          <el-option :value="5" label="已入账" />
          <el-option :value="4" label="已失效" />
        </el-select>
        <el-button size="small" :loading="syncing" @click="doSync">手动拉单</el-button>
      </div>
    </template>

    <el-table :data="data.list" v-loading="loading">
      <el-table-column prop="platformOrderNo" label="订单号" width="190" />
      <el-table-column label="平台" width="80">
        <template #default="{ row }">{{ names[row.platform] || row.platform }}</template>
      </el-table-column>
      <el-table-column prop="goodsTitle" label="商品" min-width="200" show-overflow-tooltip />
      <el-table-column label="归属" width="140">
        <template #default="{ row }">
          <span v-if="row.userId">用户 #{{ row.userId }}</span>
          <span v-else style="color:#f56c6c">未归属</span>
          <span v-if="row.agentId" style="color:#999"> / 代理 #{{ row.agentId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="实付" width="100">
        <template #default="{ row }">¥{{ money(row.payAmount) }}</template>
      </el-table-column>
      <el-table-column label="预估佣金" width="100">
        <template #default="{ row }">¥{{ money(row.estCommission) }}</template>
      </el-table-column>
      <el-table-column label="实结佣金" width="100">
        <template #default="{ row }">
          <span :style="{ color: +row.settleCommission > 0 ? '#ff4b3a' : '#999' }">
            ¥{{ money(row.settleCommission) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="tagType(row.orderStatus)" size="small">
            {{ statusText[row.orderStatus] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="下单时间" width="160">
        <template #default="{ row }">{{ fmt(row.orderTime) }}</template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      :total="data.total"
      :page-size="20"
      layout="total, prev, pager, next"
      style="margin-top:14px"
      @current-change="load"
    />
  </el-card>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const names = { PDD: '拼多多', JD: '京东', TB: '淘宝', DY: '抖音' };
const statusText = { 1: '已付款', 2: '已收货', 3: '已结算', 4: '已失效', 5: '已入账' };
const tagType = (s) => ({ 1: 'info', 2: 'warning', 3: 'primary', 4: 'danger', 5: 'success' }[s]);

const data = ref({ list: [], total: 0 });
const platform = ref('');
const status = ref('');
const page = ref(1);
const loading = ref(false);
const syncing = ref(false);

const money = (v) => (+(v || 0)).toFixed(2);
const fmt = (d) => (d ? new Date(d).toLocaleString('zh-CN') : '—');

async function load() {
  loading.value = true;
  try {
    data.value = await api.orders({
      platform: platform.value || undefined,
      status: status.value || undefined,
      page: page.value,
      pageSize: 20,
    });
  } finally {
    loading.value = false;
  }
}

async function doSync() {
  syncing.value = true;
  try {
    await api.syncOrders(24);
    ElMessage.success('拉单完成');
    load();
  } finally {
    syncing.value = false;
  }
}

onMounted(load);
</script>
