<template>
  <div class="page">
    <van-nav-bar :title="topic.name || '专题'" left-arrow fixed placeholder @click-left="$router.back()" />

    <div class="topic-head" :style="headStyle">
      <div class="th-icon" v-if="topic.icon && !topic.cover">{{ topic.icon }}</div>
      <div class="th-name">{{ topic.name }}</div>
      <div v-if="topic.intro" class="th-intro">{{ topic.intro }}</div>
    </div>

    <!--
      只给「返利最高 / 价格最低」两个排法，不放筛选器。
      目标用户是不熟悉返利的县城用户，多一个控件就多一层「这是干什么的」。
      真要筛，搜索页已经有了。
    -->
    <div class="sort-row">
      <div
        v-for="s in SORTS"
        :key="s.key"
        class="sort-item"
        :class="{ on: sort === s.key }"
        @click="switchSort(s.key)"
      >{{ s.name }}</div>
      <span v-if="total" class="muted count">共 {{ total }} 件</span>
    </div>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text=""
      @load="load"
    >
      <div class="goods-grid">
        <GoodsCard
          v-for="g in list"
          :key="g.platform + g.goodsId"
          :g="g"
          show-recommend
        />
      </div>
    </van-list>

    <van-empty
      v-if="!loading && !list.length"
      description="这个专题还在备货，换个分区看看"
    />

    <BeianFooter />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import BeianFooter from '../components/BeianFooter.vue';

const SORTS = [
  { key: 'rebate', name: '返利最高' },
  { key: 'price', name: '价格最低' },
];

const route = useRoute();
const topic = ref({});
const list = ref([]);
const total = ref(0);
const page = ref(0);
const sort = ref('rebate');
const loading = ref(false);
const finished = ref(false);

const headStyle = computed(() => ({
  background: /^https?:|^data:/.test(topic.value.cover || '')
    ? `center/cover no-repeat url(${topic.value.cover})`
    : (topic.value.bg || 'linear-gradient(135deg,#ff8a3d,#ff5000)'),
}));

async function load() {
  loading.value = true;
  try {
    const r = await api.topicGoods(route.params.slug, { sort: sort.value, page: page.value + 1 });
    page.value += 1;
    topic.value = r.topic || {};
    list.value = [...list.value, ...(r.list || [])];
    total.value = r.total || 0;
    // 服务端分页，靠总数判断到底，别拿本页长度猜——猜错就是无限加载
    if (list.value.length >= total.value) finished.value = true;
  } catch (e) {
    finished.value = true;
    if (!list.value.length) showToast(e?.message || '专题加载失败');
  } finally {
    loading.value = false;
  }
}

function switchSort(k) {
  if (sort.value === k) return;
  sort.value = k;
  reset();
}

function reset() {
  list.value = [];
  page.value = 0;
  total.value = 0;
  finished.value = false;
  load();
}

// 从一个专题直接跳另一个专题时，组件会复用，必须自己重置
watch(() => route.params.slug, reset, { immediate: true });
</script>

<style scoped>
.topic-head {
  padding: 18px 16px 20px;
  color: #fff;
  text-align: center;
}
.th-icon { font-size: 30px; line-height: 1; }
.th-name { font-size: 19px; font-weight: 700; margin-top: 6px; }
.th-intro { font-size: 12px; opacity: .9; margin-top: 5px; }

.sort-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
}
.sort-item {
  font-size: 13px;
  color: #666;
  padding: 4px 12px;
  border-radius: 999px;
  background: #f5f6f8;
}
.sort-item.on {
  color: #fff;
  background: var(--brand);
  font-weight: 600;
}
.count { margin-left: auto; }
</style>
