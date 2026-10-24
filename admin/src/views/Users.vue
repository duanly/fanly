<template>
  <el-card shadow="never">
    <template #header>
      <div style="display:flex;align-items:center;gap:12px">
        <el-input
          v-model="keyword"
          placeholder="搜索手机号 / 昵称 / 邀请码"
          size="small"
          clearable
          style="width:280px"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
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
      <el-table-column prop="inviteCode" label="邀请码" width="100" />
      <el-table-column label="代理等级" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.agentLevel && row.agentLevel >= 1" size="small">
            {{ ['','白银','黄金','钻石'][row.agentLevel] || '预备' }}
          </el-tag>
          <span v-else style="color:#999;font-size:12px">普通用户</span>
        </template>
      </el-table-column>
      <el-table-column label="上级" width="150">
        <template #default="{ row }">
          <span v-if="row.parentAgentCode">
            <span>{{ row.parentNickname || row.parentAgentCode }}</span>
            <span v-if="row.parentMobile" style="color:#999;font-size:11px;margin-left:4px">
              {{ row.parentMobile }}
            </span>
          </span>
          <span v-else style="color:#999">—</span>
        </template>
      </el-table-column>
      <el-table-column label="余额" width="100">
        <template #default="{ row }">¥{{ money(row.balance) }}</template>
      </el-table-column>
      <el-table-column label="返利中" width="100">
        <template #default="{ row }">¥{{ money(row.pending) }}</template>
      </el-table-column>
      <el-table-column label="累计返利" width="110">
        <template #default="{ row }">
          <span style="color:#ff4b3a">¥{{ money(row.totalRebate) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="订单数" width="80">
        <template #default="{ row }">{{ row.orderCount || 0 }}</template>
      </el-table-column>
      <el-table-column label="注册时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '正常' : '冻结' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="onResetPwd(row)">重置密码</el-button>
          <el-button
            v-if="row.status === 1"
            size="small"
            type="danger"
            @click="onFreeze(row)"
          >冻结</el-button>
          <el-button
            v-else
            size="small"
            type="primary"
            @click="onUnfreeze(row)"
          >解冻</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const keyword = ref('');
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const money = (v) => (+(v || 0)).toFixed(2);

function formatTime(t) {
  if (!t) return '—';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function load() {
  loading.value = true;
  try {
    const r = await api.users({
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

function onSearch() {
  page.value = 1;
  load();
}

async function onResetPwd(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入新密码，留空则随机生成',
      `重置 ${row.nickname || row.mobile} 的密码`,
      { inputValue: '000000', inputPlaceholder: '6-20 位' },
    );
    const newPwd = (value || '').trim();
    const r = await api.resetUserPassword(row.id, newPwd || undefined);
    ElMessageBox.alert(
      `新密码：${r.newPassword}`,
      '重置成功',
      { confirmButtonText: '知道了' },
    );
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '重置失败');
  }
}

async function onFreeze(row) {
  try {
    await ElMessageBox.confirm(`确定要冻结 ${row.nickname || row.mobile} 吗？`, '提示');
    // TODO: 等后端加冻结接口再对接，先提示
    ElMessage.info('暂未开放冻结功能');
  } catch (e) {
    if (e === 'cancel') return;
  }
}

async function onUnfreeze(row) {
  try {
    await ElMessageBox.confirm(`确定要解冻 ${row.nickname || row.mobile} 吗？`, '提示');
    ElMessage.info('暂未开放解冻功能');
  } catch (e) {
    if (e === 'cancel') return;
  }
}

onMounted(load);
</script>
