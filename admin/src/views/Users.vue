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

    <el-table
      :data="list"
      v-loading="loading"
      row-key="id"
      :default-sort="{ prop: 'id', order: 'descending' }"
      @sort-change="onSortChange"
    >
      <!-- 折叠行：资金/上级明细 + 操作，默认收起 -->
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="expand-box">
            <div class="expand-block">
              <div class="expand-title">资金</div>
              <div class="expand-line">余额：¥{{ money(row.balance) }}</div>
              <div class="expand-line">返利中：¥{{ money(row.pending) }}</div>
              <div class="expand-line">累计返利：<span style="color:#ff4b3a">¥{{ money(row.totalRebate) }}</span></div>
            </div>
            <div class="expand-block">
              <div class="expand-title">关系</div>
              <div class="expand-line">邀请码：{{ row.inviteCode || '—' }}</div>
              <div class="expand-line">
                上级代理：
                <template v-if="row.parentAgentCode">
                  {{ row.parentNickname || row.parentAgentCode }}
                  <span class="muted">{{ row.parentMobile || '' }}</span>
                </template>
                <span v-else class="muted">—</span>
              </div>
            </div>
            <div class="expand-block">
              <div class="expand-title">操作</div>
              <div class="expand-actions">
                <el-button size="small" @click="onResetPwd(row)">重置密码</el-button>
                <el-button v-if="row.status === 1" size="small" type="danger" @click="onFreeze(row)">冻结</el-button>
                <el-button v-else size="small" type="primary" @click="onUnfreeze(row)">解冻</el-button>
              </div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="ID" width="80" sortable="custom" />
      <el-table-column label="用户" width="180">
        <template #default="{ row }">
          <div style="font-size:13px">{{ row.nickname || '—' }}</div>
          <div style="font-size:12px;color:#999">{{ row.mobile }}</div>
        </template>
      </el-table-column>
      <el-table-column label="代理等级" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.agentLevel && row.agentLevel >= 1" size="small">
            {{ ['','白银','黄金','钻石'][row.agentLevel] || '预备' }}
          </el-tag>
          <span v-else style="color:#999;font-size:12px">普通用户</span>
        </template>
      </el-table-column>
      <el-table-column label="订单数" width="100" prop="orderCount" sortable="custom">
        <template #default="{ row }">{{ row.orderCount || 0 }}</template>
      </el-table-column>
      <el-table-column label="订单额" width="120" prop="totalSpend" sortable="custom">
        <template #default="{ row }">¥{{ money(row.totalSpend) }}</template>
      </el-table-column>
      <el-table-column label="累计返利" width="120" prop="totalRebate" sortable="custom">
        <template #default="{ row }">
          <span style="color:#ff4b3a">¥{{ money(row.totalRebate) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="170" prop="createdAt" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '正常' : '冻结' }}
          </el-tag>
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
// 服务端排序（含子查询统计列），字段在后端白名单内，默认新用户在前（id 倒序）
const sortBy = ref('id');
const sortOrder = ref('desc');

function onSortChange({ prop, order }) {
  sortBy.value = prop || 'id';
  sortOrder.value = order === 'ascending' ? 'asc' : 'desc';
  page.value = 1;
  load();
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
    const r = await api.users({
      keyword: keyword.value || undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
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

<style scoped>
.expand-box {
  display: flex;
  gap: 48px;
  padding: 8px 24px 16px 48px;
  background: #fafafa;
}
.expand-block { min-width: 200px; }
.expand-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
.expand-line {
  font-size: 13px;
  color: #303133;
  line-height: 2;
}
.expand-line .muted, .muted { color: #909399; }
.expand-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
