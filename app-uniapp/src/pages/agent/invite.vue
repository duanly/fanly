<template>
  <view class="page">
    <!-- 等级卡片 -->
    <view class="level-card">
      <view class="lc-info">
        <view class="lc-badge">{{ LEVELS[p?.agentLevel ?? 0] || '预备' }}</view>
        <view class="lc-name">{{ p?.nickname }}</view>
        <view class="lc-code">邀请码：<text class="code">{{ p?.inviteCode }}</text></view>
      </view>
      <view v-if="qr" class="lc-qr"><image :src="qr.qrcode" mode="aspectFit" /></view>
    </view>

    <!-- 操作 -->
    <view class="action-row">
      <view class="act-btn" @click="copyLink"><text class="ai">🔗</text><text>复制链接</text></view>
      <view class="act-btn" @click="copyCode"><text class="ai">👥</text><text>复制邀请码</text></view>
      <view class="act-btn" @click="saveTip"><text class="ai">🖼️</text><text>保存二维码</text></view>
    </view>

    <!-- 升级进度 -->
    <view class="section-card">
      <view class="sec-title">团队推广已结算佣金</view>
      <view class="progress-bar"><view class="progress-fill" :style="{ width: progressPct + '%' }"></view></view>
      <view class="progress-text">
        <template v-if="stats?.levelRequest">
          <template v-if="stats.levelRequest.type === 1">⏳ 等级升级审核中…</template>
          <template v-else>⚠️ 等级调整审核中（宽限至 {{ fmtDate(stats.levelRequest.graceUntil) }}）</template>
        </template>
        <template v-else-if="stats?.nextLevel">
          距离 {{ { 1000: '黄金', 5000: '钻石' }[stats.nextLevel.needPerf] }} 还差 ¥{{ stats.nextLevel.gap }}
        </template>
        <template v-else>已达最高等级，继续加油！</template>
      </view>
      <view class="level-ladder">
        <view class="ladder-item done"><text class="ladder-ico">🥈</text><text class="ladder-name">白银</text><text class="ladder-num">已开通</text></view>
        <view class="ladder-item" :class="{ done: Number(stats?.perf ?? 0) >= 1000 }"><text class="ladder-ico">🥇</text><text class="ladder-name">黄金</text><text class="ladder-num">¥1000</text></view>
        <view class="ladder-item" :class="{ done: Number(stats?.perf ?? 0) >= 5000 }"><text class="ladder-ico">💎</text><text class="ladder-name">钻石</text><text class="ladder-num">¥5000</text></view>
      </view>
    </view>

    <!-- 数据 -->
    <view class="section-card">
      <view class="sec-head">
        <text class="sec-title">我的团队</text>
        <text class="sec-more" @click="goAgent">更多 ›</text>
      </view>
      <view class="stat-grid">
        <view class="stat-item"><view class="stat-num">{{ p?.inviteCount || 0 }}</view><view class="stat-label">直属好友</view></view>
        <view class="stat-item"><view class="stat-num">{{ team.total }}</view><view class="stat-label">团队总人数</view></view>
        <view class="stat-item">
          <view class="stat-num" v-if="p?.isAgent">{{ stats?.orderCount || 0 }}</view>
          <view class="stat-num muted" v-else>—</view>
          <view class="stat-label">有效订单</view>
        </view>
        <view class="stat-item">
          <view class="stat-num" v-if="p?.isAgent">¥{{ stats?.creditedBonus || '0.00' }}</view>
          <view class="stat-num muted" v-else>—</view>
          <view class="stat-label">已赚分成</view>
        </view>
      </view>
    </view>

    <!-- 最近加入 -->
    <view class="section-card">
      <view class="sec-title">最近加入</view>
      <view v-if="team.list?.length">
        <view v-for="u in team.list.slice(0, 5)" :key="u.id" class="team-item">
          <view class="ti-avatar">{{ (u.nickname || '').slice(0, 1) }}</view>
          <view class="ti-info">
            <view class="ti-name">{{ u.nickname }}</view>
            <view class="ti-mobile muted">{{ u.mobile }}</view>
          </view>
          <view class="ti-rebate muted">贡献 ¥{{ money(u.totalRebate) }}</view>
        </view>
      </view>
      <view v-else class="empty">还没有人加入，快去分享吧～</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { money } from '../../utils/format.js';

const LEVELS = ['预备', '白银', '黄金', '钻石'];
const p = ref(null);
const qr = ref(null);
const team = ref({ list: [], total: 0 });
const stats = ref(null);

