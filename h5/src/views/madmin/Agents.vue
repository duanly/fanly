<template>
  <div class="madmin-agents">
    <van-nav-bar
      title="代理管理"
      left-text="返回"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    />

    <van-tabs v-model:active="status" sticky offset-top="46px" @change="onStatusChange">
      <van-tab title="全部" name="" />
      <van-tab title="正常" name="1" />
      <van-tab title="待审核" name="0" />
      <van-tab title="已禁用" name="2" />
    </van-tabs>

    <div class="search-row">
      <van-search
        v-model="keyword"
        placeholder="搜索手机号/昵称/邀请码"
        shape="round"
        @search="onSearch"
      />
    </div>
    <div class="filter-row">
      <van-switch v-model="showPrep" size="18" @change="onPrepChange" />
      <span class="filter-label">显示预备代理</span>
    </div>

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <div class="agent-list">
        <div v-for="a in list" :key="a.id" class="agent-card">
          <div class="agent-head">
            <div class="a-info">
              <div class="a-mobile">{{ a.nickname || a.mobile || a.realName || '未知' }}</div>
              <div v-if="(a.nickname && a.mobile) || a.realName" class="a-sub">
                {{ a.mobile || (a.realName ? '实名: ' + a.realName : '') }}
              </div>
              <div class="a-code" @click="copyCode(a.agentCode)">
                推广码: <b>{{ a.agentCode || '-' }}</b>
                <van-icon name="copy-o" size="11" style="margin-left:2px" />
              </div>
            </div>
            <van-tag :type="statusTagType(a.status)" size="medium">
              {{ statusName(a.status) }}
            </van-tag>
          </div>
          <div class="agent-stats">
            <div class="a-stat">
              <div class="a-stat-num">{{ a.teamSize || 0 }}</div>
              <div class="a-stat-label">团队人数</div>
            </div>
            <div class="a-stat">
              <div class="a-stat-num">¥{{ a.stats?.creditedBonus || '0.00' }}</div>
              <div class="a-stat-label">已入账分成</div>
            </div>
            <div class="a-stat">
              <div class="a-stat-num">
                <span class="level-badge" :class="'lv-' + (a.level || 0)">
                  {{ levelIcon(a.level) }}{{ levelName(a.level) }}
                </span>
                <span v-if="a.manualLevel" class="manual-tag">手动</span>
              </div>
              <div class="a-stat-label">等级</div>
            </div>
          </div>
          <div class="agent-actions">
            <van-button size="small" type="primary" plain @click="openSetLevel(a)">
              设置等级
            </van-button>
            <van-button
              v-if="a.status === 0"
              size="small"
              type="success"
              @click="auditAgent(a, 1)"
            >通过</van-button>
            <van-button
              v-if="a.status === 0"
              size="small"
              type="danger"
              plain
              @click="auditAgent(a, 2)"
            >拒绝</van-button>
            <van-button
              v-if="a.status === 1"
              size="small"
              type="warning"
              plain
              @click="auditAgent(a, 2)"
            >禁用</van-button>
            <van-button
              v-if="a.status === 2"
              size="small"
              type="primary"
              @click="auditAgent(a, 1)"
            >恢复</van-button>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!loading && !list.length" description="暂无代理" />

    <!-- 设置等级弹层 -->
    <van-popup v-model:show="showLevelPicker" position="bottom" round :style="{ padding: '20px 20px 30px' }">
      <div style="font-size:17px;font-weight:700;margin-bottom:6px">设置代理等级</div>
      <div class="muted" style="font-size:12px;margin-bottom:16px">
        手动设置后，自动升级规则不再生效（优先级：手动 &gt; 自动）
      </div>
      <div class="level-picker">
        <div
          v-for="lv in levelOptions"
          :key="lv.value"
          class="lp-item"
          :class="{ active: pickedLevel === lv.value, disabled: lv.value === 0 && currentAgent?.status === 0 }"
          @click="pickedLevel = lv.value"
        >
          <div class="lp-ico">{{ lv.icon }}</div>
          <div class="lp-name">{{ lv.name }}</div>
          <div class="lp-rate">{{ lv.rate }}</div>
        </div>
      </div>
      <van-field
        v-if="pickedLevel > 0"
        v-model="customRate"
        placeholder="自定义一级分成比例（选填，如 0.15）"
        type="digit"
        style="margin-top:12px"
      />
      <van-field
        v-model="customRateL2"
        placeholder="自定义二级分成比例（选填，如 0.04；留空按人数自动）"
        type="digit"
        style="margin-top:12px"
      />
      <van-checkbox v-model="backToAuto" v-if="currentAgent?.manualLevel" style="margin-top:10px">
        取消手动标记，恢复自动升级
      </van-checkbox>
      <van-button
        block
        round
        type="primary"
        color="#ff4b3a"
        style="margin-top:16px"
        :loading="settingLevel"
        @click="confirmSetLevel"
      >确认设置</van-button>
    </van-popup>

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
  const m = { 0: '待审核', 1: '正常', 2: '已禁用' };
  return m[s] || '未知';
}

function statusTagType(s) {
  if (s === 1) return 'success';
  if (s === 0) return 'warning';
  return 'danger';
}

