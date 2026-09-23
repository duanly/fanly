<template>
  <div class="page">
    <van-nav-bar title="推广中心" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-loading v-if="loading" style="padding:60px;text-align:center" />

    <!-- 还不是代理，或还在审核中 -->
    <div v-else-if="blocked" style="padding:60px 24px;text-align:center">
      <van-icon :name="blockedIcon" size="52" color="#ff976a" />
      <div style="margin-top:14px;font-size:16px">{{ blocked.title }}</div>
      <div class="muted" style="margin-top:8px;line-height:1.8">{{ blocked.desc }}</div>
      <van-button
        v-if="blocked.action"
        round
        type="primary"
        color="#ff4b3a"
        style="margin-top:22px;width:180px"
        :loading="applying"
        @click="apply"
      >
        {{ blocked.action }}
      </van-button>
    </div>

    <template v-else-if="s">
      <div class="wallet">
        <div class="sub">我的专属推广码</div>
        <div class="big" style="letter-spacing:3px">{{ s.agentCode }}</div>
        <div class="sub" style="margin-top:6px">
          {{ s.levelName }} · 分成比例 {{ (s.rate * 100).toFixed(0) }}%
        </div>
      </div>

      <div class="stat-row">
        <div><div class="n">{{ s.teamSize }}</div><div class="l">团队人数</div></div>
        <div><div class="n">{{ s.orderCount }}</div><div class="l">有效订单</div></div>
        <div><div class="n">{{ money(s.gmv) }}</div><div class="l">团队 GMV</div></div>
      </div>

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
      <div style="background:#fff;margin:0 12px;border-radius:12px;padding:20px;text-align:center">
        <img v-if="qr" :src="qr.qrcode" style="width:200px;height:200px" />
        <van-loading v-else />
        <div class="muted" style="margin-top:10px;word-break:break-all">{{ qr?.url }}</div>
        <van-button
          size="small"
          round
          type="primary"
          color="#ff4b3a"
          style="margin-top:12px"
          @click="copyLink"
        >
          复制推广链接
        </van-button>
      </div>

      <div class="section-title">我的团队（{{ team.total }} 人）</div>
      <van-cell-group inset>
        <van-cell v-for="u in team.list" :key="u.id" :title="u.nickname" :label="u.mobile">
          <template #value>
            <span class="muted">贡献返利 ¥{{ money(u.totalRebate) }}</span>
          </template>
        </van-cell>
      </van-cell-group>
      <van-empty v-if="!team.list.length" description="还没有人扫你的码" />
      <div style="height:20px" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { showToast } from 'vant';
import { api } from '../api';

const s = ref(null);
const qr = ref(null);
const team = ref({ list: [], total: 0 });
const loading = ref(true);
const applying = ref(false);
const agentStatus = ref(null);   // null=不是代理, 0=待审核, 2=已冻结

const money = (v) => (+(v || 0)).toFixed(2);

const blocked = computed(() => {
  if (s.value) return null;
  if (agentStatus.value === 0) {
    return {
      title: '申请审核中',
      desc: '平台正在审核你的推广员申请，通过后这里会出现你的专属二维码和业绩数据。',
    };
  }
  if (agentStatus.value === 2) {
    return { title: '账号已冻结', desc: '你的推广员资格已被冻结，请联系客服了解原因。' };
  }
  return {
    title: '你还不是推广员',
    desc: '免费加盟。通过后你会拿到专属二维码，好友扫码注册即成为你的直属用户，他们每笔订单你都有分成。',
    action: '免费申请',
  };
});

const blockedIcon = computed(() =>
  agentStatus.value === 0 ? 'clock-o' : agentStatus.value === 2 ? 'warning-o' : 'gold-coin-o',
);

async function apply() {
  applying.value = true;
  try {
    await api.agentApply('');
    showToast('已提交，等待审核');
    await load();
  } finally {
    applying.value = false;
  }
}

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
    const p = await api.profile();
    agentStatus.value = p.isAgent ? p.agentStatus : null;
    // 只有审核通过的代理才有业绩和二维码
    if (p.isAgent && p.agentStatus === 1) {
      s.value = await api.agentStats();
      qr.value = await api.agentQrcode();
      team.value = await api.agentTeam({ page: 1, pageSize: 50 });
    } else {
      s.value = null;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
