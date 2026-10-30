<template>
  <view class="page">
    <!-- 自定义导航（navigationStyle: custom） -->
    <view class="nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar">
        <view class="nav-back" @click="back">‹</view>
        <view class="nav-title">在线客服</view>
        <view class="nav-placeholder"></view>
      </view>
    </view>

    <scroll-view class="msg-list" scroll-y :scroll-with-animation="true" :scroll-into-view="anchor">
      <view v-for="(m, i) in messages" :key="m.id" :id="'msg' + m.id">
        <view v-if="showTime(m, i)" class="time-sep">{{ fmtTime(m.createdAt) }}</view>
        <view v-if="m.senderType === 4" class="system-row">
          <view class="system-bubble">🔔 {{ m.content }}</view>
        </view>
        <view v-else class="msg-row" :class="isMine(m) ? 'mine' : 'theirs'">
          <view v-if="!isMine(m)" class="avatar staff-avatar">🎧</view>
          <view class="bubble" :class="{ image: m.type === 2 }">
            <image
              v-if="m.type === 2"
              :src="m.content"
              class="msg-img"
              mode="widthFix"
              @click="preview(m.content)"
            />
            <text v-else>{{ m.content }}</text>
          </view>
          <view v-if="isMine(m)" class="avatar my-avatar">
            <image v-if="myAvatar" :src="myAvatar" mode="aspectFill" />
            <text v-else>🙂</text>
          </view>
        </view>
      </view>
      <view v-if="loading" class="time-sep">加载中…</view>
      <view id="msgBottom" class="bottom-anchor"></view>
    </scroll-view>

    <view class="input-bar" :style="{ paddingBottom: 'calc(16rpx + env(safe-area-inset-bottom))' }">
      <view class="ib-icon" :class="{ disabled: uploading }" @click="pickImage">
        <text>🖼️</text>
      </view>
      <input v-model="draft" class="ib-input" placeholder="请输入消息" :disabled="uploading" confirm-type="send" @confirm="sendText" />
      <view class="ib-send" :class="{ off: !canSend }" @click="sendText">
        {{ uploading ? '发送中' : '发送' }}
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { fmtTime as fullFmtTime } from '../../utils/format.js';

const messages = ref([]);
const draft = ref('');
const sending = ref(false);
const uploading = ref(false);
const loading = ref(true);
const myAvatar = ref('');
const anchor = ref('');
const statusBarHeight = ref(20);

let pollTimer = null;

const canSend = computed(() => draft.value.trim().length > 0 && !sending.value && !uploading.value);

function isMine(m) { return m.senderType === 1; }
function showTime(m, i) {
  if (i === 0) return true;
  const prev = new Date(messages.value[i - 1].createdAt).getTime();
  return new Date(m.createdAt).getTime() - prev > 5 * 60 * 1000;
}
function fmtTime(t) {
  // 列表里只显示 月-日 时:分
  return fullFmtTime(t).slice(5, 16);
}
function scrollBottom() {
  anchor.value = '';
  setTimeout(() => { anchor.value = 'msgBottom'; }, 30);
}
function merge(rows) {
  for (const m of rows) {
    if (!messages.value.some((x) => x.id === m.id)) messages.value.push(m);
  }
}

async function loadConversation() {
  loading.value = true;
  try {
    const r = await api.supportConversation();
    messages.value = r.messages || [];
    await api.readSupport().catch(() => {});
    scrollBottom();
  } catch {} finally {
    loading.value = false;
  }
}

// 轮询拉新消息：socket.io 协议在小程序端不兼容，先用 4 秒轮询保证三端可用，
// 后续可换成 wx.connectSocket 原生 WS
async function poll() {
  try {
    const before = messages.value.length;
    const r = await api.supportConversation();
    merge(r.messages || []);
    if (messages.value.length > before) {
      scrollBottom();
      api.readSupport().catch(() => {});
    }
  } catch {}
}
function startPoll() {
  stopPoll();
  pollTimer = setInterval(poll, 4000);
}
function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function sendText() {
  const content = draft.value.trim();
  if (!content || sending.value) return;
  sending.value = true;
  try {
    const r = await api.sendSupportMessage(1, content);
    merge([r.message]);
    draft.value = '';
    scrollBottom();
  } catch {
    uni.showToast({ title: '发送失败，请重试', icon: 'none' });
  } finally {
    sending.value = false;
  }
}

