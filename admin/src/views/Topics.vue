<template>
  <div>
    <div class="bar">
      <el-radio-group v-model="activeType" size="default" @change="load">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="category">品类标签</el-radio-button>
        <el-radio-button value="brand">品牌标签</el-radio-button>
        <el-radio-button value="activity">活动标签</el-radio-button>
        <el-radio-button value="operate">运营标签</el-radio-button>
      </el-radio-group>
      <el-button type="primary" @click="openEdit()">新建专题</el-button>
      <el-button type="warning" :loading="autoTagging" @click="runAutoTagAll">
        全量自动打标
      </el-button>
      <span class="hint">
        建好就能用：页面地址一列就是 H5 的入口，不用改代码也不用发版
      </span>
    </div>

    <el-table :data="list" v-loading="loading" size="small" border>
      <el-table-column label="图标" width="60" align="center">
        <template #default="{ row }">
          <span :style="{ background: isImageUrl(row.icon) ? 'transparent' : (row.bg || '#eee') }" class="ico">
            <AppIcon :name="row.icon || '📦'" :size="22" />
          </span>
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

      <el-table-column label="关键词" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.autoBrand" type="success" size="small">品牌·自动</el-tag>
          <span v-else-if="row.keywordRules?.length" class="kw-count">
            {{ row.keywordRules.length }} 个
          </span>
          <span v-else class="kw-empty">未设</span>
        </template>
      </el-table-column>

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

        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="category">品类标签</el-radio>
            <el-radio value="activity">活动标签</el-radio>
            <el-radio value="operate">运营标签</el-radio>
          </el-radio-group>
          <div class="tip">
            品类是长期的（日用百货），活动是时效性的（中秋特惠），运营是首页推荐位用的（爆款推荐）。
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
          <div class="icon-edit-row">
            <div
              class="icon-preview"
              :style="{ background: isImageUrl(form.icon) ? 'transparent' : (form.bg || '#eee') }"
            >
              <AppIcon :name="form.icon || '📦'" :size="36" />
            </div>
            <div class="icon-edit-right">
              <el-input v-model="form.icon" style="width:220px" placeholder="图标库 / emoji / 图片URL" />
              <div style="margin-left:8px;display:flex;gap:6px">
                <el-button size="small" type="success" plain @click="iconPickerRef?.open()">图标库</el-button>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :loading="uploadingIcon"
                  @click="$refs.iconFileInput?.click()"
                >上传图片</el-button>
              </div>
              <input
                ref="iconFileInput"
                type="file"
                accept="image/*"
                style="display:none"
                @change="onIconFileChange"
              />
              <div class="tip">可从图标库选、填 emoji、上传图片（自动压缩到 128×128）或填图片 URL</div>
              <IconPicker ref="iconPickerRef" v-model="form.icon" />
            </div>
          </div>
        </el-form-item>

        <el-form-item label="图标底色">
          <el-input v-model="form.bg" placeholder="linear-gradient(135deg,#81c784,#43a047)" />
          <div class="tip">留空会按名称自动分配一个，不用非填。</div>
        </el-form-item>

        <el-form-item label="一句说明">
          <el-input v-model="form.intro" maxlength="30" show-word-limit placeholder="给宝宝挑的，都是常用的" />
          <div class="tip">显示在专题页顶部；放活动位时也当卡片副标题。</div>
        </el-form-item>

        <el-form-item label="自动打标关键词">
          <el-input
            v-model="keywordText"
            type="textarea"
            :rows="3"
            placeholder="多个关键词用逗号或空格分隔，比如：奶粉, 婴儿奶粉, 婴幼儿配方奶粉"
          />
          <div class="tip">
            商品标题命中任意一个关键词，就自动打上这个标签。
            留空表示不参与自动打标。品牌标签由系统自动生成，不用手动配。
          </div>
        </el-form-item>

        <el-form-item label="头图">
          <el-input v-model="form.cover" placeholder="图片 URL，留空就用底色渐变" />
        </el-form-item>

        <el-form-item label="排序权重">
          <el-input-number v-model="form.sortWeight" :min="0" :max="9999" />
          <span class="tip inline">越大越靠前</span>
        </el-form-item>

        <el-form-item label="活动时间">
          <el-date-picker
            v-model="form.startAt"
            type="datetime"
            placeholder="开始时间"
            style="width:200px"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
          <span style="margin:0 8px;color:#999">至</span>
          <el-date-picker
            v-model="form.endAt"
            type="datetime"
            placeholder="结束时间"
            style="width:200px"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
          <div class="tip">设了结束时间，专题页会显示倒计时；都留空就是永久有效</div>
        </el-form-item>

        <el-form-item label="分享海报">
          <el-input v-model="form.shareImage" placeholder="海报图 URL，用户点分享时长按保存" />
        </el-form-item>

        <el-form-item label="顶部轮播图">
          <div class="banner-list">
            <div v-for="(b, i) in form.banners" :key="i" class="banner-item">
              <el-input v-model="b.image" placeholder="图片 URL" style="flex:1" />
              <el-input v-model="b.url" placeholder="跳转链接（可选）" style="width:180px;margin-left:8px" />
              <el-button link type="danger" style="margin-left:4px" @click="removeBanner(i)">删除</el-button>
            </div>
            <el-button size="small" @click="addBanner">+ 添加一张</el-button>
          </div>
          <div class="tip">不配就用单张头图（cover），再没有就用底色渐变</div>
        </el-form-item>

        <el-form-item label="活动规则">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="5"
            placeholder="活动规则、参与方式、注意事项等，支持换行"
          />
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
import AppIcon from '../components/AppIcon.vue';
import IconPicker from '../components/IconPicker.vue';

