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
      <van-tab title="待审核" name="0" />
      <van-tab title="已通过" name="1" />
      <van-tab title="已拒绝" name="2" />
      <van-tab title="已打款" name="3" />
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
            <span class="wd-amount">¥{{ w.amount || 0 }}</span>
            <van-tag :type="statusTagType(w.status)" size="medium">
              {{ statusName(w.status) }}
            </van-tag>
          </div>
          <div class="wd-body">
            <div class="wd-row">
              <span class="wd-label">用户</span>
              <span class="wd-value">{{ w.mobile || w.userId || '-' }}</span>
            </div>
            <div class="wd-row">
              <span class="wd-label">提现方式</span>
              <span class="wd-value">{{ w.channel || '微信' }}</span>
            </div>
            <div v-if="w.realName" class="wd-row">
              <span class="wd-label">姓名</span>
              <span class="wd-value">{{ w.realName }}</span>
            </div>
            <div v-if="w.account" class="wd-row">
              <span class="wd-label">账号</span>
              <span class="wd-value">{{ w.account }}</span>
            </div>
            <div class="wd-row">
              <span class="wd-label">申请时间</span>
              <span class="wd-value">{{ formatTime(w.createdAt) }}</span>
            </div>
            <div v-if="w.failReason" class="wd-row">
              <span class="wd-label">拒绝原因</span>
              <span class="wd-value fail">{{ w.failReason }}</span>
            </div>
          </div>
          <div v-if="w.status === 0" class="wd-actions">
            <van-button
              size="small"
              type="danger"
              plain
              @click="reject(w)"
            >拒绝</van-button>
            <van-button
              size="small"
              type="primary"
              @click="approve(w)"
            >通过</van-button>
          </div>
          <div v-else-if="w.status === 1" class="wd-actions">
            <van-button
              size="small"
              type="success"
              @click="markPaid(w)"
            >标记已打款</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无提现记录" />

    <!-- 底部 tabbar -->
    <van-tabbar v-model="active" route fixed safe-area-inset-bottom active-color="#ff4b3a">
      <van-tabbar-item to="/madmin" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item to="/madmin/orders" icon="orders-o">订单</van-tabbar-item>
      <van-tabbar-item to="/madmin/pool" icon="shop-collect-o">选品池</van-tabbar-item>
      <van-tabbar-item to="/madmin/agents" icon="friends-o">代理</van-tabbar-item>
      <van-tabbar-item to="/madmin/withdraws" icon="gold-coin-o">提现</van-tabbar-item>
    </van-tabbar>

    <!-- 拒绝原因弹窗 -->
    <van-dialog
      v-model:show="showReject"
      title="拒绝原因"
      show-cancel-button
      :before-close="onRejectConfirm"
    >
      <van-field
        v-model="rejectReason"
        rows="3"
        autosize
        label="原因"
        type="textarea"
        placeholder="请输入拒绝原因"
      />
    </van-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { showToast, showConfirmDialog, showSuccessToast } from 'vant';
import { adminApi } from '../../api';

function statusName(s) {
  const m = { 0: '待审核', 1: '已通过', 2: '已拒绝', 3: '已打款' };
  return m[s] || '未知';
}

function statusTagType(s) {
  if (s === 0) return 'warning';
  if (s === 1) return 'primary';
  if (s === 3) return 'success';
  return 'danger';
}

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const status = ref('0');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const active = ref('withdraws');

const showReject = ref(false);
const rejectReason = ref('');
const currentWithdraw = ref(null);

let reqSeq = 0;

function onStatusChange() {
  reset();
}

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
}

async function onLoad() {
  const seq = ++reqSeq;
  try {
    const params = {
      status: Number(status.value),
      page: page.value,
      pageSize,
    };
    const r = await adminApi.withdraws(params);
    if (seq !== reqSeq) return;
    const rows = r.list || r || [];
    list.value = list.value.concat(rows);
    page.value++;
    if (rows.length < pageSize) {
      finished.value = true;
    }
  } catch (e) {
    showToast(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function approve(w) {
  try {
    await showConfirmDialog({
      title: '审核通过',
      message: `确定通过 ¥${w.amount} 的提现申请？`,
    });
    await adminApi.auditWithdraw(w.id, true, '');
    showSuccessToast('已通过');
    w.status = 1;
  } catch (e) {
    if (e === 'cancel') return;
  }
}

function reject(w) {
  currentWithdraw.value = w;
  rejectReason.value = '';
  showReject.value = true;
}

async function onRejectConfirm(action) {
  if (action !== 'confirm') return true;
  if (!rejectReason.value.trim()) {
    showToast('请输入拒绝原因');
    return false;
  }
  try {
    await adminApi.auditWithdraw(currentWithdraw.value.id, false, rejectReason.value.trim());
    showSuccessToast('已拒绝');
    currentWithdraw.value.status = 2;
    currentWithdraw.value.failReason = rejectReason.value.trim();
    showReject.value = false;
  } catch {
    return false;
  }
  return true;
}

async function markPaid(w) {
  try {
    await showConfirmDialog({
      title: '确认打款',
      message: `确定已给 ¥${w.amount} 完成打款？`,
    });
    await adminApi.finishWithdraw(w.id, true, '', '');
    showSuccessToast('已标记打款');
    w.status = 3;
  } catch (e) {
    if (e === 'cancel') return;
  }
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
.wd-amount {
  font-size: 20px;
  font-weight: 700;
  color: #ff4b3a;
}
.wd-body {
  padding: 10px 14px;
}
.wd-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}
.wd-label {
  color: #999;
}
.wd-value {
  color: #333;
  max-width: 60%;
  text-align: right;
  word-break: break-all;
}
.wd-value.fail {
  color: #ee0a24;
}
.wd-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 10px 14px;
  border-top: 1px solid #f5f5f5;
}
</style>