function pickImage() {
  if (uploading.value) return;
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      uploading.value = true;
      try {
        const up = await api.supportUpload(res.tempFilePaths[0]);
        const r = await api.sendSupportMessage(2, up.url);
        merge([r.message]);
        scrollBottom();
      } catch {
        uni.showToast({ title: '图片发送失败', icon: 'none' });
      } finally {
        uploading.value = false;
      }
    },
  });
}

function preview(url) {
  uni.previewImage({ urls: [url], current: url });
}
function back() { uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/mine/mine' }) }); }

onLoad(() => {
  try {
    const info = uni.getSystemInfoSync();
    statusBarHeight.value = info.statusBarHeight || 20;
  } catch {}
});
onShow(async () => {
  if (!messages.value.length) await loadConversation();
  else poll();
  try {
    const p = await api.profile();
    myAvatar.value = p?.avatar || '';
  } catch {}
  startPoll();
});
onHide(stopPoll);
onUnload(stopPoll);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; display: flex; flex-direction: column; }
.nav { background: #fff; }
.nav-bar { height: 88rpx; display: flex; align-items: center; position: relative; }
.nav-back { width: 88rpx; text-align: center; font-size: 56rpx; color: #333; line-height: 1; }
.nav-title { position: absolute; left: 0; right: 0; text-align: center; font-size: 32rpx; font-weight: 700; pointer-events: none; }
.nav-placeholder { width: 88rpx; }

.msg-list { flex: 1; padding: 24rpx 24rpx 24rpx; box-sizing: border-box; }
.bottom-anchor { height: 20rpx; }
.time-sep { text-align: center; font-size: 22rpx; color: #b0b3b8; margin: 20rpx 0; }
.system-row { text-align: center; margin: 24rpx 0; }
.system-bubble {
  display: inline-block; max-width: 85%;
  padding: 14rpx 28rpx; font-size: 24rpx; color: #8c8c8c;
  background: rgba(0, 0, 0, 0.05); border-radius: 16rpx; line-height: 1.6;
}
.msg-row { display: flex; align-items: flex-start; gap: 16rpx; margin-bottom: 28rpx; }
.msg-row.mine { justify-content: flex-end; }
.avatar { width: 76rpx; height: 76rpx; border-radius: 50%; flex-shrink: 0; overflow: hidden; }
.staff-avatar {
  background: linear-gradient(135deg, #ff6b35, #ff4b3a);
  color: #fff; display: flex; align-items: center; justify-content: center; font-size: 40rpx;
}
.my-avatar { background: #ffd1cc; display: flex; align-items: center; justify-content: center; }
.my-avatar image { width: 100%; height: 100%; }
.bubble {
  max-width: 72%;
  padding: 18rpx 24rpx;
  border-radius: 28rpx;
  background: #fff;
  color: #1a1a1a;
  font-size: 30rpx;
  line-height: 1.5;
  word-break: break-word;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.05);
}
.theirs .bubble { border-top-left-radius: 8rpx; }
.mine .bubble { background: $brand; color: #fff; border-top-right-radius: 8rpx; }
.bubble.image { padding: 6rpx; background: transparent; box-shadow: none; }
.msg-img { display: block; width: 360rpx; border-radius: 24rpx; }

.input-bar {
  display: flex; align-items: center; gap: 16rpx;
  padding: 16rpx 24rpx;
  background: #fff; border-top: 2rpx solid #eee;
}
.ib-icon { flex-shrink: 0; width: 64rpx; text-align: center; font-size: 44rpx; }
.ib-icon.disabled { opacity: .4; }
.ib-input {
  flex: 1; height: 72rpx;
  background: #f5f6f8; border-radius: 36rpx;
  padding: 0 28rpx; font-size: 30rpx;
}
.ib-send {
  flex-shrink: 0;
  background: $brand; color: #fff;
  font-size: 28rpx; font-weight: 600;
  border-radius: 36rpx;
  padding: 16rpx 32rpx;
}
.ib-send.off { background: #ffc4bf; }
</style>