function fmtDate(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const progressPct = computed(() => {
  const perf = Number(stats.value?.perf ?? 0);
  if (perf >= 1000) return 100;
  return Math.min(100, (perf / 1000) * 100);
});

async function load() {
  try {
    const [profile, qrData, teamData] = await Promise.all([
      api.profile(),
      api.agentInviteQrcode(),
      api.agentTeam({ page: 1, pageSize: 10 }),
    ]);
    p.value = profile;
    qr.value = qrData;
    team.value = teamData;
    try { stats.value = await api.agentStats(); } catch { stats.value = null; }
  } catch {}
}

function copyLink() {
  if (!qr.value?.url) return;
  uni.setClipboardData({ data: qr.value.url });
}
function copyCode() {
  if (!p.value?.inviteCode) return;
  uni.setClipboardData({
    data: p.value.inviteCode,
    success: () => uni.showToast({ title: '邀请码已复制', icon: 'none' }),
  });
}
function saveTip() {
  uni.showToast({ title: '长按二维码图片即可保存', icon: 'none' });
}
function goAgent() { uni.navigateTo({ url: '/pages/agent/agent' }); }

onShow(load);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding: 24rpx 0 40rpx; }
.level-card {
  position: relative; margin: 0 24rpx 24rpx; padding: 40rpx;
  border-radius: 32rpx; background: #fff; display: flex; gap: 32rpx; align-items: center;
}
.lc-info { flex: 1; min-width: 0; }
.lc-badge { display: inline-block; font-size: 22rpx; color: $brand; background: #fff0ec; padding: 4rpx 16rpx; border-radius: 999rpx; }
.lc-name { font-size: 36rpx; font-weight: 700; margin-top: 16rpx; color: #1a1a1a; }
.lc-code { font-size: 26rpx; color: #666; margin-top: 12rpx; }
.lc-code .code { color: $brand; letter-spacing: 4rpx; font-size: 30rpx; font-weight: 700; }
.lc-qr { width: 200rpx; height: 200rpx; flex: none; }
.lc-qr image { width: 100%; height: 100%; }

.action-row { display: flex; justify-content: space-around; background: #fff; margin: 0 24rpx 24rpx; border-radius: 24rpx; padding: 28rpx 0; }
.act-btn { display: flex; flex-direction: column; align-items: center; gap: 8rpx; font-size: 24rpx; color: #666; }
.act-btn .ai { font-size: 44rpx; }

.section-card { background: #fff; margin: 0 24rpx 24rpx; border-radius: 24rpx; padding: 32rpx; }
.sec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; }
.sec-title { font-size: 30rpx; font-weight: 600; color: #1a1a1a; margin-bottom: 24rpx; }
.sec-head .sec-title { margin-bottom: 0; }
.sec-more { font-size: 24rpx; color: #999; }
.progress-bar { height: 16rpx; background: #f0f0f0; border-radius: 999rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #ff4b3a, #ff976a); border-radius: 999rpx; min-width: 8rpx; }
.progress-text { font-size: 24rpx; color: #666; margin-top: 16rpx; text-align: right; }
.level-ladder { display: flex; justify-content: space-between; margin-top: 32rpx; padding-top: 28rpx; border-top: 2rpx dashed #eee; }
.ladder-item { display: flex; flex-direction: column; align-items: center; gap: 8rpx; opacity: .4; }
.ladder-item.done { opacity: 1; }
.ladder-ico { font-size: 48rpx; }
.ladder-name { font-size: 24rpx; color: #666; }
.ladder-num { font-size: 22rpx; color: #999; }
.ladder-item.done .ladder-name { color: $brand; }

.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; text-align: center; }
.stat-num { font-size: 32rpx; font-weight: 700; color: $brand; }
.stat-num.muted { color: #ccc; font-weight: 400; }
.stat-label { font-size: 22rpx; color: #999; margin-top: 8rpx; }

.team-item { display: flex; align-items: center; gap: 20rpx; padding: 16rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.team-item:last-child { border-bottom: none; }
.ti-avatar {
  width: 72rpx; height: 72rpx; border-radius: 50%;
  background: linear-gradient(135deg, #ff976a, #ff4b3a); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 600; flex: none;
}
.ti-info { flex: 1; min-width: 0; }
.ti-name { font-size: 28rpx; color: #333; }
.ti-mobile { font-size: 22rpx; margin-top: 4rpx; }
.ti-rebate { font-size: 24rpx; flex: none; }
.empty { color: #999; font-size: 24rpx; text-align: center; padding: 32rpx 0; }
.muted { color: #999; }
</style>
