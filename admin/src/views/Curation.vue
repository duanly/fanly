<template>
  <div>
    <el-tabs v-model="tab">
      <!-- ───────── 待上架 ───────── -->
      <el-tab-pane label="待上架" name="pending">
        <el-card shadow="never">
          <div class="bar">
            <el-select v-model="p.platform" placeholder="全部平台" clearable style="width:140px" @change="loadPending">
              <el-option label="拼多多" value="PDD" />
              <el-option label="京东" value="JD" />
              <el-option label="淘宝" value="TB" />
              <el-option label="唯品会" value="VIP" />
            </el-select>
            <el-input
              v-model="p.keyword"
              placeholder="搜商品标题关键词"
              style="width:220px"
              clearable
              @keyup.enter="loadPending"
            />
            <el-input-number v-model="p.minCommission" :min="0" :precision="2" :step="0.5" placeholder="最低佣金" style="width:120px" />
            <span class="hint">元以上</span>
            <el-input-number v-model="p.minSales" :min="0" :step="100" placeholder="最低销量" style="width:120px" />
            <span class="hint">件以上</span>
            <el-button type="primary" @click="loadPending">筛选</el-button>

            <el-divider direction="vertical" />
            <el-button type="primary" :loading="pulling" @click="autoPull">
              手动触发自动拉品
            </el-button>

            <el-divider direction="vertical" />
            <el-button type="success" :disabled="!selectedIds.length" @click="batchOnShelf">
              批量上架 ({{ selectedIds.length }})
            </el-button>
            <el-button type="warning" :disabled="!selectedIds.length" @click="batchTag">
              上架并打标签
            </el-button>
            <el-button type="danger" :disabled="!selectedIds.length" @click="batchRemove">
              批量删除
            </el-button>
          </div>

          <p class="hint" style="margin:0 0 10px">
            这里是自动拉品回来的「待选品」商品。每天凌晨会自动从各平台拉取约 1000 件有佣金的商品。
            审核通过后点「上架」就进入货架，前台就能看到了。
          </p>

          <el-table
            :data="pending.list"
            v-loading="pLoading"
            size="small"
            @selection-change="(v) => selectedIds = v.map((r) => r.curatedId)"
          >
            <el-table-column type="selection" width="42" />
            <el-table-column label="商品" min-width="300">
              <template #default="{ row }">
                <div class="goods">
                  <img :src="row.image" />
                  <div>
                    <div class="t">{{ row.title }}</div>
                    <div class="m">{{ row.platform }} · {{ row.shopName || '—' }}<span v-if="row.salesVolume"> · 已售 {{ row.salesVolume }}</span></div>
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

            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button link type="success" size="small" @click="onShelf(row)">上架</el-button>
                <el-button link type="primary" size="small" @click="onShelfAndTag(row)">上架并打标签</el-button>
                <el-button link type="danger" size="small" @click="removePending(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="p.page"
            :page-size="p.pageSize"
            :total="pending.total"
            layout="total, prev, pager, next"
            style="margin-top:12px"
            @current-change="loadPending"
          />
        </el-card>
      </el-tab-pane>

      <!-- ───────── 货架内管理 ───────── -->
      <el-tab-pane label="货架" name="pool">
        <el-card shadow="never">
          <div class="bar">
            <el-select v-model="q.topicId" placeholder="全部标签" clearable style="width:190px" @change="loadPool">
              <el-option
                v-for="t in allTopics"
                :key="t.id"
                :label="t.name"
                :value="t.id"
                :disabled="t.status !== 1"
              />
            </el-select>
            <el-select v-model="q.status" placeholder="全部状态" clearable style="width:140px" @change="loadPool">
              <el-option label="上架" :value="1" />
              <el-option label="人工下架" :value="0" />
              <el-option label="自动下架" :value="2" />
              <el-option label="待选品" :value="3" />
            </el-select>
            <el-button @click="loadPool">刷新列表</el-button>
            <el-button type="warning" :loading="refreshing" @click="refreshAll">
              全池刷新价格佣金
            </el-button>
            <el-button type="danger" :loading="removingOff" @click="removeOffShelf">
              一键移除已下架
            </el-button>
            <el-button :loading="cleaningOld" @click="cleanOffShelf">
              清理历史下架
            </el-button>
            <el-button type="warning" :loading="deduping" @click="doDedup">
              一键去重
            </el-button>

            <el-divider direction="vertical" />
            <el-button type="primary" :disabled="!poolSelected.length" @click="openBatchTag">
              批量打标签 ({{ poolSelected.length }})
            </el-button>
            <el-button type="danger" :disabled="!poolSelected.length" @click="batchUntag">
              批量取消标签
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

          <el-table
            :data="pool.list"
            v-loading="loading"
            size="small"
            @selection-change="(v) => poolSelected = v"
          >
            <el-table-column type="selection" width="42" />
            <el-table-column label="商品" min-width="300">
              <template #default="{ row }">
                <div class="goods">
                  <img :src="row.image" />
                  <div>
                    <div class="t">{{ row.title }}</div>
                    <div class="m">{{ row.platform }} · {{ row.shopName || '—' }}<span v-if="row.salesVolume"> · 已售 {{ row.salesVolume }}</span></div>
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

            <el-table-column label="标签" width="220">
              <template #default="{ row }">
                <div v-if="goodsTags[row.curatedId] == null" class="no-tags" @click="addFirstTag(row)">
                  <el-tag type="warning" size="small" effect="dark" style="cursor:pointer">未打标签 · 点击添加</el-tag>
                </div>
                <el-select
                  v-else
                  v-model="goodsTags[row.curatedId]"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  placeholder="点击添加标签"
                  size="small"
                  style="width:100%"
                  @change="(v) => saveTags(row, v)"
                >
                  <el-option
                    v-for="t in allTopics"
                    :key="t.id"
                    :label="t.name"
                    :value="t.id"
                    :disabled="t.status !== 1"
                  />
                </el-select>
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
              <el-option label="唯品会" value="VIP" />
            </el-select>
            <el-input
              v-model="f.keyword"
              placeholder="关键词，留空看全品类/榜单"
              style="width:240px"
              clearable
              @keyup.enter="find"
            />
            <el-select v-model="f.channel" style="width:150px">
              <el-option label="全品类" value="all" />
              <el-option label="实时收益榜" value="earn" />
              <el-option label="实时热销榜" value="hot" />
              <el-option label="平台推荐位" value="pick" />
            </el-select>
            <el-button type="primary" :loading="finding" @click="find">查找</el-button>

            <el-divider direction="vertical" />
            <span class="hint">导入到</span>
            <el-radio-group v-model="f.targetStatus" size="default">
              <el-radio :label="3">待上架</el-radio>
              <el-radio :label="1">直接上架</el-radio>
            </el-radio-group>
            <el-input-number v-model="f.importCount" :min="20" :max="500" :step="20" style="width:110px" />
            <span class="hint">件</span>
            <el-button type="success" :loading="importing" @click="importBatch">
              {{ f.targetStatus === 1 ? '一键批量导入并上架' : '一键批量导入进待上架' }}
            </el-button>

            <el-divider direction="vertical" />
            <span class="hint">导入时打标签</span>
            <el-select
              v-model="f.importTopicIds"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="选择标签（可选）"
              size="default"
              style="width:220px"
            >
              <el-option
                v-for="t in allTopics"
                :key="t.id"
                :label="t.name"
                :value="t.id"
                :disabled="t.status !== 1"
              />
            </el-select>
            <el-input-number v-model="f.sortWeight" :min="-999" :max="999" style="width:110px" />
          </div>

          <p class="hint" style="margin:0 0 10px">
            有关键词时按<b>到手返利</b>排序（佣金金额，不是佣金比例）；留空选「全品类」按<b>销量</b>浏览平台全部商品，选榜单则拉对应榜单。
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
                <span class="m">{{ (g.commissionRate * 100).toFixed(1) }}%<span v-if="g.salesVolume"> · 售 {{ g.salesVolume }}</span></span>
              </div>
              <div class="card-status">
                <el-tag v-if="foundStatus[statusKey(g)]?.status === 1" type="success" size="small" effect="light">已上架</el-tag>
                <el-tag v-else-if="foundStatus[statusKey(g)]?.status === 3" type="warning" size="small" effect="light">待上架</el-tag>
                <el-tag v-else-if="foundStatus[statusKey(g)]?.status === 0" type="info" size="small" effect="light">已下架</el-tag>
                <el-tag v-else-if="foundStatus[statusKey(g)]?.status === 2" type="danger" size="small" effect="light">已过期</el-tag>
              </div>
              <el-button
                v-if="!foundStatus[statusKey(g)]"
                size="small"
                type="primary"
                style="width:100%"
                @click="openAddWithTags(g)"
              >
                上架
              </el-button>
              <el-button
                v-else-if="foundStatus[statusKey(g)]?.status === 3"
                size="small"
                type="success"
                style="width:100%"
                @click="openAddWithTags(g, true)"
              >
                上架并打标签
              </el-button>
              <el-button
                v-else
                size="small"
                plain
                style="width:100%"
                @click="refreshFoundStatus(g)"
              >
                刷新状态
              </el-button>
            </div>
          </div>

          <div v-if="f.hasMore" class="more">
            <el-button :loading="finding" @click="more">
              加载更多（已显示 {{ found.length }} 件）
            </el-button>
          </div>

          <el-empty v-if="!finding && !found.length" description="还没有结果，先查找" />
        </el-card>
      </el-tab-pane>
    
    <!-- 找商品：单个上架+打标签弹框 -->
    <el-dialog v-model="addDlg" title="上架商品" width="480px">
      <el-form label-width="80px">
        <el-form-item label="商品">
          <span>{{ addDlgGoods?.g?.title?.slice(0, 40) }}</span>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="addDlgTags" multiple placeholder="选择标签（可选，不选就是进全品类）" style="width:100%">
            <el-option
              v-for="t in allTopics"
              :key="t.id"
              :label="t.name"
              :value="t.id"
              :disabled="t.status !== 1"
            />
          </el-select>
          <div style="color:#909399;font-size:12px;margin-top:4px">
            不打标签也会进入前台「全部商品」页
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDlg = false">取消</el-button>
        <el-button type="primary" :loading="addDlgLoading" @click="confirmAddWithTags">确认上架</el-button>
      </template>
    </el-dialog>

    <!-- 批量打标签弹框 -->
    <el-dialog v-model="batchTagOpen" title="批量打标签" width="480px">
      <el-select v-model="batchTagIds" multiple placeholder="选择要打的标签" style="width:100%">
        <el-option
          v-for="t in allTopics"
          :key="t.id"
          :label="t.name"
          :value="t.id"
          :disabled="t.status !== 1"
        />
      </el-select>
      <div style="color:#909399;font-size:12px;margin-top:8px">
        将给选中的 {{ poolSelected.length }} 件商品打上这些标签（已有的不受影响）
      </div>
      <template #footer>
        <el-button @click="batchTagOpen = false">取消</el-button>
        <el-button type="primary" :loading="batchTagLoading" @click="confirmBatchTag">确定</el-button>
      </template>
    </el-dialog>

    <!-- 待选品单个：上架并打标签 -->
    <el-dialog v-model="pendingTagDlg" title="上架并打标签" width="480px">
      <el-select v-model="pendingTagIds" multiple placeholder="选择要打的标签（可不选，直接上架）" style="width:100%">
        <el-option
          v-for="t in allTopics"
          :key="t.id"
          :label="t.name"
          :value="t.id"
          :disabled="t.status !== 1"
        />
      </el-select>
      <div style="color:#909399;font-size:12px;margin-top:8px">
        上架后商品会进入货架并打上选中的标签
      </div>
      <template #footer>
        <el-button @click="pendingTagDlg = false">取消</el-button>
        <el-button type="primary" :loading="pendingTagLoading" @click="confirmPendingTag">确定上架</el-button>
      </template>
    </el-dialog>

    <!-- 待选品批量：上架并打标签 -->
    <el-dialog v-model="pendingBatchTagDlg" title="批量上架并打标签" width="480px">
      <el-select v-model="pendingBatchTagIds" multiple placeholder="选择要打的标签（可不选，直接上架）" style="width:100%">
        <el-option
          v-for="t in allTopics"
          :key="t.id"
          :label="t.name"
          :value="t.id"
          :disabled="t.status !== 1"
        />
      </el-select>
      <div style="color:#909399;font-size:12px;margin-top:8px">
        将给选中的 {{ selectedIds.length }} 件商品上架并打标签
      </div>
      <template #footer>
        <el-button @click="pendingBatchTagDlg = false">取消</el-button>
        <el-button type="primary" :loading="pendingBatchTagLoading" @click="confirmPendingBatchTag">确定上架</el-button>
      </template>
    </el-dialog>
