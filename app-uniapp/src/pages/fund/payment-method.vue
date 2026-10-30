<template>
  <view class="page">
    <!-- 实名提示 -->
    <view v-if="realNameStatus === 2" class="realname-tip">
      ✅ 已实名认证：{{ realName }}，收款姓名需与实名一致
    </view>
    <view v-else class="realname-tip warn" @click="goRealname">
      <text>⚠️ 未实名认证，建议先完成认证</text>
      <text class="go">去认证 ›</text>
    </view>

    <!-- 渠道切换 -->
    <view class="tabs">
      <view class="tab" :class="{ on: tab === 'wechat' }" @click="tab = 'wechat'">微信收款</view>
      <view class="tab" :class="{ on: tab === 'alipay' }" @click="tab = 'alipay'">支付宝收款</view>
    </view>

    <view class="card">
      <!-- 微信 -->
      <template v-if="tab === 'wechat'">
        <view class="field">
          <text class="label">真实姓名</text>
          <input v-model="wechatForm.realName" class="input" placeholder="请输入微信收款姓名" maxlength="20" :disabled="realNameStatus === 2" />
        </view>
        <view class="field column">
          <text class="label">收款码</text>
          <view class="upload" @click="pickImage('wechat')">
            <image v-if="wechatForm.qrCode" :src="wechatForm.qrCode" class="up-img" mode="aspectFill" />
            <view v-else class="ph"><text class="ph-ico">🖼️</text><text>点击上传收款码</text></view>
          </view>
        </view>
      </template>

      <!-- 支付宝 -->
      <template v-else>
        <view class="field">
          <text class="label">真实姓名</text>
          <input v-model="alipayForm.realName" class="input" placeholder="请输入支付宝收款姓名" maxlength="20" :disabled="realNameStatus === 2" />
        </view>
        <view class="field">
          <text class="label">支付宝账号</text>
          <input v-model="alipayForm.alipayAccount" class="input" placeholder="选填，辅助打款" maxlength="64" />
        </view>
        <view class="field column">
          <text class="label">收款码</text>
          <view class="upload" @click="pickImage('alipay')">
            <image v-if="alipayForm.qrCode" :src="alipayForm.qrCode" class="up-img" mode="aspectFill" />
            <view v-else class="ph"><text class="ph-ico">🖼️</text><text>点击上传收款码</text></view>
          </view>
        </view>
      </template>

      <button class="submit" :loading="saving" @click="save">保存</button>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';

const tab = ref('wechat');
const saving = ref(false);
const realNameStatus = ref(0);
const realName = ref('');
const wechatForm = reactive({ realName: '', qrCode: '' });
const alipayForm = reactive({ realName: '', qrCode: '', alipayAccount: '' });
let currentChannel = 'wechat';

async function load() {
  try {
    const info = await api.getPaymentMethod();
    realNameStatus.value = info.realNameStatus ?? 0;
    realName.value = info.realName || '';
    wechatForm.realName = info.wechat?.realName || '';
    wechatForm.qrCode = info.wechat?.qrCode || '';
    alipayForm.realName = info.alipay?.realName || '';
    alipayForm.qrCode = info.alipay?.qrCode || '';
    alipayForm.alipayAccount = info.alipay?.alipayAccount || '';
    // 已实名自动填充姓名
    if (realNameStatus.value === 2 && realName.value) {
      if (!wechatForm.realName) wechatForm.realName = realName.value;
      if (!alipayForm.realName) alipayForm.realName = realName.value;
    }
  } catch {}
}

function pickImage(channel) {
  currentChannel = channel;
  uni.chooseImage({
    count: 1,
    success: async (res) => {
      uni.showLoading({ title: '上传中' });
      try {
        // 与 H5 一致：复用头像上传接口，收款码也存 uploads
        const r = await api.uploadAvatar(res.tempFilePaths[0]);
        if (channel === 'wechat') wechatForm.qrCode = r.url || '';
        else alipayForm.qrCode = r.url || '';
        uni.showToast({ title: '上传成功', icon: 'success' });
      } catch {
        uni.showToast({ title: '上传失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },
  });
}

async function save() {
  const form = tab.value === 'wechat' ? wechatForm : alipayForm;
  if (!form.realName.trim()) return uni.showToast({ title: '请填写真实姓名', icon: 'none' });
  if (!form.qrCode) return uni.showToast({ title: '请上传收款码', icon: 'none' });
  saving.value = true;
  try {
    await api.savePaymentMethod({
      channel: tab.value === 'wechat' ? 'WECHAT' : 'ALIPAY',
      realName: form.realName.trim(),
      qrCode: form.qrCode,
      alipayAccount: tab.value === 'alipay' ? (alipayForm.alipayAccount || '').trim() : undefined,
    });
    uni.showToast({ title: '保存成功', icon: 'success' });
    load();
  } finally {
    saving.value = false;
  }
}

function goRealname() { uni.navigateTo({ url: '/pages/realname/realname' }); }

onShow(load);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.realname-tip {
  margin: 24rpx; padding: 20rpx 28rpx;
  background: #e8f7ee; color: #07c160;
  border-radius: 20rpx; font-size: 24rpx;
}
.realname-tip.warn {
  background: #fff7e6; color: #ff8a00;
  display: flex; justify-content: space-between; align-items: center;
}
.realname-tip.warn .go { color: $brand; }

.tabs { display: flex; background: #fff; }
.tab { flex: 1; text-align: center; padding: 28rpx 0; font-size: 28rpx; color: #666; }
.tab.on { color: $brand; font-weight: 800; position: relative; }
.tab.on::after {
  content: ''; position: absolute;
  left: 50%; bottom: 8rpx; transform: translateX(-50%);
  width: 48rpx; height: 6rpx; background: $brand; border-radius: 3rpx;
}

.card { margin: 24rpx; background: #fff; border-radius: 24rpx; padding: 8rpx 28rpx; }
.field { display: flex; align-items: center; padding: 32rpx 0; border-bottom: 2rpx solid #f5f6f8; }
.field:last-of-type { border-bottom: none; }
.field.column { flex-direction: column; align-items: stretch; }
.label { width: 200rpx; font-size: 28rpx; color: #333; flex-shrink: 0; }
.field.column .label { width: auto; margin-bottom: 20rpx; }
.input { flex: 1; font-size: 28rpx; }
.upload {
  width: 240rpx; height: 240rpx;
  border-radius: 16rpx; border: 2rpx dashed #ddd; overflow: hidden;
}
.up-img { width: 100%; height: 100%; }
.ph {
  height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12rpx; color: #999; font-size: 22rpx;
}
.ph-ico { font-size: 48rpx; }
.submit {
  margin: 24rpx 0;
  height: 88rpx; line-height: 88rpx;
  background: $brand; color: #fff;
  border-radius: 999rpx; font-size: 30rpx;
}
.submit::after { border: none; }
</style>
