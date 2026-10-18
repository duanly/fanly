<template>
  <div class="agent-page">
    <van-nav-bar title="推广中心" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-loading v-if="loading" style="padding:60px;text-align:center" />

    <template v-else>
      <!-- 等级卡片（所有用户都能看到） -->
      <div class="wallet">
        <div class="w-top">
          <div>
            <AgentBadge :level="p?.agentLevel ?? 0" />
            <div class="w-name">{{ p?.nickname }}</div>
            <div class="w-code">推广码 {{ p?.inviteCode }}</div>
          </div>
          <div class="w-qr" v-if="qr" @click="$router.push('/invite')">
            <img :src="qr.qrcode" alt="推广码" />
            <div class="w-qr-tip">点击查看</div>
          </div>
        </div>

        <!-- 升级进度 -->
        <div class="progress-wrap">
          <div class="p-head">
            <span>升级进度</span>
            <span class="p-count">{{ p?.inviteCount || 0 }} 人</span>
          </div>
          <div class="p-bar">
            <div class="p-fill" :style="{ width: progressPct + '%' }"></div>
          </div>
          <div class="p-text">
            <template v-if="p?.nextLevel">
              距离 <b>{{ p.nextLevelName }}</b> 还差 {{ p.needForNext }} 人
            </template>
            <template v-else>
              已达最高等级，继续加油！
            </template>
          </div>
          <div class="p-ladder">
            <div class="li" :class="{ done: (p?.inviteCount ?? 0) >= 10 }">
              <span class="li-ico">🥈</span>
              <span class="li-name">白银</span>
              <span class="li-num">10人</span>
            </div>
            <div class="li" :class="{ done: (p?.inviteCount ?? 0) >= 30 }">
              <span class="li-ico">🥇</span>
              <span class="li-name">黄金</span>
              <span class="li-num">30人</span>
            </div>
            <div class="li" :class="{ done: (p?.inviteCount ?? 0) >= 100 }">
              <span class="li-ico">💎</span>
              <span class="li-name">钻石</span>
              <span class="li-num">100人</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 团队数据（所有用户都能看） -->
      <div class="stat-row">
        <div><div class="n">{{ p?.inviteCount || 0 }}</div><div class="l">直属好友</div></div>
        <div><div class="n">{{ team.total }}</div><div class="l">团队总人数</div></div>
        <div>
          <div class="n" v-if="p?.isAgent">{{ s?.orderCount || 0 }}</div>
          <div class="n muted" v-else>—</div>
          <div class="l">有效订单</div>
        </div>
        <div>
          <div class="n price" v-if="p?.isAgent">{{ money(s?.gmv) }}</div>
          <div class="n muted" v-else>—</div>
          <div class="l">团队 GMV</div>
        </div>
      </div>

      <!-- 代理专属：分成数据 -->
      <template v-if="p?.isAgent && s">
        <!-- 二级团队 -->
        <div class="l2-card">
          <div class="l2-head">
            <span class="t">二级团队</span>
            <span class="r">分成 {{ (s.rateL2 * 100).toFixed(0) }}%</span>
          </div>
          <div class="l2-nums">
            <div><b>{{ s.subAgentCount ?? 0 }}</b><span>我发展的代理</span></div>
            <div><b>{{ s.teamSizeL2 ?? 0 }}</b><span>他们带来的用户</span></div>
          </div>
          <div class="l2-tip">
            你拉的人自己也成了代理，他团队的订单你同样能分一笔。
          </div>
        </div>

        <!-- 分成收益 -->
        <div class="stat-row">
          <div>
            <div class="n price">{{ money(s.creditedBonus) }}</div>
            <div class="l">已入账分成</div>
          </div>
          <div>
            <div class="n" style="color:#ff976a">{{ money(s.pendingBonus) }}</div>
            <div class="l">待结算</div>
          </div>
          <div>
            <div class="n" style="color:#999">{{ money(s.reversedBonus) }}</div>
            <div class="l">已冲销</div>
          </div>
        </div>

        <div class="section-title">我的推广二维码</div>
      </template>

      <!-- 非代理提示 -->
      <div v-else class="upgrade-tip">
        <van-icon name="fire-o" size="20" color="#ff4b3a" />
        <span>邀请满 10 位好友自动升级为白银代理，享 8% 团队分成</span>
      </div>

      <!-- 推广二维码（所有用户都有） -->
      <div class="qr-card">
        <img v-if="qr" :src="qr.qrcode" class="qr-img" />
        <van-loading v-else />
        <div class="muted" style="margin-top:10px;font-size:12px">{{ qr?.url }}</div>
        <div class="qr-actions">
          <van-button size="small" round type="primary" color="#ff4b3a" @click="copyLink">
            复制推广链接
          </van-button>
          <van-button size="small" round plain color="#ff4b3a" @click="$router.push('/invite')">
            查看详情
          </van-button>
        </div>
      </div>

      <!-- 团队列表（所有用户都能看） -->
      <div class="section-title">我的团队（{{ team.total }} 人）</div>
      <van-cell-group inset v-if="team.list?.length">
        <van-cell v-for="u in team.list" :key="u.id" :title="u.nickname" :label="u.mobile">
          <template #value>
            <span class="muted">贡献 ¥{{ money(u.totalRebate) }}</span>
          </template>
        </van-cell>
      </van-cell-group>
      <van-empty v-else description="还没有人扫你的码" />

      <div style="height:20px" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { showToast } from 'vant';
