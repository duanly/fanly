<template>
  <div class="page">
    <van-search
      v-model="keyword"
      placeholder="搜你想买的东西"
      show-action
      @search="reset"
      @cancel="$router.back()"
    />

    <van-tabs v-model:active="platformIdx" color="#ff4b3a" line-width="20" @change="reset">
      <van-tab v-for="p in platforms" :key="p.key" :title="p.name" />
    </van-tabs>

    <van-dropdown-menu active-color="#ff4b3a">
      <van-dropdown-item v-model="sort" :options="sortOptions" @change="reset" />
    </van-dropdown-menu>

    <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="load">
      <div class="goods-grid">
        <GoodsCard v-for="g in list" :key="g.platform + g.goodsId" :g="g" />
      </div>
    </van-list>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import { PLATFORMS } from '../utils/platform';

const platforms = PLATFORMS;
const sortOptions = [
  { text: '综合排序', value: '' },
  { text: '销量优先', value: 'sales' },
  { text: '返利最高', value: 'commission' },
  { text: '价格最低', value: 'price' },
];

const keyword = ref('');
const platformIdx = ref(0);
const sort = ref('');
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  load();
}

async function load() {
  try {
    const r = await api.search({
      platform: platforms[platformIdx.value].key,
      keyword: keyword.value,
      page: page.value,
      pageSize: 20,
      sort: sort.value,
    });
    const rows = r.list || [];
    list.value.push(...rows);
    page.value += 1;
    if (rows.length < 20 || page.value > 5) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}
</script>
