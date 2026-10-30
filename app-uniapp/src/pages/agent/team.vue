<template>
  <view class="page">
    <view class="summary">
      <view class="s-item">
        <view class="s-num">{{ profile?.inviteCount || 0 }}</view>
        <view class="s-lbl">直属好友</view>
      </view>
      <view class="s-item">
        <view class="s-num">{{ total }}</view>
        <view class="s-lbl">团队总人数</view>
      </view>
    </view>

    <view v-if="list.length" class="list">
      <view v-for="u in list" :key="u.id" class="row">
        <view class="avatar">{{ (u.nickname || '').slice(0, 1) }}</view>
        <view class="info">
          <view class="name">
            <text>{{ u.nickname }}</text>
            <text v-if="u.agentLevel >= 1" class="badge">{{ LEVELS[u.agentLevel] }}代理</text>
            <text v-else class="normal">普通用户</text>
          </view>
          <view class="mobile">{{ u.mobile || '未绑定手机' }}</view>
        </view>
        <view class="rebate">
          <view class="r-amt">¥{{ money(u.totalRebate) }}</view>
          <view class="r-lbl">累计贡献</view>
        </view>
      </view>
    </view>
    <view v-else-if="!loading" class="empty">还没有人扫你的码，快去分享吧</view>
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="finished && list.length" class="state">没有更多了</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onReachBottom } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';
import { money } from '../../utils/format.js';

const LEVELS = ['预备', '白银', '黄金', '钻石'];
const profile = ref(null);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const finished = ref(false);
const loading = ref(false);

async function load(reset = false) {
  if (loading.value) return;
  if (reset) {
    page.value = 1;
    finished.value = false;
    list.value = [];
  }
  if (finished.value) return;
  loading.value = true;
  try {
    const [pr, r] = await Promise.all([
      list.value.length ? Promise.resolve(profile.value) : api.profile(),
      api.agentTeam({ page: page.value, pageSize: 20 }),
    ]);
    if (!list.value.length) profile.value = pr;
    list.value.push(...(r.list || []));
    total.value = r.total || 0;
    page.value += 1;
    if (list.value.length >= total.value) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

onShow(() => { if (!list.value.length) load(true); });
onReachBottom(() => load());
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.summary { display: flex; background: linear-gradient(135deg, #ff6a3d, #ff3b30); margin: 24rpx; border-radius: 24rpx; padding: 40rpx 0; }
.s-item { flex: 1; text-align: center; color: #fff; }
.s-num { font-size: 44rpx; font-weight: 800; }
.s-lbl { font-size: 22rpx; opacity: .85; margin-top: 8rpx; }
.list { margin: 0 24rpx; background: #fff; border-radius: 24rpx; padding: 0 28rpx; }
.row { display: flex; align-items: center; gap: 20rpx; padding: 28rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.row:last-child { border-bottom: none; }
.avatar {
  width: 80rpx; height: 80rpx; border-radius: 50%;
  background: linear-gradient(135deg, #ff976a, #ff4b3a); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700; flex: none;
}
.info { flex: 1; min-width: 0; }
.name { font-size: 28rpx; color: #333; display: flex; align-items: center; gap: 12rpx; }
.badge { font-size: 20rpx; color: $brand; background: #fff0ec; border-radius: 6rpx; padding: 2rpx 10rpx; }
.normal { font-size: 20rpx; color: #bbb; }
.mobile { font-size: 22rpx; color: #999; margin-top: 8rpx; }
.rebate { text-align: right; flex: none; }
.r-amt { font-size: 30rpx; font-weight: 700; color: $brand; }
.r-lbl { font-size: 20rpx; color: #999; margin-top: 4rpx; }
.empty { text-align: center; color: #999; font-size: 24rpx; padding: 80rpx 0; }
.state { text-align: center; color: #999; font-size: 22rpx; padding: 32rpx; }
</style>
