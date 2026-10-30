<template>
  <view class="page">
    <view class="top">
      <view class="logo">🙂</view>
      <view class="brand">省钱猫</view>
      <view class="sub">买啥都返现</view>
    </view>

    <view class="card">
      <!-- 登录 / 注册 切换 -->
      <view class="tabs">
        <view class="tab" :class="{ on: mode === 'login' }" @click="mode = 'login'">登录</view>
        <view class="tab" :class="{ on: mode === 'register' }" @click="mode = 'register'">注册</view>
      </view>

      <!-- ===== 登录 ===== -->
      <template v-if="mode === 'login'">
        <view class="field">
          <input v-model="loginForm.mobile" type="number" maxlength="11" class="input" placeholder="手机号" />
        </view>
        <view class="field captcha-field">
          <input v-model="loginForm.password" :password="!pwdVisible" class="input" placeholder="请输入密码" />
          <text class="eye" @click="pwdVisible = !pwdVisible">{{ pwdVisible ? '🙈' : '👁️' }}</text>
        </view>
        <button class="submit" :loading="loading" @click="doLogin">登录</button>
        <view class="login-foot">
          <text class="link" @click="showForgot = true">忘记密码？</text>
          <text class="link" @click="mode = 'register'">去注册 ›</text>
        </view>
      </template>

      <!-- ===== 注册 ===== -->
      <template v-else>
        <view class="field">
          <input v-model="regForm.mobile" type="number" maxlength="11" class="input" placeholder="手机号" />
        </view>
        <view class="field captcha-field">
          <input v-model="regForm.password" :password="!regPwdVisible" class="input" placeholder="设置 6-20 位密码" />
          <text class="eye" @click="regPwdVisible = !regPwdVisible">{{ regPwdVisible ? '🙈' : '👁️' }}</text>
        </view>
        <view class="field">
          <input v-model="regForm.confirmPassword" :password="!regPwdVisible" class="input" placeholder="再次输入密码" />
        </view>
        <view class="field captcha-field">
          <input v-model="regForm.captchaCode" class="input captcha-input" placeholder="图形验证码" maxlength="6" />
          <image v-if="captchaImg" class="captcha-img" :src="captchaImg" mode="aspectFill" @click="loadCaptcha" />
          <view v-else class="captcha-img captcha-fallback" @click="loadCaptcha">图</view>
        </view>
        <view class="field">
          <input v-model="regForm.inviteCode" class="input" placeholder="邀请码（选填，填了才有上级）" />
        </view>
        <button class="submit" :loading="loading" @click="doRegister">注册并登录</button>
        <view class="login-foot">
          <text class="link" @click="mode = 'login'">已有账号？去登录 ›</text>
        </view>
      </template>
    </view>

    <!-- 忘记密码 -->
    <view v-if="showForgot" class="mask" @click="showForgot = false">
      <view class="dialog" @click.stop>
        <view class="d-title">忘记密码</view>
        <view class="d-body">请联系客服重置密码，提供注册手机号，我们会尽快为您重置。</view>
        <view class="d-btn" @click="goSupport">联系客服</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useUserStore } from '../../store/user.js';
import { api } from '../../api/index.js';
import { storage } from '../../utils/storage.js';

const userStore = useUserStore();

const mode = ref('login');
const loading = ref(false);
const pwdVisible = ref(false);
const regPwdVisible = ref(false);
const showForgot = ref(false);
const captchaImg = ref('');

const loginForm = reactive({ mobile: '', password: '' });
const regForm = reactive({
  mobile: '', password: '', confirmPassword: '',
  captchaKey: '', captchaCode: '', inviteCode: '',
});

// 设备标识：没有就生成一个存起来
if (!storage.get('deviceId')) {
  storage.set('deviceId', 'app-' + Math.random().toString(36).slice(2, 12));
}
// 邀请落地页写入的邀请码
const savedInvite = storage.get('inviteCode');
if (savedInvite) regForm.inviteCode = savedInvite;

function loadCaptcha() {
  api.getCaptcha().then((r) => {
    regForm.captchaKey = r.key;
    captchaImg.value = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg || '');
  }).catch(() => {});
}
loadCaptcha();

async function doLogin() {
  if (!/^1[3-9]\d{9}$/.test(loginForm.mobile)) {
    return uni.showToast({ title: '手机号格式不对', icon: 'none' });
  }
  if (!loginForm.password) return uni.showToast({ title: '请输入密码', icon: 'none' });
  loading.value = true;
  try {
    await userStore.login({
      mobile: loginForm.mobile,
      password: loginForm.password,
      deviceId: storage.get('deviceId'),
    });
    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => uni.switchTab({ url: '/pages/mine/mine' }), 400);
  } catch {} finally {
    loading.value = false;
  }
}

