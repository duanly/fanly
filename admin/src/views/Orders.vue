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

onMounted(load);
</script>
