<template>
  <div class="madmin-realnames">
    <van-nav-bar
      title="实名审核"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <!-- 搜索 -->
    <div class="search-bar">
      <van-field
        v-model="keyword"
        placeholder="搜手机号 / 昵称 / 姓名"
        clearable
        left-icon="search"
        @keyup.enter="doSearch"
        @clear="doSearch"
      />
      <van-button type="primary" size="small" @click="doSearch">搜索</van-button>
    </div>

    <van-tabs v-model:active="status" sticky offset-top="98px" @change="onStatusChange">
      <van-tab title="审核中" name="1" />
      <van-tab title="已通过" name="2" />
      <van-tab title="已驳回" name="3" />
    </van-tabs>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <div class="rn-list">
        <div v-for="r in list" :key="r.id" class="rn-card">
          <div class="rn-head">
            <span class="rn-name">{{ r.realName || '未填姓名' }}</span>
            <van-tag :type="statusTagType(r.realNameStatus)" size="medium">
              {{ statusName(r.realNameStatus) }}
            </van-tag>
          </div>
          <div class="rn-body">
            <div class="rn-row">
              <span class="rn-label">用户 ID</span>
              <span class="rn-value">{{ r.id }}</span>
            </view>
            <div class="rn-row">
              <span class="rn-label">昵称</span>
              <span class="rn-value">{{ r.nickname || '—' }}</span>
            </div>
            <div class="rn-row">
              <span class="rn-label">手机号</span>
              <span class="rn-value">{{ r.mobile || '—' }}</span>
            </div>
            <div class="rn-row">
              <span class="rn-label">身份证号</span>
              <span class="rn-value">{{ maskId(r.idCardNo) }}</span>
            </div>
            <div class="rn-row">
              <span class="rn-label">提交时间</span>
              <span class="rn-value">{{ formatTime(r.createdAt) }}</span>
            </div>
            <div v-if="r.realNameRemark" class="rn-row">
              <span class="rn-label">备注</span>
              <span class="rn-value" :class="{ fail: r.realNameStatus === 3 }">{{ r.realNameRemark }}</span>
            </div>
          </div>
          <div v-if="r.realNameStatus === 1" class="rn-actions">
            <van-button size="small" type="danger" plain @click="openReject(r)">驳回</van-button>
            <van-button size="small" type="success" @click="pass(r)">通过</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无实名认证" />

    <!-- 驳回原因弹窗 -->
    <van-dialog
      v-model:show="showPrompt"
      title="驳回原因（会展示给用户）"
      show-cancel-button
      :before-close="onPromptConfirm"
    >
      <van-field
        v-model="rejectReason"
        rows="2"
        autosize
        type="textarea"
        placeholder="如：身份证号与姓名不一致"
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
import { ref } from 'vue';
import { showToast, showConfirmDialog, showSuccessToast } from 'vant';
import { adminApi } from '../../api';

function statusName(s) {
  return { 1: '审核中', 2: '已通过', 3: '已驳回' }[s] || '未知';
}
function statusTagType(s) {
  return { 1: 'warning', 2: 'success', 3: 'danger' }[s] || 'default';
}
function maskId(id) {
  if (!id) return '—';
  if (id.length < 8) return id;
  return id.slice(0, 3) + '***********' + id.slice(-4);
}
function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const status = ref('1');
const keyword = ref('');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const active = ref(0);

const showPrompt = ref(false);
const rejectReason = ref('');
const current = ref(null);
let reqSeq = 0;

function reset() {
  list.value = [];
  page.value = 1;
  finished.value = false;
}
function onStatusChange() { reset(); }
function doSearch() { reset(); }

async function onLoad() {
  const seq = ++reqSeq;
  try {
    const r = await adminApi.realnames({
      status: Number(status.value),
      keyword: keyword.value.trim() || undefined,
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

async function pass(r) {
  try {
    await showConfirmDialog({
      title: '审核通过',
      message: `确定通过 ${r.realName} 的实名认证？`,
    });
    await adminApi.auditRealname(r.id, true, '');
    showSuccessToast('已通过');
    r.realNameStatus = 2;
  } catch (e) {
    if (e === 'cancel') return;
  }
}

function openReject(r) {
  current.value = r;
  rejectReason.value = '';
  showPrompt.value = true;
}

async function onPromptConfirm(action) {
  if (action !== 'confirm') return true;
  if (!rejectReason.value.trim()) {
    showToast('请输入驳回原因');
    return false;
  }
  try {
    await adminApi.auditRealname(current.value.id, false, rejectReason.value.trim());
    showSuccessToast('已驳回');
    current.value.realNameStatus = 3;
    current.value.realNameRemark = rejectReason.value.trim();
  } catch {
    return false;
  }
  return true;
}
</script>

<style scoped>
.madmin-realnames {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 60px;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
}
.search-bar .van-field {
  flex: 1;
  background: #f7f8fa;
  border-radius: 999px;
  padding: 2px 14px;
}
.rn-list {
  padding: 8px 12px;
}
.rn-card {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  overflow: hidden;
}
.rn-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #f5f5f5;
}
.rn-name {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}
.rn-body {
  padding: 6px 14px 10px;
}
.rn-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 13px;
}
.rn-label {
  color: #999;
}
.rn-value {
  color: #333;
  max-width: 65%;
  text-align: right;
  word-break: break-all;
}
.rn-value.fail {
  color: #ee0a24;
}
.rn-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 10px 14px;
  border-top: 1px solid #f5f5f5;
}
</style>
