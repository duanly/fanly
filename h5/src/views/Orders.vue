<template>
  <div class="page">
    <van-nav-bar title="我的订单" fixed placeholder />

    <NeedLogin
      v-if="!logged"
      title="登录后查看订单"
      desc="登录后这里会显示你的每一笔返利订单，以及到账状态"
    />

    <template v-else>
    <van-tabs v-model:active="tab" color="#ff4b3a" line-width="20" @change="reset">
      <van-tab v-for="t in tabs" :key="t.label" :title="t.label" />
    </van-tabs>

    <!-- 返利什么时候到账是客服问得最多的，直接写在列表顶上 -->
    <div class="tip-bar">
      返利在订单<b>确认收货且平台结算</b>后入账，一般 15~30 天。退款或维权的订单会失效。
      <span class="claim-link" @click="$router.push('/claim')">买了没看到订单？去找回 ›</span>
    </div>

    <van-list v-if="logged" v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="load">
      <div
        v-for="o in list"
        :key="o.id"
        style="background:#fff;margin:10px 12px;border-radius:12px;padding:12px;display:flex;gap:10px"
      >
        <img :src="o.goodsImg" style="width:72px;height:72px;border-radius:8px;object-fit:cover;background:#eee" />
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;line-height:1.4;max-height:36px;overflow:hidden">{{ o.goodsTitle }}</div>
          <div class="muted" style="margin-top:4px">
            {{ platformName(o.platform) }} · {{ fmt(o.orderTime) }}
          </div>
          <div class="muted" style="font-size:11px">单号 {{ o.platformOrderNo }}</div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px">
            <span class="muted">实付 ¥{{ (+o.payAmount).toFixed(2) }}</span>
            <span>
              <span
                style="margin-right:4px;font-size:12px"
                :style="{ color: statusColor(o.orderStatus) }"
              >{{ statusText(o.orderStatus) }}</span>
              <span
                class="price"
                :style="o.orderStatus === 4 ? 'text-decoration:line-through;opacity:.45' : ''"
              >¥{{ (+o.myRebate).toFixed(2) }}</span>
            </span>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="finished && !list.length" description="还没有订单，去首页逛逛" />
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../api';
import NeedLogin from '../components/NeedLogin.vue';

const logged = ref(!!localStorage.getItem('token'));

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
const statusColor = (s) => ({ 4: '#c8c9cc', 5: '#07c160' }[s] || '#969799');
const fmt = (d) => (d ? new Date(d).toLocaleDateString('zh-CN') : '');

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
