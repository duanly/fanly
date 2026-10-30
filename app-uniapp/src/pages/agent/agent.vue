<template>
  <view class="page">
    <!-- 等级卡片 -->
    <view class="wallet">
      <view class="w-top">
        <view>
          <view class="w-badge">{{ levelName }}</view>
          <view class="w-name">{{ p?.nickname }}</view>
          <view class="w-code">推广码 {{ p?.inviteCode }}</view>
        </view>
        <view v-if="qr" class="w-qr" @click="goInvite">
          <image :src="qr.qrcode" mode="aspectFit" />
          <view class="w-qr-tip">点击查看</view>
        </view>
      </view>

      <view class="progress-wrap">
        <view class="p-head"><text>团队推广已结算佣金</text></view>
        <view class="p-bar"><view class="p-fill" :style="{ width: progressPct + '%' }"></view></view>
        <view v-if="s?.levelRequest" class="p-text">
          <template v-if="s.levelRequest.type === 1">
            ⏳ 升级「{{ levelNameOf(s.levelRequest.toLevel) }}」审核中…
          </template>
          <template v-else>
            ⚠️ 等级调整审核中（宽限至 {{ fmtDate(s.levelRequest.graceUntil) }}，冲刺业绩可保留等级）
          </template>
        </view>
        <view v-else class="p-text">
          <template v-if="s?.nextLevel">
            距离 {{ levelNameOfPerf(s.nextLevel.needPerf) }} 还差 ¥{{ s.nextLevel.gap }} 团队推广已结算佣金
          </template>
          <template v-else>已达最高等级，继续加油！</template>
        </view>
        <view class="p-ladder">
          <view class="li done"><text class="li-ico">🥈</text><text class="li-name">白银</text><text class="li-num">已开通</text></view>
          <view class="li" :class="{ done: Number(s?.perf ?? 0) >= 1000 }"><text class="li-ico">🥇</text><text class="li-name">黄金</text><text class="li-num">¥1000</text></view>
          <view class="li" :class="{ done: Number(s?.perf ?? 0) >= 5000 }"><text class="li-ico">💎</text><text class="li-name">钻石</text><text class="li-num">¥5000</text></view>
        </view>
        <view class="p-note">分成按每笔订单联盟实际结算到平台的佣金 × 你的分成比例计算</view>
      </view>
    </view>

    <!-- 团队数据 -->
    <view class="stat-row">
      <view><view class="n">{{ p?.inviteCount || 0 }}</view><view class="l">直属好友</view></view>
      <view><view class="n">{{ team.total }}</view><view class="l">团队总人数</view></view>
      <view>
        <view class="n" v-if="p?.isAgent">{{ s?.orderCount || 0 }}</view>
        <view class="n muted" v-else>—</view>
        <view class="l">有效订单</view>
      </view>
      <view>
        <view class="n price" v-if="p?.isAgent">{{ money(s?.gmv) }}</view>
        <view class="n muted" v-else>—</view>
        <view class="l">团队 GMV</view>
      </view>
    </view>

    <!-- 代理专属 -->
    <template v-if="p?.isAgent && s">
      <view class="l2-card">
        <view class="l2-head">
          <text class="t">二级团队</text>
          <text class="r">分成 {{ displayRatePct(s.rateL2) }}%</text>
        </view>
        <view class="l2-nums">
          <view><text class="b">{{ s.subAgentCount ?? 0 }}</text><text class="sp">我发展的代理</text></view>
          <view><text class="b">{{ s.teamSizeL2 ?? 0 }}</text><text class="sp">他们带来的用户</text></view>
        </view>
        <view class="l2-tip">你拉的人自己也成了代理，他团队的订单你同样能分一笔。</view>
        <view v-if="s.rateL2Manual" class="l2-progress manual">分成比例由管理员单独配置</view>
        <view v-else-if="s.l2Next" class="l2-progress">
          二级团队再产生 ¥{{ s.l2Next.gap }} 已结算佣金，分成提升到 {{ displayRatePct(s.l2Next.rate) }}%
        </view>
        <view v-else class="l2-progress">已达最高档，分成 {{ displayRatePct(s.rateL2) }}%</view>
      </view>

      <view class="stat-row">
        <view><view class="n price">{{ money(s.creditedBonus) }}</view><view class="l">已入账分成</view></view>
        <view><view class="n" style="color:#ff976a">{{ money(s.pendingBonus) }}</view><view class="l">待结算</view></view>
        <view><view class="n" style="color:#999">{{ money(s.reversedBonus) }}</view><view class="l">已冲销</view></view>
      </view>
    </template>
    <view v-else class="upgrade-tip">
      <text>🔥</text>
      <text>成为代理后按推广业绩升级：团队推广已结算佣金满 ¥1000 升黄金、满 ¥5000 升钻石</text>
    </view>

    <!-- 二维码 -->
    <view class="qr-card">
      <image v-if="qr" :src="qr.qrcode" class="qr-img" mode="aspectFit" />
      <view v-else class="qr-loading">加载中…</view>
      <view class="qr-url muted">{{ qr?.url }}</view>
      <view class="qr-actions">
        <view class="qr-btn primary" @click="copyLink">复制推广链接</view>
        <view class="qr-btn plain" @click="goInvite">查看详情</view>
      </view>
    </view>

    <!-- 团队 -->
    <view class="section-title" @click="goTeam">我的团队（{{ team.total }} 人）›</view>
    <view v-if="team.list?.length" class="team-card">
      <view v-for="u in team.list" :key="u.id" class="team-row">
        <view class="t-name">{{ u.nickname }}</view>
        <view class="t-sub">
          <text>{{ u.mobile }}</text>
          <text v-if="u.agentLevel >= 1" class="t-badge">{{ levelNameOf(u.agentLevel) }}</text>
          <text v-else class="t-normal">普通</text>
        </view>
        <view class="t-rebate muted">贡献 ¥{{ money(u.totalRebate) }}</view>
      </view>
    </view>
    <view v-else class="empty">还没有人扫你的码</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { money, displayRatePct } from '../../utils/format.js';

