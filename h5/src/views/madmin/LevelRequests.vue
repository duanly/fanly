<template>
  <div class="m-levels">
    <van-nav-bar
      title="等级审核"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    />

    <van-tabs v-model:active="status" sticky offset-top="46px" @change="onStatusChange">
      <van-tab title="待审核" :name="0" />
      <van-tab title="已通过" :name="1" />
      <van-tab title="已驳回" :name="2" />
      <van-tab title="已取消" :name="3" />
    </van-tabs>

    <div v-for="r in list" :key="r.id" class="req-card">
      <div class="req-head">
        <van-tag :type="r.requestType === 1 ? 'success' : 'danger'">
          {{ r.requestType === 1 ? '升级' : '降级' }}
        </van-tag>
        <span class="req-change">{{ levelName(r.fromLevel) }} → <b>{{ levelName(r.toLevel) }}</b></span>
      </div>
      <div class="req-info">
        {{ r.nickname || '未设置昵称' }} · {{ r.mobile }}
      </div>
      <div class="req-info">
        近 90 天佣金：<b>¥{{ money(r.perfSnapshot) }}</b>
      </div>
      <div v-if="r.status === 0 && r.requestType === 2" class="req-info" style="color:#ff4b3a">
        宽限至 {{ fmtDate(r.graceUntil) }}（剩 {{ graceDays(r.graceUntil) }} 天）
      </div>
      <div v-if="r.rejectReason" class="req-info muted">备注：{{ r.rejectReason }}</div>

      <div v-if="r.status === 0" class="req-actions">
        <van-button size="small" type="primary" @click="audit(r, true)">通过</van-button>
        <van-button size="small" type="danger" plain @click="audit(r, false)">驳回</van-button>
      </div>
    </div>

    <van-empty v-if="!list.length" description="暂无记录" />

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
import { onMounted, ref } from 'vue';
import { showConfirmDialog, showSuccessToast, showToast } from 'vant';
import { adminApi } from '../../api';

const NAMES = ['预备代理', '白银代理', '黄金代理', '钻石代理'];
const levelName = (l) => NAMES[l] ?? l;
const money = (v) => (+(v || 0)).toFixed(2);

function fmtDate(t) {
  if (!t) return '—';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function graceDays(t) {
  if (!t) return 0;
  return Math.max(0, Math.ceil((new Date(t).getTime() - Date.now()) / 86400000));
}

const status = ref(0);
const list = ref([]);
const active = ref(0);

async function load() {
  const r = await adminApi.levelRequests({ status: status.value, page: 1, size: 50 });
  list.value = r.list || [];
}
function onStatusChange() { load(); }

async function audit(r, pass) {
  try {
    if (pass) await showConfirmDialog({ title: '确认通过', message: `${levelName(r.fromLevel)} → ${levelName(r.toLevel)}` });
    await adminApi.auditLevel(r.id, pass, pass ? '' : '审核未通过');
    showSuccessToast('已处理');
    load();
  } catch (e) {
    if (e === 'cancel') return;
    showToast(e.message || '操作失败');
  }
}

onMounted(load);
</script>

<style scoped>
.m-levels { min-height: 100vh; background: #f5f6f8; padding-bottom: 70px; }
.req-card {
  background: #fff;
  margin: 10px 12px;
  border-radius: 12px;
  padding: 12px 14px;
}
.req-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.req-change { font-size: 13px; color: #333; }
.req-info {
  margin-top: 7px;
  font-size: 13px;
  color: #666;
}
.muted { color: #999; }
.req-actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}
</style>
