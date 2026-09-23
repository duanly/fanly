<template>
  <div style="min-height:100vh;background:linear-gradient(160deg,#ff6a3d,#ff3b30)">
    <div style="padding:70px 24px 20px;color:#fff;text-align:center">
      <div style="font-size:30px;font-weight:700">省钱猫</div>
      <div style="margin-top:10px;opacity:.92">买啥都返现，省下的就是赚到的</div>
    </div>

    <div style="background:#fff;margin:20px 16px;border-radius:14px;padding:24px;text-align:center">
      <template v-if="info?.valid">
        <van-icon name="friends-o" size="44" color="#ff4b3a" />
        <div style="margin-top:12px;font-size:16px">
          <b>{{ info.realName || info.agentCode }}</b> 邀请你加入
        </div>
        <div class="muted" style="margin-top:6px">邀请码 {{ info.agentCode }}</div>
        <div class="muted" style="margin-top:14px;line-height:1.8">
          注册后自动成为他的直属用户<br />你的每笔订单他都有一份分成，你的返利不受影响
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

const route = useRoute();
const router = useRouter();
const info = ref(null);

function go() {
  router.replace('/login');
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
