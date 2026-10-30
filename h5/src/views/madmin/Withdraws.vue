<template>
  <div class="madmin-withdraws">
    <van-nav-bar
      title="提现审核"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <van-tabs v-model:active="status" sticky offset-top="46px" @change="onStatusChange">
      <van-tab title="待审核" name="1" />
      <van-tab title="待打款" name="2" />
      <van-tab title="已打款" name="4" />
      <van-tab title="已驳回" name="6" />
      <van-tab title="失败" name="5" />
    </van-tabs>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <div class="wd-list">
        <div v-for="w in list" :key="w.id" class="wd-card">
          <div class="wd-head">
            <div class="wd-head-left">
              <span class="wd-amount">¥{{ w.amount || 0 }}</span>
              <span v-if="+w.fee > 0" class="wd-fee">手续费 ¥{{ w.fee }}</span>
            </div>
            <van-tag :type="statusTagType(w.status)" size="medium">
              {{ statusName(w.status) }}
            </van-tag>
          </div>
          <div class="wd-body">
            <div class="wd-row">
              <span class="wd-label">用户</span>
              <span class="wd-value">
                ID {{ w.userId }}<template v-if="w.nickname"> · {{ w.nickname }}</template><template v-if="w.mobile"> · {{ w.mobile }}</template>
              </span>
            </div>
            <div class="wd-row">
              <span class="wd-label">提现方式</span>
              <span class="wd-value">{{ w.channel === 'ALIPAY' ? '支付宝' : '微信' }}</span>
            </div>
            <div v-if="w.payeeName" class="wd-row">
              <span class="wd-label">收款人</span>
              <span class="wd-value">{{ w.payeeName }}</span>
            </div>
            <div v-if="w.accountInfo" class="wd-row">
              <span class="wd-label">账号信息</span>
              <span class="wd-value">{{ w.accountInfo }}</span>
            </div>
            <div v-if="w.qrCodeUrl" class="wd-row">
              <span class="wd-label">收款码</span>
              <img :src="w.qrCodeUrl" class="wd-qr" @click="previewQr(w.qrCodeUrl)" />
            </div>
            <div class="wd-row">
              <span class="wd-label">申请时间</span>
              <span class="wd-value">{{ formatTime(w.createdAt) }}</span>
            </div>
            <div v-if="w.channelOrderNo" class="wd-row">
              <span class="wd-label">打款流水号</span>
              <span class="wd-value">{{ w.channelOrderNo }}</span>
            </div>
            <div v-if="w.failReason" class="wd-row">
              <span class="wd-label">原因</span>
              <span class="wd-value fail">{{ w.failReason }}</span>
            </div>
          </div>

          <!-- 待审核：通过 / 驳回 -->
          <div v-if="w.status === 1" class="wd-actions">
            <van-button size="small" type="danger" plain @click="openPrompt(w, 'reject')">驳回</van-button>
            <van-button size="small" type="primary" @click="approve(w)">通过</van-button>
          </div>
          <!-- 待打款 / 打款中：登记打款结果 -->
          <div v-else-if="w.status === 2 || w.status === 3" class="wd-actions">
            <van-button size="small" plain @click="openPrompt(w, 'fail')">打款失败</van-button>
            <van-button size="small" type="success" @click="openPrompt(w, 'paidno')">打款成功</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无提现记录" />

    <!-- 通用输入弹窗：驳回原因 / 失败原因 / 流水号 -->
    <van-dialog
      v-model:show="showPrompt"
      :title="promptTitle"
      show-cancel-button
      :before-close="onPromptConfirm"
    >
      <van-field
        v-model="promptText"
        rows="2"
        :autosize="promptMode === 'paidno' ? false : { minHeight: 60 }"
        :type="promptMode === 'paidno' ? 'text' : 'textarea'"
        :placeholder="promptPlaceholder"
      />
    </van-dialog>

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/agents" icon="friends-o">代理</van-tabbar-item>
      <van-tabbar-item to="/madmin/withdraws" icon="gold-coin-o">提现</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { showToast, showConfirmDialog, showSuccessToast, showImagePreview } from 'vant';
