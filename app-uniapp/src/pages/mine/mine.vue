<template>
  <view class="page">
    <!-- ── 未登录：对齐 H5 NeedLogin ── -->
    <view v-if="!logged" class="need-login">
      <text class="nl-icon">👤</text>
      <view class="nl-title">登录后查看我的</view>
      <view class="nl-desc">余额、提现、推广中心都在登录后可用</view>
      <button class="nl-btn" @click="goLogin">立即登录</button>
    </view>

    <template v-else>
      <!-- ── 渐变头部（点击编辑资料） ── -->
      <view class="hero">
        <view class="hero-row" @click="openEditProfile">
          <view class="avatar">
            <image v-if="profile?.avatar" :src="resolveImg(profile.avatar)" mode="aspectFill" />
            <text v-else>{{ avatarText }}</text>
          </view>
          <view class="hero-info">
            <view class="nick-row">
              <text class="nick">{{ profile?.nickname || '—' }}</text>
              <text class="edit-ico">✏️</text>
            </view>
            <view class="mobile">
              <text>{{ profile?.mobile || '' }}</text>
              <text v-if="profile?.bindAgent"> · 邀请人 {{ profile.bindAgent.agentCode }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ── 钱包卡（浮动压住头部，对齐 H5 .mine-wallet） ── -->
      <view class="wallet-card">
        <view class="wc-sub">可提现余额（元）</view>
        <view class="wc-big">{{ money(profile?.balance) }}</view>
        <view class="wc-cols">
          <view class="wc-col">
            <view class="wc-n">{{ money(profile?.pending) }}</view>
            <view class="wc-l">返利中</view>
          </view>
          <view class="wc-col">
            <view class="wc-n">{{ money(profile?.frozen) }}</view>
            <view class="wc-l">提现中</view>
          </view>
          <view class="wc-col">
            <view class="wc-n">{{ money(profile?.totalRebate) }}</view>
            <view class="wc-l">累计已返</view>
          </view>
        </view>
        <view class="wc-month">
          <text>本月已到账 <text class="b">{{ money(summary?.monthEarned) }}</text></text>
          <text>本月已提现 <text class="b">{{ money(summary?.monthWithdraw) }}</text></text>
        </view>
        <view class="wc-btns">
          <button class="wc-btn" @click="go('/pages/fund/withdraw')">提现</button>
          <button class="wc-btn" @click="go('/pages/fund/withdraws')">提现记录</button>
        </view>
      </view>

      <!-- ── 团队待结算分成（白银及以上且有待结算才出现） ── -->
      <view
        v-if="profile?.agentLevel >= 1 && agentStats?.pendingBonus > 0"
        class="team-card"
        @click="go('/pages/agent/agent')"
      >
        <view class="tc-left">
          <text class="tc-ico">🪙</text>
          <view class="tc-info">
            <view class="tc-label">团队待结算分成</view>
            <view class="tc-desc">下线性待确认，结算后自动到账</view>
          </view>
        </view>
        <view class="tc-right">
          <text class="tc-amount">¥{{ money(agentStats?.pendingBonus) }}</text>
          <text class="tc-arrow">›</text>
        </view>
      </view>

      <!-- ── 返利 / 分成比例 ── -->
      <view class="rate-card">
        <view class="rate-item">
          <view class="rate-num">{{ displayRatePct(profile?.userRebateRate) }}%</view>
          <view class="rate-label">自购返利</view>
        </view>
        <view class="rate-divider"></view>
        <view class="rate-item">
          <view class="rate-num">{{ displayRatePct(profile?.agentRate) }}%</view>
          <view class="rate-label">推广分成</view>
        </view>
      </view>
      <view class="rate-note">
        返利与分成均按联盟每笔订单实际结算到平台的佣金 × 对应比例计算，实际以结算为准。
      </view>

      <!-- ── 功能入口 第一组 ── -->
      <view class="cell-group">
        <view class="cell" @click="go('/pages/support/support')">
          <text class="cell-ico">🎧</text>
          <text class="cell-name">联系客服</text>
          <text v-if="unread" class="unread-dot">{{ unread > 99 ? 99 : unread }}</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/fund/balance')">
          <text class="cell-ico">💰</text>
          <text class="cell-name">资金明细</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/fund/withdraws')">
          <text class="cell-ico">🏦</text>
          <text class="cell-name">提现记录</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/claim/claim')">
          <text class="cell-ico">🔍</text>
          <text class="cell-name">订单找回</text>
          <text class="cell-val muted">没返利？点这里</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/orders/orders')">
          <text class="cell-ico">🧾</text>
          <text class="cell-name">我的订单</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/checkin/checkin')">
          <text class="cell-ico">🎁</text>
          <text class="cell-name">签到领金币</text>
          <text class="cell-val coin-val">{{ coinCount }} 金币</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/agent/invite')">
          <text class="cell-ico">📨</text>
          <text class="cell-name">我的推广码</text>
          <text class="cell-val muted">{{ profile?.inviteCode }}</text>
          <text class="cell-arrow">›</text>
        </view>
        <view v-if="!profile?.bindAgent" class="cell" @click="openBindInviter">
          <text class="cell-ico">🎟️</text>
          <text class="cell-name">填写邀请码</text>
          <text class="cell-val muted">去填写</text>
          <text class="cell-arrow">›</text>
        </view>
        <view v-else class="cell">
          <text class="cell-ico">👤</text>
          <text class="cell-name">我的邀请人</text>
          <text class="cell-val">{{ profile.bindAgent.agentCode }}</text>
        </view>
      </view>

      <!-- ── 功能入口 第二组 ── -->
      <view class="cell-group">
        <view class="cell" @click="go('/pages/realname/realname')">
          <text class="cell-ico">🪪</text>
          <text class="cell-name">实名认证</text>
          <text v-if="realNameStatus === 2" class="tag tag-ok">已认证</text>
          <text v-else-if="realNameStatus === 1" class="tag tag-warn">审核中</text>
          <text v-else-if="realNameStatus === 3" class="tag tag-danger">已驳回</text>
          <text v-else class="cell-val muted">去认证</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/fund/payment-method')">
          <text class="cell-ico">💳</text>
          <text class="cell-name">收款设置</text>
          <text class="cell-val muted">{{ payMethodSet ? '已设置' : '去设置' }}</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/agent/agent')">
          <text class="cell-ico">🏅</text>
          <text class="cell-name">推广中心</text>
          <text v-if="profile?.agentLevel != null" class="agent-badge" :class="'lv' + profile.agentLevel">
            {{ levelMeta.icon }} {{ levelMeta.name }}
          </text>
          <text v-else class="cell-val muted">去看看</text>
          <text class="cell-arrow">›</text>
        </view>
        <view class="cell" @click="go('/pages/change-password/change-password')">
          <text class="cell-ico">🔑</text>
          <text class="cell-name">修改密码</text>
          <text class="cell-arrow">›</text>
        </view>
      </view>

      <button class="logout" @click="logout">退出登录</button>

      <!-- 备案主体（ICP 待新主体备案号下发后再补，对齐 H5 BeianFooter） -->
      <view class="beian">
        <view class="beian-who">耒阳市优辰网络科技有限公司</view>
      </view>

      <!-- ── 编辑资料弹层 ── -->
      <view v-if="showEditProfile" class="sheet-mask" @click="showEditProfile = false">
        <view class="sheet" @click.stop>
          <view class="sheet-title">编辑资料</view>

          <view class="edit-avatar-wrap">
            <view class="edit-avatar" @click="chooseAvatar">
              <image v-if="editAvatar" :src="resolveImg(editAvatar)" mode="aspectFill" />
              <text v-else>{{ (editNickname || '昵称').slice(0, 1) }}</text>
              <view class="edit-avatar-cam">
                <text v-if="!uploadingAvatar">📷</text>
                <text v-else>⏳</text>
              </view>
            </view>
            <view class="edit-avatar-hint">{{ uploadingAvatar ? '上传中...' : '点击更换头像' }}</view>
          </view>

          <input
            v-model="editNickname"
            class="sheet-input"
            maxlength="20"
            placeholder="请输入昵称"
            placeholder-class="sheet-ph"
          />
          <button class="sheet-btn" :loading="savingProfile" @click="saveProfile">保存</button>
        </view>
      </view>

      <!-- ── 填写邀请码弹层 ── -->
      <view v-if="showBindInviter" class="sheet-mask" @click="showBindInviter = false">
        <view class="sheet" @click.stop>
          <view class="sheet-title">填写邀请码</view>
          <view class="sheet-desc">绑定后不可修改，请确认邀请码正确</view>
          <input
            v-model="inviteCodeInput"
            class="sheet-input"
            maxlength="8"
            placeholder="请输入邀请码"
            placeholder-class="sheet-ph"
          />
          <button class="sheet-btn" :loading="bindingInviter" @click="doBindInviter">确认绑定</button>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '../../store/user.js';
import { api } from '../../api/index.js';
import { money, displayRatePct } from '../../utils/format.js';
import { resolveImg } from '../../utils/url.js';

const userStore = useUserStore();
const logged = computed(() => userStore.isLoggedIn);
const profile = computed(() => userStore.profile);

const summary = ref(null);
const coinInfo = ref(null);
const agentStats = ref(null);
const realNameStatus = ref(0);
const payMethodSet = ref(false);
const unread = ref(0);

// 代理等级（对齐 H5 AgentBadge 的 LEVELS）
const LEVELS = {
  0: { name: '预备代理', icon: '🎯' },
  1: { name: '白银代理', icon: '🥈' },
  2: { name: '黄金代理', icon: '🥇' },
  3: { name: '钻石代理', icon: '💎' },
};
const levelMeta = computed(() => LEVELS[profile.value?.agentLevel] || LEVELS[0]);

// 金币：coinStatus 优先，兜底 profile.coins
const coinCount = computed(() => coinInfo.value?.coins ?? profile.value?.coins ?? 0);

// 无头像时取昵称/手机号前三个字
const avatarText = computed(() => {
  const name = profile.value?.nickname || profile.value?.mobile || '';
  return name.slice(0, 3);
});

function go(url) {
  uni.navigateTo({ url });
}
function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' });
}

