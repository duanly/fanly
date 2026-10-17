<template>
  <div class="madmin-login">
    <div class="login-box">
      <div class="logo">🐱</div>
      <h1>省钱猫 · 管理后台</h1>
      <p class="subtitle">手机端运营工具</p>

      <van-form @submit="onSubmit">
        <van-cell-group inset>
          <van-field
            v-model="form.username"
            label="账号"
            placeholder="请输入管理员账号"
            :rules="[{ required: true, message: '请输入账号' }]"
          />
          <van-field
            v-model="form.password"
            type="password"
            label="密码"
            placeholder="请输入密码"
            :rules="[{ required: true, message: '请输入密码' }]"
          />
        </van-cell-group>

        <div class="btn-wrap">
          <van-button
            round
            block
            type="danger"
            native-type="submit"
            :loading="loading"
          >登录</van-button>
        </div>
      </van-form>

      <div class="tip">
        访问 <a href="/admin/" target="_blank">PC 版管理后台</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { adminApi } from '../../api';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const form = reactive({ username: '', password: '' });

async function onSubmit() {
  loading.value = true;
  try {
    const r = await adminApi.login({
      username: form.username,
      password: form.password,
    });
    const token = r.token || r;
    localStorage.setItem('adminToken', token);
    showToast('登录成功');
    const redirect = route.query.redirect || '/madmin';
    setTimeout(() => router.replace(redirect), 300);
  } catch {
    // 错误已经由拦截器 toast 了
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.madmin-login {
  min-height: 100vh;
  background: linear-gradient(180deg, #ff4b3a 0%, #ff6b35 100%);
  padding: 60px 16px 20px;
  box-sizing: border-box;
}
.login-box {
  background: #fff;
  border-radius: 20px;
  padding: 32px 20px 24px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
}
.logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  background: #fff0ee;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}
h1 {
  text-align: center;
  font-size: 20px;
  margin: 0 0 4px;
  color: #1a1a1a;
}
.subtitle {
  text-align: center;
  font-size: 13px;
  color: #999;
  margin: 0 0 24px;
}
.btn-wrap {
  padding: 20px 16px 8px;
}
.tip {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-top: 16px;
}
.tip a {
  color: #ff4b3a;
  text-decoration: none;
}
:deep(.van-cell-group--inset) {
  margin: 0;
}
</style>