</el-tabs>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { GROUPS, groupName } from '../constants/groups';

const tab = ref('pending');

// ── 待上架（待选品）──
const pending = ref({ list: [], total: 0 });
const pLoading = ref(false);
const pulling = ref(false);
const selectedIds = ref([]);
const p = reactive({
  platform: '',
  keyword: '',
  minCommission: 0,
  minSales: 0,
  page: 1,
  pageSize: 30,
});

const topicList = ref([]);

async function loadPending() {
  pLoading.value = true;
  try {
    const r = await api.curationList({
      status: 3, // PENDING
      page: p.page,
      pageSize: p.pageSize,
    });
    let list = r.list || [];
    // 前端再过滤平台和关键词（后端 list 接口目前只支持 groupKey 和 status）
    if (p.platform) list = list.filter((g) => g.platform === p.platform);
    if (p.keyword) list = list.filter((g) => g.title.includes(p.keyword));
    if (p.minCommission > 0) list = list.filter((g) => Number(g.commission) >= p.minCommission);
    if (p.minSales > 0) list = list.filter((g) => (g.salesVolume || 0) >= p.minSales);
    pending.value = { list, total: list.length < p.pageSize ? (p.page - 1) * p.pageSize + list.length : r.total };
    // 加载 topic 列表（打标签用）
    if (!topicList.value.length) {
      topicList.value = await api.topics();
    }
  } finally {
    pLoading.value = false;
  }
}