function logout() {
  uni.showModal({
    title: '确认退出？',
    success: (r) => {
      if (r.confirm) {
        userStore.logout();
        uni.showToast({ title: '已退出', icon: 'none' });
      }
    },
  });
}

// ─── 编辑资料 ───
const showEditProfile = ref(false);
const editNickname = ref('');
const editAvatar = ref('');
const savingProfile = ref(false);
const uploadingAvatar = ref(false);

function openEditProfile() {
  editNickname.value = profile.value?.nickname || '';
  editAvatar.value = profile.value?.avatar || '';
  showEditProfile.value = true;
}

function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      const file = res.tempFiles?.[0];
      if (file && file.size > 2 * 1024 * 1024) {
        uni.showToast({ title: '头像不能超过 2MB', icon: 'none' });
        return;
      }
      uploadingAvatar.value = true;
      try {
        const r = await api.uploadAvatar(res.tempFilePaths[0]);
        editAvatar.value = r.url;
      } catch (e) {
        uni.showToast({ title: e.message || '上传失败', icon: 'none' });
      } finally {
        uploadingAvatar.value = false;
      }
    },
  });
}

async function saveProfile() {
  const name = editNickname.value.trim();
  if (!name) return uni.showToast({ title: '昵称不能为空', icon: 'none' });
  if (name.length > 20) return uni.showToast({ title: '昵称最多 20 个字符', icon: 'none' });

  savingProfile.value = true;
  try {
    const payload = { nickname: name };
    // 只有头像真的变了（已是服务器 URL）才传，本地临时路径/base64 不传
    if (editAvatar.value && !editAvatar.value.startsWith('data:')) {
      payload.avatar = editAvatar.value;
    }
    await api.updateProfile(payload);
    uni.showToast({ title: '保存成功', icon: 'none' });
    showEditProfile.value = false;
    await userStore.fetchProfile();
  } catch (e) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' });
  } finally {
    savingProfile.value = false;
  }
}

