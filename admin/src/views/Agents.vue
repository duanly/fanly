<template>
  <el-card shadow="never">
    <template #header>
      <el-radio-group v-model="status" size="small" @change="load">
        <el-radio-button :value="''">全部</el-radio-button>
        <el-radio-button :value="0">待审核</el-radio-button>
        <el-radio-button :value="1">正常</el-radio-button>
        <el-radio-button :value="2">已冻结</el-radio-button>
      </el-radio-group>
    </template>

    <el-table :data="data.list" v-loading="loading">
      <el-table-column prop="agentCode" label="推广码" width="100" />
      <el-table-column prop="realName" label="姓名" width="100" />
      <el-table-column label="等级" width="110">
        <template #default="{ row }">
          <el-select
            :model-value="row.level"
            size="small"
            @change="(v) => update(row, { level: v })"
          >
            <el-option :value="1" label="普通代理" />
            <el-option :value="2" label="高级代理" />
            <el-option :value="3" label="合伙人" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="分成比例" width="120">
        <template #default="{ row }">
          <span v-if="row.agentRate">{{ (+row.agentRate * 100).toFixed(0) }}% (自定义)</span>
          <span v-else style="color:#999">按等级模板</span>
        </template>
      </el-table-column>
      <el-table-column prop="teamSize" label="团队" width="70" />
      <el-table-column label="有效订单" width="90">
        <template #default="{ row }">{{ row.stats.orderCount }}</template>
      </el-table-column>
      <el-table-column label="团队 GMV" width="110">
        <template #default="{ row }">¥{{ money(row.stats.gmv) }}</template>
      </el-table-column>
      <el-table-column label="已入账分成" width="110">
        <template #default="{ row }">
          <span style="color:#ff4b3a">¥{{ money(row.stats.creditedBonus) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="已冲销" width="100">
        <template #default="{ row }">
          <span style="color:#999">¥{{ money(row.stats.reversedBonus) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="['warning', 'success', 'info'][row.status]" size="small">
            {{ ['待审核', '正常', '已冻结'][row.status] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status !== 1" size="small" type="primary" @click="update(row, { status: 1 })">
            通过
          </el-button>
          <el-button v-if="row.status !== 2" size="small" @click="update(row, { status: 2 })">冻结</el-button>
          <el-button size="small" link @click="setRate(row)">改比例</el-button>
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

const data = ref({ list: [], total: 0 });
const status = ref('');
const page = ref(1);
const loading = ref(false);
const money = (v) => (+(v || 0)).toFixed(2);

async function load() {
  loading.value = true;
  try {
    data.value = await api.agents({ status: status.value, page: page.value });
  } finally {
    loading.value = false;
  }
}

async function update(row, patch) {
  await api.updateAgent(row.id, patch);
  ElMessage.success('已更新');
  load();
}

async function setRate(row) {
  const { value } = await ElMessageBox.prompt(
    '填百分比，例如 15 表示 15%。留空则回到等级模板。',
    `设置 ${row.agentCode} 的分成比例`,
    { inputValue: row.agentRate ? String(+row.agentRate * 100) : '' },
  );
  await api.updateAgent(row.id, { agentRate: value ? String(+value / 100) : null });
  ElMessage.success('已更新');
  load();
}

onMounted(load);
</script>
