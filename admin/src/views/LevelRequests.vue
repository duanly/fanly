<template>
  <el-card shadow="never">
    <template #header>
      <div style="display:flex;align-items:center;gap:16px">
        <el-radio-group v-model="status" size="small" @change="load">
          <el-radio-button :value="0">待审核</el-radio-button>
          <el-radio-button :value="1">已通过</el-radio-button>
          <el-radio-button :value="2">已驳回</el-radio-button>
          <el-radio-button :value="3">已取消</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="reqType" size="small" @change="load">
          <el-radio-button :value="0">全部类型</el-radio-button>
          <el-radio-button :value="1">升级</el-radio-button>
          <el-radio-button :value="2">降级</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-table :data="data.list" v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="代理" width="170">
        <template #default="{ row }">
          <div style="font-size:13px">{{ row.nickname || '未设置昵称' }}</div>
          <div style="font-size:11px;color:#999">{{ row.mobile }}</div>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.requestType === 1 ? 'success' : 'danger'" size="small">
            {{ row.requestType === 1 ? '升级' : '降级' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="等级变化" width="110">
        <template #default="{ row }">
          {{ levelName(row.fromLevel) }} → <b>{{ levelName(row.toLevel) }}</b>
        </template>
      </el-table-column>
      <el-table-column label="近90天佣金" width="110">
        <template #default="{ row }">
          ¥{{ money(row.perfSnapshot) }}
        </template>
      </el-table-column>
      <el-table-column label="宽限截止" width="170">
        <template #default="{ row }">
          <template v-if="row.status === 0 && row.requestType === 2">
            <span style="color:#ff4b3a">{{ fmtDate(row.graceUntil) }}</span>
            <div style="font-size:11px;color:#999">剩 {{ graceDays(row.graceUntil) }} 天</div>
          </template>
          <span v-else style="color:#bbb">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="rejectReason" label="备注" min-width="130" show-overflow-tooltip />
      <el-table-column label="提交时间" width="160">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 0">
            <el-button size="small" type="primary" @click="audit(row, true)">通过</el-button>
            <el-button size="small" type="danger" @click="audit(row, false)">驳回</el-button>
          </template>
          <span v-else style="color:#bbb">—</span>
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

const NAMES = ['预备代理', '白银代理', '黄金代理', '钻石代理'];
const levelName = (l) => NAMES[l] ?? l;
const money = (v) => (+(v || 0)).toFixed(2);

function fmtDate(t) {
  if (!t) return '—';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function graceDays(t) {
  if (!t) return 0;
  return Math.max(0, Math.ceil((new Date(t).getTime() - Date.now()) / 86400000));
}

const data = ref({ list: [], total: 0 });
const status = ref(0);
const reqType = ref(0);
const page = ref(1);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    data.value = await api.levelRequests({
      status: status.value,
      type: reqType.value || undefined,
      page: page.value,
    });
  } finally {
    loading.value = false;
  }
}

async function audit(row, pass) {
  let reason = '';
  if (pass) {
    await ElMessageBox.confirm(
      `确认${row.requestType === 1 ? '通过升级' : '确认降级'}：${levelName(row.fromLevel)} → ${levelName(row.toLevel)}？`,
      '等级审核',
    );
  } else {
    const r = await ElMessageBox.prompt('驳回原因（可选，不会主动通知用户）', '驳回');
    reason = r.value || '';
  }
  await api.auditLevel(row.id, pass, reason);
  ElMessage.success('已处理');
  load();
}

onMounted(load);
</script>