// ─── 填写邀请码 ───
const showBindInviter = ref(false);
const inviteCodeInput = ref('');
const bindingInviter = ref(false);

function openBindInviter() {
  inviteCodeInput.value = '';
  showBindInviter.value = true;
}

async function doBindInviter() {
  const code = inviteCodeInput.value.trim();
  if (!code) return uni.showToast({ title: '请输入邀请码', icon: 'none' });
  bindingInviter.value = true;
  try {
    await api.bindInviter(code);
    uni.showToast({ title: '绑定成功', icon: 'none' });
    showBindInviter.value = false;
    inviteCodeInput.value = '';
    await userStore.fetchProfile();
  } catch (e) {
    uni.showToast({ title: e.message || '绑定失败', icon: 'none' });
  } finally {
    bindingInviter.value = false;
  }
}

async function load() {
  await userStore.fetchProfile();
  // 概览挂了不该让整页白屏，余额在 profile 里已有
  try { summary.value = await api.summary(); } catch { summary.value = null; }
  try { coinInfo.value = await api.coinStatus(); } catch { coinInfo.value = null; }
  // 代理业绩：普通用户无数据，静默
  if (profile.value?.agentId || profile.value?.agentLevel != null) {
    try { agentStats.value = await api.agentStats(); } catch { agentStats.value = null; }
  }
  // 实名 + 收款方式
  try {
    const pm = await api.getPaymentMethod();
    realNameStatus.value = pm.realNameStatus || 0;
    payMethodSet.value = !!(
      (pm.wechat?.realName && pm.wechat?.qrCode) ||
      (pm.alipay?.realName && pm.alipay?.qrCode)
    );
  } catch {
    realNameStatus.value = 0;
    payMethodSet.value = false;
  }
  // 客服未读
  try {
    const u = await api.supportUnread();
    unread.value = u.count || 0;
  } catch { unread.value = 0; }
}

