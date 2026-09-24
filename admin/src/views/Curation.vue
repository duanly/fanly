<template>
  <div>
    <el-tabs v-model="tab">
      <!-- ───────── 池内管理 ───────── -->
      <el-tab-pane label="选品池" name="pool">
        <el-card shadow="never">
          <div class="bar">
            <el-select v-model="q.groupKey" placeholder="全部专题" clearable style="width:160px" @change="loadPool">
              <el-option v-for="g in groups" :key="g.groupKey" :label="`${g.groupKey} (${g.onShelf}/${g.total})`" :value="g.groupKey" />
            </el-select>
            <el-select v-model="q.status" placeholder="全部状态" clearable style="width:140px" @change="loadPool">
              <el-option label="上架" :value="1" />
              <el-option label="人工下架" :value="0" />
              <el-option label="自动下架" :value="2" />
            </el-select>
            <el-button @click="loadPool">刷新列表</el-button>
            <el-button type="warning" :loading="refreshing" @click="refreshAll">
              全池刷新价格佣金
            </el-button>
            <span class="hint">定时任务每小时自动刷一次，这里是手动催一次</span>
          </div>

          <el-alert
            v-if="expiredCount"
            :title="`有 ${expiredCount} 件被自动下架（佣金归零或退出推广），筛选「自动下架」查看`"
            type="warning"
            show-icon
            :closable="false"
            style="margin-bottom:12px"
          />

          <el-table :data="pool.list" v-loading="loading" size="small">
            <el-table-column label="商品" min-width="300">
              <template #default="{ row }">
                <div class="goods">
                  <img :src="row.image" />
                  <div>
                    <div class="t">{{ row.title }}</div>
                    <div class="m">{{ row.platform }} · {{ row.shopName || '—' }} · 已售 {{ row.salesVolume }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="价格 / 佣金" width="170">
              <template #default="{ row }">
                <div>券后 <b>¥{{ row.couponPrice }}</b> <span class="m">/ ¥{{ row.price }}</span></div>
                <div class="m">
                  佣金 ¥{{ row.commission }}（{{ (row.commissionRate * 100).toFixed(1) }}%）
                </div>
              </template>
            </el-table-column>

            <el-table-column label="专题" width="150">
              <template #default="{ row }">
                <el-input
                  v-model="row.groupKey"
                  size="small"
                  @change="(v) => save(row, { groupKey: v })"
                />
              </template>
            </el-table-column>

            <el-table-column label="权重" width="110">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.sortWeight"
                  size="small"
                  :min="-999"
                  :max="999"
                  controls-position="right"
                  style="width:92px"
                  @change="(v) => save(row, { sortWeight: v })"
                />
              </template>
            </el-table-column>

            <el-table-column label="状态" width="150">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.status === 1"
                  @change="(v) => save(row, { status: v ? 1 : 0 })"
                />
                <div v-if="row.offReason" class="m off">{{ row.offReason }}</div>
                <div v-else class="m">{{ fmt(row.lastSyncAt) }}</div>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="130">
              <template #default="{ row }">
                <el-button link size="small" @click="refreshOne(row)">刷新</el-button>
                <el-button link type="danger" size="small" @click="remove(row)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="q.page"
            :page-size="q.pageSize"
            :total="pool.total"
            layout="total, prev, pager, next"
            style="margin-top:12px"
            @current-change="loadPool"
          />
        </el-card>
      </el-tab-pane>

      <!-- ───────── 找商品 ───────── -->
      <el-tab-pane label="找商品" name="find">
        <el-card shadow="never">
          <div class="bar">
            <el-select v-model="f.platform" style="width:110px">
              <el-option label="拼多多" value="PDD" />
              <el-option label="京东" value="JD" />
              <el-option label="淘宝" value="TB" />
              <el-option label="抖音" value="DY" />
            </el-select>
            <el-input
              v-model="f.keyword"
              placeholder="关键词，留空则看平台榜单"
              style="width:240px"
              clearable
              @keyup.enter="find"
            />
            <el-select v-model="f.channel" style="width:150px">
              <el-option label="实时收益榜" value="earn" />
              <el-option label="实时热销榜" value="hot" />
              <el-option label="平台推荐位" value="pick" />
            </el-select>
            <el-button type="primary" :loading="finding" @click="find">查找</el-button>

            <el-divider direction="vertical" />
            <span class="hint">加入到</span>
            <el-input v-model="f.groupKey" style="width:130px" placeholder="专题" />
            <el-input-number v-model="f.sortWeight" :min="-999" :max="999" style="width:110px" />
          </div>

          <p class="hint" style="margin:0 0 10px">
            有关键词时按<b>到手返利</b>排序（佣金金额，不是佣金比例）；留空则拉平台榜单。
          </p>

          <div v-loading="finding" class="cards">
            <div v-for="g in found" :key="g.goodsId" class="card">
              <img :src="g.image" />
              <div class="t">{{ g.title }}</div>
              <div class="p">
                券后 <b>¥{{ g.couponPrice }}</b>
                <span v-if="g.couponAmount > 0" class="cp">券 {{ g.couponAmount }}</span>
              </div>
              <div class="c">
                佣金 <b>¥{{ g.commission }}</b>
                <span class="m">{{ (g.commissionRate * 100).toFixed(1) }}% · 售 {{ g.salesVolume }}</span>
              </div>
              <el-button
                size="small"
                type="primary"
                style="width:100%"
                :disabled="inPool.has(g.goodsId)"
                @click="add(g)"
              >
                {{ inPool.has(g.goodsId) ? '已在池中' : '加入选品池' }}
              </el-button>
            </div>
          </div>

          <el-empty v-if="!finding && !found.length" description="还没有结果，先查找" />
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const tab = ref('pool');

// ── 池内 ──
const pool = ref({ list: [], total: 0 });
const groups = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const q = reactive({ groupKey: '', status: '', page: 1, pageSize: 20 });

const expiredCount = computed(
  () => groups.value.reduce((n, g) => n + (g.total - g.onShelf), 0),
);
const inPool = computed(() => new Set(pool.value.list.map((r) => r.goodsId)));

const fmt = (d) => (d ? `同步于 ${new Date(d).toLocaleString('zh-CN', { hour12: false })}` : '未同步');

async function loadPool() {
  loading.value = true;
  try {
    pool.value = await api.curationList({
      groupKey: q.groupKey || undefined,
      status: q.status === '' ? undefined : q.status,
      page: q.page,
      pageSize: q.pageSize,
    });
    groups.value = await api.curationGroups();
  } finally {
    loading.value = false;
  }
}

async function save(row, patch) {
  await api.curationUpdate(row.curatedId, patch);
  ElMessage.success('已保存');
  loadPool();
}

async function refreshOne(row) {
  const r = await api.curationRefresh(row.curatedId);
  ElMessage[r.status === 2 ? 'warning' : 'success'](
    r.status === 2 ? `已自动下架：${r.offReason}` : '已刷新',
  );
  loadPool();
}

async function refreshAll() {
  refreshing.value = true;
  try {
    const r = await api.curationRefreshAll();
    ElMessage.success(`刷新 ${r.total} 件：正常 ${r.ok}，下架 ${r.expired}，失败 ${r.error}`);
    loadPool();
  } finally {
    refreshing.value = false;
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`把「${row.title.slice(0, 20)}」移出选品池？`, '确认', { type: 'warning' });
  await api.curationRemove(row.curatedId);
  ElMessage.success('已移除');
  loadPool();
}

// ── 找商品 ──
const found = ref([]);
const finding = ref(false);
const f = reactive({
  platform: 'PDD',
  keyword: '',
  channel: 'earn',
  groupKey: 'default',
  sortWeight: 0,
});

async function find() {
  finding.value = true;
  try {
    const r = f.keyword
      ? await api.curationSearch({ platform: f.platform, keyword: f.keyword, pageSize: 40 })
      : await api.curationRecommend({ platform: f.platform, channel: f.channel, pageSize: 40 });
    found.value = r.list || [];
    if (!found.value.length) ElMessage.warning('没查到商品，换个关键词或榜单试试');
  } finally {
    finding.value = false;
  }
}

async function add(g) {
  await api.curationAdd({
    platform: g.platform,
    goodsId: g.goodsId,
    groupKey: f.groupKey || 'default',
    sortWeight: f.sortWeight || 0,
  });
  ElMessage.success('已加入选品池');
  loadPool();
}

onMounted(loadPool);
</script>

<style scoped>
.bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.hint { color: #909399; font-size: 12px; }
.m { color: #909399; font-size: 12px; }
.off { color: #e6a23c; }

.goods { display: flex; gap: 10px; align-items: center; }
.goods img { width: 52px; height: 52px; object-fit: cover; border-radius: 6px; flex: none; }
.goods .t { font-size: 13px; line-height: 1.4; max-height: 36px; overflow: hidden; }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.card { border: 1px solid #ebeef5; border-radius: 8px; padding: 10px; }
.card img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
.card .t { font-size: 13px; line-height: 1.4; height: 36px; overflow: hidden; margin: 8px 0 6px; }
.card .p { font-size: 13px; }
.card .cp { color: #f56c6c; margin-left: 6px; font-size: 12px; }
.card .c { font-size: 12px; color: #67c23a; margin: 4px 0 8px; }
.card .c .m { margin-left: 6px; }
</style>
