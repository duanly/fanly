<template>
  <div style="min-height:100vh;background:linear-gradient(160deg,#ff6a3d,#ff3b30);position:relative">
    <div class="invite-back" @click="back">
      <van-icon name="arrow-left" color="#fff" size="22" />
    </div>
    <div style="padding:70px 24px 20px;color:#fff;text-align:center">
      <div style="font-size:30px;font-weight:700">省钱猫</div>
      <div style="margin-top:10px;opacity:.92">买啥都返现，省下的就是赚到的</div>
    </div>

    <div style="background:#fff;margin:20px 16px;border-radius:14px;padding:24px;text-align:center">
      <template v-if="info?.valid">
        <div class="inviter-avatar">{{ (info.nickname || info.realName || '').slice(0, 1) }}</div>
        <div style="margin-top:10px">
          <AgentBadge v-if="info.isAgent" :level="info.level" />
        </div>
        <div style="margin-top:10px;font-size:16px">
          <b>{{ info.nickname || info.realName || '好友' }}</b> 邀请你加入
        </div>
        <div class="muted" style="margin-top:6px">
          邀请码 {{ info.agentCode || info.inviteCode }}
        </div>
        <div class="muted" style="margin-top:14px;line-height:1.8">
          注册后自动成为他的好友<br />购物有返利，分享还能赚金币
        </div>
      </template>
      <template v-else>
        <van-icon name="warning-o" size="44" color="#ff976a" />
        <div style="margin-top:12px">这个邀请码无效或已冻结</div>
        <div class="muted" style="margin-top:6px">你仍然可以直接注册</div>
      </template>

      <van-button
        block
        round
        type="primary"
        color="#ff4b3a"
        style="margin-top:22px"
        @click="go"
      >
        立即注册领返利
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import AgentBadge from '../components/AgentBadge.vue';

const route = useRoute();
const router = useRouter();
const info = ref(null);

function go() {
  router.replace('/login');
}

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

onMounted(async () => {
  const code = String(route.params.code || '').toUpperCase();
  // 绑定关系只在首次注册时生效，这里先存下来
  localStorage.setItem('inviteCode', code);
  try {
    info.value = await api.agentInfo(code);
  } catch { /* 无效码也让用户能注册 */ }
});
</script>

<style scoped>
.invite-back {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  z-index: 10;
}
.inviter-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff976a, #ff4b3a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  margin: 0 auto;
}
</style>
