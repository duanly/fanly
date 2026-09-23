<template>
  <el-card shadow="never">
    <template #header>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <el-radio-group v-model="status" size="small" @change="load">
          <el-radio-button :value="''">全部</el-radio-button>
          <el-radio-button :value="1">待审核</el-radio-button>
          <el-radio-button :value="2">待打款</el-radio-button>
          <el-radio-button :value="4">已成功</el-radio-button>
          <el-radio-button :value="5">失败</el-radio-button>
        </el-radio-group>
        <span style="color:#999;font-size:12px">
          流程：申请 → 审核 → 打款登记。跳过审核直接打款不会执行。
        </span>
      </div>
    </template>

    <el-table :data="data.list" v-loading="loading">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="userId" label="用户" width="80" />
      <el-table-column label="金额" width="110">
        <template #default="{ row }">
          <b style="color:#ff4b3a">¥{{ money(row.amount) }}</b>
        </template>
      </el-table-column>
      <el-table-column label="手续费" width="90">
        <template #default="{ row }">¥{{ money(row.fee) }}</template>
      </el-table-column>
      <el-table-column label="通道" width="90">
        <template #default="{ row }">{{ row.channel === 'WECHAT' ? '微信' : '支付宝' }}</template>
      </el-table-column>
      <el-table-column prop="accountInfo" label="收款账号" min-width="140" />
      <el-table-column prop="outTradeNo" label="打款幂等号" width="180" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="tagType(row.status)" size="small">{{ statusText[row.status] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="failReason" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 1">
            <el-button size="small" type="primary" @click="audit(row, true)">通过</el-button>
            <el-button size="small" type="danger" @click="audit(row, false)">驳回</el-button>
          </template>
          <template v-else-if="row.status === 2 || row.status === 3">
            <el-button size="small" type="success" @click="finish(row, true)">打款成功</el-button>
            <el-button size="small" @click="finish(row, false)">打款失败</el-button>
          </template>
          <span v-else style="color:#999">—</span>
        </template>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const statusText = { 1: '待审核', 2: '待打款', 3: '打款中', 4: '已成功', 5: '失败', 6: '已驳回' };
const tagType = (s) => ({ 1: 'warning', 2: 'primary', 3: 'primary', 4: 'success', 5: 'danger', 6: 'info' }[s]);

const data = ref({ list: [], total: 0 });
const status = ref('');
const page = ref(1);
const loading = ref(false);
const money = (v) => (+(v || 0)).toFixed(2);

async function load() {
  loading.value = true;
  try {
    data.value = await api.withdraws({ status: status.value || undefined, page: page.value });
  } finally {
    loading.value = false;
  }
}

async function audit(row, pass) {
  let reason = '';
  if (!pass) {
    const r = await ElMessageBox.prompt('驳回原因（会展示给用户，金额自动退回余额）', '驳回提现');
    reason = r.value;
  } else {
    await ElMessageBox.confirm(`确认通过 #${row.id} 的 ¥${money(row.amount)} 提现？`, '审核');
  }
  await api.auditWithdraw(row.id, pass, reason);
  ElMessage.success('已处理');
  load();
}

async function finish(row, success) {
  if (success) {
    const r = await ElMessageBox.prompt('填写通道流水号', '登记打款成功');
    await api.finishWithdraw(row.id, true, r.value);
  } else {
    const r = await ElMessageBox.prompt('失败原因（金额自动退回余额）', '登记打款失败');
    await api.finishWithdraw(row.id, false, '', r.value);
  }
  ElMessage.success('已登记');
  load();
}

onMounted(load);
</script>