async function onShelf(row) {
  await api.curationUpdate(row.curatedId, { status: 1 });
  ElMessage.success('已上架');
  loadPending();
}

// 待选品上架+打标签（单个）
const pendingTagDlg = ref(false);
const pendingTagIds = ref([]);
const pendingTagRow = ref(null);
const pendingTagLoading = ref(false);

function onShelfAndTag(row) {
  pendingTagRow.value = row;
  pendingTagIds.value = [];
  pendingTagDlg.value = true;
}

async function confirmPendingTag() {
  if (!pendingTagRow.value) return;
  pendingTagLoading.value = true;
  try {
    const id = pendingTagRow.value.curatedId;
    await api.curationUpdate(id, { status: 1 });
    for (const tid of pendingTagIds.value) {
      await api.topicTagMany(tid, [id]);
    }
    ElMessage.success('已上架' + (pendingTagIds.value.length ? '并打标签' : ''));
    pendingTagDlg.value = false;
    loadPending();
  } finally {
    pendingTagLoading.value = false;
  }
}

async function batchOnShelf() {
  if (!selectedIds.value.length) return;
  await ElMessageBox.confirm(`确认上架选中的 ${selectedIds.value.length} 件商品？`, '批量上架', { type: 'success' });
  const r = await api.curationBatchOnShelf(selectedIds.value);
  ElMessage.success(`已上架 ${r.updated} 件`);
  selectedIds.value = [];
  loadPending();
}

