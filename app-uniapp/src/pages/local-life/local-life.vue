<template>
  <view class="page">
    <!-- 品类 tabs -->
    <view class="tabs">
      <view
        v-for="t in TABS"
        :key="t.key"
        class="tab"
        :class="{ on: activeTab === t.key }"
        @click="switchTab(t.key)"
      >{{ t.name }}</view>
    </view>

    <!-- 全部活动的子分类（对齐 H5 ALL_CATS，纯前端关键词筛选） -->
    <scroll-view v-if="activeTab === 'all'" scroll-x class="cats" :show-scrollbar="false">
      <view class="cats-inner">
        <view
          v-for="c in ALL_CATS"
          :key="c.key"
          class="cat"
          :class="{ on: allCat === c.key }"
          @click="allCat = c.key"
        >
          <text class="cat-ico">{{ c.icon }}</text>
          <text class="cat-name">{{ c.name }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 活动列表 -->
    <view v-if="filteredList.length" class="list">
      <view v-for="item in filteredList" :key="item.actId" class="card">
        <image v-if="item.img" class="img" :src="item.img" mode="widthFix" />
        <view class="body">
          <view class="name">{{ item.actName }}</view>
          <view class="desc">{{ item.desc || '限时优惠' }}</view>
          <button class="btn" size="mini" @click="onClick(item)">立即领券</button>
        </view>
      </view>
    </view>

    <view v-if="state.loading" class="state">加载中…</view>
    <view v-else-if="!filteredList.length" class="state">
      {{ activeTab === 'all' && allCat !== 'all' ? '该分类暂无活动，换个分类看看～' : '暂无活动，稍后再来看看～' }}
    </view>
    <view v-else-if="state.finished" class="state">— 没有更多了 —</view>

    <!-- 二维码弹层（部分活动只返回小程序码） -->
    <view v-if="qrCode" class="qr-mask" @click="qrCode = ''">
      <view class="qr-sheet" @click.stop>
        <view class="qr-title">长按识别或截图扫码</view>
        <image
          class="qr-img"
          :src="qrCode"
          mode="widthFix"
          @click="previewQr"
        />
        <view class="qr-tip">也可保存图片后到对应 App 扫码</view>
        <button class="qr-close" @click="qrCode = ''">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { onShow, onReachBottom, onLoad } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';

const TABS = [
  { key: 'ele', name: '饿了么' },
  { key: 'mt', name: '美团券包' },
  { key: 'all', name: '全部活动' },
];

/** 全部活动子分类（与 H5 LocalLife 的 ALL_CATS 保持一致，前端关键词筛选） */
const ALL_CATS = [
  { key: 'all', name: '全部', icon: '🎉', keywords: [] },
  { key: 'food', name: '美食餐饮', icon: '🍔', keywords: ['外卖', '美食', '餐饮', '到店', '正餐', '快餐', '火锅', '烧烤', '烤肉', '小吃', '汉堡', '披萨'] },
  { key: 'coffee', name: '奶茶咖啡', icon: '☕', keywords: ['奶茶', '咖啡', '瑞幸', '星巴克', '喜茶', '奈雪', '蜜雪', '冰饮', '饮料', '茶百道', '古茗', '沪上阿姨', '大牌冰饮', '冰城蜜', 'coco', '书亦'] },
  { key: 'taxi', name: '打车出行', icon: '🚕', keywords: ['滴滴', '网约车', '打车', '出行', 't3', '曹操', '高德打车', '首汽', '花小猪', '万顺'] },
  { key: 'hotel', name: '酒店民宿', icon: '🏨', keywords: ['酒店', '民宿', '飞猪', '同城酒店', '美团酒店', '住宿', '客栈', '宾馆', '汉庭', '如家', '全季', '亚朵', '维也纳'] },
  { key: 'movie', name: '电影演出', icon: '🎬', keywords: ['电影票', '影城', '猫眼', '淘票票', '观影', '演出', '话剧', '演唱会', '万达', '大地', '横店', '金逸', 'cgv'] },
  { key: 'ticket', name: '景点门票', icon: '🏞️', keywords: ['景点', '门票', '景区', '乐园', '欢乐谷', '迪士尼', '方特', '长隆', '世界之窗', '海洋', '动物园', '博物'] },
  { key: 'vip', name: '会员权益', icon: '✨', keywords: ['会员', '视频会员', '音乐会员', 'vip', '爱奇艺', '腾讯视频', '优酷', '芒果tv', 'b站', 'bilibili', '网易云', 'qq音乐', '酷狗', '酷我', '喜马拉雅', '得到', '百度网盘', '夸克', 'wps', '美团会员', '饿了么会员'] },
];

const activeTab = ref('ele');
const allCat = ref('all');
const qrCode = ref('');
const pageSize = 20;

/** 三个 tab 各自独立的列表状态，切回来不丢数据 */
const states = reactive({
  ele: { list: [], page: 1, loading: false, finished: false },
  mt: { list: [], page: 1, loading: false, finished: false },
  all: { list: [], page: 1, loading: false, finished: false },
});
const state = computed(() => states[activeTab.value]);

/** 全部活动 tab 的子分类筛选（关键词命中即保留） */
const filteredList = computed(() => {
  if (activeTab.value !== 'all' || allCat.value === 'all') return state.value.list;
  const cat = ALL_CATS.find((c) => c.key === allCat.value);
  if (!cat || !cat.keywords.length) return state.value.list;
  return state.value.list.filter((item) => {
    const text = `${item.actName || ''} ${item.desc || ''} ${item.introduce || ''}`.toLowerCase();
    return cat.keywords.some((kw) => text.includes(kw.toLowerCase()));
  });
});

function normalize(item) {
  return {
    actId: item.actId || item.act_id || item.id,
    actName: item.actName || item.act_name || item.title || item.name,
    desc: item.desc || item.act_desc || item.subtitle || '',
    img: item.img || item.image || item.pic || item.banner || '',
    raw: item,
  };
}

async function loadMore() {
  const s = states[activeTab.value];
  if (s.loading || s.finished) return;
  s.loading = true;
  try {
    let rows = [];
    if (activeTab.value === 'ele') {
      const r = await api.jtkEleActivities({ page: s.page, pageSize });
      rows = (r.list || r || []).map(normalize);
    } else if (activeTab.value === 'mt') {
      const r = await api.jtkMtCoupons({ page: s.page, pageSize });
      rows = (r.list || r || []).map(normalize);
    } else {
      const r = await api.jtkActivities({ page: s.page, pageSize });
      rows = (r.list || r || []).map(normalize);
    }
    s.list.push(...rows);
    if (rows.length < pageSize) s.finished = true;
    s.page += 1;
  } catch (e) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' });
    s.finished = true;
  } finally {
    s.loading = false;
  }
}

