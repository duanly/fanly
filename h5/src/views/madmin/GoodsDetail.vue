<template>
  <div class="madmin-goods">
    <van-nav-bar
      title="商品详情"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <div v-if="goods" class="goods-header">
      <img :src="goods.image" class="g-big-img" />
      <div class="g-info">
        <div class="g-title">{{ goods.title }}</div>
        <div class="g-price-row">
          <div class="g-price">
            <span class="yuan">¥</span>
            <span class="num">{{ goods.couponPrice || goods.price }}</span>
          </div>
          <div class="g-comm">
            返利 ¥{{ goods.commission || 0 }}
          </div>
        </div>
      </div>
    </div>

    <!-- 基本信息 -->
    <van-cell-group inset title="基本信息">
      <van-cell title="平台" :value="platName(goods?.platform)" />
      <van-cell title="商品ID" :value="goods?.goodsId" />
      <van-cell title="状态">
        <template #value>
          <van-tag :type="statusTagType(goods?.status)" size="medium">
            {{ statusName(goods?.status) }}
          </van-tag>
        </template>
      </van-cell>
      <van-cell title="权重" :value="goods?.sortWeight || 0" />
    </van-cell-group>

    <!-- 标签管理 -->
    <van-cell-group inset title="标签" class="tags-group">
      <div class="tag-list">
        <div
          v-for="t in goodsTopics"
          :key="t.id"
          class="tag-chip"
          @click="removeTag(t)"
        >
          <span class="tag-icon">{{ t.icon || '🏷️' }}</span>
          <span class="tag-name">{{ t.name }}</span>
          <van-icon name="cross" size="14" />
        </div>
        <div class="tag-chip add" @click="showTagPicker = true">
          <van-icon name="plus" size="16" />
          <span>添加标签</span>
        </div>
      </div>
    </van-cell-group>

    <!-- 底部操作栏 -->
    <div class="bottom-bar">
      <van-button
        v-if="goods?.status !== 1"
        type="primary"
        block
        :loading="opLoading"
        @click="onShelf"
      >上架</van-button>
      <template v-else>
        <van-button
          type="warning"
          block
          :loading="opLoading"
          @click="offShelf"
        >下架</van-button>
      </template>
      <van-button
        type="danger"
        plain
        block
        @click="removeGoods"
      >删除</van-button>
    </div>

    <!-- 标签选择弹窗 -->
    <van-popup
      v-model:show="showTagPicker"
      position="bottom"
      :style="{ height: '70%' }"
      round
    >
      <div class="picker-header">
        <span class="picker-title">选择标签</span>
        <van-icon name="cross" size="20" @click="showTagPicker = false" />
      </div>
      <van-tabs v-model:active="tagType">
        <van-tab title="全部" name="" />
        <van-tab title="品类" name="category" />
        <van-tab title="品牌" name="brand" />
        <van-tab title="活动" name="activity" />
        <van-tab title="运营" name="operate" />
      </van-tabs>
      <div class="picker-search">
        <van-search v-model="tagKw" placeholder="搜索标签" shape="round" />
      </div>
      <div class="picker-list">
        <div
          v-for="t in filteredTags"
          :key="t.id"
          class="picker-item"
          :class="{ picked: isTopicPicked(t.id) }"
          @click="toggleTopic(t)"
        >
          <span class="pi-ico">{{ t.icon || '🏷️' }}</span>
          <span class="pi-name">{{ t.name }}</span>
          <span class="pi-count">{{ t.goodsCount || 0 }}件</span>
          <van-icon v-if="isTopicPicked(t.id)" name="success" color="#07c160" />
        </div>
        <van-empty v-if="!allTags.length && !tagsLoading" description="暂无标签" />
      </div>
      <div class="picker-footer">
        <van-button type="primary" block :loading="savingTags" @click="saveTags">
          确定（已选 {{ pickedTopicIds.length }} 个）
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { showToast, showConfirmDialog, showSuccessToast } from 'vant';
import { adminApi } from '../../api';

const route = useRoute();
const goodsId = computed(() => route.params.id);

