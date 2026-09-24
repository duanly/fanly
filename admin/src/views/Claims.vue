<template>
  <el-card shadow="never">
    <div class="bar">
      <el-radio-group v-model="q.status" @change="load">
        <el-radio-button :value="''">全部</el-radio-button>
        <el-radio-button :value="1">待处理</el-radio-button>
        <el-radio-button :value="2">已找回</el-radio-button>
        <el-radio-button :value="3">已驳回</el-radio-button>
      </el-radio-group>
      <el-button :loading="retrying" @click="retry">催一次自动重试</el-button>
      <span class="hint">
        系统每 10 分钟自动重试一次待处理的，大部分不用人工。
        这里只处理自动匹配不上的。
      </span>
    </div>

    <el-table :data="rows" v-loading="loading" size="small">
      <el-table-column label="用户" width="80" prop="userId" />
      <el-table-column label="订单" min-width="230">
        <template #default="{ row }">
          <div style="font-weight:600">{{ platName(row.platform) }} · {{ row.platformOrderNo }}</div>
          <div class="m">{{ row.goodsTitle || '未填商品' }} · ¥{{ row.payAmount }}</div>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="180">
        <template #default="{ row }">
          <el-tag :type="TAG[row.status]" size="small">{{ STATUS[row.status] }}</el-tag>
          <div class="m" style="margin-top:3px">{{ row.resultReason }}</div>
        </template>
      </el-table-column>

      <el-table-column label="重试" width="70">
        <template #default="{ row }">
          <span class="m">{{ row.retryCount }} 次</span>
        </template>
      </el-table-column>

      <el-table-column label="提交时间" width="160">
        <template #default="{ row }">
          <span class="m">{{ fmt(row.createdAt) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <template v-if="row.status === 1">
            <el-button link type="primary" size="small" @click="audit(row, true)">通过</el-button>
            <el-button link type="danger" size="small" @click="audit(row, false)">驳回</el-button>
          </template>
          <span v-else class="m">已处理</span>
        </template>
      </el-table-column>
    </el-table>

    <el-alert
      type="info" show-icon :closable="false" style="margin-top:12px"
      title="「通过」不会凭空发钱：它只是再匹配一次订单。系统里没有这笔订单的话会自动转成驳回——真要补偿请走资金调帐，别在这儿绕过去。"
    />

    <el-pagination
      v-model:current-page="q.page"
      :page-size="20"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top:12px"
      @current-change="load"
    />
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const STATUS = { 1: '待处理', 2: '已找回', 3: '已驳回' };
const TAG = { 1: 'warning', 2: 'success', 3: 'info' };
const platName = (p) => ({ PDD: '拼多多', JD: '京东', TB: '淘宝', DY: '抖音' }[p] || p);
const fmt = (d) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '');

const rows = ref([]);
const total = ref(0);
const loading = ref(false);
const retrying = ref(false);
const q = reactive({ status: 1, page: 1 });

async function load() {
  loading.value = true;
  try {
    const r = await api.claimList({
      status: q.status === '' ? undefined : q.status,
      page: q.page,
      pageSize: 20,
    });
    rows.value = r.list || [];
    total.value = r.total || 0;
  } finally {
    loading.value = false;
  }
}

async function retry() {
  retrying.value = true;
  try {
    const r = await api.claimRetry();
    ElMessage.success(`重试 ${r.total} 条：找回 ${r.approved}，驳回 ${r.rejected}，仍在找 ${r.still}`);
    load();
  } finally {
    retrying.value = false;
  }
}

async function audit(row, pass) {
  let reason = '';
  if (!pass) {
    const r = await ElMessageBox.prompt('驳回原因（会显示给用户）', '驳回', {
      inputValue: '经核实这笔订单未通过本平台下单，无法返利',
    });
    reason = r.value;
  }
  const saved = await api.claimAudit(row.id, pass, reason);
  ElMessage[saved.status === 2 ? 'success' : 'warning'](saved.resultReason);
  load();
}

onMounted(load);
</script>

<style scoped>
.bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.hint { color: #909399; font-size: 12px; }
.m { color: #909399; font-size: 12px; }
</style>
