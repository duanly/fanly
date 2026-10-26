<template>
  <div class="invite-page">
    <van-nav-bar title="我的推广码" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-loading v-if="loading" style="padding:80px;text-align:center" />

    <template v-else>
      <!-- 顶部等级卡片 -->
      <div class="level-card">
        <div class="lc-bg"></div>
        <div class="lc-info">
          <AgentBadge :level="p?.agentLevel ?? 0" />
          <div class="lc-name">{{ p?.nickname }}</div>
          <div class="lc-code">邀请码：<b>{{ p?.inviteCode }}</b></div>
        </div>
        <div class="lc-qr" v-if="qr">
          <img :src="qr.qrcode" alt="推广二维码" />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-row">
        <div class="act-btn" @click="copyLink">
          <van-icon name="wap-nav" size="22" color="#ff4b3a" />
          <span>复制链接</span>
        </div>
        <div class="act-btn" @click="copyCode">
          <van-icon name="friends-o" size="22" color="#ff4b3a" />
          <span>复制邀请码</span>
        </div>
        <div class="act-btn" @click="saveTip">
          <van-icon name="photograph" size="22" color="#ff4b3a" />
          <span>保存二维码</span>
        </div>
      </div>

      <!-- 升级进度：按近90天已结算佣金（合规：只挂业绩不挂人头） -->
      <div class="section-card">
        <div class="sec-head">
          <span class="sec-title">团队推广已结算佣金</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <div class="progress-text">
          <template v-if="stats?.levelRequest">
            <template v-if="stats.levelRequest.type === 1">⏳ 等级升级审核中…</template>
            <template v-else>⚠️ 等级调整审核中（宽限至 {{ fmtDate(stats.levelRequest.graceUntil) }}）</template>
          </template>
          <template v-else-if="stats?.nextLevel">
            距离 <b>{{ levelNames[stats.nextLevel.needPerf] }}</b> 还差 ¥{{ stats.nextLevel.gap }} 团队推广已结算佣金
          </template>
          <template v-else>
            已达最高等级，继续加油！
          </template>
        </div>
        <div class="level-ladder">
          <div class="ladder-item done">
            <span class="ladder-ico">🥈</span>
            <span class="ladder-name">白银</span>
            <span class="ladder-num">已开通</span>
          </div>
          <div class="ladder-item" :class="{ done: Number(stats?.perf ?? 0) >= 1000 }">
            <span class="ladder-ico">🥇</span>
            <span class="ladder-name">黄金</span>
            <span class="ladder-num">¥1000</span>
          </div>
          <div class="ladder-item" :class="{ done: Number(stats?.perf ?? 0) >= 5000 }">
            <span class="ladder-ico">💎</span>
            <span class="ladder-name">钻石</span>
            <span class="ladder-num">¥5000</span>
          </div>
        </div>
      </div>

      <!-- 数据概览 -->
      <div class="section-card">
        <div class="sec-head">
          <span class="sec-title">我的团队</span>
          <span class="sec-more" @click="$router.push('/agent')">
            更多 <van-icon name="arrow" size="10" />
          </span>
        </div>
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-num">{{ p?.inviteCount || 0 }}</div>
            <div class="stat-label">直属好友</div>
          </div>
          <div class="stat-item">
            <div class="stat-num">{{ team.total }}</div>
            <div class="stat-label">团队总人数</div>
          </div>
          <div class="stat-item">
            <div class="stat-num" v-if="p?.isAgent">{{ stats?.orderCount || 0 }}</div>
            <div class="stat-num muted" v-else>—</div>
            <div class="stat-label">有效订单</div>
          </div>
          <div class="stat-item">
            <div class="stat-num" v-if="p?.isAgent">¥{{ stats?.creditedBonus || '0.00' }}</div>
            <div class="stat-num muted" v-else>—</div>
            <div class="stat-label">已赚分成</div>
          </div>
        </div>
      </div>

      <!-- 团队列表 -->
      <div class="section-card">
        <div class="sec-head">
          <span class="sec-title">最近加入</span>
        </div>
        <div v-if="team.list?.length" class="team-list">
          <div v-for="u in team.list.slice(0, 5)" :key="u.id" class="team-item">
            <div class="ti-avatar">{{ (u.nickname || '').slice(0, 1) }}</div>
            <div class="ti-info">
              <div class="ti-name">{{ u.nickname }}</div>
              <div class="ti-mobile muted">{{ u.mobile }}</div>
            </div>
            <div class="ti-rebate muted">
              贡献 ¥{{ (+(u.totalRebate || 0)).toFixed(2) }}
            </div>
          </div>
        </div>
        <van-empty v-else description="还没有人加入，快去分享吧～" />
      </div>

      <div style="height:20px" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { showToast } from 'vant';
import { api } from '../api';
import AgentBadge from '../components/AgentBadge.vue';