async function doRegister() {
  if (!/^1[3-9]\d{9}$/.test(regForm.mobile)) {
    return uni.showToast({ title: '手机号格式不对', icon: 'none' });
  }
  if (!regForm.password || regForm.password.length < 6 || regForm.password.length > 20) {
    return uni.showToast({ title: '密码长度 6-20 位', icon: 'none' });
  }
  if (regForm.password !== regForm.confirmPassword) {
    return uni.showToast({ title: '两次密码输入不一致', icon: 'none' });
  }
  if (!regForm.captchaCode) return uni.showToast({ title: '请输入图形验证码', icon: 'none' });

  loading.value = true;
  try {
    // 注册接口成功即直接返回 token，不用再调一次登录
    const r = await api.register({
      mobile: regForm.mobile,
      password: regForm.password,
      captchaKey: regForm.captchaKey,
      captchaCode: regForm.captchaCode,
      inviteCode: regForm.inviteCode || undefined,
      deviceId: storage.get('deviceId'),
    });
    userStore.token = r.token;
    storage.set('token', r.token);
    await userStore.fetchProfile();
    uni.showToast({ title: '注册成功', icon: 'success' });
    setTimeout(() => uni.switchTab({ url: '/pages/mine/mine' }), 400);
  } catch (e) {
    // 验证码错误：自动换一张，清空已输的
    if (e?.message?.includes('图形验证码')) {
      loadCaptcha();
      regForm.captchaCode = '';
    }
  } finally {
    loading.value = false;
  }
}

function goSupport() {
  showForgot.value = false;
  if (userStore.isLoggedIn) uni.navigateTo({ url: '/pages/support/support' });
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff0ed 0%, #fff7f5 40%, #f7f8fa 100%);
  padding: 0 56rpx;
}
.top { padding-top: 120rpx; text-align: center; }
.logo { font-size: 96rpx; }
.brand { font-size: 64rpx; font-weight: 800; color: $brand; margin-top: 12rpx; }
.sub { font-size: 26rpx; color: $text-muted; margin-top: 8rpx; }

.card {
  margin-top: 48rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx 32rpx 40rpx;
  box-shadow: 0 8rpx 28rpx rgba(255, 75, 58, 0.08);
}
.tabs { display: flex; margin-bottom: 32rpx; gap: 24rpx; }
.tab {
  flex: 1; text-align: center;
  padding: 16rpx 0; font-size: 30rpx; color: #999;
  background: #f7f8fa; border-radius: 999rpx;
}
.tab.on { color: #fff; background: $brand; font-weight: 700; }

.field { margin-bottom: 24rpx; }
.input {
  height: 88rpx;
  background: #f7f8fa;
  border-radius: 999rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
}
.captcha-field { display: flex; align-items: center; gap: 16rpx; }
.captcha-field .input { flex: 1; }
.eye { font-size: 36rpx; padding: 0 8rpx; flex-shrink: 0; }
.captcha-input { flex: 1; }
.captcha-img {
  width: 176rpx; height: 88rpx;
  border-radius: 12rpx; background: #f0f0f0; flex-shrink: 0;
}
.captcha-fallback {
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; color: #666;
}
.submit {
  height: 88rpx; line-height: 88rpx;
  background: $brand; color: #fff;
  border-radius: 999rpx; font-size: 30rpx; margin-top: 8rpx;
}
.submit::after { border: none; }
.login-foot {
  display: flex; justify-content: space-between;
  margin-top: 24rpx; font-size: 24rpx; color: #999;
}
.link { color: $brand; }

.mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, .45);
  z-index: 200; display: flex; align-items: center; justify-content: center;
  padding: 0 80rpx;
}
.dialog { width: 100%; background: #fff; border-radius: 24rpx; padding: 40rpx 32rpx 32rpx; }
.d-title { font-size: 34rpx; font-weight: 700; text-align: center; }
.d-body { font-size: 26rpx; color: #666; line-height: 1.7; margin-top: 20rpx; }
.d-btn {
  margin-top: 28rpx; height: 84rpx; line-height: 84rpx;
  text-align: center; background: $brand; color: #fff;
  border-radius: 999rpx; font-size: 28rpx;
}
</style>
