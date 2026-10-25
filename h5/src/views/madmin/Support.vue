<template>
  <div class="m-support">
    <van-nav-bar
      title="客服工作台"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    >
      <template #right>
        <span class="rules-entry" @click="$router.push('/madmin/support-rules')">自动回复</span>
      </template>
    </van-nav-bar>

    <van-search
      v-model="keyword"
      placeholder="搜索手机号 / 昵称"
      shape="round"
      @search="loadList"
      @clear="loadList"
    />

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <div
        v-for="c in list"
        :key="c.id"
        class="conv-card"
        @click="openConv(c)"
      >
        <van-badge :content="c.staffUnread" :show-zero="false" :max="99">
          <van-image
            round
            width="44"
            height="44"
            :src="c.avatar"
            fit="cover"
          >
            {{ (c.nickname || '客')[0] }}
          </van-image>
        </van-badge>
        <div class="conv-main">
          <div class="conv-top">
            <span class="conv-name">{{ c.nickname || '未设置昵称' }}</span>
            <span class="conv-time">{{ fmtTime(c.lastMessageAt) }}</span>
          </div>
          <div class="conv-last">
            {{ c.lastMessageType === 2 ? '[图片]' : (c.lastMessage || '—') }}
          </div>
          <div class="conv-mobile">{{ c.mobile }}</div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无客户咨询" />

    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/agents" icon="friends-o">代理</van-tabbar-item>
      <van-tabbar-item to="/madmin/withdraws" icon="gold-coin-o">提现</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import { adminApi } from '../../api';

const router = useRouter();
const active = ref(0);
const keyword = ref('');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
let socket = null;

function fmtTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

async function onLoad() {
  try {
    const r = await adminApi.supportConversations({
      keyword: keyword.value || undefined,
      page: page.value,
      size: pageSize,
    });
    const rows = r.list || [];
    if (page.value === 1) list.value = rows;
    else list.value = list.value.concat(rows);
    if (rows.length < pageSize) finished.value = true;
    page.value++;
  } finally {
    loading.value = false;
  }
}

function loadList() {
  page.value = 1;
  finished.value = false;
  list.value = [];
  loading.value = true;
  onLoad();
}

function openConv(c) {
  router.push(`/madmin/support/${c.id}`);
}

/** 新消息到达：置顶并更新未读（当前页所有会话的推送都收） */
function upsert(c) {
  const i = list.value.findIndex((x) => x.id === c.id);
  const prev = i >= 0 ? list.value[i] : {};
  if (i >= 0) list.value.splice(i, 1);
  list.value.unshift({ ...prev, ...c });
}

onMounted(() => {
  socket = io({
    auth: { token: localStorage.getItem('adminToken') },
    transports: ['websocket', 'polling'],
  });
  socket.on('support:message', ({ conversation }) => {
    if (conversation) upsert(conversation);
  });
  socket.on('support:conversation', ({ conversation }) => {
    if (conversation) upsert(conversation);
  });
});

onUnmounted(() => {
  socket?.disconnect();
  socket = null;
});
</script>

<style scoped>
.m-support { min-height: 100vh; background: #f5f6f8; padding-bottom: 60px; }
.rules-entry { color: #ff4b3a; font-size: 14px; font-weight: 600; }

.conv-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  margin: 8px 12px;
  padding: 12px 14px;
  border-radius: 12px;
}
.conv-card:active { background: #fafafa; }
.conv-main { flex: 1; min-width: 0; }
.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.conv-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.conv-time { font-size: 11px; color: #bbb; flex-shrink: 0; }
.conv-last {
  margin-top: 3px;
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-mobile { margin-top: 2px; font-size: 11px; color: #c0c4cc; }
</style>