const loading = ref(true);
const p = ref(null);
const qr = ref(null);
const team = ref({ list: [], total: 0 });
const stats = ref(null);

// 下一档名称查表：needPerf → 名称
const levelNames = { 1000: '黄金', 5000: '钻石' };
function fmtDate(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 进度：近90天佣金相对黄金门槛（¥1000）的占比，到黄金即满
const progressPct = computed(() => {
  const perf = Number(stats.value?.perf ?? 0);
  if (perf >= 1000) return 100;
  return Math.min(100, (perf / 1000) * 100);
});

async function load() {
  loading.value = true;
  try {
    const [profile, qrData, teamData] = await Promise.all([
      api.profile(),
      api.agentInviteQrcode(),
      api.agentTeam({ page: 1, pageSize: 10 }),
    ]);
    p.value = profile;
    qr.value = qrData;
    team.value = teamData;

    // 业绩数据人人可取（后端按近90天已结算佣金返回；未成为正式代理时为 0）
    try { stats.value = await api.agentStats(); } catch { stats.value = null; }
  } finally {
    loading.value = false;
  }
}

function copyLink() {
  if (!qr.value?.url) return;
  navigator.clipboard.writeText(qr.value.url).then(() => {
    showToast('链接已复制');
  }).catch(() => {
    showToast('复制失败，请长按二维码保存');
  });
}

function copyCode() {
  if (!p.value?.inviteCode) return;
  navigator.clipboard.writeText(p.value.inviteCode).then(() => {
    showToast('邀请码已复制');
  }).catch(() => {
    showToast('复制失败');
  });
}

function saveTip() {
  showToast('长按图片即可保存到相册');
}

onMounted(load);
</script>

<style scoped>
.invite-page {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 20px;
}

/* 等级卡片 */
.level-card {
  position: relative;
  margin: 12px;
  padding: 20px;
  border-radius: 16px;
  background: #fff;
  overflow: hidden;
  display: flex;
  gap: 16px;
  align-items: center;
}
.lc-bg {
  position: absolute;
  top: -30px;
  right: -30px;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, rgba(255, 75, 58, 0.08) 0%, transparent 70%);
  border-radius: 50%;
}
.lc-info {
  flex: 1;
  position: relative;
  z-index: 1;
}
.lc-name {
  font-size: 18px;
  font-weight: 700;
  margin-top: 8px;
  color: #1a1a1a;
}
.lc-code {
  font-size: 13px;
  color: #666;
  margin-top: 6px;
}
.lc-code b {
  color: #ff4b3a;
  letter-spacing: 2px;
  font-size: 15px;
}
.lc-qr {
  width: 100px;
  height: 100px;
  flex: none;
  position: relative;
  z-index: 1;
}
.lc-qr img {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  display: block;
}

/* 操作按钮 */
.action-row {
  display: flex;
  justify-content: space-around;
  background: #fff;
  margin: 0 12px 12px;
  border-radius: 12px;
  padding: 14px 0;
}
.act-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
}
.act-btn:active { opacity: 0.6; }

/* 通用卡片 */
.section-card {
  background: #fff;
  margin: 0 12px 12px;
  border-radius: 12px;
  padding: 16px;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.sec-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}
.sec-count {
  font-size: 14px;
  color: #ff4b3a;
  font-weight: 600;
}
.sec-more {
  font-size: 12px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 升级进度 */
.progress-bar {
  height: 8px;
  background: #f0f0f0;
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff4b3a, #ff976a);
  border-radius: 999px;
  transition: width 0.3s;
  min-width: 4px;
}
.progress-text {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
  text-align: right;
}
.progress-text b {
  color: #ff4b3a;
}
.level-ladder {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed #eee;
}
.ladder-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.3s;
}
.ladder-item.done {
  opacity: 1;
}
.ladder-ico {
  font-size: 24px;
}
.ladder-name {
  font-size: 12px;
  color: #666;
}
.ladder-num {
  font-size: 11px;
  color: #999;
}
.ladder-item.done .ladder-name {
  color: #ff4b3a;
  font-weight: 500;
}

/* 数据概览 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  text-align: center;
}
.stat-item .stat-num {
  font-size: 16px;
  font-weight: 700;
  color: #ff4b3a;
}
.stat-item .stat-num.muted {
  color: #ccc;
  font-weight: 400;
}
.stat-item .stat-label {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

/* 团队列表 */
.team-list {
  margin: 0 -4px;
}
.team-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid #f5f5f5;
}
.team-item:last-child { border-bottom: none; }
.ti-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff976a, #ff4b3a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex: none;
}
.ti-info {
  flex: 1;
  min-width: 0;
}
.ti-name {
  font-size: 14px;
  color: #333;
}
.ti-mobile {
  font-size: 12px;
  margin-top: 2px;
}
.ti-rebate {
  font-size: 12px;
  flex: none;
}
.muted { color: #999; }
</style>
