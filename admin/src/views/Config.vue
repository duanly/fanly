<template>
  <el-alert
    type="info"
    :closable="false"
    title="改完立即生效，不用重启服务。分成比例只影响之后结算的订单，已入账的不动。"
    style="margin-bottom:14px"
  />

  <el-card v-for="g in groups" :key="g.title" shadow="never" style="margin-bottom:14px">
    <template #header>{{ g.title }}</template>
    <el-table :data="g.rows">
      <el-table-column prop="key" label="参数" width="240" />
      <el-table-column prop="remark" label="说明" min-width="240" />
      <el-table-column label="当前值" width="260">
        <template #default="{ row }">
          <el-input v-model="row.value" size="small" style="width:140px" />
          <el-button
            size="small"
            type="primary"
            style="margin-left:8px"
            @click="save(row)"
          >
            保存
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const list = ref([]);

const groups = computed(() => [
  { title: '分佣比例', rows: list.value.filter((r) => r.key.startsWith('rebate.')) },
  { title: '代理规则', rows: list.value.filter((r) => r.key.startsWith('agent.')) },
  { title: '提现规则', rows: list.value.filter((r) => r.key.startsWith('withdraw.')) },
  { title: '风控阈值', rows: list.value.filter((r) => r.key.startsWith('risk.')) },
]);

async function save(row) {
  await api.setConfig(row.key, row.value);
  ElMessage.success(`${row.key} 已更新`);
}

onMounted(async () => { list.value = await api.config(); });
</script>
