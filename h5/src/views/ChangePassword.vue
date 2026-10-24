<template>
  <div class="page">
    <van-nav-bar title="修改密码" left-arrow @click-left="$router.back()" />

    <van-cell-group :border="false" style="margin-top:12px">
      <van-field
        v-model="oldPassword"
        :type="oldVisible ? 'text' : 'password'"
        label="原密码"
        placeholder="请输入原密码"
      >
        <template #button>
          <van-icon :name="oldVisible ? 'eye-o' : 'closed-eye'" size="20" color="#969799" @click="oldVisible = !oldVisible" />
        </template>
      </van-field>
      <van-field
        v-model="newPassword"
        :type="newVisible ? 'text' : 'password'"
        label="新密码"
        placeholder="6-20 位字母或数字"
      >
        <template #button>
          <van-icon :name="newVisible ? 'eye-o' : 'closed-eye'" size="20" color="#969799" @click="newVisible = !newVisible" />
        </template>
      </van-field>
      <van-field
        v-model="confirmPassword"
        :type="newVisible ? 'text' : 'password'"
        label="确认新密码"
        placeholder="再次输入新密码"
      />
    </van-cell-group>

    <div style="padding:24px 16px">
      <van-button block round type="primary" color="#ff4b3a" :loading="loading" @click="submit">
        确认修改
      </van-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';

const router = useRouter();
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const oldVisible = ref(false);
const newVisible = ref(false);
const loading = ref(false);

async function submit() {
  if (!oldPassword.value) return showToast('请输入原密码');
  if (!newPassword.value || newPassword.value.length < 6 || newPassword.value.length > 20) {
    return showToast('新密码长度 6-20 位');
  }
  if (newPassword.value !== confirmPassword.value) {
    return showToast('两次新密码输入不一致');
  }
  loading.value = true;
  try {
    await api.changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    });
    showToast('修改成功，请重新登录');
    // 清 token，跳登录页
    localStorage.removeItem('token');
    setTimeout(() => {
      router.replace('/login');
    }, 1200);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6f8;
}
</style>