onShow(() => { if (logged.value) load(); });
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 60rpx; }

/* ── 未登录 ── */
.need-login { padding: 200rpx 60rpx; text-align: center; }
.nl-icon {
  font-size: 112rpx;
  width: 160rpx;
  height: 160rpx;
  line-height: 160rpx;
  border-radius: 50%;
  background: #fff0ee;
  display: block;
  margin: 0 auto;
}
.nl-title { font-size: 34rpx; font-weight: 700; margin-top: 32rpx; color: #1a1a1a; }
.nl-desc { font-size: 26rpx; color: #999; margin-top: 16rpx; line-height: 1.7; }
.nl-btn {
  margin-top: 48rpx;
  width: 360rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 30rpx;
}
.nl-btn::after { border: none; }

/* ── 渐变头部 ── */
.hero {
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  padding: calc(48rpx + var(--status-bar-height, 0rpx)) 32rpx 64rpx;
}
.hero-row { display: flex; align-items: center; }
.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  color: #fff;
  font-size: 34rpx;
  font-weight: 600;
}
.avatar image { width: 100%; height: 100%; }
.hero-info { flex: 1; min-width: 0; margin-left: 24rpx; }
.nick-row { display: flex; align-items: center; }
.nick { font-size: 38rpx; font-weight: 700; color: #fff; }
.edit-ico { font-size: 26rpx; margin-left: 12rpx; }
.mobile { font-size: 24rpx; color: #fff; opacity: 0.85; margin-top: 8rpx; }

/* ── 钱包卡 ── */
.wallet-card {
  position: relative;
  z-index: 2;
  margin: -32rpx 24rpx 0;
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  border-radius: 24rpx;
  padding: 36rpx 32rpx;
  color: #fff;
  box-shadow: 0 16rpx 48rpx rgba(255, 59, 48, 0.25);
}
.wc-sub { font-size: 24rpx; opacity: 0.85; }
.wc-big { font-size: 64rpx; font-weight: 800; line-height: 1.2; margin-top: 4rpx; }
.wc-cols {
  display: flex;
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid rgba(255, 255, 255, 0.25);
}
.wc-col { flex: 1; text-align: center; }
.wc-n { font-size: 32rpx; font-weight: 700; }
.wc-l { font-size: 22rpx; opacity: 0.85; margin-top: 6rpx; }
.wc-month {
  display: flex;
  justify-content: space-between;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid rgba(255, 255, 255, 0.18);
  font-size: 24rpx;
  opacity: 0.9;
}
.wc-month .b { font-weight: 700; }
.wc-btns { display: flex; gap: 20rpx; margin-top: 28rpx; }
.wc-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  background: #fff;
  color: $brand;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 600;
  padding: 0;
}
.wc-btn::after { border: none; }

/* ── 团队待结算 ── */
.team-card {
  position: relative;
  z-index: 3;
  margin: -40rpx 32rpx 0;
  background: linear-gradient(135deg, #fff7e6 0%, #ffe8cc 100%);
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4rpx 24rpx rgba(255, 152, 0, 0.15);
}
.tc-left { display: flex; align-items: center; flex: 1; min-width: 0; }
.tc-ico { font-size: 44rpx; margin-right: 20rpx; }
.tc-label { font-size: 28rpx; font-weight: 600; color: #e67700; }
.tc-desc { font-size: 22rpx; color: #ffa94d; margin-top: 4rpx; }
.tc-right { display: flex; align-items: center; flex-shrink: 0; }
.tc-amount { font-size: 38rpx; font-weight: 700; color: #e67700; }
.tc-arrow { font-size: 32rpx; color: #f3c184; margin-left: 12rpx; }

/* ── 比例卡 ── */
.rate-card {
  position: relative;
  z-index: 1;
  margin: -36rpx 32rpx 0;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 0;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
}
.rate-item { flex: 1; text-align: center; }
.rate-num { font-size: 44rpx; font-weight: 700; color: $brand; line-height: 1.2; }
.rate-label { font-size: 24rpx; color: #999; margin-top: 8rpx; }
.rate-divider { width: 2rpx; height: 64rpx; background: #eee; }
.rate-note {
  margin: 16rpx 56rpx 24rpx;
  font-size: 20rpx;
  line-height: 1.6;
  color: #999;
  text-align: center;
}

/* ── 单元格分组 ── */
.cell-group {
  margin: 0 24rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}
.cell {
  display: flex;
  align-items: center;
  padding: 28rpx;
  border-bottom: 2rpx solid #f5f6f8;
}
.cell:last-child { border-bottom: none; }
.cell:active { background: #fafafa; }
.cell-ico { font-size: 36rpx; margin-right: 20rpx; }
.cell-name { font-size: 28rpx; color: #1a1a1a; }
.cell-val { font-size: 26rpx; color: #999; margin-left: auto; margin-right: 12rpx; }
.cell-arrow { color: #ccc; font-size: 36rpx; margin-left: auto; }
/* 有右侧元素时，auto 只留给该元素，箭头固定间距跟在后面
   （否则两个 margin-left:auto 会平分剩余空间，徽章被挤到中间） */
.cell-val + .cell-arrow,
.tag + .cell-arrow,
.agent-badge + .cell-arrow,
.unread-dot + .cell-arrow { margin-left: 0; }
.muted { color: #999; }
.coin-val { color: $brand; font-weight: 600; }
.unread-dot {
  margin-left: auto;
  margin-right: 12rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  padding: 0 8rpx;
  text-align: center;
  background: $brand;
  color: #fff;
  font-size: 20rpx;
  border-radius: 999rpx;
}

/* 实名状态标签 */
.tag {
  margin-left: auto;
  margin-right: 12rpx;
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  border: 2rpx solid;
}
.tag-ok { color: #07c160; border-color: #07c160; }
.tag-warn { color: #ff976a; border-color: #ff976a; }
.tag-danger { color: #ee0a24; border-color: #ee0a24; }

/* 代理徽章（对齐 H5 AgentBadge） */
.agent-badge {
  margin-left: auto;
  margin-right: 12rpx;
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  border: 2rpx solid #ffd5c2;
  background: linear-gradient(135deg, #fff5f0, #fff0e8);
  color: #ff6b35;
}
.agent-badge.lv0 { background: #f5f5f5; color: #999; border-color: #e5e5e5; }
.agent-badge.lv1 { background: linear-gradient(135deg, #f8f8f8, #ececec); color: #666; border-color: #d0d0d0; }
.agent-badge.lv2 { background: linear-gradient(135deg, #fff8e8, #ffefcc); color: #e6a23c; border-color: #f5dab1; }
.agent-badge.lv3 { background: linear-gradient(135deg, #e8f7ff, #d4efff); color: #00a8ff; border-color: #b3e0ff; }

/* ── 退出登录 / 备案 ── */
.logout {
  margin: 8rpx 24rpx 0;
  height: 88rpx;
  line-height: 88rpx;
  background: #fff;
  color: $brand;
  border-radius: 999rpx;
  font-size: 30rpx;
}
.logout::after { border: none; }
.beian { padding: 44rpx 32rpx 16rpx; text-align: center; }
.beian-who { font-size: 20rpx; color: #c0c2c6; line-height: 1.8; }

/* ── 底部弹层（与 home.vue 同一套约定） ── */
.sheet-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 300;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 40rpx 60rpx;
  animation: sheet-up 0.22s ease-out;
}
@keyframes sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.sheet-title { font-size: 34rpx; font-weight: 700; color: #1a1a1a; margin-bottom: 12rpx; }
.sheet-desc { font-size: 24rpx; color: #999; margin-bottom: 32rpx; }
.sheet-input {
  background: #f7f8fa;
  border-radius: 20rpx;
  padding: 24rpx;
  font-size: 28rpx;
  margin: 24rpx 0 32rpx;
}
.sheet-ph { color: #bbb; }
.sheet-btn {
  height: 88rpx;
  line-height: 88rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 30rpx;
}
.sheet-btn::after { border: none; }

/* 编辑资料弹层里的头像 */
.edit-avatar-wrap { text-align: center; margin: 24rpx 0 32rpx; }
.edit-avatar {
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff976a, #ff4b3a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  font-weight: 700;
  margin: 0 auto;
  overflow: hidden;
  position: relative;
}
.edit-avatar image { width: 100%; height: 100%; }
.edit-avatar-cam {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 44rpx;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}
.edit-avatar-hint { font-size: 24rpx; color: #999; margin-top: 16rpx; }
</style>
