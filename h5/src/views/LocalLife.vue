<template>
  <div class="local-life">
    <!-- 顶部导航 -->
    <div class="ll-header">
      <div class="ll-title">本地生活</div>
      <div class="ll-sub">点外卖 / 打车 / 住酒店，都能返</div>
    </div>

    <!-- 品类 tabs -->
    <van-tabs
      v-model:active="activeCate"
      color="#ff9500"
      line-width="16"
      :sticky="true"
      :offset-top="0"
      class="ll-tabs"
      @change="onCateChange"
    >
      <van-tab v-for="c in CATEGORIES" :key="c.key" :title="c.name" />
    </van-tabs>

    <!-- 活动列表 -->
    <div class="ll-section">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="— 没有更多活动了 —"
        @load="loadList"
        class="ll-list"
      >
        <div class="ll-grid">
          <div
            v-for="item in list"
            :key="item.actId"
            class="ll-card"
            @click="onActClick(item)"
          >
            <div class="llc-img">
              <img v-if="item.img" :src="item.img" :alt="item.actName" loading="lazy" />
              <div v-else class="llc-img-fallback">🎁</div>
            </div>
            <div class="llc-body">
              <div class="llc-name">{{ item.actName }}</div>
              <div class="llc-desc">{{ item.actDesc || '限时优惠' }}</div>
              <div class="llc-foot">
                <div class="llc-btn">立即领券 ›</div>
              </div>
            </div>
          </div>
        </div>
      </van-list>

      <van-empty v-if="!loading && !list.length" description="该分类暂无活动，看看其他分类吧～" />
    </div>

    <!-- 小程序码引导弹层（非微信环境使用） -->
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
          <van-button block size="large" type="primary" :disabled="!h5Url" @click="openInBrowser">
            浏览器直接打开
          </van-button>
          <van-button block size="large" plain @click="copyLink">
            复制链接去微信打开
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { showToast } from 'vant';

const CATEGORIES = [
  { key: 'all', name: '全部' },
  { key: '外卖美食', name: '外卖美食' },
  { key: '饿了么', name: '饿了么' },
  { key: '打车出行', name: '打车出行' },
  { key: '特惠酒店', name: '酒店住宿' },
  { key: '电影票', name: '电影演出' },
  { key: '话费充值', name: '话费充值' },
];

const activeCate = ref('all');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);

// 小程序码弹层
const showQrPopup = ref(false);
const currentAct = ref(null);
const qrCode = ref('');
const h5Url = ref('');

const isWechat = /MicroMessenger/i.test(navigator.userAgent);

const currentCate = computed(() => CATEGORIES.find((c) => c.key === activeCate.value));

function onCateChange() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  loadList();
}

async function loadList() {
  try {
    const cateName = activeCate.value === 'all' ? undefined : currentCate.value?.key;
    const r = await api.jtkActivities({
      cateName,
      page: page.value,
      pageSize,
    });
    const rows = (r.list || r || []).map((item) => ({
      actId: item.actId || item.act_id || item.id,
      actName: item.actName || item.act_name || item.title || item.name,
      actDesc: item.desc || item.act_desc || item.subtitle,
      img: item.img || item.image || item.pic || item.banner,
      icon: item.icon || item.logo,
    }));
    list.value.push(...rows);
    page.value += 1;
    if (rows.length < pageSize) finished.value = true;
  } catch (e) {
    showToast(e.message || '加载失败');
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

async function onActClick(item) {
  currentAct.value = item;
  qrCode.value = '';
  h5Url.value = '';
  try {
    const r = await api.jtkConvert(item.actId);
    const h5 = r.h5 || r.longH5 || r.jump_url || r.url;
    h5Url.value = h5 || '';

    // 有 H5 链接 → 直接打开
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
  } catch (e) {
    showToast(e.message || '转链失败');
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
  loading.value = true;
  loadList();
});
</script>

<style scoped>
.local-life {
  min-height: 100vh;
  background: #f7f8fa;
  width: 100%;
  box-sizing: border-box;
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

.ll-tabs {
  background: #fff;
  font-weight: 600;
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

.ll-section {
  margin: 10px 12px 0;
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px 14px;
  border: 2px solid #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  overflow: hidden;
  width: calc(100% - 24px);
  box-sizing: border-box;
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

/* 图片区（活动横幅图，横版 4:3） */
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
}
.llc-desc {
  font-size: 11px;
  color: #999;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
