<template>
  <div class="page">
    <van-nav-bar title="实名认证" left-arrow fixed placeholder @click-left="$router.back()" />

    <!-- 状态提示 -->
    <div v-if="info.status === 2" class="status-bar success">
      <van-icon name="checked" size="20" />
      <span>已实名认证</span>
    </div>
    <div v-else-if="info.status === 1" class="status-bar warning">
      <van-icon name="clock-o" size="18" />
      <span>审核中，一般 1-2 个工作日完成</span>
    </div>
    <div v-else-if="info.status === 3" class="status-bar danger">
      <van-icon name="info-o" size="18" />
      <span>审核未通过：{{ info.remark || '请检查后重新提交' }}</span>
    </div>
    <div v-else class="status-bar">
      <van-icon name="contact" size="18" />
      <span>请完成实名认证后再提现</span>
    </div>

    <!-- 已通过/审核中：显示信息 -->
    <van-cell-group v-if="info.status === 2 || info.status === 1" inset style="margin-top:12px">
      <van-cell title="真实姓名" :value="info.realName || '—'" />
      <van-cell title="身份证号" :value="info.idCardNo || '—'" />
    </van-cell-group>

    <!-- 未提交/驳回：表单 -->
    <van-cell-group v-else inset style="margin-top:12px">
      <van-field
        v-model="form.realName"
        label="真实姓名"
        placeholder="请输入身份证上的姓名"
        maxlength="20"
      />
      <van-field
        v-model="form.idCardNo"
        label="身份证号"
        placeholder="请输入 18 位身份证号"
        maxlength="18"
      />
    </van-cell-group>

    <div v-if="info.status === 0 || info.status === 3" style="padding:24px 16px">
      <van-button block round type="primary" color="#ff4b3a" :loading="loading" @click="submit">
        提交认证
      </van-button>
    </div>

    <div class="tips">
      <div class="tips-title">温馨提示</div>
      <div>· 实名认证后不可修改，请确保信息准确</div>
      <div>· 收款账户姓名需与实名一致</div>
      <div>· 所有信息仅用于身份核验，严格保密</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { showToast } from 'vant';
import { api } from '../api';

const info = ref({ status: 0, realName: '', idCardNo: '', remark: '' });
const form = reactive({ realName: '', idCardNo: '' });
const loading = ref(false);

async function load() {
  info.value = await api.getRealName();
  form.realName = info.value.realName || '';
  form.idCardNo = info.value.idCardNo ? info.value.idCardNo.replace(/\*/g, '') : '';
}

async function submit() {
  if (!form.realName.trim()) return showToast('请输入真实姓名');
  if (form.realName.trim().length < 2) return showToast('姓名至少 2 个字');
  if (!/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(form.idCardNo.trim())) {
    return showToast('身份证号格式不正确');
  }
  loading.value = true;
  try {
    await api.submitRealName({
      realName: form.realName.trim(),
      idCardNo: form.idCardNo.trim(),
    });
    showToast('已提交，等待审核');
    info.value.status = 1;
    setTimeout(() => load(), 500);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6f8;
}
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  margin: 12px 12px 0;
  background: #fff;
  border-radius: 12px;
  font-size: 14px;
  color: #333;
}
.status-bar.success {
  background: #e8f7ee;
  color: #07c160;
}
.status-bar.warning {
  background: #fff7e6;
  color: #ff8a00;
}
.status-bar.danger {
  background: #fff1f0;
  color: #ff4b3a;
}
.tips {
  margin: 20px 16px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 12px;
  font-size: 12px;
  color: #999;
  line-height: 2;
}
.tips-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}
</style>
