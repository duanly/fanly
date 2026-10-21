<template>
  <el-card shadow="never">
    <template #header>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <el-select v-model="platform" placeholder="全部平台" clearable size="small" style="width:130px" @change="onFilterChange">
          <el-option value="PDD" label="拼多多" />
          <el-option value="JD" label="京东" />
          <el-option value="TB" label="淘宝" />
          <el-option value="VIP" label="唯品会" />
        </el-select>
        <el-select v-model="status" placeholder="全部状态" clearable size="small" style="width:130px" @change="onFilterChange">
          <el-option :value="1" label="已付款" />
          <el-option :value="2" label="已收货" />
          <el-option :value="3" label="已结算" />
          <el-option :value="5" label="已入账" />
          <el-option :value="4" label="已失效" />
        </el-select>
        <el-input
          v-model="agentKeyword"
          placeholder="搜索代理（推广码/姓名/昵称）"
          size="small"
          style="width:220px"
          clearable
          @clear="onFilterChange"
          @keyup.enter="onFilterChange"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button size="small" :loading="syncing" @click="doSync">手动拉单</el-button>
        <el-button size="small" type="warning" plain :loading="recalcing" @click="doRecalcPending">
          重算返利中
        </el-button>
        <el-button size="small" type="info" plain :loading="rebuilding" @click="doRebuildPending">
          重建代理预估
        </el-button>
      </div>
    </template>

    <el-table :data="data.list" v-loading="loading">
      <el-table-column prop="platformOrderNo" label="订单号" width="190" />
      <el-table-column label="平台" width="80">
        <template #default="{ row }">{{ names[row.platform] || row.platform }}</template>
      </el-table-column>
      <el-table-column prop="goodsTitle" label="商品" min-width="200" show-overflow-tooltip />
      <el-table-column label="归属" width="200">
        <template #default="{ row }">
          <div style="line-height:1.4">
            <!-- 用户 -->
            <div v-if="row.userId" style="margin-bottom:4px">
              <div style="font-size:13px;font-weight:500">
                {{ row.userNickname || '—' }}
              </div>
              <div style="font-size:11px;color:#999">{{ row.userMobile || '' }}</div>
            </div>
            <span v-else style="color:#f56c6c;font-size:12px">未归属用户</span>

            <!-- 代理 -->
            <div v-if="row.agentId" style="border-top:1px dashed #eee;padding-top:4px;margin-top:4px">
              <div style="font-size:12px;color:#606266;display:flex;align-items:center;gap:4px">
                <el-tag size="small" :type="agentLevelTag(row.agentLevel)" effect="light">
                  {{ agentLevelName(row.agentLevel) }}
                </el-tag>
                <span style="font-weight:500">{{ row.agentCode }}</span>
              </div>
              <div style="font-size:11px;color:#999;margin-top:2px">
                {{ row.agentRealName || row.agentNickname || '—' }}
              </div>
            </div>
            <div v-else-if="row.userId" style="font-size:11px;color:#c0c4cc;margin-top:2px">
              无代理
            </div>
          </div>
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
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="openAssign(row)">
            指派归属
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 指派归属对话框 -->
    <el-dialog v-model="assignVisible" title="指派订单归属" width="480px">
      <el-alert
        v-if="assignOrder"
        :title="'订单：' + assignOrder.platformOrderNo"
        type="info"
        :closable="false"
        style="margin-bottom:16px"
      >
        <template #default>
          <div>{{ assignOrder.goodsTitle }}</div>
          <div style="margin-top:4px">
            实付 ¥{{ money(assignOrder.payAmount) }} /
            预估佣金 ¥{{ money(assignOrder.estCommission) }}
          </div>
        </template>
      </el-alert>

      <el-input
        v-model="searchUserKw"
        placeholder="搜索用户（手机号/昵称/邀请码）"
        clearable
        @keyup.enter="searchUsers"
        @clear="userList = []"
      >
        <template #append>
          <el-button :loading="userSearching" @click="searchUsers">搜索</el-button>
        </template>
      </el-input>

      <div style="margin-top:12px;max-height:320px;overflow-y:auto;border:1px solid #ebeef5;border-radius:4px">
        <div
          v-for="u in userList"
          :key="u.id"
          :class="['user-item', { active: selectedUserId === u.id }]"
          @click="selectedUserId = u.id"
        >
          <div style="font-weight:500">{{ u.nickname || '—' }}</div>
          <div style="font-size:12px;color:#909399">
            {{ u.mobile || '未绑定手机' }}
            <span v-if="u.agentLevel" style="margin-left:8px">
              <el-tag size="small" effect="plain">{{ agentLevelName(u.agentLevel) }}</el-tag>
            </span>
          </div>
        </div>
        <div v-if="!userSearching && userList.length === 0 && searchUserKw" style="text-align:center;padding:30px;color:#c0c4cc">
          未找到用户
        </div>
      </div>

      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedUserId" :loading="assigning" @click="doAssign">
          确认指派
        </el-button>
      </template>
    </el-dialog>

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
import { Search } from '@element-plus/icons-vue';
import { api } from '../api';

