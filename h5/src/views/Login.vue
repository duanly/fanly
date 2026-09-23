<template>
  <div style="min-height:100vh;background:linear-gradient(160deg,#ff6a3d,#ff3b30 55%,#f5f6f8 55%)">
    <div style="padding:60px 24px 24px;color:#fff">
      <div style="font-size:26px;font-weight:700">省钱猫</div>
      <div style="opacity:.9;margin-top:6px">买啥都返现，省下的就是赚到的</div>
    </div>

    <div style="background:#fff;margin:0 16px;border-radius:14px;padding:8px 0 20px">
      <van-cell-group :border="false">
        <van-field v-model="mobile" type="tel" maxlength="11" label="手机号" placeholder="请输入手机号" />
        <van-field v-model="smsCode" maxlength="6" label="验证码" placeholder="6 位验证码">
          <template #button>
            <van-button size="small" :disabled="counting > 0" @click="send">
              {{ counting > 0 ? `${counting}s` : '获取验证码' }}
            </van-button>
          </template>
        </van-field>
        <van-field v-model="inviteCode" label="邀请码" placeholder="选填，填了才有上级" />
      </van-cell-group>

      <div style="padding:16px 16px 0">
        <van-button block round type="primary" color="#ff4b3a" :loading="loading" @click="submit">
          登录 / 注册
        </van-button>
      </div>
      <div class="muted" style="text-align:center;margin-top:12px">
        开发模式下验证码会自动填入
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';

const mobile = ref('13900000001');
const smsCode = ref('');
const inviteCode = ref('');
const loading = ref(false);
const counting = ref(0);
const route = useRoute();
const router = useRouter();

async function send() {
  if (!/^1[3-9]\d{9}$/.test(mobile.value)) return showToast('手机号格式不对');
  const r = await api.sendSms(mobile.value);
  // 开发模式：服务端把验证码直接返回，接短信服务商后这里会是 undefined
  if (r.devCode) {
    smsCode.value = r.devCode;
    showToast(`开发模式验证码 ${r.devCode}`);
  } else {
    showToast('验证码已发送');
  }
  counting.value = 60;
  const t = setInterval(() => {
    counting.value -= 1;
    if (counting.value <= 0) clearInterval(t);
  }, 1000);
}

async function submit() {
  if (!smsCode.value) return showToast('请先获取验证码');
  loading.value = true;
  try {
    const r = await api.login({
      mobile: mobile.value,
      smsCode: smsCode.value,
      inviteCode: inviteCode.value || undefined,
      deviceId: localStorage.getItem('deviceId') || '',
    });
    localStorage.setItem('token', r.token);
    showToast(r.isNew ? '注册成功' : '登录成功');
    router.replace(route.query.redirect || '/mine');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  // 扫码落地页写入的邀请码
  const saved = localStorage.getItem('inviteCode');
  if (saved) inviteCode.value = saved;
  if (!localStorage.getItem('deviceId')) {
    localStorage.setItem('deviceId', 'web-' + Math.random().toString(36).slice(2, 12));
  }
});
</script>
