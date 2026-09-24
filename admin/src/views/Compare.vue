<template>
  <div>
    <el-card shadow="never">
      <div class="bar">
        <el-button type="primary" @click="openNew">新建比价组</el-button>
        <el-select v-model="q.groupKey" placeholder="全部品类" clearable style="width:180px" @change="load">
          <el-option v-for="c in CATEGORIES" :key="c.key" :label="`${c.name} (${c.key})`" :value="c.key" />
        </el-select>
        <span class="hint">
          只做标品。各平台没有共享商品标识，白牌非标品没有「同款」概念，硬凑会误导用户。
        </span>
      </div>

      <el-table :data="rows" v-loading="loading" size="small" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding:8px 20px">
              <div v-if="!row.members.length" class="hint">
                还没有成员。点「加成员」，在选品池里勾同款商品——每个平台只能有一件。
              </div>
              <el-table v-else :data="row.members" size="small">
                <el-table-column label="平台" prop="platform" width="80" />
                <el-table-column label="商品" min-width="260">
                  <template #default="{ row: m }">
                    <div class="goods">
                      <img :src="m.image" />
                      <span>{{ m.title }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="券后 / 佣金" width="170">
                  <template #default="{ row: m }">
                    ¥{{ m.couponPrice }} <span class="m">/ 佣金 ¥{{ m.commission }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="90">
                  <template #default="{ row: m }">
                    <el-button link type="danger" size="small" @click="dropMember(row, m)">
                      移出
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="比价组" min-width="220">
          <template #default="{ row }">
            <div style="display:flex;gap:10px;align-items:center">
              <img v-if="row.cover" :src="row.cover" class="cover" />
              <div>
                <div style="font-weight:600">{{ row.name }}</div>
                <div class="m">{{ row.spec || '未写规格' }} · {{ categoryName(row.groupKey) }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="成员" width="90">
          <template #default="{ row }">
            <el-tag :type="row.members.length >= 2 ? 'success' : 'info'" size="small">
              {{ row.members.length }} 个平台
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              @change="(v) => save({ ...row, status: v ? 1 : 0 })"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link size="small" @click="openAdd(row)">加成员</el-button>
            <el-button link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-alert
        v-if="rows.some((r) => r.status === 1 && r.members.length < 2)"
        title="有上架的组成员不足 2 个平台，前台不会显示——一个平台没法比价"
        type="warning" show-icon :closable="false" style="margin-top:12px"
      />
    </el-card>

    <!-- 建组 / 编辑 -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑比价组' : '新建比价组'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="写清型号，例如 飞鹤星飞帆 1段 700g" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="form.spec" placeholder="例如 单罐，不含赠品" />
          <div class="hint">套装和赠品是比价失真的头号原因，写出来让用户自己判断</div>
        </el-form-item>
        <el-form-item label="品类">
          <el-select v-model="form.groupKey" filterable allow-create default-first-option>
            <el-option v-for="c in CATEGORIES" :key="c.key" :label="`${c.name} (${c.key})`" :value="c.key" />
          </el-select>
          <div class="hint">比价页顶部按这个分栏，跟选品池的「专题」是两套东西</div>
        </el-form-item>
        <el-form-item label="权重">
          <el-input-number v-model="form.sortWeight" :min="-999" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 从选品池挑成员 -->
    <el-dialog v-model="addVisible" :title="`给「${current?.name}」加成员`" width="720px">
      <div class="bar">
        <el-input
          v-model="poolKeyword" placeholder="按标题筛选选品池"
          style="width:220px" clearable @input="filterPool"
        />
        <span class="hint">只列选品池里的商品。没有的话先去「选品池 → 找商品」用全平台搜一遍。</span>
      </div>

      <el-table :data="poolShown" size="small" @selection-change="(v) => picked = v" max-height="380">
        <el-table-column type="selection" width="44" />
        <el-table-column label="平台" prop="platform" width="80" />
        <el-table-column label="商品" min-width="280">
          <template #default="{ row }">
            <div class="goods">
              <img :src="row.image" />
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="券后" width="90">
          <template #default="{ row }">¥{{ row.couponPrice }}</template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!picked.length" @click="submitMembers">
          加入 {{ picked.length }} 件
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { CATEGORIES, categoryName } from '../constants/groups';

const rows = ref([]);
const loading = ref(false);
const q = reactive({ groupKey: '' });

const formVisible = ref(false);
const form = reactive({ id: null, name: '', spec: '', groupKey: 'electronics', sortWeight: 0 });

const addVisible = ref(false);
const current = ref(null);
const pool = ref([]);
const poolShown = ref([]);
const poolKeyword = ref('');
const picked = ref([]);

async function load() {
  loading.value = true;
  try {
    const r = await api.compareList({ groupKey: q.groupKey || undefined, pageSize: 50 });
    rows.value = r.list || [];
  } finally {
    loading.value = false;
  }
}

function openNew() {
  Object.assign(form, { id: null, name: '', spec: '', groupKey: 'electronics', sortWeight: 0 });
  formVisible.value = true;
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id, name: row.name, spec: row.spec,
    groupKey: row.groupKey, sortWeight: row.sortWeight,
  });
  formVisible.value = true;
}

async function submit() {
  await api.compareSave({ ...form });
  ElMessage.success('已保存');
  formVisible.value = false;
  load();
}

async function save(row) {
  await api.compareSave({
    id: row.id, name: row.name, spec: row.spec,
    groupKey: row.groupKey, sortWeight: row.sortWeight, status: row.status,
  });
  load();
}

async function remove(row) {
  await ElMessageBox.confirm(
    `删除比价组「${row.name}」？成员商品会留在选品池，只是不再参与比价。`,
    '确认', { type: 'warning' },
  );
  await api.compareRemove(row.id);
  ElMessage.success('已删除');
  load();
}

async function openAdd(row) {
  current.value = row;
  picked.value = [];
  poolKeyword.value = '';
  const r = await api.curationList({ status: 1, pageSize: 100 });
  pool.value = (r.list || []).map((g) => ({ ...g, id: g.curatedId }));
  poolShown.value = pool.value;
  addVisible.value = true;
}

function filterPool() {
  const k = poolKeyword.value.trim();
  poolShown.value = k ? pool.value.filter((g) => g.title.includes(k)) : pool.value;
}

async function submitMembers() {
  const r = await api.compareAddMembers(current.value.id, picked.value.map((p) => p.id));
  if (r.skipped?.length) {
    ElMessage.warning(`加入 ${r.added} 件，${r.skipped.length} 件跳过：${r.skipped[0].reason}`);
  } else {
    ElMessage.success(`加入 ${r.added} 件`);
  }
  addVisible.value = false;
  load();
}

async function dropMember(group, m) {
  await api.compareRemoveMember(group.id, m.curatedId);
  ElMessage.success('已移出');
  load();
}

onMounted(load);
</script>

<style scoped>
.bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.hint { color: #909399; font-size: 12px; }
.m { color: #909399; font-size: 12px; }
.cover { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; }
.goods { display: flex; gap: 8px; align-items: center; }
.goods img { width: 36px; height: 36px; border-radius: 4px; object-fit: cover; flex: none; }
.goods span { font-size: 12px; line-height: 1.4; }
</style>
