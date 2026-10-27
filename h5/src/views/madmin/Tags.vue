<template>
  <div class="madmin-tags">
    <van-nav-bar
      title="标签管理"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    >
      <template #right>
        <span class="nav-btn" @click="openEdit()">新建</span>
      </template>
    </van-nav-bar>

    <van-tabs v-model:active="activeType" sticky offset-top="46px" @change="onTypeChange">
      <van-tab title="品类" name="category" />
      <van-tab title="活动" name="activity" />
      <van-tab title="运营" name="operate" />
      <van-tab title="品牌" name="brand" />
      <van-tab title="全部" name="" />
    </van-tabs>

    <van-search
      v-model="keyword"
      placeholder="搜索标签"
      shape="round"
      @search="onSearch"
    />

    <div class="tag-list">
      <div
        v-for="t in filteredList"
        :key="t.id"
        class="tag-item"
        @click="goTag(t)"
      >
        <div class="t-ico" :style="{ background: isImageUrl(t.icon) ? 'transparent' : (t.bg || gradientFromName(t.name)) }">
          <AppIcon :name="t.icon || '🏷️'" :size="32" dot />
        </div>
        <div class="t-info">
          <div class="t-name">{{ t.name }}</div>
          <div class="t-meta">
            <span class="t-count">{{ t.goodsCount || 0 }} 件商品</span>
            <span class="t-type">{{ typeName(t.type) }}</span>
            <span v-if="t.autoBrand" class="t-brand">自动</span>
          </div>
        </div>
        <div class="t-actions" @click.stop>
          <van-button size="mini" type="default" plain @click="openEdit(t)">编辑</van-button>
          <van-button size="mini" type="danger" plain @click="removeTag(t)">删除</van-button>
        </div>
      </div>

      <van-empty v-if="!loading && !filteredList.length" description="暂无标签" />
    </div>

    <van-loading v-if="loading" class="loading" />

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/search" icon="search">找商品</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/tags" icon="label-o">标签</van-tabbar-item>
    </van-tabbar>

    <!-- 编辑弹窗 -->
    <van-popup
      v-model:show="editOpen"
      position="bottom"
      :style="{ height: 'auto', maxHeight: '85%' }"
      round
    >
      <div class="edit-header">
        <span class="edit-title">{{ form.id ? '编辑标签' : '新建标签' }}</span>
        <van-icon name="cross" size="20" @click="editOpen = false" />
      </div>
      <div class="edit-body">
        <van-field
          v-model="form.name"
          label="名称"
          placeholder="比如：母婴奶粉"
          maxlength="16"
        />
        <van-field
          v-model="form.slug"
          label="地址短名"
          placeholder="留空自动生成，比如 baby-milk"
          :disabled="!!form.id"
        />
        <van-field label="图标" is-link @click="iconPickerOpen = true">
          <template #input>
            <div class="icon-field">
              <AppIcon :name="form.icon || '🏷️'" :size="24" />
              <span class="icon-field-text">{{ form.icon ? '点击更换' : '点击选择' }}</span>
            </div>
          </template>
        </van-field>
        <van-field v-model="form.bg" label="底色" placeholder="CSS 渐变或颜色，留空自动分配" />
        <van-field
          v-model="form.intro"
          label="简介"
          placeholder="一句话说明"
          maxlength="30"
        />
        <van-cell title="类型">
          <template #right-icon>
            <van-radio-group v-model="form.type" direction="horizontal">
              <van-radio name="category">品类</van-radio>
              <van-radio name="activity">活动</van-radio>
              <van-radio name="operate">运营</van-radio>
            </van-radio-group>
          </template>
        </van-cell>
        <van-cell title="首页位置">
          <template #right-icon>
            <van-radio-group v-model="form.slot" direction="horizontal">
              <van-radio name="grid">宫格</van-radio>
              <van-radio name="activity">活动位</van-radio>
              <van-radio name="hidden">不露面</van-radio>
            </van-radio-group>
          </template>
        </van-cell>
        <van-field
          v-model="form.sortWeight"
          type="number"
          label="排序权重"
          placeholder="0"
        />
        <van-field
          v-model="keywordRulesText"
          label="自动打标关键词"
          type="textarea"
          rows="2"
          placeholder="多个关键词用逗号分隔，比如：奶粉,婴儿奶粉"
        />
        <div class="edit-tip">
          商品标题命中任意一个关键词，就自动打上这个标签。留空不参与自动打标。
        </div>
      </div>
      <div class="edit-footer">
        <van-button type="primary" block :loading="saving" @click="save">保存</van-button>
      </div>
    </van-popup>
    <!-- 图标库选择弹层 -->
    <van-popup
      v-model:show="iconPickerOpen"
      position="bottom"
      round
      :style="{ height: '80%' }"
    >
      <div class="ipicker-head">
        <span class="ipicker-title">选择图标</span>
        <van-icon name="cross" size="20" @click="iconPickerOpen = false" />
      </div>
      <van-search v-model="iconKw" placeholder="搜索图标名" shape="round" />
      <div class="ipicker-grid">
        <div
          v-for="n in filteredIconNames"
          :key="n"
          class="ipicker-cell"
          :class="{ active: form.icon === 'icon:' + n }"
          :title="n"
          @click="pickIcon(n)"
        >
          <AppIcon :name="'icon:' + n" :size="28" />
        </div>
      </div>
      <van-empty v-if="!filteredIconNames.length" description="没有匹配的图标" />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showConfirmDialog, showSuccessToast } from 'vant';
