<template>
  <div class="page">
    <van-nav-bar :title="title" left-arrow fixed placeholder @click-left="back" />

    <div class="chip-row" style="padding:10px 12px 2px">
      <div
        v-for="(p, i) in platforms"
        :key="p.key"
        class="chip"
        :class="{ active: platformIdx === i }"
        @click="switchPlatform(i)"
      >
        {{ p.name }}
      </div>
    </div>

    <van-loading v-if="loading" style="padding:50px;text-align:center" />

    <template v-else>
      <div class="goods-grid">
        <GoodsCard v-for="g in list" :key="g.goodsId" :g="g" />
      </div>

      <van-empty v-if="!list.length" description="这个专题还没选品">
        <div class="muted" style="font-size:12px;padding:0 30px;line-height:1.6">
          去后台「选品池」搜商品，加入时把专题填成 {{ key }} 就会显示在这里
        </div>
      </van-empty>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import GoodsCard from '../components/GoodsCard.vue';
import { groupMeta } from '../constants/groups';
import { PLATFORMS } from '../utils/platform';

const platforms = [{ key: '', name: '全部' }, ...PLATFORMS];

const route = useRoute();
const router = useRouter();
const key = ref(String(route.params.key || 'default'));
const title = ref(groupMeta(key.value).name);
const platformIdx = ref(0);
const list = ref([]);
const loading = ref(true);

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

function switchPlatform(i) {
  platformIdx.value = i;
  load();
}

async function load() {
  loading.value = true;
  try {
    const r = await api.feed({
      group: key.value,
      platform: platforms[platformIdx.value].key || undefined,
      limit: 30,
    });
    list.value = r.list || [];
  } finally {
    loading.value = false;
  }
}

// 从一个专题跳到另一个专题时组件会复用，得跟着路由重新拉
watch(() => route.params.key, (v) => {
  key.value = String(v || 'default');
  title.value = groupMeta(key.value).name;
  load();
});

onMounted(load);
</script>
