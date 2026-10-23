<template>
  <div class="local-life">
    <!-- 顶部导航 -->
    <div class="ll-header">
      <div class="ll-title">本地生活</div>
      <div class="ll-sub">点外卖 · 喝咖啡 · 每单都返</div>
    </div>

    <!-- 饿了么 banner + 活动列表 -->
    <div class="ll-banner ele" @click="scrollTo('ele')">
      <div class="ll-banner-left">
        <div class="ll-banner-title">饿了么外卖</div>
        <div class="ll-banner-desc">红包天天领 · 单单都返利</div>
      </div>
      <div class="ll-banner-ico">🍜</div>
    </div>

    <div class="ll-section" id="ele">
      <div class="ll-sec-title">
        <span class="ll-sec-dot ele-dot"></span>
        <span>饿了么精选活动</span>
        <span class="ll-sec-more" @click="scrollTo('ele')">更多 ›</span>
      </div>
      <van-list
        v-model:loading="ele.loading"
        :finished="ele.finished"
        finished-text="— 没有更多了 —"
        @load="loadEle"
        class="ll-list"
      >
        <div class="ll-grid">
          <div
            v-for="item in ele.list"
            :key="'e-' + item.actId"
            class="ll-card"
            @click="onEleClick(item)"
          >
            <div class="llc-img">
              <img v-if="item.img" :src="item.img" :alt="item.actName" loading="lazy" />
              <div v-else class="llc-img-fallback">🎁</div>
            </div>
            <div class="llc-body">
              <div class="llc-name">{{ item.actName }}</div>
              <div class="llc-desc">{{ item.desc || '限时优惠' }}</div>
              <div v-if="item.commissionRate" class="llc-comm">
                预估 {{ item.commissionRate }}
              </div>
              <div class="llc-foot">
                <div class="llc-btn">立即领券 ›</div>
              </div>
            </div>
          </div>
        </div>
      </van-list>
    </div>

    <!-- 美团券包 banner + 活动列表 -->
    <div class="ll-banner mt" @click="scrollTo('mt')">
      <div class="ll-banner-left">
        <div class="ll-banner-title">美团券包</div>
        <div class="ll-banner-desc">咖啡奶茶 · 到店核销有返利</div>
      </div>
      <div class="ll-banner-ico">☕</div>
    </div>

    <div class="ll-section" id="mt">
      <div class="ll-sec-title">
        <span class="ll-sec-dot mt-dot"></span>
        <span>美团超值券包</span>
        <span class="ll-sec-more" @click="scrollTo('mt')">更多 ›</span>
      </div>
      <van-list
        v-model:loading="mt.loading"
        :finished="mt.finished"
        finished-text="— 没有更多了 —"
        @load="loadMt"
        class="ll-list"
      >
        <div class="ll-grid">
          <div
            v-for="item in mt.list"
            :key="'m-' + item.actId"
            class="ll-card"
            @click="onMtClick(item)"
          >
            <div class="llc-img">
              <img v-if="item.img" :src="item.img" :alt="item.actName" loading="lazy" />
              <div v-else class="llc-img-fallback">🎁</div>
            </div>
            <div class="llc-body">
              <div class="llc-name">{{ item.actName }}</div>
              <div class="llc-desc">{{ item.desc || '限时优惠' }}</div>
              <div v-if="item.commissionRate" class="llc-comm">
                预估 {{ item.commissionRate }}
              </div>
              <div class="llc-foot">
                <div class="llc-btn mt-btn">立即抢购 ›</div>
              </div>
            </div>
          </div>
        </div>
      </van-list>
    </div>

    <!-- 小程序码引导弹层（兜底：没有 H5 时展示） -->
    <van-popup
      v-model:show="showQrPopup"
      position="bottom"
      round
      :style="{ padding: '24px 20px 28px' }"
    >
      <div class="ll-qr-wrap">
        <div class="ll-qr-title">{{ currentAct?.actName || '活动领券' }}</div>
        <div class="ll-qr-sub">微信扫码或长按识别小程序码，立即领取优惠</div>
        <div class="ll-qr-img-box">
          <img v-if="qrCode" :src="qrCode" alt="小程序码" />
          <div v-else class="ll-qr-loading">
            <van-loading size="24px" />
          </div>
        </div>
        <div class="ll-qr-tip">
          <van-icon name="info-o" size="12" />
          <span>本活动为微信小程序专属，扫码后在微信中打开即可使用</span>
        </div>
        <div class="ll-qr-actions">
          <van-button v-if="h5Url" block size="large" type="primary" @click="openInBrowser">
            浏览器直接打开
          </van-button>
          <van-button v-if="h5Url" block size="large" plain @click="copyLink">
            复制链接去微信打开
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { reactive, onMounted, ref } from 'vue';
import { api } from '../api';
import { showToast } from 'vant';

const pageSize = 10;

const ele = reactive({
  list: [],
  page: 1,
  loading: false,
  finished: false,
});

const mt = reactive({
  list: [],
  page: 1,
  loading: false,
  finished: false,
});

// 小程序码弹层
const showQrPopup = ref(false);
const currentAct = ref(null);
const qrCode = ref('');
const h5Url = ref('');

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── 饿了么 ───

async function loadEle() {
  try {
    const r = await api.jtkEleActivities({
      page: ele.page,
      pageSize,
    });
    const rows = r.list || r || [];
    ele.list.push(...rows);
    ele.page += 1;
    if (rows.length < pageSize) ele.finished = true;
  } catch (e) {
    showToast(e.message || '加载失败');
    ele.finished = true;
  } finally {
    ele.loading = false;
  }
}