function switchTab(key) {
  if (activeTab.value === key) return;
  activeTab.value = key;
  const s = states[key];
  if (!s.loading && !s.finished && !s.list.length) loadMore();
}

/** 首页宫格深链：tabBar 页 switchTab 不能带参数，用 storage 桥接 */
function applyEntry(entry) {
  if (!entry) return;
  if (entry.tab && TABS.some((t) => t.key === entry.tab)) {
    activeTab.value = entry.tab;
  }
  if (entry.cat && ALL_CATS.some((c) => c.key === entry.cat)) {
    allCat.value = entry.cat;
  }
  const s = states[activeTab.value];
  if (!s.loading && !s.finished && !s.list.length) loadMore();
}

onLoad((options) => {
  // 直接导航带参的兜底（tabBar 页正常走 storage 桥接）
  if (options && (options.tab || options.cat)) applyEntry(options);
});

onShow(() => {
  let entry = null;
  try {
    entry = uni.getStorageSync('ll-entry') || null;
    if (entry) uni.removeStorageSync('ll-entry');
  } catch { /* 无桥接参数 */ }
  if (entry) {
    applyEntry(entry);
    return;
  }
  // 首次进入：加载默认 tab
  const s = states[activeTab.value];
  if (!s.loading && !s.finished && !s.list.length) loadMore();
});

onReachBottom(() => loadMore());

