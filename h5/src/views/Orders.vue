<template>
  <div class="page">
    <van-nav-bar title="我的订单" fixed placeholder />

    <van-tabs v-model:active="tab" color="#ff4b3a" line-width="20" @change="reset">
      <van-tab v-for="t in tabs" :key="t.label" :title="t.label" />
    </van-tabs>

    <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="load">
      <div
        v-for="o in list"
        :key="o.id"
        style="background:#fff;margin:10px 12px;border-radius:12px;padding:12px;display:flex;gap:10px"
      >
        <img :src="o.goodsImg" style="width:72px;height:72px;border-radius:8px;object-fit:cover;background:#eee" />
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;line-height:1.4;max-height:36px;overflow:hidden">{{ o.goodsTitle }}</div>
          <div class="muted" style="margin-top:4px">
            {{ platformName(o.platform) }} · {{ o.platformOrderNo }}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px">
            <span class="muted">实付 ¥{{ (+o.payAmount).toFixed(2) }}</span>
            <span>
              <span class="muted" style="margin-right:4px">{{ statusText(o.orderStatus) }}</span>
              <span class="price">¥{{ (+o.myRebate).toFixed(2) }}</span>
            </span>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="finished && !list.length" description="还没有订单，去首页逛逛" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../api';

const tabs = [
  { label: '全部', status: undefined },
  { label: '待收货', status: 1 },
  { label: '已收货', status: 2 },
  { label: '已到账', status: 5 },
  { label: '已失效', status: 4 },
];
const tab = ref(0);
const list = ref([]);
const page = ref(1);
const loading = ref(false);
const finished = ref(false);

const platformName = (p) => ({ PDD: '拼多多', JD: '京东', TB: '淘宝', DY: '抖音' }[p] || p);
const statusText = (s) => ({ 1: '待收货', 2: '已收货', 3: '已结算', 4: '已失效', 5: '已到账' }[s] || '');

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  load();
}

async function load() {
  try {
    const r = await api.orders({ status: tabs[tab.value].status, page: page.value, pageSize: 20 });
    const rows = r.list || [];
    list.value.push(...rows);
    page.value += 1;
    if (list.value.length >= r.total) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}
</script>
