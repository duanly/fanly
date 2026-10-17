<template>
  <div class="madmin-tags">
    <van-nav-bar
      title="标签管理"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <van-tabs v-model:active="activeType" sticky offset-top="46px" @change="onTypeChange">
      <van-tab title="全部" name="" />
      <van-tab title="品类" name="category" />
      <van-tab title="品牌" name="brand" />
      <van-tab title="活动" name="activity" />
      <van-tab title="运营" name="operate" />
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
        <div class="t-ico" :style="{ background: t.bg || gradientFromName(t.name) }">
          {{ t.icon || '🏷️' }}
        </div>
        <div class="t-info">
          <div class="t-name">{{ t.name }}</div>
          <div class="t-meta">
            <span class="t-count">{{ t.goodsCount || 0 }} 件商品</span>
            <span class="t-type">{{ typeName(t.type) }}</span>
          </div>
        </div>
        <van-icon name="arrow" />
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { adminApi } from '../../api';

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

// 简单的按名称生成渐变色
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

const activeType = ref('');
const keyword = ref('');
const list = ref([]);
const loading = ref(false);
const active = ref('tags');

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
  // 前端过滤，不用重新加载
}

function onSearch() {
  // 前端过滤
}

function goTag(t) {
  router.push(`/madmin/tag/${t.slug}`);
}

onMounted(load);
</script>

<style scoped>
.madmin-tags {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 60px;
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
  gap: 10px;
  font-size: 12px;
  color: #999;
}
.t-type {
  padding: 1px 6px;
  background: #f5f5f5;
  border-radius: 3px;
  font-size: 11px;
}
.loading {
  text-align: center;
  padding: 20px;
}
</style>