const names = { PDD: '拼多多', JD: '京东', TB: '淘宝', DY: '抖音' };
const statusText = { 1: '已付款', 2: '已收货', 3: '已结算', 4: '已失效', 5: '已入账' };
const tagType = (s) => ({ 1: 'info', 2: 'warning', 3: 'primary', 4: 'danger', 5: 'success' }[s]);
const agentLevelName = (l) => ({ 0: '预备', 1: '白银', 2: '黄金', 3: '钻石' }[l] || '');
const agentLevelTag = (l) => ({ 0: 'info', 1: '', 2: 'warning', 3: 'danger' }[l] || 'info');

const data = ref({ list: [], total: 0 });
const platform = ref('');
const status = ref('');
const agentKeyword = ref('');
const page = ref(1);
const loading = ref(false);
const syncing = ref(false);
const recalcing = ref(false);
const rebuilding = ref(false);

// 指派归属
const assignVisible = ref(false);
const assignOrder = ref(null);
const selectedUserId = ref(null);
const searchUserKw = ref('');
const userList = ref([]);
const userSearching = ref(false);
const assigning = ref(false);

const money = (v) => (+(v || 0)).toFixed(2);
const fmt = (d) => (d ? new Date(d).toLocaleString('zh-CN') : '—');

function onFilterChange() {
  page.value = 1;
  load();
}

async function load() {
  loading.value = true;
  try {
    data.value = await api.orders({
      platform: platform.value || undefined,
      status: status.value || undefined,
      agentKeyword: agentKeyword.value.trim() || undefined,
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

async function doRecalcPending() {
  recalcing.value = true;
  try {
    const r = await api.recalcPending();
    ElMessage.success(`重算完成，修复了 ${r.fixed} 个用户，总预估返利 ¥${(+r.totalPending).toFixed(2)}`);
    load();
  } finally {
    recalcing.value = false;
  }
}

async function doRebuildPending() {
  try {
    await ElMessageBox.confirm(
      '重建所有未结算订单的代理预估分佣明细。已结算/已冲销的明细不会受影响。',
      '确认重建',
      { type: 'info' },
    );
  } catch {
    return;
  }
  rebuilding.value = true;
  try {
    const r = await api.rebuildPendingDetails();
    ElMessage.success(`重建完成，共 ${r.rebuilt} 笔订单，待结算代理分成 ¥${(+r.totalBonus).toFixed(2)}`);
    load();
  } finally {
    rebuilding.value = false;
  }
}

// ---- 指派归属 ----
function openAssign(row) {
  assignOrder.value = row;
  selectedUserId.value = null;
  searchUserKw.value = '';
  userList.value = [];
  assignVisible.value = true;
}

async function searchUsers() {
  const kw = searchUserKw.value.trim();
  if (!kw) return;
  userSearching.value = true;
  try {
    const r = await api.users({ keyword: kw, page: 1, pageSize: 20 });
    userList.value = r.list || r || [];
  } finally {
    userSearching.value = false;
  }
}

async function doAssign() {
  if (!selectedUserId.value || !assignOrder.value) return;
  try {
    await ElMessageBox.confirm(
      `确认将订单 ${assignOrder.value.platformOrderNo} 指派给该用户？`,
      '确认指派',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  assigning.value = true;
  try {
    await api.assignOrder(assignOrder.value.id, selectedUserId.value);
    ElMessage.success('指派成功');
    assignVisible.value = false;
    load();
  } finally {
    assigning.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.user-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f5f7fa;
  transition: background 0.2s;
}
.user-item:last-child {
  border-bottom: none;
}
.user-item:hover {
  background: #f5f7fa;
}
.user-item.active {
  background: #ecf5ff;
}
</style>
