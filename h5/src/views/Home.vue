<template>
  <div class="page">
    <van-nav-bar title="省钱猫" fixed placeholder>
      <template #right>
        <van-icon name="search" size="20" @click="$router.push('/search')" />
      </template>
    </van-nav-bar>

    <!-- 口令粘贴条：返利平台的核心留存入口 -->
    <div class="pad">
      <van-field
        v-model="paste"
        placeholder="粘贴淘宝/抖音口令或商品链接，自动查返利"
        left-icon="notes-o"
        clearable
        :border="false"
        style="border-radius:10px;background:#fff"
      >
        <template #button>
          <van-button size="small" type="primary" color="#ff4b3a" :loading="parsing" @click="doParse">
            查返利
          </van-button>
        </template>
      </van-field>
    </div>

    <van-tabs v-model:active="platformIdx" color="#ff4b3a" line-width="20" @change="load">
      <van-tab v-for="p in platforms" :key="p.key" :title="p.name" />
    </van-tabs>

    <div class="section-title">🔥 今日爆款</div>

    <van-loading v-if="loading" style="padding:40px;text-align:center" />
    <div v-else class="goods-grid">
      <GoodsCard v-for="g in list" :key="g.goodsId" :g="g" />
    </div>

    <van-empty v-if="!loading && !list.length" description="暂无商品" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';

const platforms = [
  { key: 'PDD', name: '拼多多' },
  { key: 'JD', name: '京东' },
  { key: 'TB', name: '淘宝' },
  { key: 'DY', name: '抖音' },
];
const platformIdx = ref(0);
const list = ref([]);
const loading = ref(true);
const paste = ref('');
const parsing = ref(false);
const router = useRouter();

async function load() {
  loading.value = true;
  try {
    const r = await api.recommend(platforms[platformIdx.value].key);
    list.value = r.list || [];
  } finally {
    loading.value = false;
  }
}

async function doParse() {
  if (!paste.value.trim()) return showToast('先粘贴口令或链接');
  if (!localStorage.getItem('token')) return router.push('/login');
  parsing.value = true;
  try {
    const r = await api.parse(paste.value.trim());
    if (!r?.goods) return showToast('没认出这个商品');
    router.push(`/goods/${r.goods.platform}/${r.goods.goodsId}`);
  } finally {
    parsing.value = false;
  }
}

onMounted(load);
</script>
