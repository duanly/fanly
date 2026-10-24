<template>
  <div style="min-height:100vh;background:linear-gradient(160deg,#ff6a3d,#ff3b30 55%,#f5f6f8 55%);position:relative">
    <div class="login-back" @click="back">
      <van-icon name="arrow-left" color="#fff" size="22" />
    </div>
    <div style="padding:60px 24px 24px;color:#fff">
      <div style="font-size:26px;font-weight:700">省钱猫</div>
      <div style="opacity:.9;margin-top:6px">买啥都返现，省下的就是赚到的</div>
    </div>

    <div style="background:#fff;margin:0 16px;border-radius:14px;padding:8px 0 20px">
      <!-- 登录 / 注册 切换 -->
      <van-tabs v-model:active="tab" color="#ff4b3a" line-width="24" :border="false">
        <van-tab title="登录" name="login" />
        <van-tab title="注册" name="register" />
      </van-tabs>

      <!-- ===== 登录 ===== -->
      <van-cell-group v-if="tab === 'login'" :border="false">
        <van-field v-model="loginForm.mobile" type="tel" maxlength="11" label="手机号" placeholder="请输入手机号" />
        <van-field
          v-model="loginForm.password"
          :type="pwdVisible ? 'text' : 'password'"
          label="密码"
          placeholder="请输入密码"
        >
          <template #button>
            <van-icon :name="pwdVisible ? 'eye-o' : 'closed-eye'" size="20" color="#969799" @click="pwdVisible = !pwdVisible" />
          </template>
        </van-field>
      </van-cell-group>

      <div v-if="tab === 'login'" style="padding:16px 16px 0">
        <van-button block round type="primary" color="#ff4b3a" :loading="loading" @click="doLogin">
          登录
        </van-button>
        <div class="login-foot">
          <span class="link" @click="showForgot = true">忘记密码？</span>
          <span class="link" @click="tab = 'register'">去注册 ›</span>
        </div>
      </div>

      <!-- ===== 注册 ===== -->
      <van-cell-group v-if="tab === 'register'" :border="false">
        <van-field v-model="regForm.mobile" type="tel" maxlength="11" label="手机号" placeholder="请输入手机号" />
        <van-field
          v-model="regForm.password"
          :type="regPwdVisible ? 'text' : 'password'"
          label="设置密码"
          placeholder="6-20 位字母或数字"
        >
          <template #button>
            <van-icon :name="regPwdVisible ? 'eye-o' : 'closed-eye'" size="20" color="#969799" @click="regPwdVisible = !regPwdVisible" />
          </template>
        </van-field>
        <van-field
          v-model="regForm.confirmPassword"
          :type="regPwdVisible ? 'text' : 'password'"
          label="确认密码"
          placeholder="再次输入密码"
        />
        <van-field v-model="regForm.captchaCode" label="图形验证码" placeholder="请输入验证码" maxlength="6">
          <template #button>
            <div class="captcha-img" @click="loadCaptcha" title="点击刷新">
              <img v-if="captchaSvg" :src="captchaDataUrl" alt="验证码" />
              <span v-else style="font-size:12px;color:#969799">加载中...</span>
            </div>
          </template>
        </van-field>
        <van-field v-model="regForm.inviteCode" label="邀请码" placeholder="选填，填了才有上级" />
      </van-cell-group>

      <div v-if="tab === 'register'" style="padding:16px 16px 0">
        <van-button block round type="primary" color="#ff4b3a" :loading="loading" @click="doRegister">
          注册并登录
        </van-button>
        <div class="login-foot">
          <span class="link" @click="tab = 'login'">已有账号？去登录 ›</span>
        </div>
      </div>
    </div>

    <!-- 忘记密码弹窗 -->
    <van-dialog v-model:show="showForgot" title="忘记密码" show-cancel-button confirm-button-text="我知道了" :show-confirm-button="true">
      <div style="padding:8px 4px 4px;font-size:14px;line-height:1.8;color:#333">
        请联系客服重置密码。<br />
        添加客服微信并提供注册手机号，我们会尽快为您重置。
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';

const tab = ref('login');
const loading = ref(false);
const pwdVisible = ref(false);
const regPwdVisible = ref(false);
const showForgot = ref(false);
const route = useRoute();
const router = useRouter();

const loginForm = ref({ mobile: '', password: '' });
const regForm = ref({
  mobile: '',
  password: '',
  confirmPassword: '',
  captchaKey: '',
  captchaCode: '',
  inviteCode: '',
});

// 图形验证码
const captchaSvg = ref('');
const captchaDataUrl = computed(() => {
  if (!captchaSvg.value) return '';
  // SVG 转 data URL（直接用 encodeURIComponent 就行，不用 base64）
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(captchaSvg.value);
});

async function loadCaptcha() {
  try {
    const r = await api.getCaptcha();
    regForm.value.captchaKey = r.key;
    captchaSvg.value = r.svg;
  } catch (e) {
    // 忽略错误，用户点一下再刷新
  }
}

async function doLogin() {
  if (!/^1[3-9]\d{9}$/.test(loginForm.value.mobile)) return showToast('手机号格式不对');
  if (!loginForm.value.password) return showToast('请输入密码');
  loading.value = true;
  try {
    const r = await api.login({
      mobile: loginForm.value.mobile,
      password: loginForm.value.password,
      deviceId: localStorage.getItem('deviceId') || '',
    });
    localStorage.setItem('token', r.token);
    showToast('登录成功');
    router.replace(route.query.redirect || '/mine');
  } finally {
    loading.value = false;
  }
}

async function doRegister() {
  if (!/^1[3-9]\d{9}$/.test(regForm.value.mobile)) return showToast('手机号格式不对');
  if (!regForm.value.password || regForm.value.password.length < 6 || regForm.value.password.length > 20) {
    return showToast('密码长度 6-20 位');
  }
  if (regForm.value.password !== regForm.value.confirmPassword) {
    return showToast('两次密码输入不一致');
  }
  if (!regForm.value.captchaCode) return showToast('请输入图形验证码');

  loading.value = true;
  try {
    const r = await api.register({
      mobile: regForm.value.mobile,
      password: regForm.value.password,
      captchaKey: regForm.value.captchaKey,
      captchaCode: regForm.value.captchaCode,
      inviteCode: regForm.value.inviteCode || undefined,
      deviceId: localStorage.getItem('deviceId') || '',
    });
    localStorage.setItem('token', r.token);
    showToast('注册成功');
    router.replace(route.query.redirect || '/mine');
  } catch (e) {
    // 图形验证码错了，自动刷新一张
    if (e.message && e.message.includes('图形验证码')) {
      loadCaptcha();
      regForm.value.captchaCode = '';
    }
    throw e;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  // 扫码落地页写入的邀请码
  const saved = localStorage.getItem('inviteCode');
  if (saved) regForm.value.inviteCode = saved;

  if (!localStorage.getItem('deviceId')) {
    localStorage.setItem('deviceId', 'web-' + Math.random().toString(36).slice(2, 12));
  }

  // 注册页需要先加载一张验证码
  loadCaptcha();
});

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}
</script>

<style scoped>
.login-back {
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

.login-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  font-size: 13px;
  color: #969799;
}

.login-foot .link {
  color: #ff4b3a;
  cursor: pointer;
}

.captcha-img {
  width: 100px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f7fa;
  cursor: pointer;
  user-select: none;
}
.captcha-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