import { api } from '../api';
import AgentBadge from '../components/AgentBadge.vue';

const p = ref(null);
const s = ref(null);
const qr = ref(null);
const team = ref({ list: [], total: 0 });
const loading = ref(true);

const money = (v) => (+(v || 0)).toFixed(2);

const progressPct = computed(() => {
  const count = p.value?.inviteCount || 0;
  if (count >= 100) return 100;
  if (count >= 30) return 30 + ((count - 30) / 70) * 70;
  if (count >= 10) return 10 + ((count - 10) / 20) * 20;
  return (count / 10) * 10;
});

async function copyLink() {
  try {
    await navigator.clipboard.writeText(qr.value.url);
    showToast('链接已复制');
  } catch {
    showToast('复制失败，请长按二维码保存');
  }
}

async function load() {
  loading.value = true;
  try {
    const [profile, qrData, teamData] = await Promise.all([
      api.profile(),
      api.agentInviteQrcode(),
      api.agentTeam({ page: 1, pageSize: 50 }),
    ]);
    p.value = profile;
    qr.value = qrData;
    team.value = teamData;

    // 只有代理才有业绩数据
    if (profile.isAgent) {
      try { s.value = await api.agentStats(); } catch { s.value = null; }
    }
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.agent-page {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 20px;
}

/* 顶部钱包卡 */
.wallet {
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  color: #fff;
  margin: 0;
  padding: 20px 16px 18px;
}
.w-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.w-name {
  font-size: 18px;
  font-weight: 700;
  margin-top: 8px;
}
.w-code {
  font-size: 12px;
  opacity: .85;
  margin-top: 4px;
  letter-spacing: 1px;
}
.w-qr {
  width: 72px;
  height: 72px;
  background: #fff;
  border-radius: 8px;
  padding: 4px;
  text-align: center;
}
.w-qr img {
  width: 100%;
  height: calc(100% - 14px);
  display: block;
  border-radius: 4px;
}
.w-qr-tip {
  font-size: 10px;
  color: #999;
  margin-top: 2px;
}

/* 升级进度 */
.progress-wrap {
  background: rgba(255,255,255,.15);
  border-radius: 12px;
  padding: 12px 14px;
  margin-top: 16px;
}
.p-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
}
.p-count {
  font-size: 14px;
  font-weight: 700;
}
.p-bar {
  height: 6px;
  background: rgba(255,255,255,.3);
  border-radius: 999px;
  margin-top: 8px;
  overflow: hidden;
}
.p-fill {
  height: 100%;
  background: #fff;
  border-radius: 999px;
  transition: width .3s;
  min-width: 3px;
}
.p-text {
  font-size: 11px;
  opacity: .88;
  margin-top: 6px;
  text-align: right;
}
.p-text b { font-weight: 700; }
.p-ladder {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,.2);
}
.li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  opacity: .5;
  transition: opacity .3s;
}
.li.done { opacity: 1; }
.li-ico { font-size: 20px; }
.li-name { font-size: 11px; }
.li-num { font-size: 10px; opacity: .8; }
.li.done .li-name { font-weight: 700; }

/* 数据行 */
.stat-row {
  display: flex;
  background: #fff;
  margin: 12px;
  border-radius: 12px;
  padding: 14px 0;
}
.stat-row > div {
  flex: 1;
  text-align: center;
  border-right: 1px solid #f0f0f0;
}
.stat-row > div:last-child { border-right: none; }
.stat-row .n {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}
.stat-row .n.muted { color: #ccc; font-weight: 400; }
.stat-row .n.price { color: #ff4b3a; }
.stat-row .l {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

/* 二级团队卡 */
.l2-card {
  background: linear-gradient(135deg, #4a3aff, #7b3ad5);
  color: #fff;
  margin: 0 12px 12px;
  border-radius: 12px;
  padding: 14px 16px;
}
.l2-head { display: flex; justify-content: space-between; align-items: baseline; }
.l2-head .t { font-size: 15px; font-weight: 700; }
.l2-head .r { font-size: 12px; background: rgba(255,255,255,.22); border-radius: 999px; padding: 2px 10px; }
.l2-nums { display: flex; margin-top: 12px; }
.l2-nums > div { flex: 1; }
.l2-nums b { font-size: 22px; font-weight: 800; display: block; }
.l2-nums span { font-size: 11px; opacity: .88; }
.l2-tip { font-size: 11px; opacity: .85; margin-top: 10px; line-height: 1.6; }

/* 升级提示 */
.upgrade-tip {
  background: #fff8f5;
  margin: 0 12px 12px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
  color: #ff6b35;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* section 标题 */
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  padding: 8px 16px;
  margin-top: 4px;
}

/* 二维码卡 */
.qr-card {
  background: #fff;
  margin: 0 12px;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}
.qr-img {
  width: 180px;
  height: 180px;
  display: block;
  margin: 0 auto;
  border-radius: 8px;
}
.qr-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 14px;
}

.muted { color: #999; }
</style>