const levelOptions = [
  { value: 0, name: '预备代理', icon: '🎯', rate: '0%' },
  { value: 1, name: '白银代理', icon: '🥈', rate: '8%' },
  { value: 2, name: '黄金代理', icon: '🥇', rate: '12%' },
  { value: 3, name: '钻石代理', icon: '💎', rate: '18%' },
];

function levelName(l) {
  const names = { 0: '预备', 1: '白银', 2: '黄金', 3: '钻石' };
  return names[l] || '预备';
}

function levelIcon(l) {
  const icons = { 0: '🎯', 1: '🥈', 2: '🥇', 3: '💎' };
  return icons[l] || '🎯';
}

const status = ref('');
const keyword = ref('');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const active = ref('agents');
const showPrep = ref(false); // 是否显示预备代理（默认不显示）

// 设置等级弹层
const showLevelPicker = ref(false);
const currentAgent = ref(null);
const pickedLevel = ref(1);
const customRate = ref('');
const customRateL2 = ref('');
const backToAuto = ref(false);
const settingLevel = ref(false);

function openSetLevel(a) {
  currentAgent.value = a;
  pickedLevel.value = a.level ?? 0;
  customRate.value = a.agentRate || '';
  customRateL2.value = a.agentRateL2 || '';
  backToAuto.value = false;
  showLevelPicker.value = true;
}

async function confirmSetLevel() {
  if (!currentAgent.value) return;
  settingLevel.value = true;
  try {
    const body = { level: pickedLevel.value };
    if (customRate.value) body.agentRate = customRate.value;
    // 二级分成：填了用手动值，清空则显式回到按人数自动分档
    body.agentRateL2 = customRateL2.value ? customRateL2.value : null;
    if (backToAuto.value) body.manualLevel = false;
    await adminApi.updateAgent(currentAgent.value.id, body);
    showSuccessToast('设置成功');
    currentAgent.value.level = pickedLevel.value;
    if (customRate.value) currentAgent.value.agentRate = customRate.value;
    currentAgent.value.agentRateL2 = customRateL2.value || null;
    currentAgent.value.manualLevel = !backToAuto.value && pickedLevel.value > 0;
    showLevelPicker.value = false;
  } catch (e) {
    showToast(e.message || '设置失败');
  } finally {
    settingLevel.value = false;
  }
}

let reqSeq = 0;

function onStatusChange() {
  reset();
}

function onSearch() {
  reset();
}

function onPrepChange() {
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
      page: page.value,
      pageSize,
    };
    if (status.value !== '') params.status = Number(status.value);
    if (keyword.value.trim()) params.keyword = keyword.value.trim();
    if (!showPrep.value) params.minLevel = 1; // 默认过滤预备代理（level 0）

    const r = await adminApi.agents(params);
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

async function auditAgent(a, targetStatus) {
  const actionMap = { 1: '通过', 2: '禁用/拒绝' };
  try {
    await showConfirmDialog({
      title: '确认操作',
      message: `确定${actionMap[targetStatus] || '修改'}这个代理？`,
    });
    await adminApi.updateAgent(a.id, { status: targetStatus });
    showSuccessToast('操作成功');
    a.status = targetStatus;
  } catch (e) {
    if (e === 'cancel') return;
  }
}

function copyCode(code) {
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    showToast('推广码已复制');
  }).catch(() => {
    showToast('复制失败');
  });
}
</script>

<style scoped>
.madmin-agents {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 60px;
}
.search-row {
  padding: 8px 12px 0;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.search-row :deep(.van-search) {
  padding: 0;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 10px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.filter-label {
  font-size: 13px;
  color: #666;
}
.agent-list {
  padding: 8px 12px;
}
.agent-card {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  padding: 14px;
}
.agent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.a-info {
  flex: 1;
  min-width: 0;
}
.a-mobile {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 2px;
}
.a-sub {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.a-code {
  font-size: 12px;
  color: #999;
  display: inline-flex;
  align-items: center;
}
.a-code b {
  color: #ff4b3a;
  letter-spacing: 1px;
  font-weight: 600;
}
.agent-stats {
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
  border-top: 1px solid #f5f5f5;
  border-bottom: 1px solid #f5f5f5;
  margin-bottom: 10px;
}
.a-stat {
  text-align: center;
}
.a-stat-num {
  font-size: 16px;
  font-weight: 600;
  color: #ff4b3a;
  margin-bottom: 4px;
}
.a-stat-label {
  font-size: 11px;
  color: #999;
}
.agent-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* 等级徽章 */
.level-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.level-badge.lv-0 { background: #f5f5f5; color: #999; }
.level-badge.lv-1 { background: #f0f0f0; color: #666; }
.level-badge.lv-2 { background: #fff7e6; color: #c77700; }
.level-badge.lv-3 { background: #e6f4ff; color: #0066cc; }
.manual-tag {
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  font-size: 9px;
  background: #ff4b3a;
  color: #fff;
  border-radius: 3px;
  vertical-align: middle;
}

/* 等级选择器 */
.level-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.lp-item {
  text-align: center;
  padding: 12px 6px;
  border-radius: 10px;
  background: #f7f8fa;
  border: 2px solid transparent;
  transition: all .2s;
}
.lp-item.active {
  background: #fff5f0;
  border-color: #ff4b3a;
}
.lp-item.disabled {
  opacity: .4;
}
.lp-ico {
  font-size: 24px;
  margin-bottom: 4px;
}
.lp-name {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}
.lp-rate {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}
.muted { color: #999; }
</style>