import { adminApi } from '../../api';

// 后端真实状态：1待审核 2待打款 3打款中 4已打款 5失败 6已驳回
function statusName(s) {
  return { 1: '待审核', 2: '待打款', 3: '打款中', 4: '已打款', 5: '失败', 6: '已驳回' }[s] || '未知';
}
function statusTagType(s) {
  return { 1: 'warning', 2: 'primary', 3: 'primary', 4: 'success', 5: 'danger', 6: 'default' }[s] || 'default';
}
function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const status = ref('1');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const active = ref('withdraws');

const showPrompt = ref(false);
const promptMode = ref('reject'); // reject | fail | paidno
const promptText = ref('');
const current = ref(null);
let reqSeq = 0;

const promptTitle = computed(
  () => ({ reject: '驳回原因（展示给用户，金额退回余额）', fail: '打款失败原因（金额退回余额）', paidno: '打款成功，填通道流水号（选填）' }[promptMode.value]),
);
const promptPlaceholder = computed(
  () => ({ reject: '如：收款人信息有误', fail: '如：账户被限额', paidno: '微信/支付宝的转账单号' }[promptMode.value]),
);

function onStatusChange() { reset(); }
function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
}

async function onLoad() {
  const seq = ++reqSeq;
  try {
    const r = await adminApi.withdraws({
      status: Number(status.value),
      page: page.value,
      pageSize,
    });
    if (seq !== reqSeq) return;
    const rows = r.list || [];
    list.value = list.value.concat(rows);
    page.value++;
    if (rows.length < pageSize) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

async function approve(w) {
  try {
    await showConfirmDialog({
      title: '审核通过',
      message: `确定通过 ¥${w.amount} 的提现？通过后进入待打款。`,
    });
    await adminApi.auditWithdraw(w.id, true, '');
    showSuccessToast('已通过');
    w.status = 2;
  } catch (e) {
    if (e === 'cancel') return;
  }
}

function openPrompt(w, mode) {
  current.value = w;
  promptMode.value = mode;
  promptText.value = '';
  showPrompt.value = true;
}

async function onPromptConfirm(action) {
  if (action !== 'confirm') return true;
  const w = current.value;
  const text = promptText.value.trim();
  try {
    if (promptMode.value === 'reject') {
      if (!text) { showToast('请输入驳回原因'); return false; }
      await adminApi.auditWithdraw(w.id, false, text);
      w.status = 6;
    } else if (promptMode.value === 'fail') {
      if (!text) { showToast('请输入失败原因'); return false; }
      await adminApi.finishWithdraw(w.id, false, '', text);
      w.status = 5;
    } else {
      await adminApi.finishWithdraw(w.id, true, text, '');
      w.status = 4;
    }
    w.failReason = (promptMode.value === 'reject' || promptMode.value === 'fail') ? text : w.failReason;
    w.channelOrderNo = promptMode.value === 'paidno' ? text : w.channelOrderNo;
    showSuccessToast('已处理');
  } catch {
    return false;
  }
  return true;
}

function previewQr(url) {
  showImagePreview([url]);
}
</script>

<style scoped>
.madmin-withdraws {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 60px;
}
.wd-list {
  padding: 8px 12px;
}
.wd-card {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  overflow: hidden;
}
.wd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #f5f5f5;
}
.wd-head-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.wd-amount {
  font-size: 20px;
  font-weight: 700;
  color: #ff4b3a;
}
.wd-fee {
  font-size: 11px;
  color: #999;
}
.wd-body {
  padding: 6px 14px 10px;
}
.wd-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 13px;
}
.wd-label {
  color: #999;
}
.wd-value {
  color: #333;
  max-width: 68%;
  text-align: right;
  word-break: break-all;
}
.wd-value.fail {
  color: #ee0a24;
}
.wd-qr {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  border: 1px solid #eee;
  object-fit: cover;
}
.wd-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 10px 14px;
  border-top: 1px solid #f5f5f5;
}
</style>
