<template>
  <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#1f2937">
    <el-card style="width:360px">
      <div style="font-size:19px;font-weight:600;text-align:center;margin-bottom:6px">返利平台管理后台</div>
      <div style="text-align:center;color:#999;font-size:12px;margin-bottom:20px">admin / admin123</div>
      <el-form :model="form" @submit.prevent="submit">
        <el-form-item>
          <el-input v-model="form.username" placeholder="账号" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        </el-form-item>
        <el-button type="primary" style="width:100%" :loading="loading" @click="submit">登录</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const form = reactive({ username: 'admin', password: 'admin123' });
const loading = ref(false);
const router = useRouter();

async function submit() {
  loading.value = true;
  try {
    const r = await api.login(form);
    localStorage.setItem('adminToken', r.token);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } finally {
    loading.value = false;
  }
}
</script>