function platName(p) {
  const m = { PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' };
  return m[p] || p;
}
function statusName(s) {
  const m = { 1: '已上架', 0: '人工下架', 2: '自动下架', 3: '待上架' };
  return m[s] || '未知';
}
function statusTagType(s) {
  if (s === 1) return 'success';
  if (s === 3) return 'warning';
  return 'default';
}

const goods = ref(null);
const goodsTopics = ref([]);
const opLoading = ref(false);

// 标签选择器
const showTagPicker = ref(false);
const allTags = ref([]);
const tagsLoading = ref(false);
const tagType = ref('');
const tagKw = ref('');
const pickedTopicIds = ref([]);
const savingTags = ref(false);

const filteredTags = computed(() => {
  let list = allTags.value || [];
  if (tagType.value) {
    list = list.filter((t) => t.type === tagType.value);
  }
  if (tagKw.value.trim()) {
    const kw = tagKw.value.trim().toLowerCase();
    list = list.filter((t) => t.name.toLowerCase().includes(kw));
  }
  return list;
});

function isTopicPicked(id) {
  return pickedTopicIds.value.includes(id);
}

async function loadGoods() {
  try {
    // 先从 sessionStorage 尝试读取（从列表页带过来的）
    const cached = sessionStorage.getItem('madmin_goods_' + goodsId.value);
    if (cached) {
      goods.value = JSON.parse(cached);
      return;
    }
    // 没有缓存就从 list 接口分页找（一般在前面几页）
    for (let p = 1; p <= 10; p++) {
      const r = await adminApi.curationList({ page: p, pageSize: 50 });
      const rows = r.list || [];
      const found = rows.find((g) => String(g.id || g.curatedId) === String(goodsId.value));
      if (found) {
        goods.value = found;
        return;
      }
      if (rows.length < 50) break;
    }
    showToast('商品不存在');
  } catch (e) {
    showToast(e.message || '加载失败');
  }
}

async function loadGoodsTopics() {
  try {
    // 接口返回的是 topicId 数组，需要结合标签列表拿到名称
    const topicIds = await adminApi.goodsTopics(goodsId.value);
    goodsTopics.value = topicIds
      .map((id) => allTags.value.find((t) => t.id === id))
      .filter(Boolean);
    pickedTopicIds.value = [...topicIds];
  } catch {
    goodsTopics.value = [];
  }
}

async function loadAllTags() {
  tagsLoading.value = true;
  try {
    const r = await adminApi.topics();
    allTags.value = r.list || r || [];
  } catch {
    allTags.value = [];
  } finally {
    tagsLoading.value = false;
  }
}

function toggleTopic(t) {
  const idx = pickedTopicIds.value.indexOf(t.id);
  if (idx >= 0) {
    pickedTopicIds.value.splice(idx, 1);
  } else {
    pickedTopicIds.value.push(t.id);
  }
}

async function removeTag(t) {
  try {
    await showConfirmDialog({
      title: '移除标签',
      message: `确定移除「${t.name}」标签？`,
    });
    const newIds = pickedTopicIds.value.filter((id) => id !== t.id);
    await adminApi.setGoodsTopics(goodsId.value, newIds);
    pickedTopicIds.value = newIds;
    goodsTopics.value = goodsTopics.value.filter((gt) => gt.id !== t.id);
    showSuccessToast('已移除');
  } catch (e) {
    if (e === 'cancel') return;
  }
}

async function saveTags() {
  savingTags.value = true;
  try {
    await adminApi.setGoodsTopics(goodsId.value, pickedTopicIds.value);
    goodsTopics.value = pickedTopicIds.value
      .map((id) => allTags.value.find((t) => t.id === id))
      .filter(Boolean);
    showSuccessToast('保存成功');
    showTagPicker.value = false;
  } finally {
    savingTags.value = false;
  }
}

async function onShelf() {
  opLoading.value = true;
  try {
    await adminApi.curationBatchOnShelf([Number(goodsId.value)]);
    goods.value.status = 1;
    showSuccessToast('已上架');
  } finally {
    opLoading.value = false;
  }
}

async function offShelf() {
  try {
    await showConfirmDialog({
      title: '下架商品',
      message: '确定下架这个商品吗？',
    });
    opLoading.value = true;
    await adminApi.curationUpdate(Number(goodsId.value), { status: 0 });
    goods.value.status = 0;
    showSuccessToast('已下架');
  } catch (e) {
    if (e === 'cancel') return;
  } finally {
    opLoading.value = false;
  }
}

async function removeGoods() {
  try {
    await showConfirmDialog({
      title: '删除商品',
      message: '确定从选品池删除这个商品？此操作不可恢复。',
      confirmButtonText: '删除',
      confirmButtonColor: '#ee0a24',
    });
    await adminApi.curationRemove(Number(goodsId.value));
    showSuccessToast('已删除');
    setTimeout(() => history.back(), 800);
  } catch (e) {
    if (e === 'cancel') return;
  }
}

// 打开标签选择器时加载标签
watch(showTagPicker, (v) => {
  if (v && !allTags.value.length) {
    loadAllTags().then(loadGoodsTopics);
  }
});

onMounted(async () => {
  await loadAllTags();
  await loadGoods();
  await loadGoodsTopics();
});
</script>

<style scoped>
.madmin-goods {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 80px;
}
.goods-header {
  background: #fff;
  padding: 16px;
  display: flex;
  gap: 14px;
  margin-bottom: 12px;
}
.g-big-img {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 10px;
  flex: none;
}
.g-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.g-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a1a1a;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.g-price-row {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.g-price {
  color: #ff4b3a;
}
.g-price .yuan {
  font-size: 14px;
}
.g-price .num {
  font-size: 22px;
  font-weight: 700;
}
.g-comm {
  font-size: 13px;
  color: #ff9800;
  background: #fff3e0;
  padding: 2px 8px;
  border-radius: 10px;
}
.tags-group :deep(.van-cell-group__title) {
  padding: 12px 16px 8px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px 16px;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px 4px 4px;
  background: #f0f7ff;
  border-radius: 14px;
  font-size: 13px;
  color: #1989fa;
}
.tag-chip .tag-icon {
  font-size: 14px;
}
.tag-chip.add {
  background: #f5f5f5;
  color: #999;
  padding: 4px 10px;
  gap: 4px;
}
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 100;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}
.bottom-bar .van-button {
  flex: 1;
}
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}
.picker-title {
  font-size: 16px;
  font-weight: 600;
}
.picker-search {
  padding: 8px 12px;
  border-bottom: 1px solid #f5f5f5;
}
.picker-search :deep(.van-search) {
  padding: 0;
}
.picker-list {
  max-height: 40vh;
  overflow-y: auto;
}
.picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f5f5;
}
.picker-item.picked {
  background: #f0f9eb;
}
.pi-ico {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background: #f5f5f5;
  flex: none;
}
.pi-name {
  flex: 1;
  font-size: 14px;
  color: #333;
}
.pi-count {
  font-size: 12px;
  color: #999;
}
.picker-footer {
  padding: 12px 16px;
  border-top: 1px solid #eee;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
</style>