import { adminApi } from '../../api';
import AppIcon from '../../components/AppIcon.vue';
import { ICON_NAMES } from '../../components/icon-lib';

const router = useRouter();

const TYPE_NAME = {
  category: '品类标签',
  brand: '品牌标签',
  activity: '活动标签',
  operate: '运营标签',
};

function typeName(t) {
  return TYPE_NAME[t] || t;
}

function isImageUrl(v) {
  return typeof v === 'string' && /^(https?:|\/)/.test(v);
}

function gradientFromName(name) {
  const colors = [
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fa709a,#fee140)',
    'linear-gradient(135deg,#30cfd0,#330867)',
    'linear-gradient(135deg,#a8edea,#fed6e3)',
    'linear-gradient(135deg,#ff9a9e,#fecfef)',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const EMPTY = {
  id: null, name: '', slug: '', icon: '', bg: '', intro: '',
  type: 'category', slot: 'grid', sortWeight: 0,
};

const activeType = ref('category');
const keyword = ref('');
const list = ref([]);
const loading = ref(false);
const active = ref('tags');

const editOpen = ref(false);
const saving = ref(false);

// 图标库选择
const iconPickerOpen = ref(false);
const iconKw = ref('');
const filteredIconNames = computed(() => {
  const k = iconKw.value.trim().toLowerCase();
  return k ? ICON_NAMES.filter((n) => n.toLowerCase().includes(k)) : ICON_NAMES;
});
function pickIcon(n) {
  form.icon = `icon:${n}`;
  iconPickerOpen = false;
}
const form = reactive({ ...EMPTY });
const keywordRulesText = ref('');

const filteredList = computed(() => {
  let l = list.value || [];
  if (activeType.value) {
    l = l.filter((t) => t.type === activeType.value);
  }
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase();
    l = l.filter((t) => t.name.toLowerCase().includes(kw));
  }
  return l;
});

async function load() {
  loading.value = true;
  try {
    const r = await adminApi.topics();
    list.value = r.list || r || [];
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
}

function onTypeChange() {
  // 前端过滤
}

function onSearch() {
  // 前端过滤
}

function goTag(t) {
  router.push(`/madmin/tag/${t.slug}`);
}

function openEdit(t) {
  if (t) {
    Object.assign(form, t);
    keywordRulesText.value = (t.keywordRules || []).join(', ');
  } else {
    Object.assign(form, EMPTY);
    keywordRulesText.value = '';
  }
  editOpen.value = true;
}

async function save() {
  if (!form.name.trim()) {
    showToast('请输入名称');
    return;
  }
  saving.value = true;
  try {
    const body = {
      name: form.name.trim(),
      slug: form.slug || undefined,
      icon: form.icon,
      bg: form.bg,
      intro: form.intro,
      type: form.type,
      slot: form.slot,
      sortWeight: Number(form.sortWeight) || 0,
      keywordRules: keywordRulesText.value
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (form.id) {
      await adminApi.topicUpdate(form.id, body);
    } else {
      await adminApi.topicCreate(body);
    }
    showSuccessToast('保存成功');
    editOpen.value = false;
    load();
  } finally {
    saving.value = false;
  }
}

async function removeTag(t) {
  try {
    await showConfirmDialog({
      title: '删除标签',
      message: `确定删除「${t.name}」标签？挂在它下面的 ${t.goodsCount || 0} 件商品只会解绑，不会从选品池里删掉。`,
      confirmButtonText: '删除',
      confirmButtonColor: '#ee0a24',
    });
    await adminApi.topicRemove(t.id);
    showSuccessToast('已删除');
    load();
  } catch (e) {
    if (e === 'cancel') return;
  }
}

onMounted(load);
</script>

<style scoped>
.madmin-tags {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 60px;
}
.nav-btn {
  font-size: 14px;
  color: #1989fa;
}
.tag-list {
  padding: 8px 12px;
}
.tag-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
}
.tag-item:active {
  background: #f9f9f9;
}
.t-ico {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
  flex: none;
  overflow: hidden;
}
.t-ico img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.t-info {
  flex: 1;
  min-width: 0;
}
.t-name {
  font-size: 15px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}
.t-meta {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: #999;
  align-items: center;
  flex-wrap: wrap;
}
.t-type {
  padding: 1px 6px;
  background: #f5f5f5;
  border-radius: 3px;
  font-size: 11px;
}
.t-brand {
  padding: 1px 6px;
  background: #e8f5e9;
  color: #4caf50;
  border-radius: 3px;
  font-size: 11px;
}
.t-actions {
  display: flex;
  gap: 6px;
  flex: none;
}
.loading {
  text-align: center;
  padding: 20px;
}
.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #eee;
}
.edit-title {
  font-size: 16px;
  font-weight: 600;
}
.edit-body {
  max-height: 60vh;
  overflow-y: auto;
  padding-bottom: 8px;
}
.edit-tip {
  padding: 4px 16px 12px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}

/* 图标选择字段 */
.icon-field {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-field-text { font-size: 13px; color: #999; }

/* 图标库弹层 */
.ipicker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #eee;
}
.ipicker-title { font-size: 16px; font-weight: 600; }
.ipicker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 12px 16px 20px;
}
.ipicker-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
}
.ipicker-cell:active { background: #f7f8fa; }
.ipicker-cell.active {
  border-color: #ff4b3a;
  background: #fff1ef;
  box-shadow: 0 0 0 1px #ff4b3a inset;
}
.edit-footer {
  padding: 12px 16px;
  border-top: 1px solid #eee;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
</style>
