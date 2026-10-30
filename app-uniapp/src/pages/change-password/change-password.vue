<template>
  <view class="page">
    <view class="card">
      <view class="field">
        <text class="label">原密码</text>
        <input v-model="oldPassword" :password="!oldVisible" class="input" placeholder="请输入原密码" />
        <text class="eye" @click="oldVisible = !oldVisible">{{ oldVisible ? '🙈' : '👁️' }}</text>
      </view>
      <view class="field">
        <text class="label">新密码</text>
        <input v-model="newPassword" :password="!newVisible" class="input" placeholder="6-20 位字母或数字" />
        <text class="eye" @click="newVisible = !newVisible">{{ newVisible ? '🙈' : '👁️' }}</text>
      </view>
      <view class="field">
        <text class="label">确认新密码</text>
        <input v-model="confirmPassword" :password="!newVisible" class="input" placeholder="再次输入新密码" />
      </view>
    </view>

    <view class="btn-wrap">
      <button class="submit" :loading="loading" @click="submit">确认修改</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../../api/index.js';
import { clearToken } from '../../utils/storage.js';

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const oldVisible = ref(false);
const newVisible = ref(false);
const loading = ref(false);

async function submit() {
  if (!oldPassword.value) return uni.showToast({ title: '请输入原密码', icon: 'none' });
  if (!newPassword.value || newPassword.value.length < 6 || newPassword.value.length > 20) {
    return uni.showToast({ title: '新密码长度 6-20 位', icon: 'none' });
  }
  if (newPassword.value !== confirmPassword.value) {
    return uni.showToast({ title: '两次新密码输入不一致', icon: 'none' });
  }
  loading.value = true;
  try {
    await api.changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    });
    uni.showToast({ title: '修改成功，请重新登录', icon: 'none' });
    clearToken();
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/login' });
    }, 1200);
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; }
.card { margin-top: 24rpx; background: #fff; padding: 0 32rpx; }
.field { display: flex; align-items: center; padding: 32rpx 0; border-bottom: 2rpx solid #f5f6f8; }
.field:last-child { border-bottom: none; }
.label { width: 180rpx; font-size: 28rpx; color: #333; flex-shrink: 0; }
.input { flex: 1; font-size: 28rpx; }
.eye { font-size: 36rpx; padding: 0 8rpx; }
.btn-wrap { padding: 48rpx 32rpx; }
.submit {
  height: 92rpx; line-height: 92rpx; border-radius: 999rpx;
  background: $brand; color: #fff; font-size: 30rpx;
}
.submit::after { border: none; }
</style>
