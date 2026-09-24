<template>
  <el-card shadow="never">
    <div class="bar">
      <el-button type="primary" @click="openNew">新增活动位</el-button>
      <span class="hint">
        首页那一排活动入口。可以是外链（跳出去），也可以是站内路径（如 /checkin 签到）。
        一个都没配的话首页不显示这一排。
      </span>
    </div>

    <el-table :data="rows" v-loading="loading" size="small">
      <el-table-column label="图标" width="70">
        <template #default="{ row }">
          <span style="font-size:22px">{{ row.icon }}</span>
        </template>
      </el-table-column>

      <el-table-column label="标题 / 副标题" min-width="180">
        <template #default="{ row }">
          <div style="font-weight:600">{{ row.title }}</div>
          <div class="m">{{ row.subtitle || '—' }}</div>
        </template>
      </el-table-column>

      <el-table-column label="链接" min-width="260">
        <template #default="{ row }">
          <el-tag :type="row.internal ? 'success' : 'info'" size="small" style="margin-right:6px">
            {{ row.internal ? '站内' : '外链' }}
          </el-tag>
          <span class="m">{{ row.url || '未配置' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="权重" width="80" prop="sortWeight" />

      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 1"
            @change="(v) => save({ ...row, status: v ? 1 : 0 })"
          />
        </template>
      </el-table-column>

      <el-table-column label="操作" width="130">
        <template #default="{ row }">
          <el-button link size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="visible" :title="form.id ? '编辑活动位' : '新增活动位'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="一个 emoji，例如 🎁" style="width:120px" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="例如 新人 0 元购" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" placeholder="例如 限首单" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.internal">
            <el-radio :value="false">外链</el-radio>
            <el-radio :value="true">站内页面</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="链接">
          <el-input
            v-model="form.url"
            :placeholder="form.internal ? '站内路径，如 /checkin' : 'https://…'"
          />
          <div class="hint">
            站内路径要写成 /checkin 这种形式；外链会在新窗口打开
          </div>
        </el-form-item>
        <el-form-item label="权重">
          <el-input-number v-model="form.sortWeight" :min="-999" :max="999" />
          <span class="hint" style="margin-left:8px">越大越靠前</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const rows = ref([]);
const loading = ref(false);
const visible = ref(false);
const form = reactive({
  id: null, icon: '🎁', title: '', subtitle: '', url: '', internal: false, sortWeight: 0, status: 1,
});

async function load() {
  loading.value = true;
  try { rows.value = await api.homeLinks(); } finally { loading.value = false; }
}

function openNew() {
  Object.assign(form, {
    id: null, icon: '🎁', title: '', subtitle: '', url: '', internal: false, sortWeight: 0, status: 1,
  });
  visible.value = true;
}

function openEdit(row) {
  Object.assign(form, { ...row });
  visible.value = true;
}

async function submit() {
  if (!form.title?.trim()) return ElMessage.warning('标题不能为空');
  await api.homeLinkSave({ ...form });
  ElMessage.success('已保存');
  visible.value = false;
  load();
}

async function save(row) {
  await api.homeLinkSave(row);
  load();
}

async function remove(row) {
  await ElMessageBox.confirm(`删除「${row.title}」？`, '确认', { type: 'warning' });
  await api.homeLinkRemove(row.id);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>

<style scoped>
.bar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.hint { color: #909399; font-size: 12px; }
.m { color: #909399; font-size: 12px; }
</style>
