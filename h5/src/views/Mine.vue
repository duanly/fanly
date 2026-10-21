<template>
  <div class="page">
    <NeedLogin
      v-if="!logged"
      title="登录后查看我的"
      desc="余额、提现、推广中心都在登录后可用"
    />

    <template v-else>
    <div style="background:linear-gradient(135deg,#ff6a3d,#ff3b30);padding:20px 16px 28px">
      <div style="display:flex;align-items:center;gap:12px;color:#fff" @click="openEditProfile">
        <div class="mine-avatar">
          <img v-if="p?.avatar" :src="p.avatar" alt="" />
          <span v-else>{{ avatarText }}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:18px;font-weight:700;display:flex;align-items:center;gap:6px">
            {{ p?.nickname || '—' }}
            <van-icon name="edit" size="14" />
          </div>
          <div style="opacity:.85;font-size:12px;margin-top:2px">
            {{ p?.mobile }}
            <span v-if="p?.bindAgent"> · 邀请人 {{ p.bindAgent.agentCode }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="wallet mine-wallet">
      <div class="sub">可提现余额（元）</div>
      <div class="big">{{ money(p?.balance) }}</div>
      <div class="wallet-cols">
        <div>
          <div class="n">{{ money(p?.pending) }}</div>
          <div class="sub">返利中</div>
        </div>
        <div>
          <div class="n">{{ money(p?.frozen) }}</div>
          <div class="sub">提现中</div>
        </div>
        <div>
          <div class="n">{{ money(p?.totalRebate) }}</div>
          <div class="sub">累计已返</div>
        </div>
      </div>
      <div class="wallet-month">
        <span>本月已到账 <b>{{ money(s?.monthEarned) }}</b></span>
        <span>本月已提现 <b>{{ money(s?.monthWithdraw) }}</b></span>
      </div>

      <div style="display:flex;gap:10px;margin-top:12px">
        <van-button
          block round size="small"
          style="background:#fff;color:#ff3b30;font-weight:600;border:none"
          @click="$router.push('/withdraw')"
        >提现</van-button>
        <van-button
          block round size="small"
          style="background:#fff;color:#ff3b30;border:none;font-weight:600"
          @click="$router.push('/withdraws')"
        >提现记录</van-button>
      </div>
    </div>

    <!-- 返利/分成比例 -->
    <div class="rate-card">
      <div class="rate-item">
        <div class="rate-num">{{ (p?.userRebateRate * 100).toFixed(0) }}%</div>
        <div class="rate-label">自购返利</div>
      </div>
      <div class="rate-divider"></div>
      <div class="rate-item">
        <div class="rate-num">{{ (p?.agentRate * 100).toFixed(0) }}%</div>
        <div class="rate-label">推广分成</div>
      </div>
    </div>

    <van-cell-group inset style="margin-bottom:12px">
      <van-cell title="资金明细" is-link icon="balance-list-o" to="/ledger" />
      <van-cell title="提现记录" is-link icon="after-sale" to="/withdraws" />
      <van-cell title="订单找回" is-link icon="search" to="/claim">
        <template #value><span class="muted">没返利？点这里</span></template>
      </van-cell>
      <van-cell title="我的订单" is-link icon="orders-o" to="/orders" />
      <van-cell title="签到领金币" is-link icon="gift-o" to="/checkin">
        <template #value>
          <span style="color:#ff4b3a;font-weight:600">{{ coinCount }} 金币</span>
        </template>
      </van-cell>
      <van-cell title="我的推广码" is-link icon="friends-o" to="/invite">
        <template #value>
          <span class="muted">{{ p?.inviteCode }}</span>
        </template>
      </van-cell>
      <van-cell
        v-if="!p?.bindAgent"
        title="填写邀请码"
        is-link
        icon="invition"
        @click="showBindInviter = true"
      >
        <template #value><span class="muted">去填写</span></template>
      </van-cell>
      <van-cell v-else title="我的邀请人" icon="manager-o">
        <template #value>{{ p.bindAgent.agentCode }}</template>
      </van-cell>
    </van-cell-group>

    <van-cell-group inset>
      <van-cell title="推广中心" is-link icon="gold-coin-o" to="/agent">
        <template #value>
          <AgentBadge v-if="p?.agentLevel != null" :level="p.agentLevel" mini />
          <span v-else class="muted">去看看</span>
        </template>
      </van-cell>
      <van-cell
        v-if="canShowAddDesktop"
        title="添加到桌面"
        is-link
        icon="desktop-o"
        @click="onAddToDesktop"
      >
        <template #value>
          <span class="muted">访问更方便</span>
        </template>
      </van-cell>
    </van-cell-group>

    <div style="padding:24px 16px">
      <van-button block round plain @click="logout">退出登录</van-button>
    </div>

    <!-- 编辑资料弹层 -->
    <van-popup v-model:show="showEditProfile" position="bottom" round :style="{ padding: '20px 20px 30px' }">
      <div style="font-size:17px;font-weight:700;margin-bottom:16px">编辑资料</div>

      <!-- 头像 -->
      <div style="text-align:center;margin-bottom:20px">
        <div class="edit-avatar" @click="chooseAvatar">
          <img v-if="editAvatar" :src="editAvatar" alt="" />
          <span v-else>{{ (editNickname || '昵称').slice(0, 1) }}</span>
          <div class="edit-avatar-camera">
            <van-icon v-if="!uploadingAvatar" name="photograph" size="14" color="#fff" />
            <van-loading v-else size="14" color="#fff" />
          </div>
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px">
          {{ uploadingAvatar ? '上传中...' : '点击更换头像' }}
        </div>
        <input
          ref="avatarInput"
          type="file"
          accept="image/*"
          style="display:none"
          @change="onAvatarChange"
        />
      </div>

      <!-- 昵称 -->
      <van-field
        v-model="editNickname"
        label="昵称"
        maxlength="20"
        placeholder="请输入昵称"
        :border="false"
        style="background:#f7f8fa;border-radius:10px;padding:0 12px;margin-bottom:16px"
      />

      <van-button
        block
        round
        type="primary"
        color="#ff4b3a"
        :loading="savingProfile"
        @click="saveProfile"
      >保存</van-button>
    </van-popup>

    <!-- 填写邀请码弹层 -->
    <van-popup v-model:show="showBindInviter" position="bottom" round :style="{ padding: '20px 20px 30px' }">
      <div style="font-size:17px;font-weight:700;margin-bottom:6px">填写邀请码</div>
      <div class="muted" style="font-size:12px;margin-bottom:16px">绑定后不可修改，请确认邀请码正确</div>
      <van-field
        v-model="inviteCodeInput"
        placeholder="请输入邀请码"
        maxlength="8"
        :border="false"
        style="background:#f7f8fa;border-radius:10px;padding:0 12px;margin-bottom:16px"
      />
      <van-button
        block
        round
        type="primary"
        color="#ff4b3a"
        :loading="bindingInviter"
        @click="doBindInviter"
      >确认绑定</van-button>
    </van-popup>

    <BeianFooter />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import { api } from '../api';
import NeedLogin from '../components/NeedLogin.vue';
import BeianFooter from '../components/BeianFooter.vue';
import AgentBadge from '../components/AgentBadge.vue';

const logged = ref(!!localStorage.getItem('token'));
const p = ref(null);
const s = ref(null);
const coinInfo = ref(null);
const showBindInviter = ref(false);
const inviteCodeInput = ref('');
const bindingInviter = ref(false);
const router = useRouter();
const money = (v) => (+(v || 0)).toFixed(2);

// ─── 添加到桌面 ───
const canInstall = ref(window.__pwaCanInstall || false);
let deferredPrompt = window.__pwaInstallPrompt || null;

// iOS 判断：Safari 浏览器且未安装 PWA
const isIOS = ref(false);

// 是否显示「添加到桌面」按钮：
// - iOS Safari 始终显示（引导手动添加）
// - Android：只要不是已安装为 PWA 模式就显示（即使 beforeinstallprompt 还没触发，也显示引导）
// - 已安装为独立窗口时不显示
const canShowAddDesktop = computed(() => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return false; // 已安装，不显示
  if (isIOS.value) return true;    // iOS 始终显示引导
  // Android：只要是浏览器环境就显示（不管 beforeinstallprompt 有没有）
  const ua = navigator.userAgent.toLowerCase();
  return /android/.test(ua) || canInstall.value;
});

