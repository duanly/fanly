<template>
  <div class="page">
    <van-nav-bar title="转链查返利" left-arrow fixed placeholder @click-left="back" />

    <!-- 输入区 -->
    <div style="background:#fff;margin:12px;border-radius:14px;padding:14px">
      <van-field
        v-model="content"
        type="textarea"
        rows="4"
        autosize
        maxlength="1000"
        :border="false"
        placeholder="把淘宝 / 京东 / 拼多多 / 抖音的商品链接或口令粘贴到这里"
        style="background:#f7f8fa;border-radius:10px;padding:12px"
      />

      <div style="display:flex;gap:10px;margin-top:12px">
        <van-button
          plain
          round
          size="small"
          style="flex:1"
          icon="notes-o"
          @click="pasteFromClipboard"
        >
          读取剪贴板
        </van-button>
        <van-button
          round
          size="small"
          type="primary"
          color="#ff4b3a"
          style="flex:2"
          :loading="loading"
          @click="doParse"
        >
          查返利
        </van-button>
      </div>

      <div class="muted" style="margin-top:10px;line-height:1.7">
        在电商 App 里点「分享」→「复制链接」，回到这里粘贴即可。
        读不到剪贴板是浏览器限制，手动长按粘贴一样用。
      </div>
    </div>

    <!-- 失败提示 -->
    <div v-if="failReason" style="margin:0 12px">
      <van-notice-bar wrapable :scrollable="false" color="#ed6a0c" background="#fffbe8" left-icon="warning-o">
        {{ failReason }}
      </van-notice-bar>
    </div>

    <!-- 解析结果 -->
    <ParseResult v-if="result?.ok" :data="result" @open="openApp" />

    <!-- 历史记录 -->
    <template v-if="history.length && !result">
      <div class="section-title" style="margin-top:6px">
        最近查过
        <span style="margin-left:auto;font-size:12px;font-weight:400;color:#999" @click="clearHistory">
          清空
        </span>
      </div>
      <van-cell-group inset>
        <van-cell
          v-for="(h, i) in history"
          :key="i"
          :title="h.title"
          :label="h.platformName + ' · 返 ¥' + h.rebate"
          is-link
          @click="$router.push(`/goods/${h.platform}/${h.goodsId}`)"
        />
      </van-cell-group>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import { readClipboard, looksLikeShare } from '../utils/clipboard';
import ParseResult from '../components/ParseResult.vue';

const content = ref('');
const result = ref(null);
const failReason = ref('');
const loading = ref(false);
const history = ref([]);
const router = useRouter();

const HISTORY_KEY = 'parseHistory';

function loadHistory() {
  try {
    history.value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    history.value = [];
  }
}

function pushHistory(r) {
  const item = {
    title: r.goods.title,
    platform: r.goods.platform,
    platformName: r.platformName,
    goodsId: r.goods.goodsId,
    rebate: r.goods.rebate,
  };
  const next = [item, ...history.value.filter((h) => h.goodsId !== item.goodsId)].slice(0, 10);
  history.value = next;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
}

function clearHistory() {
  history.value = [];
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* 忽略 */ }
}

async function pasteFromClipboard() {
  const t = await readClipboard();
  if (!t) return showToast('读不到剪贴板，请长按输入框粘贴');
  content.value = t;
  if (looksLikeShare(t)) doParse();
}

async function doParse() {
  const text = content.value.trim();
  if (!text) return showToast('先粘贴商品链接或口令');
  loading.value = true;
  failReason.value = '';
  result.value = null;
  try {
    const r = await api.parse(text);
    if (r?.ok) {
      result.value = r;
      pushHistory(r);
    } else {
      failReason.value = r?.reason || '没认出这个商品';
    }
  } finally {
    loading.value = false;
  }
}

function openApp() {
  const dl = result.value?.link?.deeplink;
  if (!dl) return showToast('转链信息缺失');
  showToast('正在打开购物 App…');
  location.href = dl;
}

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

onMounted(async () => {
  loadHistory();
  // 进页面顺手看一眼剪贴板，命中就直接查，省一次点击
  const t = await readClipboard();
  if (t && looksLikeShare(t)) {
    content.value = t;
    doParse();
  }
});
</script>
