<template>
  <div class="m-chat">
    <van-nav-bar
      :title="title"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    />

    <div ref="listRef" class="msg-list">
      <template v-for="(m, i) in messages" :key="m.id">
        <div v-if="showTime(m, i)" class="time-sep">{{ fmtTime(m.createdAt) }}</div>
        <div class="msg-row" :class="m.senderType === 1 ? 'from-user' : 'from-staff'">
          <div class="bubble" :class="{ image: m.type === 2, auto: m.senderType === 3 }">
            <div v-if="m.senderType === 3" class="auto-tag">自动回复</div>
            <van-image
              v-if="m.type === 2"
              :src="m.content"
              fit="cover"
              class="msg-img"
              @click="showImagePreview([m.content], { startPosition: 0, closeable: true })"
            />
            <template v-else>{{ m.content }}</template>
          </div>
        </div>
      </template>
    </div>

    <div class="input-bar">
      <input ref="fileRef" type="file" accept="image/*" hidden @change="onPickImage" />
      <van-icon
        name="photograph"
        size="26"
        color="#666"
        class="ib-icon"
        @click="fileRef?.click()"
      />
      <input
        v-model="draft"
        class="ib-input"
        placeholder="输入回复"
        :disabled="uploading"
        @keyup.enter="send"
      />
      <button class="ib-send" :disabled="!canSend" @click="send">
        {{ uploading ? '发送中' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { showImagePreview, showToast } from 'vant';
import { io } from 'socket.io-client';
import { adminApi } from '../../api';

const route = useRoute();
const convId = Number(route.params.id);

const listRef = ref(null);
const fileRef = ref(null);
const messages = ref([]);
const draft = ref('');
const sending = ref(false);
const uploading = ref(false);
const title = ref('客户会话');
let socket = null;

const canSend = computed(() => draft.value.trim().length > 0 && !sending.value && !uploading.value);

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

function scrollBottom(smooth = false) {
  nextTick(() => {
    const el = listRef.value;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  });
}

async function load() {
  try {
    const r = await adminApi.supportDetail(convId);
    messages.value = r.messages || [];
    title.value = r.user?.nickname || r.user?.mobile || '客户会话';
    scrollBottom();
  } catch {
    showToast('会话加载失败');
  }
}

async function send() {
  const content = draft.value.trim();
  if (!content || sending.value) return;
  sending.value = true;
  try {
    const r = await adminApi.supportSend(convId, 1, content);
    append(r.message);
    draft.value = '';
  } catch {
    showToast('发送失败，请重试');
  } finally {
    sending.value = false;
  }
}

async function onPickImage(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return showToast('图片不能超过 5MB');
  uploading.value = true;
  try {
    const up = await adminApi.adminUploadImage(file);
    const r = await adminApi.supportSend(convId, 2, up.url);
    append(r.message);
  } catch {
    showToast('图片发送失败');
  } finally {
    uploading.value = false;
  }
}

function append(m) {
  if (messages.value.some((x) => x.id === m.id)) return;
  messages.value.push(m);
  scrollBottom(true);
}

onMounted(() => {
  load();
  socket = io({
    auth: { token: localStorage.getItem('adminToken') },
    transports: ['websocket', 'polling'],
  });
  socket.on('support:message', ({ message, conversation }) => {
    // 只收当前会话；其他客户的消息回列表页看未读
    if (conversation?.id === convId) append(message);
  });
});

onUnmounted(() => {
  socket?.disconnect();
  socket = null;
});
</script>

<style scoped>
.m-chat {
  min-height: 100vh;
  background: #f5f6f8;
  display: flex;
  flex-direction: column;
}
.msg-list { flex: 1; padding: 12px 12px 80px; }

.time-sep {
  text-align: center;
  font-size: 11px;
  color: #b0b3b8;
  margin: 10px 0;
}

.msg-row { display: flex; margin-bottom: 14px; }
.msg-row.from-user { justify-content: flex-start; }
.msg-row.from-staff { justify-content: flex-end; }

.bubble {
  max-width: 74%;
  padding: 9px 12px;
  border-radius: 14px;
  background: #fff;
  color: #1a1a1a;
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.from-user .bubble { border-top-left-radius: 4px; }
.from-staff .bubble {
  background: #ff4b3a;
  color: #fff;
  border-top-right-radius: 4px;
}
.bubble.auto { background: #f4f4f5; color: #606266; }
.auto-tag { font-size: 10px; color: #909399; margin-bottom: 2px; }
.bubble.image { padding: 3px; background: transparent; box-shadow: none; }
.msg-img {
  display: block;
  width: 180px;
  max-width: 60vw;
  border-radius: 12px;
  overflow: hidden;
}

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
.ib-icon { flex-shrink: 0; padding: 4px; }
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
.ib-send:disabled { background: #ffc4bf; }
</style>