const p = ref(null);
const s = ref(null);
const qr = ref(null);
const team = ref({ list: [], total: 0 });

const LEVELS = ['预备', '白银', '黄金', '钻石'];
const levelName = computed(() => LEVELS[p.value?.agentLevel ?? 0] || '预备');
const levelNameOf = (lv) => LEVELS[lv] || '预备';
const levelNameOfPerf = (perf) => ({ 1000: '黄金', 5000: '钻石' }[perf] || '下一级');

function fmtDate(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const progressPct = computed(() => {
  const perf = Number(s.value?.perf ?? 0);
  if (perf >= 1000) return 100;
  return Math.min(100, (perf / 1000) * 100);
});

async function load() {
  try {
    const [profile, qrData, teamData] = await Promise.all([
      api.profile(),
      api.agentInviteQrcode(),
      api.agentTeam({ page: 1, pageSize: 20 }),
    ]);
    p.value = profile;
    qr.value = qrData;
    team.value = teamData;
    try { s.value = await api.agentStats(); } catch { s.value = null; }
  } catch {}
}

function copyLink() {
  if (!qr.value?.url) return;
  uni.setClipboardData({
    data: qr.value.url,
    success: () => uni.showToast({ title: '链接已复制', icon: 'none' }),
  });
}
function goInvite() { uni.navigateTo({ url: '/pages/agent/invite' }); }
function goTeam() { uni.navigateTo({ url: '/pages/agent/team' }); }

onShow(load);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.wallet { background: linear-gradient(135deg, #ff6a3d, #ff3b30); color: #fff; padding: 40rpx 32rpx 36rpx; }
.w-top { display: flex; justify-content: space-between; align-items: flex-start; }
.w-badge {
  display: inline-block;
  padding: 4rpx 16rpx;
  font-size: 22rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 999rpx;
}
.w-name { font-size: 36rpx; font-weight: 700; margin-top: 16rpx; }
.w-code { font-size: 22rpx; opacity: .85; margin-top: 8rpx; letter-spacing: 2rpx; }
.w-qr { width: 144rpx; height: 144rpx; background: #fff; border-radius: 16rpx; padding: 8rpx; text-align: center; }
.w-qr image { width: 100%; height: 104rpx; border-radius: 8rpx; }
.w-qr-tip { font-size: 18rpx; color: #999; margin-top: 4rpx; }

.progress-wrap { background: rgba(255, 255, 255, .15); border-radius: 24rpx; padding: 24rpx 28rpx; margin-top: 32rpx; }
.p-head { font-size: 26rpx; font-weight: 600; }
.p-bar { height: 12rpx; background: rgba(255, 255, 255, .3); border-radius: 999rpx; margin-top: 16rpx; overflow: hidden; }
.p-fill { height: 100%; background: #fff; border-radius: 999rpx; min-width: 6rpx; }
.p-text { font-size: 22rpx; opacity: .88; margin-top: 12rpx; text-align: right; }
.p-ladder { display: flex; justify-content: space-between; margin-top: 24rpx; padding-top: 20rpx; border-top: 2rpx solid rgba(255, 255, 255, .2); }
.li { display: flex; flex-direction: column; align-items: center; gap: 4rpx; opacity: .5; }
.li.done { opacity: 1; }
.li-ico { font-size: 40rpx; }
.li-name { font-size: 22rpx; }
.li-num { font-size: 20rpx; opacity: .8; }
.li.done .li-name { font-weight: 700; }
.p-note { margin-top: 20rpx; font-size: 20rpx; line-height: 1.6; color: rgba(255, 255, 255, .72); }

.stat-row { display: flex; background: #fff; margin: 24rpx; border-radius: 24rpx; padding: 28rpx 0; }
.stat-row > view { flex: 1; text-align: center; border-right: 2rpx solid #f0f0f0; }
.stat-row > view:last-child { border-right: none; }
.n { font-size: 36rpx; font-weight: 700; color: #1a1a1a; }
.n.muted { color: #ccc; font-weight: 400; }
.n.price { color: $brand; }
.l { font-size: 22rpx; color: #999; margin-top: 8rpx; }

.l2-card { background: linear-gradient(135deg, #4a3aff, #7b3ad5); color: #fff; margin: 0 24rpx 24rpx; border-radius: 24rpx; padding: 28rpx 32rpx; }
.l2-head { display: flex; justify-content: space-between; align-items: baseline; }
.l2-head .t { font-size: 30rpx; font-weight: 700; }
.l2-head .r { font-size: 22rpx; background: rgba(255, 255, 255, .22); border-radius: 999rpx; padding: 4rpx 20rpx; }
.l2-nums { display: flex; margin-top: 24rpx; }
.l2-nums > view { flex: 1; }
.l2-nums .b { font-size: 44rpx; font-weight: 800; display: block; }
.l2-nums .sp { font-size: 22rpx; opacity: .88; }
.l2-tip { font-size: 22rpx; opacity: .85; margin-top: 20rpx; line-height: 1.6; }
.l2-progress { margin-top: 20rpx; padding: 14rpx 24rpx; font-size: 24rpx; background: rgba(255, 255, 255, .15); border-radius: 16rpx; }
.l2-progress.manual { opacity: .8; font-size: 22rpx; }

.upgrade-tip {
  background: #fff8f5; margin: 0 24rpx 24rpx; padding: 24rpx 28rpx; border-radius: 20rpx;
  font-size: 26rpx; color: #ff6b35; display: flex; align-items: center; gap: 16rpx;
}
.section-title { font-size: 28rpx; font-weight: 600; color: #333; padding: 8rpx 32rpx 16rpx; }
.qr-card { background: #fff; margin: 0 24rpx 24rpx; border-radius: 24rpx; padding: 40rpx; text-align: center; }
.qr-img { width: 360rpx; height: 360rpx; margin: 0 auto; }
.qr-loading { height: 360rpx; line-height: 360rpx; color: #999; }
.qr-url { margin-top: 20rpx; font-size: 22rpx; word-break: break-all; }
.qr-actions { display: flex; gap: 20rpx; justify-content: center; margin-top: 28rpx; }
.qr-btn { padding: 14rpx 36rpx; border-radius: 999rpx; font-size: 26rpx; }
.qr-btn.primary { background: $brand; color: #fff; }
.qr-btn.plain { border: 2rpx solid $brand; color: $brand; }
.team-card { background: #fff; margin: 0 24rpx; border-radius: 24rpx; padding: 0 28rpx; }
.team-row { padding: 24rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.team-row:last-child { border-bottom: none; }
.t-name { font-size: 28rpx; color: #333; }
.t-sub { font-size: 22rpx; color: #999; margin-top: 8rpx; display: flex; align-items: center; gap: 12rpx; }
.t-badge { background: #fff0ec; color: $brand; border-radius: 6rpx; padding: 2rpx 10rpx; font-size: 20rpx; }
.t-normal { font-size: 20rpx; color: #bbb; }
.t-rebate { font-size: 22rpx; margin-top: 8rpx; }
.empty { text-align: center; color: #999; font-size: 24rpx; padding: 40rpx; }
.muted { color: #999; }
</style>