function isImageUrl(v) {
  return typeof v === 'string' && /^(https?:|\/)/.test(v);
}

const SLOT_NAME = { grid: '八大分区', activity: '活动位', hidden: '不露面' };
const SLOT_TAG = { grid: 'success', activity: 'warning', hidden: 'info' };
const TYPE_NAME = { category: '品类标签', activity: '活动标签', operate: '运营标签', brand: '品牌标签' };

const EMPTY = {
  id: null, name: '', slug: '', icon: '', bg: '', cover: '', intro: '',
  type: 'category', slot: 'grid', sortWeight: 0, status: 1,
  startAt: null, endAt: null, banners: [], description: '', shareImage: '',
};

const list = ref([]);
const loading = ref(false);
const editOpen = ref(false);
const saving = ref(false);
const autoTagging = ref(false);
const form = reactive({ ...EMPTY });
const keywordText = ref('');
const activeType = ref('');
const uploadingIcon = ref(false);
const iconFileInput = ref(null);
const iconPickerRef = ref(null);

async function onIconFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  uploadingIcon.value = true;
  try {
    const compressed = await compressImage(file, 128, 128);
    const r = await api.uploadImage(compressed);
    form.icon = r.url;
    ElMessage.success('上传成功');
  } catch (err) {
    ElMessage.error(err.message || '上传失败');
  } finally {
    uploadingIcon.value = false;
    e.target.value = '';
  }
}

// 前端压缩图片：裁剪成正方形后缩放到指定尺寸，输出 PNG Blob
function compressImage(file, targetW, targetH) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      // 居中裁剪成正方形
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, targetW, targetH);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('图片压缩失败'));
          const f = new File([blob], `icon-${Date.now()}.png`, { type: 'image/png' });
          resolve(f);
        },
        'image/png',
        0.92,
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

async function load() {
  loading.value = true;
  try {
    const r = await api.topics(activeType.value || undefined);
    list.value = r.list || r || [];
  } finally {
    loading.value = false;
  }
}

function openEdit(row) {
  const data = row ? { ...row } : {};
  // banners 确保是数组
  if (!data.banners || !Array.isArray(data.banners)) data.banners = [];
  // keywordRules 转成逗号分隔字符串给输入框
  if (data.keywordRules && Array.isArray(data.keywordRules) && data.keywordRules.length) {
    keywordText.value = data.keywordRules.join(', ');
  } else {
    keywordText.value = '';
  }
  Object.assign(form, EMPTY, data);
  editOpen.value = true;
}

function addBanner() {
  form.banners.push({ image: '', url: '' });
}

function removeBanner(i) {
  form.banners.splice(i, 1);
}

async function save() {
  if (!form.name.trim()) return ElMessage.warning('名称不能为空');
  saving.value = true;
  try {
    const body = { ...form };
    delete body.pageUrl;
    delete body.goodsCount;
    // 关键词文本 → 数组
    body.keywordRules = keywordText.value
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
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

async function runAutoTagAll() {
  await ElMessageBox.confirm(
    '将根据所有标签的关键词规则，给选品池里所有上架商品重新自动打标。' +
    '只追加新标签，不会覆盖或移除人工打的标签。商品越多越慢，耐心等一下。',
    '全量自动打标',
    { type: 'warning', confirmButtonText: '开始打标', cancelButtonText: '取消' },
  );
  autoTagging.value = true;
  try {
    const r = await api.curationAutoTagAll();
    ElMessage.success(
      `完成：共 ${r.total ?? r.totalGoods ?? '-'} 件商品，` +
      `新增 ${r.tagged ?? r.newTags ?? '-'} 个标签关联，` +
      `新建品牌标签 ${r.newBrandTopics ?? r.newTopics ?? 0} 个`,
    );
    load();
  } finally {
    autoTagging.value = false;
  }
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
  width: 28px; height: 28px; border-radius: 7px; font-size: 15px; color: #fff; overflow: hidden;
}
.ico img { width: 100%; height: 100%; object-fit: cover; }
.tip { color: #909399; font-size: 12px; line-height: 1.5; margin-top: 3px; }
.tip.inline { margin-left: 8px; margin-top: 0; }
.dlg-bar { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
.g { display: flex; align-items: center; gap: 8px; }
.g img { width: 34px; height: 34px; object-fit: cover; border-radius: 4px; flex: none; }
.g span {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; line-height: 1.35;
}
.banner-list { width: 100%; }
.banner-item { display: flex; align-items: center; margin-bottom: 8px; }
.kw-count { color: #409eff; font-size: 12px; }
.kw-empty { color: #c0c4cc; font-size: 12px; }

.icon-edit-row { display: flex; align-items: flex-start; gap: 12px; }
.icon-preview {
  width: 48px; height: 48px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: #fff; flex: none;
  overflow: hidden; margin-top: 2px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.icon-preview img { width: 100%; height: 100%; object-fit: cover; }
.icon-edit-right { display: flex; flex-direction: column; gap: 4px; }
.icon-edit-right .el-input { width: 220px; }
</style>
