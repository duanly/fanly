<template>
  <div>
    <div class="bar">
      <el-button type="primary" @click="openEdit()">新建专题</el-button>
      <span class="hint">
        建好就能用：页面地址一列就是 H5 的入口，不用改代码也不用发版
      </span>
    </div>

    <el-table :data="list" v-loading="loading" size="small" border>
      <el-table-column label="图标" width="60" align="center">
        <template #default="{ row }">
          <span :style="{ background: row.bg || '#eee' }" class="ico">{{ row.icon || '📦' }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="name" label="名称" min-width="110" />

      <el-table-column label="页面地址" min-width="200">
        <template #default="{ row }">
          <el-tag type="info" size="small" disable-transitions>{{ row.pageUrl }}</el-tag>
          <el-button link type="primary" size="small" @click="copy(row.pageUrl)">复制</el-button>
        </template>
      </el-table-column>

      <el-table-column label="首页位置" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="SLOT_TAG[row.slot]" size="small">{{ SLOT_NAME[row.slot] || row.slot }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="goodsCount" label="商品数" width="80" align="center" />
      <el-table-column prop="sortWeight" label="权重" width="70" align="center" />

      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 1"
            @change="(v) => toggle(row, v)"
          />
        </template>
      </el-table-column>

      <el-table-column label="操作" width="200" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openGoods(row)">挂商品</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && !list.length" description="还没有专题，点「新建专题」开始" />

    <!-- ───────── 编辑 ───────── -->
    <el-dialog v-model="editOpen" :title="form.id ? '编辑专题' : '新建专题'" width="520px">
      <el-form :model="form" label-width="88px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="16" show-word-limit placeholder="婴儿用品" />
        </el-form-item>

        <el-form-item label="地址短名">
          <el-input
            v-model="form.slug"
            :disabled="!!form.id"
            placeholder="留空则按名称自动生成，比如 baby"
          />
          <div class="tip">
            <template v-if="form.id">
              建好之后不能改。改了等于换页面地址，之前分享出去的链接会全部失效——要换就新建一个。
            </template>
            <template v-else>
              只能用小写字母、数字和连字符。中文会被 URL 转义成一长串百分号，复制粘贴容易弄断。
            </template>
          </div>
        </el-form-item>

        <el-form-item label="首页位置">
          <el-radio-group v-model="form.slot">
            <el-radio value="grid">八大分区</el-radio>
            <el-radio value="activity">活动位</el-radio>
            <el-radio value="hidden">不露面</el-radio>
          </el-radio-group>
          <div class="tip">
            宫格只有八个格子，是首页最贵的位置。像「9块9特卖」这种只想在筛选里用的，选「不露面」——
            它照样是个能访问的页面，只是首页不给入口。
          </div>
        </el-form-item>

        <el-form-item label="图标">
          <el-input v-model="form.icon" maxlength="2" style="width:90px" placeholder="🍼" />
          <span class="tip inline">一个 emoji</span>
        </el-form-item>

        <el-form-item label="图标底色">
          <el-input v-model="form.bg" placeholder="linear-gradient(135deg,#81c784,#43a047)" />
          <div class="tip">留空会按名称自动分配一个，不用非填。</div>
        </el-form-item>

        <el-form-item label="一句说明">
          <el-input v-model="form.intro" maxlength="30" show-word-limit placeholder="给宝宝挑的，都是常用的" />
          <div class="tip">显示在专题页顶部；放活动位时也当卡片副标题。</div>
        </el-form-item>

        <el-form-item label="头图">
          <el-input v-model="form.cover" placeholder="图片 URL，留空就用底色渐变" />
        </el-form-item>

        <el-form-item label="排序权重">
          <el-input-number v-model="form.sortWeight" :min="0" :max="9999" />
          <span class="tip inline">越大越靠前</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- ───────── 挂商品 ───────── -->
    <el-dialog v-model="goodsOpen" :title="`${cur.name} · 挂商品`" width="860px" top="6vh">
      <el-tabs v-model="goodsTab">
        <el-tab-pane label="专题里的商品" name="in">
          <el-table
            :data="inGoods"
            v-loading="goodsLoading"
            size="small"
            height="420"
            @selection-change="(v) => (pickedIn = v)"
          >
            <el-table-column type="selection" width="42" />
            <el-table-column label="商品" min-width="300">
              <template #default="{ row }">
                <div class="g">
                  <img :src="row.image" />
                  <span>{{ row.title }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="platform" label="平台" width="70" align="center" />
            <el-table-column label="券后" width="80" align="right">
              <template #default="{ row }">¥{{ row.couponPrice }}</template>
            </el-table-column>
            <el-table-column label="佣金" width="80" align="right">
              <template #default="{ row }">¥{{ row.commission }}</template>
            </el-table-column>
          </el-table>
          <div class="dlg-bar">
            <el-button
              type="danger"
              plain
              size="small"
              :disabled="!pickedIn.length"
              @click="untag"
            >从专题移出（{{ pickedIn.length }}）</el-button>
            <span class="tip inline">只解绑，商品还在选品池里</span>
          </div>
        </el-tab-pane>

        <el-tab-pane label="从选品池添加" name="add">
          <div class="dlg-bar">
            <el-input
              v-model="poolKw"
              placeholder="按标题筛"
              clearable
              size="small"
              style="width:200px"
              @keyup.enter="loadPool"
            />
            <el-button size="small" @click="loadPool">查询</el-button>
          </div>
          <el-table
            :data="pool"
            v-loading="poolLoading"
            size="small"
            height="380"
            @selection-change="(v) => (pickedPool = v)"
          >
            <el-table-column type="selection" width="42" />
            <el-table-column label="商品" min-width="300">
              <template #default="{ row }">
                <div class="g">
                  <img :src="row.image" />
                  <span>{{ row.title }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="platform" label="平台" width="70" align="center" />
            <el-table-column label="佣金" width="80" align="right">
              <template #default="{ row }">¥{{ row.commission }}</template>
            </el-table-column>
          </el-table>
          <div class="dlg-bar">
            <el-button
              type="primary"
              size="small"
              :disabled="!pickedPool.length"
              @click="tag"
            >加到本专题（{{ pickedPool.length }}）</el-button>
            <span class="tip inline">同一件商品可以同时挂在多个专题下，加这里不会从别处消失</span>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const SLOT_NAME = { grid: '八大分区', activity: '活动位', hidden: '不露面' };
const SLOT_TAG = { grid: 'success', activity: 'warning', hidden: 'info' };

const EMPTY = {
  id: null, name: '', slug: '', icon: '', bg: '', cover: '', intro: '',
  slot: 'grid', sortWeight: 0, status: 1,
};

const list = ref([]);
const loading = ref(false);
const editOpen = ref(false);
const saving = ref(false);
const form = reactive({ ...EMPTY });

async function load() {
  loading.value = true;
  try {
    const r = await api.topics();
    list.value = r.list || r || [];
  } finally {
    loading.value = false;
  }
}

function openEdit(row) {
  Object.assign(form, EMPTY, row ? { ...row } : {});
  editOpen.value = true;
}

async function save() {
  if (!form.name.trim()) return ElMessage.warning('名称不能为空');
  saving.value = true;
  try {
    const body = { ...form };
    delete body.pageUrl;
    delete body.goodsCount;
    if (form.id) await api.topicUpdate(form.id, body);
    else await api.topicCreate(body);
    ElMessage.success('保存好了');
    editOpen.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function toggle(row, on) {
  await api.topicUpdate(row.id, { status: on ? 1 : 0 });
  row.status = on ? 1 : 0;
}

async function remove(row) {
  await ElMessageBox.confirm(
    `删除「${row.name}」？挂在它下面的 ${row.goodsCount ?? 0} 件商品只会解绑，不会从选品池里删掉。`,
    '确认',
    { type: 'warning' },
  );
  await api.topicRemove(row.id);
  ElMessage.success('删好了');
  load();
}

function copy(t) {
  navigator.clipboard?.writeText(t)
    .then(() => ElMessage.success(`已复制 ${t}`))
    .catch(() => ElMessage.warning(`复制失败，手抄一下：${t}`));
}

// ───────── 挂商品 ─────────
const goodsOpen = ref(false);
const goodsTab = ref('in');
const cur = reactive({ id: null, name: '', slug: '' });
const inGoods = ref([]);
const goodsLoading = ref(false);
const pickedIn = ref([]);
const pool = ref([]);
const poolLoading = ref(false);
const poolKw = ref('');
const pickedPool = ref([]);

function openGoods(row) {
  Object.assign(cur, { id: row.id, name: row.name, slug: row.slug });
  goodsTab.value = 'in';
  inGoods.value = [];
  pool.value = [];
  pickedIn.value = [];
  pickedPool.value = [];
  goodsOpen.value = true;
  loadIn();
  loadPool();
}

async function loadIn() {
  goodsLoading.value = true;
  try {
    const r = await api.topicGoods(cur.slug, { pageSize: 100 });
    inGoods.value = r.list || [];
  } finally {
    goodsLoading.value = false;
  }
}

async function loadPool() {
  poolLoading.value = true;
  try {
    const r = await api.curationList({ status: 1, pageSize: 100 });
    const kw = poolKw.value.trim();
    // 选品池接口没有关键词参数，条数不多就在前端筛，比为它加个接口划算
    pool.value = (r.list || []).filter((g) => !kw || (g.title || '').includes(kw));
  } finally {
    poolLoading.value = false;
  }
}

async function tag() {
  const ids = pickedPool.value.map((g) => g.curatedId ?? g.id).filter(Boolean);
  const r = await api.topicTagMany(cur.id, ids);
  ElMessage.success(`加了 ${r.added} 件${r.skipped ? `，${r.skipped} 件本来就在` : ''}`);
  pickedPool.value = [];
  loadIn();
  load();
}

async function untag() {
  const ids = pickedIn.value.map((g) => g.curatedId ?? g.id).filter(Boolean);
  const r = await api.topicUntagMany(cur.id, ids);
  ElMessage.success(`移出 ${r.removed} 件`);
  pickedIn.value = [];
  loadIn();
  load();
}

onMounted(load);
</script>

<style scoped>
.bar { margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
.hint { color: #909399; font-size: 12px; }
.ico {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 7px; font-size: 15px;
}
.tip { color: #909399; font-size: 12px; line-height: 1.5; margin-top: 3px; }
.tip.inline { margin-left: 8px; margin-top: 0; }
.dlg-bar { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
.g { display: flex; align-items: center; gap: 8px; }
.g img { width: 34px; height: 34px; object-fit: cover; border-radius: 4px; flex: none; }
.g span {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; line-height: 1.35;
}
</style>
