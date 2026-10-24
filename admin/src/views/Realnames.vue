<template>
  <el-card shadow="never">
    <template #header>
      <div style="display:flex;align-items:center;gap:16px">
        <el-radio-group v-model="status" size="small" @change="onStatusChange">
          <el-radio-button :value="''">全部</el-radio-button>
          <el-radio-button :value="1">待审核</el-radio-button>
          <el-radio-button :value="2">已通过</el-radio-button>
          <el-radio-button :value="3">已驳回</el-radio-button>
        </el-radio-group>
        <el-input
          v-model="keyword"
          placeholder="搜索手机号/昵称/姓名"
          size="small"
          clearable
          style="width:260px"
          @keyup.enter="onSearch"
          @clear="onSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button size="small" type="primary" @click="onSearch">搜索</el-button>
      </div>
    </template>

    <el-table :data="list" v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="用户" width="180">
        <template #default="{ row }">
          <div style="font-size:13px">{{ row.nickname || '—' }}</div>
          <div style="font-size:12px;color:#999">{{ row.mobile }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="realName" label="真实姓名" width="110" />
      <el-table-column prop="idCardNo" label="身份证号" width="200">
        <template #default="{ row }">{{ maskId(row.idCardNo) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.realNameStatus)" size="small">
            {{ statusText(row.realNameStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="realNameRemark" label="审核备注" min-width="140" show-overflow-tooltip />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <template v-if="row.realNameStatus === 1">
            <el-button size="small" type="success" @click="onPass(row)">通过</el-button>
            <el-button size="small" type="danger" @click="onReject(row)">驳回</el-button>
          </template>
          <template v-else>
            <el-button size="small" link @click="viewDetail(row)">详情</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      :total="total"
      :page-size="pageSize"
      layout="total, prev, pager, next"
      style="margin-top:14px"
      @current-change="load"
    />
  </el-card>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const status = ref('1'); // 默认待审核
const keyword = ref('');
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);

function maskId(id) {
  if (!id) return '—';
  if (id.length < 8) return id;
  return id.slice(0, 3) + '***********' + id.slice(-4);
}

function statusType(s) {
  return { 1: 'warning', 2: 'success', 3: 'danger' }[s] || 'info';
}
function statusText(s) {
  return ['', '审核中', '已通过', '已驳回'][s] || '未知';
}

function formatTime(t) {
  if (!t) return '—';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function load() {
  loading.value = true;
  try {
    const r = await api.realnames({
      status: status.value || undefined,
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize,
    });
    list.value = r.list || r || [];
    total.value = r.total || 0;
  } finally {
    loading.value = false;
  }
}

function onStatusChange() {
  page.value = 1;
  load();
}
function onSearch() {
  page.value = 1;
  load();
}

async function onPass(row) {
  try {
    await ElMessageBox.confirm(`确定通过 ${row.realName} 的实名认证？`, '提示');
    await api.auditRealname(row.id, true, '');
    ElMessage.success('已通过');
    load();
  } catch (e) {
    if (e === 'cancel') return;
  }
}

async function onReject(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入驳回原因',
      `驳回 ${row.realName} 的认证`,
      { inputValue: '', inputPlaceholder: '例如：身份证照片不清晰' },
    );
    await api.auditRealname(row.id, false, value || '审核未通过');
    ElMessage.success('已驳回');
    load();
  } catch (e) {
    if (e === 'cancel') return;
  }
}

function viewDetail(row) {
  ElMessageBox.alert(
    `真实姓名：${row.realName || '—'}\n身份证号：${maskId(row.idCardNo)}\n状态：${statusText(row.realNameStatus)}\n备注：${row.realNameRemark || '—'}`,
    '实名详情',
    { confirmButtonText: '关闭' },
  );
}

onMounted(load);
</script>