async function onEleClick(item) {
  currentAct.value = item;
  qrCode.value = '';
  h5Url.value = '';
  try {
    const r = await api.jtkEleConvert(item.actId);
    handleConvertResult(r);
  } catch (e) {
    showToast(e.message || '转链失败');
  }
}

// ─── 美团券包 ───

async function loadMt() {
  try {
    const r = await api.jtkMtCoupons({
      page: mt.page,
      pageSize,
    });
    const rows = r.list || r || [];
    mt.list.push(...rows);
    mt.page += 1;
    if (rows.length < pageSize) mt.finished = true;
  } catch (e) {
    showToast(e.message || '加载失败');
    mt.finished = true;
  } finally {
    mt.loading = false;
  }
}

async function onMtClick(item) {
  currentAct.value = item;
  qrCode.value = '';
  h5Url.value = '';
  try {
    const r = await api.jtkMtCouponConvert(item.actId);
    handleConvertResult(r);
  } catch (e) {
    showToast(e.message || '转链失败');
  }
}

// ─── 通用跳转逻辑 ───

function handleConvertResult(r) {
  const h5 = r.h5 || r.shortH5 || r.longH5 || r.jump_url || r.url;
  h5Url.value = h5 || '';

  // 有 H5 → 直接打开
  if (h5) {
    window.location.href = h5;
    return;
  }

  // 没有 H5 但有小程序码 → 弹引导层
  const miniCode = r.weAppInfo?.miniCode || r.we_app_info?.mini_code;
  if (miniCode) {
    qrCode.value = miniCode;
    showQrPopup.value = true;
  } else {
    showToast('跳转链接获取失败');
  }
}

function openInBrowser() {
  if (h5Url.value) {
    window.location.href = h5Url.value;
  }
}

function copyLink() {
  if (!h5Url.value) return;
  const ta = document.createElement('textarea');
  ta.value = h5Url.value;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('链接已复制，去微信粘贴打开');
  } catch {
    showToast('复制失败，请手动复制');
  }
  document.body.removeChild(ta);
}

onMounted(() => {
  ele.loading = true;
  mt.loading = true;
  loadEle();
  loadMt();
});
</script>

<style scoped>
.local-life {
  min-height: 100vh;
  background: #f7f8fa;
  width: 100%;
  box-sizing: border-box;
  padding-bottom: 20px;
}

.ll-header {
  padding: calc(12px + env(safe-area-inset-top)) 16px 10px;
  background: linear-gradient(135deg, #fff5e6 0%, #fff0ed 100%);
}
.ll-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
}
.ll-sub {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

/* banner 通用 */
.ll-banner {
  margin: 10px 12px 0;
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.ll-banner.ele {
  background: linear-gradient(135deg, #00b43c 0%, #00963a 100%);
  box-shadow: 0 4px 12px rgba(0,180,60,0.2);
}
.ll-banner.mt {
  background: linear-gradient(135deg, #ffd100 0%, #ff9500 100%);
  box-shadow: 0 4px 12px rgba(255,149,0,0.25);
  color: #3a2600;
}
.ll-banner-title {
  font-size: 18px;
  font-weight: 700;
}
.ll-banner-desc {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.9;
}
.ll-banner-ico {
  font-size: 36px;
}

/* 通用 section */
.ll-section {
  margin: 10px 12px 0;
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px 14px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  width: calc(100% - 24px);
  box-sizing: border-box;
}
.ll-sec-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ll-sec-dot {
  width: 3px;
  height: 14px;
  border-radius: 2px;
}
.ele-dot { background: #00b43c; }
.mt-dot { background: #ff9500; }
.ll-sec-more {
  margin-left: auto;
  font-size: 12px;
  color: #999;
  font-weight: normal;
}

.ll-list {
  padding: 0;
  width: 100% !important;
  box-sizing: border-box;
}
.ll-list :deep(.van-list__finished-text),
.ll-list :deep(.van-list__loading) {
  width: 100%;
}
.ll-list :deep(.van-list__placeholder) {
  width: 100% !important;
}

.ll-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;
  touch-action: manipulation;
  box-sizing: border-box;
}

.ll-card {
  background: #fafafa;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.ll-card:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

/* 图片区 */
.llc-img {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #f7f8fa;
}
.llc-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.llc-img-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
}

/* 内容区 */
.llc-body {
  padding: 8px 10px 10px;
  background: #fff;
  border-radius: 0 0 12px 12px;
}
.llc-name {
  font-size: 12px;
  line-height: 1.4;
  height: 34px;
  color: #333;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 500;
}
.llc-desc {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.llc-comm {
  font-size: 11px;
  color: #ff6b35;
  margin-top: 4px;
  font-weight: 500;
}

/* 底部按钮 */
.llc-foot {
  margin-top: 8px;
}
.llc-btn {
  display: inline-block;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(135deg, #ff9500, #ff6b35);
  border-radius: 999px;
  padding: 3px 10px;
  font-weight: 600;
  white-space: nowrap;
}
.mt-btn {
  background: linear-gradient(135deg, #ffd100, #ff9500);
  color: #3a2600;
}

/* 小程序码弹层 */
.ll-qr-wrap {
  text-align: center;
}
.ll-qr-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ll-qr-sub {
  font-size: 13px;
  color: #666;
  margin-top: 6px;
}
.ll-qr-img-box {
  width: 200px;
  height: 200px;
  margin: 20px auto 14px;
  background: #fff;
  border-radius: 12px;
  padding: 10px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ll-qr-img-box img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ll-qr-loading {
  color: #999;
}
.ll-qr-tip {
  font-size: 12px;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-bottom: 18px;
}
.ll-qr-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
