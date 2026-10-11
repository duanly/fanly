<template>
  <van-popup
    v-model:show="show"
    position="bottom"
    round
    :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
  >
    <div style="padding:20px 18px 18px">
      <div style="display:flex;align-items:center;gap:8px">
        <van-icon name="notes-o" color="#ff4b3a" size="20" />
        <span style="font-size:16px;font-weight:700">检测到商品链接</span>
      </div>

      <div
        style="margin-top:12px;background:#f7f8fa;border-radius:10px;padding:10px 12px;
               font-size:13px;color:#666;line-height:1.6;max-height:66px;overflow:hidden"
      >
        {{ preview }}
      </div>

      <div style="display:flex;gap:10px;margin-top:16px">
        <van-button plain round style="flex:1" @click="dismiss">忽略</van-button>
        <van-button round type="primary" color="#ff4b3a" style="flex:2" @click="go">
          查返利
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { readClipboard, looksLikeShare } from '../utils/clipboard';

const show = ref(false);
const text = ref('');
const preview = ref('');
const router = useRouter();

// 同一段内容只提示一次，别反复弹
const SEEN_KEY = 'clipSeen';
// 冷却时间：两次检查之间至少间隔这么久，避免 iOS 每次切回页面都弹「粘贴」
const COOLDOWN_MS = 3 * 60 * 1000; // 3 分钟
const LAST_CHECK_KEY = 'clipLastCheck';

function seen() {
  try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; }
}

function markSeen(t) {
  try { localStorage.setItem(SEEN_KEY, t.slice(0, 200)); } catch { /* 忽略 */ }
}

function inCooldown() {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    return Date.now() - last < COOLDOWN_MS;
  } catch { return false; }
}

function markChecked() {
  try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch { /* 忽略 */ }
}

async function check() {
  // 登录了才有意义——转链要带用户的推广位
  if (!localStorage.getItem('token')) return;
  if (show.value) return;
  if (inCooldown()) return;
  const t = await readClipboard();
  markChecked();
  if (!t || !looksLikeShare(t)) return;
  if (t.slice(0, 200) === seen()) return;
  text.value = t;
  preview.value = t.length > 90 ? `${t.slice(0, 90)}…` : t;
  show.value = true;
}

function dismiss() {
  markSeen(text.value);
  show.value = false;
}

function go() {
  markSeen(text.value);
  show.value = false;
  router.push({ path: '/parse', query: { auto: '1' } });
}

function onVisible() {
  if (document.visibilityState === 'visible') check();
}

onMounted(() => {
  check();
  document.addEventListener('visibilitychange', onVisible);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisible);
});
</script>
