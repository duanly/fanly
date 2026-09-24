<template>
  <div class="page">
    <NeedLogin
      v-if="!logged"
      title="登录后查看我的"
      desc="余额、提现、推广中心都在登录后可用"
    />

    <template v-else>
    <div style="background:linear-gradient(135deg,#ff6a3d,#ff3b30);padding:20px 16px 0">
      <div style="display:flex;align-items:center;gap:12px;color:#fff">
        <van-image round width="54" height="54" :src="p?.avatar" >
          <template #error><van-icon name="user-circle-o" size="54" color="#fff" /></template>
        </van-image>
        <div>
          <div style="font-size:17px;font-weight:600">{{ p?.nickname || '—' }}</div>
          <div style="opacity:.85;font-size:12px">
            {{ p?.mobile }}
            <span v-if="p?.bindAgent"> · 邀请人 {{ p.bindAgent.agentCode }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="wallet" style="margin-top:-6px">
      <div class="sub">可提现余额（元）</div>
      <div class="big">{{ money(p?.balance) }}</div>
      <div class="wallet-cols">
        <div>
          <div class="n">{{ money(p?.pending) }}</div>
          <div class="sub">预估返利</div>
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
          block round size="small" style="color:#ff3b30;font-weight:600"
          @click="$router.push('/withdraw')"
        >提现</van-button>
        <van-button
          block round size="small" plain style="color:#fff;border-color:rgba(255,255,255,.6)"
          @click="$router.push('/withdraws')"
        >提现记录</van-button>
      </div>
    </div>

    <van-cell-group inset style="margin-bottom:12px">
      <van-cell title="资金明细" is-link icon="balance-list-o" to="/ledger" />
      <van-cell title="提现记录" is-link icon="after-sale" to="/withdraws" />
      <van-cell title="我的订单" is-link icon="orders-o" to="/orders" />
      <van-cell title="我的邀请码" icon="friends-o" :value="p?.inviteCode" />
    </van-cell-group>

    <van-cell-group inset>
      <van-cell v-if="p?.isAgent" title="推广中心" is-link icon="gold-coin-o" to="/agent">
        <template #value>
          <span v-if="p.agentStatus === 0" style="color:#ff976a">待审核</span>
          <span v-else-if="p.agentStatus === 2" style="color:#999">已冻结</span>
          <span v-else>{{ ['', '普通代理', '高级代理', '合伙人'][p.agentLevel] }}</span>
        </template>
      </van-cell>
      <van-cell v-else title="申请成为推广员" is-link icon="gold-coin-o" @click="apply">
        <template #value><span class="muted">免费</span></template>
      </van-cell>
    </van-cell-group>

    <div style="padding:24px 16px">
      <van-button block round plain @click="logout">退出登录</van-button>
    </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import { api } from '../api';
import NeedLogin from '../components/NeedLogin.vue';

const logged = ref(!!localStorage.getItem('token'));
const p = ref(null);
const s = ref(null);
const router = useRouter();
const money = (v) => (+(v || 0)).toFixed(2);

async function load() {
  if (!logged.value) return;
  p.value = await api.profile();
  // 概览接口挂了不该让整个「我的」白屏，余额从 profile 里已经有了
  try { s.value = await api.summary(); } catch { s.value = null; }
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

function logout() {
  localStorage.removeItem('token');
  logged.value = false;
  p.value = null;
}

onMounted(load);
</script>
