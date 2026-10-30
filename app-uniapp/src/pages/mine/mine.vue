<template>
  <view class="page">
    <!-- 顶部资料卡 -->
    <view class="wallet">
      <view class="wallet-row" @click="goLoginIfNeeded">
        <image class="avatar" :src="profile?.avatar || defaultAvatar" mode="aspectFill" />
        <view class="who">
          <view class="nick">{{ profile?.nickname || (logged ? '未设置昵称' : '点击登录') }}</view>
          <view class="mobile">{{ profile?.mobile || '登录后查看返利和订单' }}</view>
        </view>
        <view v-if="logged" class="agent-tag" :class="levelTagClass">
          {{ levelName }}
        </view>
      </view>

      <view v-if="logged" class="stats">
        <view class="stat">
          <view class="num">{{ money(profile?.pending) }}</view>
          <view class="lbl">待结算</view>
        </view>
        <view class="stat">
          <view class="num">{{ money(profile?.totalRebate) }}</view>
          <view class="lbl">已到账</view>
        </view>
        <view class="stat">
          <view class="num">{{ coins }}</view>
          <view class="lbl">金币</view>
        </view>
      </view>
    </view>

    <!-- 功能入口 -->
    <view class="cell-group">
      <view class="cell" @click="go('/pages/orders/orders')">
        <text class="cell-ico">🧾</text>
        <text class="cell-name">我的订单</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="go('/pages/fund/balance')">
        <text class="cell-ico">💰</text>
        <text class="cell-name">资金明细</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="go('/pages/fund/withdraw')">
        <text class="cell-ico">🏦</text>
        <text class="cell-name">提现记录</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="go('/pages/fund/payment-method')">
        <text class="cell-ico">💳</text>
        <text class="cell-name">收款设置</text>
        <text class="cell-arrow">›</text>
      </view>
    </view>

    <view class="cell-group">
      <view class="cell" @click="go('/pages/checkin/checkin')">
        <text class="cell-ico">🎁</text>
        <text class="cell-name">每日签到领金币</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="go('/pages/agent/agent')">
        <text class="cell-ico">👥</text>
        <text class="cell-name">推广中心</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="go('/pages/agent/invite')">
        <text class="cell-ico">📨</text>
        <text class="cell-name">我的推广码</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="go('/pages/realname/realname')">
        <text class="cell-ico">🪪</text>
        <text class="cell-name">实名认证</text>
        <text class="cell-arrow">›</text>
      </view>
      <view class="cell" @click="go('/pages/support/support')">
        <text class="cell-ico">🎧</text>
        <text class="cell-name">联系客服</text>
        <text v-if="unread" class="unread-dot">{{ unread > 99 ? 99 : unread }}</text>
        <text class="cell-arrow">›</text>
      </view>
    </view>

    <button v-if="logged" class="logout" @click="logout">退出登录</button>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '../../store/user.js';
import { api } from '../../api/index.js';
import { money, displayRatePct } from '../../utils/format.js';

const userStore = useUserStore();
const logged = computed(() => userStore.isLoggedIn);
const profile = computed(() => userStore.profile);
const coins = ref(0);
const unread = ref(0);

const levelMap = ['预备', '白银', '黄金', '钻石'];
const levelName = computed(() => `${levelMap[profile.value?.agentLevel ?? 0] || '预备'}代理`);
const levelTagClass = computed(profile.value?.manualLevel ? 'manual' : '');
const defaultAvatar = '';

function go(url) {
  if (!logged.value) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  uni.navigateTo({ url });
}
function goLoginIfNeeded() {
  if (!logged.value) uni.navigateTo({ url: '/pages/login/login' });
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

onShow(async () => {
  if (logged.value) {
    await userStore.fetchProfile();
    try {
      const cs = await api.coinStatus();
      coins.value = cs.coins || 0;
    } catch {}
    try {
      const u = await api.supportUnread();
      unread.value = u.count || 0;
    } catch {}
  }
});
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 60rpx; }
.wallet {
  background: linear-gradient(135deg, #ff6b35, #ff4b3a);
  padding: calc(48rpx + var(--status-bar-height, 0rpx)) 32rpx 32rpx;
  color: #fff;
}
.wallet-row { display: flex; align-items: center; gap: 20rpx; }
.avatar {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
}
.who { flex: 1; min-width: 0; }
.nick { font-size: 36rpx; font-weight: 800; }
.mobile { font-size: 24rpx; opacity: 0.85; margin-top: 8rpx; }
.agent-tag {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  background: rgba(255, 255, 255, 0.25);
}
.agent-tag.manual { background: rgba(255, 255, 255, 0.45); }
.stats {
  display: flex;
  margin-top: 32rpx;
  padding-top: 28rpx;
  border-top: 2rpx solid rgba(255, 255, 255, 0.2);
}
.stat { flex: 1; text-align: center; }
.num { font-size: 40rpx; font-weight: 800; }
.lbl { font-size: 22rpx; opacity: 0.85; margin-top: 6rpx; }

.cell-group {
  margin: 20rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}
.cell {
  display: flex;
  align-items: center;
  padding: 28rpx 28rpx;
  border-bottom: 2rpx solid #f5f6f8;
}
.cell:last-child { border-bottom: none; }
.cell:active { background: #fafafa; }
.cell-ico { font-size: 36rpx; margin-right: 20rpx; }
.cell-name { flex: 1; font-size: 28rpx; color: #333; }
.cell-arrow { color: #ccc; font-size: 36rpx; }
.unread-dot {
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
.logout {
  margin: 40rpx 24rpx 0;
  height: 88rpx;
  line-height: 88rpx;
  background: #fff;
  color: $brand;
  border-radius: 999rpx;
  font-size: 30rpx;
}
</style>
