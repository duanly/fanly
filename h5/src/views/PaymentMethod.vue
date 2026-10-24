<template>
  <div class="page">
    <van-nav-bar title="收款设置" left-arrow fixed placeholder @click-left="$router.back()" />

    <!-- 实名提示 -->
    <div v-if="info.realNameStatus === 2" class="realname-tip">
      <van-icon name="passed" size="16" />
      已实名认证：{{ info.realName }}，收款姓名需与实名一致
    </div>
    <div v-else class="realname-tip warn" @click="$router.push('/realname')">
      <van-icon name="info-o" size="16" />
      未实名认证，建议先完成认证 <span>去认证 ›</span>
    </div>

    <!-- tab 切换 -->
    <van-tabs v-model:active="tab" color="#ff4b3a" line-width="24" sticky offset-top="46">
      <van-tab title="微信收款" name="wechat" />
      <van-tab title="支付宝收款" name="alipay" />
    </van-tabs>

    <!-- 微信设置 -->
    <van-cell-group v-show="tab === 'wechat'" inset>
      <van-field
        v-model="wechatForm.realName"
        label="真实姓名"
        placeholder="请输入微信收款姓名"
        maxlength="20"
        :readonly="info.realNameStatus === 2"
      >
        <template #right-icon v-if="info.realNameStatus === 2">
          <span class="muted" style="font-size:12px">与实名一致</span>
        </template>
      </van-field>
      <van-cell title="收款码">
        <template #value>
          <div class="qr-upload" @click="pickImage('wechat')">
            <img v-if="wechatForm.qrCode" :src="wechatForm.qrCode" class="qr-img" />
            <div v-else class="qr-placeholder">
              <van-icon name="photograph" size="28" color="#ccc" />
              <span>点击上传</span>
            </div>
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 支付宝设置 -->
    <van-cell-group v-show="tab === 'alipay'" inset>
      <van-field
        v-model="alipayForm.realName"
        label="真实姓名"
        placeholder="请输入支付宝收款姓名"
        maxlength="20"
        :readonly="info.realNameStatus === 2"
      >
        <template #right-icon v-if="info.realNameStatus === 2">
          <span class="muted" style="font-size:12px">与实名一致</span>
        </template>
      </van-field>
      <van-field
        v-model="alipayForm.alipayAccount"
        label="支付宝账号"
        placeholder="选填，辅助打款"
        maxlength="64"
      />
      <van-cell title="收款码">
        <template #value>
          <div class="qr-upload" @click="pickImage('alipay')">
            <img v-if="alipayForm.qrCode" :src="alipayForm.qrCode" class="qr-img" />
            <div v-else class="qr-placeholder">
              <van-icon name="photograph" size="28" color="#ccc" />
              <span>点击上传</span>
            </div>
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <div style="padding:24px 16px">
      <van-button block round type="primary" color="#ff4b3a" :loading="saving" @click="save">
        保存
      </van-button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display:none"
      @change="onFileChange"
    />

    <!-- 图片预览 -->
    <van-image-preview v-model:show="previewShow" :images="previewImages" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { showToast } from 'vant';
import { api } from '../api';

const tab = ref('wechat');
const saving = ref(false);
const info = ref({ realNameStatus: 0, realName: '', wechat: {}, alipay: {} });
const wechatForm = reactive({ realName: '', qrCode: '' });
const alipayForm = reactive({ realName: '', qrCode: '', alipayAccount: '' });
const fileInput = ref(null);
const currentChannel = ref(''); // 当前在编辑哪个渠道的收款码
const previewShow = ref(false);
const previewImages = ref([]);

async function load() {
  info.value = await api.getPaymentMethod();
  wechatForm.realName = info.value.wechat.realName || '';
  wechatForm.qrCode = info.value.wechat.qrCode || '';
  alipayForm.realName = info.value.alipay.realName || '';
  alipayForm.qrCode = info.value.alipay.qrCode || '';
  alipayForm.alipayAccount = info.value.alipay.alipayAccount || '';
  // 已实名的话自动填充姓名
  if (info.value.realNameStatus === 2 && info.value.realName) {
    if (!wechatForm.realName) wechatForm.realName = info.value.realName;
    if (!alipayForm.realName) alipayForm.realName = info.value.realName;
  }
}

function pickImage(channel) {
  currentChannel.value = channel;
  fileInput.value.click();
}

async function onFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('图片不能超过 2MB');
    return;
  }
  // 上传
  const formData = new FormData();
  formData.append('file', file);
  try {
    // 复用头像上传接口，收款码也存在 uploads 目录下
    const r = await api.uploadAvatar(file);
    const url = r.url || '';
    if (currentChannel.value === 'wechat') {
      wechatForm.qrCode = url;
    } else {
      alipayForm.qrCode = url;
    }
    showToast('上传成功');
  } finally {
    e.target.value = ''; // 清空以便下次还能选同一张
  }
}

function previewQr(url) {
  previewImages.value = [{ src: url }];
  previewShow.value = true;
}

async function save() {
  const channel = tab.value === 'wechat' ? 'WECHAT' : 'ALIPAY';
  const form = tab.value === 'wechat' ? wechatForm : alipayForm;
  if (!form.realName.trim()) return showToast('请填写真实姓名');
  if (!form.qrCode) return showToast('请上传收款码');

  saving.value = true;
  try {
    await api.savePaymentMethod({
      channel,
      realName: form.realName.trim(),
      qrCode: form.qrCode,
      alipayAccount: tab.value === 'alipay' ? (form.alipayAccount || '').trim() : undefined,
    });
    showToast('保存成功');
    load();
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6f8;
}
.realname-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  margin: 12px 12px 0;
  background: #e8f7ee;
  color: #07c160;
  border-radius: 10px;
  font-size: 13px;
}
.realname-tip.warn {
  background: #fff7e6;
  color: #ff8a00;
  justify-content: space-between;
}
.realname-tip.warn span {
  color: #ff4b3a;
}
.qr-upload {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}
.qr-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.qr-placeholder {
  width: 100%;
  height: 100%;
  background: #f7f8fa;
  border: 1px dashed #dcdee0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #999;
  font-size: 11px;
}
.muted {
  color: #969799;
}
</style>
