<template>
  <div class="madmin-tag-goods">
    <van-nav-bar
      :title="topic?.name || '标签商品'"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <!-- 标签信息头 -->
    <div v-if="topic" class="tag-header">
      <div class="th-ico" :style="{ background: topic.bg || gradientFromName(topic.name) }">
        {{ topic.icon || '🏷️' }}
      </div>
      <div class="th-info">
        <div class="th-name">{{ topic.name }}</div>
        <div class="th-desc">{{ topic.intro || `${list.length || total} 件商品` }}</div>
      </div>
    </div>

    <!-- 商品列表 -->
    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
      :immediate-check="false"
    >
      <div class="goods-list">
        <div
          v-for="g in list"
          :key="g.id || g.curatedId"
          class="goods-card"
          @click="goDetail(g)"
        >
          <img :src="g.image" class="g-img" />
          <div class="g-info">
            <div class="g-title">{{ g.title }}</div>
            <div class="g-meta">
              <span class="g-platform">{{ platName(g.platform) }}</span>
            </div>
            <div class="g-price-row">
              <div class="g-price">
                <span class="label">券后</span>
                <span class="price">¥{{ g.couponPrice || g.price }}</span>
              </div>
              <div class="g-comm">
                <span class="label">返利</span>
                <span class="comm">¥{{ g.commission || 0 }}</span>
              </div>
            </div>
          </div>
          <van-button
            size="mini"
            type="danger"
            plain
            @click.stop="untagOne(g)"
          >移除</van-button>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="该标签下暂无商品" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showConfirmDialog, showSuccessToast } from 'vant';
import { adminApi } from '../../api';

const route = useRoute();
const router = useRouter();
const slug = computed(() => route.params.slug);

function platName(p) {
  const m = { PDD: '拼多多', TB: '淘宝', JD: '京东', VIP: '唯品会' };
  return m[p] || p;
}

function gradientFromName(name) {
  const colors = [
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fa709a,#fee140)',
    'linear-gradient(135deg,#30cfd0,#330867)',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const topic = ref(null);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);

let topicId = null;
let reqSeq = 0;

async function loadTopic() {
  try {
    // 从标签列表里找这个 slug 的信息
    const r = await adminApi.topics();
    const all = r.list || r || [];
    topic.value = all.find((t) => t.slug === slug.value);
    if (topic.value) {
      topicId = topic.value.id;
      total.value = topic.value.goodsCount || 0;
    }
  } catch {
    // ignore
  }
}

async function onLoad() {
  const seq = ++reqSeq;
  try {
    const r = await adminApi.topicGoods(slug.value, {
      page: page.value,
      pageSize,
    });
    if (seq !== reqSeq) return;
    const rows = r.list || r || [];
    list.value = list.value.concat(rows);
    page.value++;
    if (rows.length < pageSize) {
      finished.value = true;
    }
  } catch (e) {
    showToast(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function goDetail(g) {
  sessionStorage.setItem('madmin_goods_' + (g.id || g.curatedId), JSON.stringify(g));
  router.push(`/madmin/goods/${g.id || g.curatedId}`);
}

async function untagOne(g) {
  if (!topicId) return;
  try {
    await showConfirmDialog({
      title: '移除标签',
      message: `确定将「${g.title.slice(0, 20)}...」从该标签移除？`,
    });
    const id = g.id || g.curatedId;
    await adminApi.topicUntagMany(topicId, [id]);
    list.value = list.value.filter((item) => (item.id || item.curatedId) !== id);
    showSuccessToast('已移除');
  } catch (e) {
    if (e === 'cancel') return;
  }
}

onMounted(async () => {
  await loadTopic();
});
</script>

<style scoped>
.madmin-tag-goods {
  min-height: 100vh;
  background: #f5f6f8;
}
.tag-header {
  background: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
}
.th-ico {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: #fff;
  flex: none;
}
.th-info {
  flex: 1;
  min-width: 0;
}
.th-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 6px;
}
.th-desc {
  font-size: 13px;
  color: #999;
}
.goods-list {
  padding: 8px 12px;
}
.goods-card {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  align-items: center;
}
.g-img {
  width: 70px;
  height: 70px;
  object-fit: cover;
  border-radius: 8px;
  flex: none;
}
.g-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.g-title {
  font-size: 14px;
  color: #333;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.g-meta {
  font-size: 11px;
  color: #999;
}
.g-platform {
  padding: 1px 5px;
  background: #f5f5f5;
  border-radius: 3px;
}
.g-price-row {
  display: flex;
  gap: 12px;
  margin-top: 2px;
}
.g-price .label, .g-comm .label {
  font-size: 11px;
  color: #999;
  margin-right: 2px;
}
.g-price .price {
  font-size: 15px;
  font-weight: 600;
  color: #ff4b3a;
}
.g-comm .comm {
  font-size: 13px;
  font-weight: 600;
  color: #ff9800;
}
</style>