// 待选品批量上架+打标签
const pendingBatchTagDlg = ref(false);
const pendingBatchTagIds = ref([]);
const pendingBatchTagLoading = ref(false);

function batchTag() {
  if (!selectedIds.value.length) return;
  pendingBatchTagIds.value = [];
  pendingBatchTagDlg.value = true;
}

async function confirmPendingBatchTag() {
  pendingBatchTagLoading.value = true;
  try {
    const ids = selectedIds.value;
    await api.curationBatchOnShelf(ids);
    for (const tid of pendingBatchTagIds.value) {
      await api.topicTagMany(tid, ids);
    }
    ElMessage.success('已上架 ' + ids.length + ' 件' + (pendingBatchTagIds.value.length ? '并打标签' : ''));
    pendingBatchTagDlg.value = false;
    selectedIds.value = [];
    loadPending();
  } finally {
    pendingBatchTagLoading.value = false;
  }
}

async function batchRemove() {
  if (!selectedIds.value.length) return;
  await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 件待选品？删除后不可恢复。`, '批量删除', { type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' });
  const r = await api.curationBatchRemove(selectedIds.value);
  ElMessage.success(`已删除 ${r.deleted} 件`);
  selectedIds.value = [];
  loadPending();
}

async function removePending(row) {
  await ElMessageBox.confirm(`删除「${row.title.slice(0, 20)}」？`, '确认', { type: 'warning' });
  await api.curationRemove(row.curatedId);
  ElMessage.success('已删除');
  loadPending();
}

async function autoPull() {
  await ElMessageBox.confirm('手动触发一次自动拉品？会从各平台拉取商品进待货架，可能需要几分钟。', '自动拉品', { type: 'info' });
  pulling.value = true;
  try {
    const r = await api.curationAutoPull({});
    const parts = [];
    for (const [plat, s] of Object.entries(r)) {
      parts.push(`${plat}: 拉${s.fetched}/入${s.added}/跳过${s.skipped}/错${s.errors}`);
    }
    ElMessage.success(parts.join(' | '));
    loadPending();
  } finally {
    pulling.value = false;
  }
}

// ── 货架内 ──
const pool = ref({ list: [], total: 0 });
const groups = ref([]);
const allTopics = ref([]);
const goodsTags = ref({}); // { curatedId: [topicId, ...] }
const poolSelected = ref([]);
const loading = ref(false);
const removingOff = ref(false);
const cleaningOld = ref(false);
const refreshing = ref(false);
const deduping = ref(false);

const q = reactive({
  topicId: null,
  status: '',
  page: 1,
  pageSize: 30,
});

const expiredCount = computed(
  () => groups.value.reduce((n, g) => n + (g.total - g.onShelf), 0),
);
const inPool = computed(() => new Set(pool.value.list.map((r) => r.goodsId)));

/**
 * 筛选下拉：预设专题 + 货架里实际出现过的自定义专题。
 * 只用后者的话，刚加的新专题在没选品前选不到，是个死结。
 */
const groupOptions = computed(() => {
  const stat = Object.fromEntries(groups.value.map((g) => [g.groupKey, g]));
  const keys = [...new Set([...GROUPS.map((g) => g.key), ...groups.value.map((g) => g.groupKey)])];
  return keys.map((key) => {
    const s = stat[key];
    return {
      key,
      label: s ? `${groupName(key)} (${s.onShelf}/${s.total})` : `${groupName(key)} (0)`,
    };
  });
});

const fmt = (d) => (d ? `同步于 ${new Date(d).toLocaleString('zh-CN', { hour12: false })}` : '未同步');

async function loadPool() {
  loading.value = true;
  try {
    pool.value = await api.curationList({
      topicId: q.topicId || undefined,
      status: q.status === '' ? undefined : q.status,
      page: q.page,
      pageSize: q.pageSize,
    });
    groups.value = await api.curationGroups();
    // 批量加载当前页商品的标签
    const ids = pool.value.list.map((g) => g.curatedId).filter(Boolean);
    if (ids.length) {
      try {
        goodsTags.value = await api.goodsTopicsBatch(ids);
      } catch { goodsTags.value = {}; }
    }
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
  await ElMessageBox.confirm(`把「${row.title.slice(0, 20)}」移出货架？`, '确认', { type: 'warning' });
  await api.curationRemove(row.curatedId);
  ElMessage.success('已移除');
  loadPool();
}

async function removeOffShelf() {
  await ElMessageBox.confirm(
    '移除所有已下架商品（含人工下架和自动下架），连同标签关联一起清掉，不可恢复。确认？',
    '一键移除已下架',
    { type: 'warning', confirmButtonText: '移除', confirmButtonClass: 'el-button--danger' },
  );
  removingOff.value = true;
  try {
    const r = await api.curationRemoveOffShelf();
    ElMessage.success(r.removed ? `已移除 ${r.removed} 件下架商品` : '没有下架商品');
    loadPool();
  } finally {
    removingOff.value = false;
  }
}

async function cleanOffShelf() {
  const { value } = await ElMessageBox.prompt(
    '清理多少天前下架的商品？只清已下架（人工/自动）且最后更新时间早于该天数的。',
    '清理历史下架',
    {
      inputPattern: /^[1-9]\d*$/,
      inputErrorMessage: '请输入正整数天数',
      inputValue: '30',
      confirmButtonText: '清理',
      type: 'warning',
    },
  );
  const days = parseInt(value, 10);
  cleaningOld.value = true;
  try {
    const r = await api.curationCleanOffShelf({ days });
    ElMessage.success(r.removed ? `已清理 ${r.removed} 件 ${days} 天前下架的商品` : `没有 ${days} 天前下架的商品`);
    loadPool();
  } finally {
    cleaningOld.value = false;
  }
}

async function doDedup() {
  await ElMessageBox.confirm(
    '按「平台 + 商品ID + 标题相似度 + 价格相近」去重，保留最新一条，其余删除。已上架状态会合并到保留的那条上。\n\n建议先备份数据库再操作。',
    '一键去重',
    { type: 'warning', confirmButtonText: '开始去重' },
  );
  deduping.value = true;
  try {
    const r = await api.curationDedup();
    const exact = r.totalGroups > 0 ? `精确去重 ${r.totalGroups} 组 / 移除 ${r.removed} 件` : '';
    const fuzzy = r.fuzzyGroups > 0 ? `模糊去重 ${r.fuzzyGroups} 组 / 移除 ${r.fuzzyRemoved} 件` : '';
    const msg = [exact, fuzzy].filter(Boolean).join('，');
    if (msg) {
      ElMessage.success(`去重完成：${msg}`);
    } else {
      ElMessage.info('没有发现重复商品');
    }
    loadPool();
  } finally {
    deduping.value = false;
  }
}

// ── 标签编辑 ──
/** 点击"未打标签"时初始化空数组，让 el-select 显示出来 */
function addFirstTag(row) {
  if (!goodsTags.value[row.curatedId]) {
    goodsTags.value = { ...goodsTags.value, [row.curatedId]: [] };
  }
}

/** 单个商品保存标签（直接调用 setGoodsTopics，整套替换） */
async function saveTags(row, topicIds) {
  try {
    await api.setGoodsTopics(row.curatedId, topicIds || []);
    ElMessage.success("标签已更新");
  } catch {
    loadPool(); // 失败了刷新一下
  }
}

// 批量打标签弹框
const batchTagOpen = ref(false);
const batchTagIds = ref([]);
const batchTagLoading = ref(false);

function openBatchTag() {
  if (!poolSelected.value.length) return;
  batchTagIds.value = [];
  batchTagOpen.value = true;
}

async function confirmBatchTag() {
  if (!batchTagIds.value.length) {
    ElMessage.warning("请至少选一个标签");
    return;
  }
  batchTagLoading.value = true;
  try {
    const ids = poolSelected.value.map((r) => r.curatedId);
    for (const tid of batchTagIds.value) {
      await api.topicTagMany(tid, ids);
    }
    ElMessage.success("已给 " + ids.length + " 件商品打标签");
    batchTagOpen.value = false;
    loadPool();
  } finally {
    batchTagLoading.value = false;
  }
}

async function batchUntag() {
  if (!poolSelected.value.length) return;
  await ElMessageBox.confirm(
    "确认从选中的 " + poolSelected.value.length + " 件商品上移除所有标签？",
    "批量取消标签",
    { type: "warning" },
  );
  const ids = poolSelected.value.map((r) => r.curatedId);
  for (const t of allTopics.value) {
    try { await api.topicUntagMany(t.id, ids); } catch {}
  }
  ElMessage.success("已取消标签");
  loadPool();
}

// ── 找商品 ──
const found = ref([]);
const finding = ref(false);
const importing = ref(false);
const f = reactive({
  platform: 'PDD',
  keyword: '',
  channel: 'all',
  sortWeight: 0,
  page: 1,
  hasMore: false,
  importCount: 100,
  targetStatus: 3, // 3=待上架，1=直接上架
  importTopicIds: [], // 导入时打的标签
});

async function load(append = false) {
  finding.value = true;
  try {
    const base = { platform: f.platform, page: f.page, pageSize: 40 };
    const r = f.keyword
      ? await api.curationSearch({ ...base, keyword: f.keyword })
      : f.channel === 'all'
        ? await api.curationSearch({ ...base, sort: 'sales' })
        : await api.curationRecommend({ ...base, channel: f.channel });
    const list = r.list || [];
    found.value = append ? found.value.concat(list) : list;
    f.hasMore = !!r.hasMore;
    if (!list.length && !append) ElMessage.warning('没查到商品，换个关键词或榜单试试');
    // 批量查询已存在状态
    if (list.length) {
      try {
        const items = list.map((g) => ({ platform: f.platform, goodsId: g.goodsId }));
        const m = await api.curationExistsBatch(items);
        if (append) {
          foundStatus.value = { ...foundStatus.value, ...m };
        } else {
          foundStatus.value = m;
        }
      } catch { /* 状态查询失败不影响展示 */ }
    }
  } finally {
    finding.value = false;
  }
}

// 状态 key 格式："PLATFORM::goodsId"
function statusKey(g) {
  return (f.platform || 'PDD').toUpperCase() + '::' + g.goodsId;
}

const foundStatus = ref({}); // { "PDD::xxx": { id, status }, ... }

async function refreshFoundStatus(g) {
  const m = await api.curationExistsBatch([{ platform: f.platform, goodsId: g.goodsId }]);
  foundStatus.value = { ...foundStatus.value, ...m };
  ElMessage.success('已刷新');
}

function find() {
  f.page = 1;
  found.value = [];
  foundStatus.value = {};
  load(false);
}

function more() {
  f.page += 1;
  load(true);
}

async function importBatch() {
  if (!found.value.length) {
    ElMessage.warning('还没有搜索结果，先查找商品');
    return;
  }
  const count = Math.min(f.importCount, found.value.length);
  const goods = found.value.slice(0, count).map((g) => ({
    goodsId: g.goodsId,
    title: g.title,
    image: g.image,
    images: g.images || [],
    shopName: g.shopName || '',
    price: g.price,
    couponPrice: g.couponPrice,
    couponAmount: g.couponAmount || 0,
    commissionRate: g.commissionRate,
    commission: g.commission,
    salesVolume: g.salesVolume || 0,
  }));

  importing.value = true;
  try {
    const r = await api.curationImportWithGoods({
      platform: f.platform,
      goods,
      groupKey: f.groupKey || 'default',
      sortWeight: f.sortWeight || 0,
      targetStatus: f.targetStatus,
      topicIds: f.importTopicIds?.length ? f.importTopicIds : undefined,
    });
    const to = f.targetStatus === 1 ? '上架' : '待上架';
    ElMessage.success(
      `导入完成：共 ${r.fetched} 件，入${to} ${r.added}，跳过 ${r.skipped}` +
        `${r.errors ? `，失败 ${r.errors}` : ''}`,
    );
    // 刷新状态显示
    try {
      const items = goods.map((g) => ({ platform: f.platform, goodsId: g.goodsId }));
      const m = await api.curationExistsBatch(items);
      foundStatus.value = { ...foundStatus.value, ...m };
    } catch { /* ignore */ }
    loadPending();
    loadPool();
  } finally {
    importing.value = false;
  }
}

// 找商品：单个上架+打标签
const addDlg = ref(false);
const addDlgGoods = ref(null); // { g, alreadyPending }
const addDlgTags = ref([]);
const addDlgLoading = ref(false);

function openAddWithTags(g, alreadyPending = false) {
  addDlgGoods.value = { g, alreadyPending };
  // 预设顶部选的标签，用户可以再改
  addDlgTags.value = [...(f.importTopicIds || [])];
  addDlg.value = true;
}

async function confirmAddWithTags() {
  if (!addDlgGoods.value) return;
  const { g, alreadyPending } = addDlgGoods.value;
  addDlgLoading.value = true;
  try {
    if (!alreadyPending) {
      // 还不在库里，先加进待上架
      // 京东/淘宝的详情接口经常没权限或不稳定，直接带列表里的商品数据入库，
      // 后续自动刷新时再用详情接口更新
      if (f.platform === 'JD' || f.platform === 'TB') {
        await api.curationAddWithGoods({
          platform: f.platform,
          goodsId: g.goodsId,
          title: g.title,
          image: g.image,
          images: g.images || [],
          shopName: g.shopName || '',
          price: g.price,
          couponPrice: g.couponPrice,
          couponAmount: g.couponAmount || 0,
          commissionRate: g.commissionRate,
          commission: g.commission,
          salesVolume: g.salesVolume || 0,
          groupKey: 'default',
          sortWeight: f.sortWeight || 0,
        });
      } else {
        await api.curationAdd({
          platform: f.platform,
          goodsId: g.goodsId,
          groupKey: 'default',
          sortWeight: f.sortWeight || 0,
        });
      }
    }
    // 查询完整信息（拿到 curatedId）
    const m = await api.curationExistsBatch([{ platform: f.platform, goodsId: g.goodsId }]);
    const key = statusKey(g);
    const info = m[key];
    const curatedId = info?.id;

    // 打标签（如果选了）
    if (addDlgTags.value.length && curatedId) {
      await api.setGoodsTopics(curatedId, addDlgTags.value);
    }

    // 上架
    if (curatedId) {
      await api.curationUpdate(curatedId, { status: 1 });
    }

    ElMessage.success('已上架' + (addDlgTags.value.length ? '并打标签' : ''));
    foundStatus.value = { ...foundStatus.value, [key]: { id: curatedId, status: 1 } };
    addDlg.value = false;
    loadPending();
    loadPool();
  } finally {
    addDlgLoading.value = false;
  }
}

onMounted(async () => {
  // 标签列表提前加载，待上架和货架都要用
  try {
    const r = await api.topics();
    allTopics.value = r.list || r || [];
  } catch {}
  loadPool();
  if (tab.value === 'pending') loadPending();
});
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
.more { margin-top: 14px; text-align: center; }
.card { border: 1px solid #ebeef5; border-radius: 8px; padding: 10px; }
.card img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
.card .t { font-size: 13px; line-height: 1.4; height: 36px; overflow: hidden; margin: 8px 0 6px; }
.card .p { font-size: 13px; }
.card .cp { color: #f56c6c; margin-left: 6px; font-size: 12px; }
.card .c { font-size: 12px; color: #67c23a; margin: 4px 0 8px; }
.card .c .m { margin-left: 6px; }
.card-status { margin-bottom: 6px; text-align: center; }

.no-tags { display: flex; align-items: center; height: 28px; }

.tag-list { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.tag-list .more-tag { margin-left: 2px; }
.tag-picker { max-height: 400px; overflow-y: auto; }
.tag-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; }
</style>
