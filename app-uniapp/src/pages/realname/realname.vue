<template>
  <view class="page">
    <!-- 状态条 -->
    <view v-if="status === 2" class="status-bar success">✅ 已实名认证</view>
    <view v-else-if="status === 1" class="status-bar warning">⏳ 审核中，一般 1-2 个工作日完成</view>
    <view v-else-if="status === 3" class="status-bar danger">⛔ 审核未通过：{{ remark || '请检查后重新提交' }}</view>
    <view v-else class="status-bar normal">🪪 请完成实名认证后再提现</view>

    <!-- 已通过/审核中：只读信息 -->
    <view v-if="status === 2 || status === 1" class="card">
      <view class="field">
        <text class="label">真实姓名</text>
        <text class="value">{{ realName || '—' }}</text>
      </view>
      <view class="field">
        <text class="label">身份证号</text>
        <text class="value">{{ idCardNo || '—' }}</text>
      </view>
    </view>

    <!-- 未提交/驳回：表单（后端只收姓名+身份证号，不收证件照片） -->
    <view v-else class="card">
      <view class="field">
        <text class="label">真实姓名</text>
        <input v-model="form.realName" class="input" placeholder="身份证上的姓名" maxlength="20" />
      </view>
      <view class="field">
        <text class="label">身份证号</text>
        <input v-model="form.idCardNo" class="input" maxlength="18" placeholder="18 位身份证号" />
      </view>
      <button class="submit" :loading="saving" @click="submit">提交认证</button>
    </view>

    <view class="tips">
      <view class="tips-title">温馨提示</view>
      <view>· 实名认证后不可修改，请确保信息准确</view>
      <view>· 收款账户姓名需与实名一致</view>
      <view>· 所有信息仅用于身份核验，严格保密</view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';

const status = ref(0);
const realName = ref('');
const idCardNo = ref('');
const remark = ref('');
const saving = ref(false);
const form = reactive({ realName: '', idCardNo: '' });

async function load() {
  try {
    const r = await api.getRealName();
    status.value = r.status ?? 0;
    realName.value = r.realName || '';
    idCardNo.value = r.idCardNo || '';
    remark.value = r.remark || '';
    form.realName = r.realName || '';
    // 后端返回的是脱敏号（3+星+4），有星号就不回填，避免把星号提交回去
    form.idCardNo = r.idCardNo && !r.idCardNo.includes('*') ? r.idCardNo : '';
  } catch {}
}

async function submit() {
  const name = form.realName.trim();
  const id = form.idCardNo.trim();
  if (name.length < 2) return uni.showToast({ title: '请输入真实姓名', icon: 'none' });
  if (!/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(id)) {
    return uni.showToast({ title: '身份证号格式不正确', icon: 'none' });
  }
  saving.value = true;
  try {
    await api.submitRealName({ realName: name, idCardNo: id });
    uni.showToast({ title: '已提交，等待审核', icon: 'none' });
    setTimeout(load, 500);
  } finally {
    saving.value = false;
  }
}

onShow(load);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.status-bar {
  display: flex; align-items: center;
  margin: 24rpx; padding: 24rpx 28rpx;
  background: #fff; border-radius: 20rpx;
  font-size: 26rpx; color: #333;
}
.status-bar.success { background: #e8f7ee; color: #07c160; }
.status-bar.warning { background: #fff7e6; color: #ff8a00; }
.status-bar.danger { background: #fef0f0; color: #ee0a24; }

.card { margin: 0 24rpx; background: #fff; border-radius: 24rpx; padding: 8rpx 28rpx; }
.field { display: flex; align-items: center; padding: 32rpx 0; border-bottom: 2rpx solid #f5f6f8; }
.field:last-of-type { border-bottom: none; }
.label { width: 180rpx; font-size: 28rpx; color: #333; flex-shrink: 0; }
.input, .value { flex: 1; font-size: 28rpx; color: #1a1a1a; }
.submit {
  margin: 24rpx 0;
  height: 88rpx; line-height: 88rpx;
  background: $brand; color: #fff;
  border-radius: 999rpx; font-size: 30rpx;
}
.submit::after { border: none; }

.tips { padding: 16rpx 40rpx; font-size: 22rpx; color: #999; line-height: 2; }
.tips-title { font-size: 24rpx; color: #666; margin-bottom: 8rpx; }
</style>