function onPwaReady() {
  deferredPrompt = window.__pwaInstallPrompt;
  canInstall.value = true;
}

function onPwaChanged() {
  deferredPrompt = window.__pwaInstallPrompt;
  canInstall.value = window.__pwaCanInstall || false;
}

async function onAddToDesktop() {
  // Android / Chrome 等支持 PWA 安装提示的浏览器
  const prompt = window.__pwaInstallPrompt || deferredPrompt;
  if (prompt) {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      showToast('已添加到桌面');
    }
    window.__pwaInstallPrompt = null;
    window.__pwaCanInstall = false;
    deferredPrompt = null;
    canInstall.value = false;
    return;
  }

  // iOS Safari：显示引导提示
  if (isIOS.value) {
    showToast('点击底部分享按钮 → 添加到主屏幕');
    return;
  }

  // Android 但还没触发安装事件（可能是刚卸载、SW 还没注册好等）
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) {
    if (/chrome/.test(ua)) {
      showToast('请点击右上角 ⋮ → 安装应用');
    } else {
      showToast('请在浏览器菜单中选择「添加到桌面」');
    }
    return;
  }

  // 兜底：直接提示
  showToast('请在浏览器菜单中选择「添加到桌面」');
}

// 编辑资料
const showEditProfile = ref(false);
const editNickname = ref('');
const editAvatar = ref('');
const savingProfile = ref(false);
const uploadingAvatar = ref(false);
const avatarInput = ref(null);

function openEditProfile() {
  editNickname.value = p.value?.nickname || '';
  editAvatar.value = p.value?.avatar || '';
  showEditProfile.value = true;
}

function chooseAvatar() {
  avatarInput.value?.click();
}

function onAvatarChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('头像不能超过 2MB');
    return;
  }
  // 本地上传服务器
  const reader = new FileReader();
  reader.onload = (ev) => {
    editAvatar.value = ev.target?.result || ''; // 先显示本地预览
  };
  reader.readAsDataURL(file);
  // 上传到服务器
  uploadingAvatar.value = true;
  api.uploadAvatar(file).then((r) => {
    editAvatar.value = r.url;
  }).catch((err) => {
    showToast(err.message || '上传失败');
  }).finally(() => {
    uploadingAvatar.value = false;
  });
  e.target.value = '';
}

async function saveProfile() {
  const name = editNickname.value.trim();
  if (!name) return showToast('昵称不能为空');
  if (name.length > 20) return showToast('昵称最多 20 个字符');

  savingProfile.value = true;
  try {
    const payload = { nickname: name };
    // 只有头像真的变了才传（空字符串或 base64 不上传）
    if (editAvatar.value && !editAvatar.value.startsWith('data:')) {
      payload.avatar = editAvatar.value;
    }
    await api.updateProfile(payload);
    showToast('保存成功');
    showEditProfile.value = false;
    load();
  } catch (e) {
    showToast(e.message || '保存失败');
  } finally {
    savingProfile.value = false;
  }
}

// 头像文字：没有头像时取昵称前三个字
const avatarText = computed(() => {
  const name = p.value?.nickname || p.value?.mobile || '';
  return name.slice(0, 3);
});

// 金币数：优先从 coinStatus 取，兜底用 profile
const coinCount = computed(() => coinInfo.value?.coins ?? p.value?.coins ?? 0);

async function load() {
  if (!logged.value) return;
  p.value = await api.profile();
  // 概览接口挂了不该让整个「我的」白屏，余额从 profile 里已经有了
  try { s.value = await api.summary(); } catch { s.value = null; }
  // 金币单独查
  try { coinInfo.value = await api.coinStatus(); } catch { coinInfo.value = null; }
}

async function apply() {
  await showConfirmDialog({
    title: '申请成为推广员',
    message: '免费加盟。通过审核后你会拿到专属二维码，好友扫码注册即成为你的直属用户，他们的每笔订单你都有分成。',
  });
  await api.agentApply('');
  showToast('已提交，等待审核');
  load();
}

async function doBindInviter() {
  const code = inviteCodeInput.value.trim();
  if (!code) return showToast('请输入邀请码');
  bindingInviter.value = true;
  try {
    const r = await api.bindInviter(code);
    showToast('绑定成功');
    showBindInviter.value = false;
    inviteCodeInput.value = '';
    load();
  } finally {
    bindingInviter.value = false;
  }
}

function logout() {
  localStorage.removeItem('token');
  logged.value = false;
  p.value = null;
}

onMounted(() => {
  load();

  // 组件挂载时再检查一次全局状态（可能事件在挂载前就触发了）
  if (window.__pwaCanInstall) {
    canInstall.value = true;
    deferredPrompt = window.__pwaInstallPrompt;
  }

  // 兜底：SW 注册可能比较慢，beforeinstallprompt 可能延迟触发，轮询检查
  let checks = 0;
  const timer = setInterval(() => {
    checks++;
    if (window.__pwaCanInstall) {
      canInstall.value = true;
      deferredPrompt = window.__pwaInstallPrompt;
      clearInterval(timer);
    }
    if (checks > 30) clearInterval(timer); // 最多等 30 秒
  }, 1000);
});

// PWA 安装状态监听（全局事件，避免错过 beforeinstallprompt）
if (typeof window !== 'undefined') {
  window.addEventListener('pwa-install-ready', onPwaReady);
  window.addEventListener('pwa-install-changed', onPwaChanged);

  // iOS 检测
  const ua = navigator.userAgent.toLowerCase();
  const isIphone = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|crios|fxios|opios|edgios/.test(ua);
  isIOS.value = isIphone && isSafari && !window.matchMedia('(display-mode: standalone)').matches;
  // 已安装在独立模式运行时不显示
  if (window.matchMedia('(display-mode: standalone)').matches) {
    canInstall.value = false;
  }
}

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('pwa-install-ready', onPwaReady);
    window.removeEventListener('pwa-install-changed', onPwaChanged);
  }
});
</script>

<style scoped>
.mine-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255,255,255,.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}
.mine-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 编辑资料弹层 */
.edit-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff976a, #ff4b3a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  margin: 0 auto;
  overflow: hidden;
  position: relative;
}
.edit-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.edit-avatar-camera {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 22px;
  background: rgba(0,0,0,.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.muted { color: #999; }

/* 返利比例卡片 */
.rate-card {
  margin: -18px 16px 12px;
  background: #fff;
  border-radius: 12px;
  padding: 16px 0;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
  position: relative;
  z-index: 1;
}
.rate-item {
  flex: 1;
  text-align: center;
}
.rate-num {
  font-size: 22px;
  font-weight: 700;
  color: #ff4b3a;
  line-height: 1.2;
}
.rate-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
.rate-divider {
  width: 1px;
  height: 32px;
  background: #eee;
}
</style>
