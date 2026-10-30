<template>
  <view class="page">
    <view v-if="list.length" class="list">
      <view v-for="(item, i) in list" :key="item.actId" class="card">
        <image class="img" :src="item.img" mode="widthFix" />
        <view class="body">
          <view class="name">{{ item.actName }}</view>
          <view class="desc">{{ item.desc || '限时优惠' }}</view>
          <button class="btn" size="mini" @click="onClick(item)">立即领券</button>
        </view>
      </view>
    </view>
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="!list.length" class="state">暂无活动，稍后再来看看～</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onReachBottom, onLoad } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';

const list = ref([]);
const page = ref(1);
const pageSize = 20;
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
    const r = await api.jtkActivities({ page: page.value, pageSize });
    const rows = r.list || [];
    list.value.push(...rows);
    if (rows.length < pageSize) finished.value = true;
    page.value += 1;
  } finally {
    loading.value = false;
  }
}

async function onClick(item) {
  try {
    uni.showLoading({ title: '正在打开' });
    const r = await api.jtkConvert(item.actId);
    uni.hideLoading();
    // 小程序内无法直接唤起竞品 App，优先提示复制/打开 H5（阶段1：展示链接，引导用户）
    const url = r.longH5 || r.h5 || '';
    if (url) {
      uni.setClipboardData({
        data: url,
        success: () => uni.showModal({
          title: '已复制活动链接',
          content: '复制成功，去浏览器或对应 App 打开即可领券下单',
          showCancel: false,
        }),
      });
    } else {
      uni.showToast({ title: '跳转链接获取失败', icon: 'none' });
    }
  } catch (e) {
    uni.hideLoading();
  }
}

onShow(() => {
  if (!list.value.length) load(true);
});
onReachBottom(() => load());
</script>

<style lang="scss" scoped>
.page { padding: 20rpx 24rpx; }
.list { display: flex; flex-direction: column; gap: 20rpx; }
.card {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.img { width: 100%; background: #f7f8fa; display: block; }
.body { padding: 20rpx 24rpx 24rpx; }
.name { font-size: 30rpx; font-weight: 700; color: #1a1a1a; }
.desc { font-size: 24rpx; color: #999; margin-top: 8rpx; }
.btn {
  margin-top: 20rpx;
  background: linear-gradient(135deg, #ff9500, #ff6b35);
  color: #fff;
  border-radius: 999rpx;
  font-size: 24rpx;
}
.state { text-align: center; color: #999; font-size: 24rpx; padding: 60rpx; }
</style>
