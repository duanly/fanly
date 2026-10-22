<template>
  <el-card shadow="never">
    <template #header>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <el-select v-model="brandId" placeholder="全部品牌" clearable size="small" style="width:140px" @change="onFilterChange">
          <el-option v-for="(name, id) in BRANDS" :key="id" :label="name" :value="+id" />
        </el-select>
        <el-select v-model="status" placeholder="全部状态" clearable size="small" style="width:130px" @change="onFilterChange">
          <el-option :value="1" label="已付款" />
          <el-option :value="2" label="待结算" />
          <el-option :value="3" label="已结算" />
          <el-option :value="4" label="已失效" />
        </el-select>
        <el-input
          v-model="keyword"
          placeholder="搜索订单号/活动名称"
          size="small"
          style="width:240px"
          clearable
          @clear="onFilterChange"
          @keyup.enter="onFilterChange"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button size="small" type="primary" :loading="syncing" @click="doSync">
          手动同步
        </el-button>
      </div>
    </template>

    <el-table :data="data.list" v-loading="loading">
      <el-table-column prop="platformOrderNo" label="订单号" width="190" />
      <el-table-column label="品牌" width="100">
        <template #default="{ row }">
          <el-tag type="warning" effect="light" size="small">{{ brandName(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="goodsTitle" label="活动/商品" min-width="200" show-overflow-tooltip />
      <el-table-column label="归属" width="200">
        <template #default="{ row }">
          <div style="line-height:1.4">
            <div v-if="row.userId" style="margin-bottom:4px">
              <div style="font-size:13px;font-weight:500">
                {{ row.userNickname || '—' }}
              </div>
              <div style="font-size:11px;color:#999">{{ row.userMobile || '' }}</div>
            </div>
            <span v-else style="color:#f56c6c;font-size:12px">未归属用户</span>

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

const BRANDS = {
  1: '美团', 2: '饿了么', 3: '拼多多', 4: '京东', 5: '肯德基',
  6: '电影票', 7: '麦当劳', 8: '话费充值', 9: '百果园', 10: '奈雪的茶',
  11: '瑞幸咖啡', 12: '星巴克', 13: '喜茶', 14: '唯品会', 15: '滴滴/花小猪',
  16: '汉堡王', 17: '高德打车', 18: '电费充值', 19: '会员充值', 20: '特价快递',
  21: '联联周边游', 22: '抖音联盟', 23: '必胜客', 24: '旅划算', 25: '大牌餐券',
  26: '千千惠生活', 27: '流量卡', 28: '同程出行', 29: '华莱士', 30: 'T3出行',
  31: '景点门票', 32: '淘宝', 33: '库迪咖啡', 34: '携程旅行', 35: '分销酒店',
  36: '美团赚',
};

function brandName(o) {
  if (o.rawJson?.brand_id && BRANDS[o.rawJson.brand_id]) {
    return BRANDS[o.rawJson.brand_id];
  }
  return '本地生活';
}

const statusText = { 1: '已付款', 2: '待结算', 3: '已结算', 4: '已失效' };
const tagType = (s) => ({ 1: 'info', 2: 'warning', 3: 'primary', 4: 'danger' }[s]);
const agentLevelName = (l) => ({ 0: '预备', 1: '白银', 2: '黄金', 3: '钻石' }[l] || '');
const agentLevelTag = (l) => ({ 0: 'info', 1: '', 2: 'warning', 3: 'danger' }[l] || 'info');

const data = ref({ list: [], total: 0 });
const brandId = ref('');
const status = ref('');
const keyword = ref('');
const page = ref(1);
const loading = ref(false);
const syncing = ref(false);

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
    data.value = await api.jtkOrders({
      brandId: brandId.value || undefined,
      status: status.value || undefined,
      keyword: keyword.value.trim() || undefined,
      page: page.value,
      pageSize: 20,
    });
  } finally {
    loading.value = false;
  }
}

async function doSync() {
  try {
    await ElMessageBox.confirm(
      '立即从聚推客拉取最近 24 小时的订单？',
      '手动同步',
      { type: 'info' },
    );
  } catch {
    return;
  }
  syncing.value = true;
  try {
    const r = await api.jtkSync(24);
    ElMessage.success(`同步完成，拉取 ${r.fetched || 0} 笔`);
    load();
  } finally {
    syncing.value = false;
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