/* ───────── 转链与跳转 ───────── */

async function onClick(item) {
  uni.showLoading({ title: '正在打开' });
  try {
    let r;
    if (activeTab.value === 'ele') {
      r = await api.jtkEleConvert(item.actId);
    } else if (activeTab.value === 'mt') {
      r = await api.jtkMtCouponConvert(item.actId);
    } else {
      r = await api.jtkConvert(item.actId);
    }
    uni.hideLoading();
    handleConvertResult(r || {});
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e?.message || '转链失败', icon: 'none' });
  }
}

/** 转链结果分流（对齐 H5 字段优先级，长链优先避免丢跟单参数） */
function handleConvertResult(r) {
  const h5 = r.longH5 || r.h5 || r.shortH5 || r.jump_url || r.url
    || r.taobaoH5 || r.taobaoInfo?.h5Url || r.alipayH5 || r.alipayInfo?.h5Url || '';
  const wechatQr = r.weAppInfo?.miniCode || r.we_app_info?.mini_code || '';
  const qr = wechatQr || r.taobaoInfo?.qrCode || r.alipayInfo?.qrCode || '';
  const tbWord = r.taobaoInfo?.tbWord || r.taobaoInfo?.tbToken || '';

  if (h5) {
    openExternal(h5);
    return;
  }
  if (qr) {
    qrCode.value = qr;
    return;
  }
  if (tbWord) {
    uni.setClipboardData({
      data: tbWord,
      success: () => uni.showModal({
        title: '淘口令已复制',
        content: '打开淘宝即可弹窗领券下单',
        showCancel: false,
      }),
    });
    return;
  }
  uni.showToast({ title: '跳转链接获取失败', icon: 'none' });
}

function previewQr() {
  if (qrCode.value) uni.previewImage({ urls: [qrCode.value] });
}

/** 外链按端能力分流：App 走系统浏览器，H5 新窗口，小程序只能剪贴板 */
function openExternal(url) {
  // #ifdef APP-PLUS
  plus.runtime.openURL(url);
  // #endif
  // #ifdef H5
  window.open(url, '_blank');
  // #endif
  // #ifdef MP
  uni.setClipboardData({
    data: url,
    success: () => uni.showModal({
      title: '链接已复制',
      content: '去浏览器或对应 App 粘贴打开即可领券下单',
      showCancel: false,
    }),
  });
  // #endif
}
</script>

<style lang="scss" scoped>
.page { padding-bottom: 40rpx; }

.tabs {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  background: #fff;
  padding: 0 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
}
.tab.on {
  color: $brand;
  font-weight: 700;
  font-size: 30rpx;
}
.tab.on::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 8rpx;
  transform: translateX(-50%);
  width: 48rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: $brand;
}

.cats {
  white-space: nowrap;
  background: #fff;
  padding: 16rpx 0;
  border-bottom: 2rpx solid #f5f5f5;
}
.cats-inner { display: inline-flex; padding: 0 16rpx; gap: 16rpx; }
.cat {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 12rpx 24rpx;
  border-radius: 20rpx;
  background: #f7f8fa;
}
.cat.on {
  background: linear-gradient(135deg, #fff0ed, #ffe4de);
}
.cat-ico { font-size: 32rpx; }
.cat-name { font-size: 22rpx; color: #333; }
.cat.on .cat-name { color: $brand; font-weight: 700; }

.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 20rpx 24rpx 0;
}
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
.btn::after { border: none; }
.state { text-align: center; color: #999; font-size: 24rpx; padding: 60rpx; }

/* 二维码弹层 */
.qr-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-sheet {
  width: 560rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.qr-title { font-size: 30rpx; font-weight: 700; color: #1a1a1a; }
.qr-img {
  width: 420rpx;
  height: 420rpx;
  margin: 24rpx 0;
  border-radius: 16rpx;
}
.qr-tip { font-size: 22rpx; color: #999; }
.qr-close {
  margin-top: 24rpx;
  width: 100%;
  background: #f5f6f8;
  color: #666;
  border-radius: 999rpx;
  font-size: 28rpx;
}
.qr-close::after { border: none; }
</style>
