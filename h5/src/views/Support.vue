<template>
  <div class="support-page">
    <van-nav-bar title="在线客服" left-arrow fixed placeholder @click-left="$router.back()" />

    <div ref="listRef" class="msg-list">
      <template v-for="(m, i) in messages" :key="m.id">
        <div v-if="showTime(m, i)" class="time-sep">{{ fmtTime(m.createdAt) }}</div>
        <div v-if="m.senderType === 4" class="system-row">
          <div class="system-bubble">🔔 {{ m.content }}</div>
        </div>
        <div v-else class="msg-row" :class="isMine(m) ? 'mine' : 'theirs'">
          <div v-if="!isMine(m)" class="avatar staff-avatar">🎧</div>
          <div class="bubble" :class="{ image: m.type === 2, fail: m._fail }">
            <img
              v-if="m.type === 2"
              :src="m.content"
              class="msg-img"
              alt=""
              @click="showImagePreview([m.content], { startPosition: 0, closeable: true })"
            />
            <template v-else>{{ m.content }}</template>
          </div>
          <img v-if="isMine(m)" class="avatar" :src="myAvatar || defaultAvatar" alt="" />
        </div>
      </template>
      <div v-if="loading" class="time-sep">加载中…</div>
    </div>

    <div class="input-bar">
      <input ref="fileRef" type="file" accept="image/*" hidden @change="onPickImage" />
      <van-icon
        name="photograph"
        size="26"
        color="#666"
        class="ib-icon"
        :class="{ disabled: sending }"
        @click="pickImage"
      />
      <input
        v-model="draft"
        class="ib-input"
        placeholder="请输入消息"
        :disabled="uploading"
        @keyup.enter="sendText"
      />
      <button class="ib-send" :disabled="!canSend" @click="sendText">
        {{ uploading ? '发送中' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { showImagePreview, showToast } from 'vant';
import { io } from 'socket.io-client';
import { api } from '../api';

const listRef = ref(null);
const fileRef = ref(null);
const messages = ref([]);
const draft = ref('');
const sending = ref(false);
const uploading = ref(false);
const loading = ref(true);
const myAvatar = ref('');
const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#ffd1cc"/><text x="40" y="52" font-size="40" text-anchor="middle">🙂</text></svg>',
);

let socket = null;

const canSend = computed(() => draft.value.trim().length > 0 && !sending.value && !uploading.value);

// 右侧气泡：只有自己发的；客服和自动回复都在左侧
function isMine(m) { return m.senderType === 1; }

function showTime(m, i) {
  if (i === 0) return true;
  const prev = new Date(messages.value[i - 1].createdAt).getTime();
  return new Date(m.createdAt).getTime() - prev > 5 * 60 * 1000;
}

function fmtTime(t) {
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function scrollToBottom(smooth = false) {
  nextTick(() => {
    const el = listRef.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  });
}

function appendMessage(m) {
  if (messages.value.some((x) => x.id === m.id)) return;
  messages.value.push(m);
  scrollToBottom(true);
}

async function loadConversation() {
  loading.value = true;
  try {
    const r = await api.supportConversation();
    messages.value = r.messages || [];
    await api.readSupport();
    scrollToBottom();
  } finally {
    loading.value = false;
  }
}

async function sendText() {
  const content = draft.value.trim();
  if (!content || sending.value) return;
  sending.value = true;
  try {
    const r = await api.sendSupportMessage(1, content);
    appendMessage(r.message);
    draft.value = '';
  } catch {
    showToast('发送失败，请重试');
  } finally {
    sending.value = false;
  }
}

function pickImage() {
  if (sending.value || uploading.value) return;
  fileRef.value?.click();
}

async function onPickImage(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // 允许重复选同一张
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return showToast('图片不能超过 5MB');
  uploading.value = true;
  try {
    const up = await api.supportUpload(file);
    const r = await api.sendSupportMessage(2, up.url);
    appendMessage(r.message);
  } catch {
    showToast('图片发送失败');
  } finally {
    uploading.value = false;
  }
}

function connectSocket() {
  const token = localStorage.getItem('token');
  socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
  socket.on('support:message', (data) => {
    if (!data?.message) return;
    appendMessage(data.message);
    // 在会话页里收到任何推送都立即已读
    api.readSupport().catch(() => {});
  });
}

onMounted(async () => {
  loadConversation();
  try {
    const p = await api.profile();
    myAvatar.value = p?.avatar || '';
  } catch { /* 头像用默认值即可 */ }
  connectSocket();
});

onUnmounted(() => {
  socket?.disconnect();
  socket = null;
});
</script>

<style scoped>
.support-page {
  min-height: 100vh;
  background: #f5f6f8;
  display: flex;
  flex-direction: column;
}

.msg-list {
  flex: 1;
  padding: 12px 12px 80px;
}

.time-sep {
  text-align: center;
  font-size: 11px;
  color: #b0b3b8;
  margin: 10px 0;
}
/* 系统通知：居中、灰底，区别于人工/自动回复 */
.system-row { text-align: center; margin: 12px 0; }
.system-bubble {
  display: inline-block;
  max-width: 85%;
  padding: 7px 14px;
  font-size: 12px;
  color: #8c8c8c;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  line-height: 1.6;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 14px;
}
.msg-row.mine {
  justify-content: flex-end;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}
.staff-avatar {
  background: linear-gradient(135deg, #ff6b35, #ff4b3a);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.bubble {
  max-width: 72%;
  padding: 9px 12px;
  border-radius: 14px;
  background: #fff;
  color: #1a1a1a;
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.theirs .bubble {
  border-top-left-radius: 4px;
}
.mine .bubble {
  background: #ff4b3a;
  color: #fff;
  border-top-right-radius: 4px;
}
.bubble.fail {
  background: #fff1f0;
  color: #ff4b3a;
  border: 1px solid #ffccc7;
}

.bubble.image {
  padding: 3px;
  background: transparent;
  box-shadow: none;
}
.msg-img {
  display: block;
  width: 180px;
  max-width: 60vw;
  border-radius: 12px;
  cursor: pointer;
}

/* 底部输入栏：固定 + 安全区 */
.input-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #eee;
}
.ib-icon {
  flex-shrink: 0;
  padding: 4px;
}
.ib-icon.disabled {
  opacity: 0.4;
}
.ib-input {
  flex: 1;
  height: 36px;
  border: none;
  outline: none;
  background: #f5f6f8;
  border-radius: 18px;
  padding: 0 14px;
  font-size: 15px;
  min-width: 0;
}
.ib-send {
  flex-shrink: 0;
  border: none;
  background: #ff4b3a;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border-radius: 18px;
  padding: 8px 16px;
}
.ib-send:disabled {
  background: #ffc4bf;
}
</style>
