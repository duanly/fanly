<template>
  <div class="local-life">
    <!-- 顶部头图 banner（随 tab 切换） -->
    <div class="ll-banner" :class="'ll-banner-' + activeTab">
      <div class="ll-banner-inner">
        <div class="ll-banner-title">
          <template v-if="activeTab === 'ele'">🍜 饿了么外卖</template>
          <template v-else-if="activeTab === 'mt'">🎫 美团券包</template>
          <template v-else-if="activeTab === 'all'">🎉 全部活动</template>
        </div>
        <div class="ll-banner-sub">
          <template v-if="activeTab === 'ele'">天天领红包 · 每餐都能省</template>
          <template v-else-if="activeTab === 'mt'">到店美食 · 吃喝玩乐超值券</template>
          <template v-else-if="activeTab === 'all'">本地生活全覆盖 · 领券下单享优惠</template>
        </div>
      </div>
      <div class="ll-banner-deco"></div>
    </div>

    <!-- 品类 tabs（sticky 吸顶） -->
    <van-tabs
      v-model:active="activeTab"
      color="#ff9500"
      line-width="16"
      :sticky="true"
      :offset-top="0"
      class="ll-tabs"
      @change="onTabChange"
    >
      <van-tab v-for="t in TABS" :key="t.key" :title="t.name" :name="t.key" />
    </van-tabs>

    <!-- 饿了么 -->
    <div v-show="activeTab === 'ele'" class="ll-section">
      <div v-if="ele.list.length" class="ll-grid">
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
            <div class="llc-foot">
              <div class="llc-btn ele-btn">立即领券 ›</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="ele.loading" class="ll-loadmore">
        <van-loading size="18px" /> <span>加载中...</span>
      </div>
      <div v-else-if="ele.finished && ele.list.length" class="ll-loadmore ll-finished">
        — 没有更多了 —
      </div>
      <div v-else-if="ele.list.length" class="ll-loadmore ll-clickmore" @click="loadEle">
        点击加载更多 ↓
      </div>

      <van-empty v-if="!ele.loading && ele.finished && !ele.list.length" description="暂无活动，稍后再来看看～" />
    </div>

    <!-- 美团券包 -->
    <div v-show="activeTab === 'mt'" class="ll-section">
      <div v-if="mt.list.length" class="ll-grid">
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
            <div class="llc-foot">
              <div class="llc-btn mt-btn">立即抢购 ›</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="mt.loading" class="ll-loadmore">
        <van-loading size="18px" /> <span>加载中...</span>
      </div>
      <div v-else-if="mt.finished && mt.list.length" class="ll-loadmore ll-finished">
        — 没有更多了 —
      </div>
      <div v-else-if="mt.list.length" class="ll-loadmore ll-clickmore" @click="loadMt">
        点击加载更多 ↓
      </div>

      <van-empty v-if="!mt.loading && mt.finished && !mt.list.length" description="暂无活动，稍后再来看看～" />
    </div>

    <!-- 全部活动（聚推客通用联盟活动） -->
    <div v-show="activeTab === 'all'" class="ll-section">
      <div v-if="all.list.length" class="ll-grid">
        <div
          v-for="item in all.list"
          :key="'a-' + item.actId"
          class="ll-card"
          @click="onUnionClick(item)"
        >
          <div class="llc-img">
            <img v-if="item.img" :src="item.img" :alt="item.actName" loading="lazy" />
            <div v-else class="llc-img-fallback">🎁</div>
          </div>
          <div class="llc-body">
            <div class="llc-name">{{ item.actName }}</div>
            <div class="llc-desc">{{ item.desc || '限时优惠' }}</div>
            <div class="llc-foot">
              <div class="llc-btn all-btn">立即领券 ›</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="all.loading" class="ll-loadmore">
        <van-loading size="18px" /> <span>加载中...</span>
      </div>
      <div v-else-if="all.finished && all.list.length" class="ll-loadmore ll-finished">
        — 没有更多了 —
      </div>
      <div v-else-if="all.list.length" class="ll-loadmore ll-clickmore" @click="loadAll">
        点击加载更多 ↓
      </div>

      <van-empty v-if="!all.loading && all.finished && !all.list.length" description="暂无活动，稍后再来看看～" />
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
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { showToast } from 'vant';

const TABS = [
  { key: 'ele', name: '饿了么' },
  { key: 'mt', name: '美团券包' },
  { key: 'all', name: '全部活动' },
];

const activeTab = ref('ele');
const pageSize = 20;

// 从 URL 参数读取初始 tab（支持 #/local-life?tab=mt 这样的跳转）
function initTabFromUrl() {
  const hash = location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx < 0) return;
  const search = hash.slice(qIdx + 1);
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (tab && TABS.some((t) => t.key === tab)) {
    activeTab.value = tab;
  }
}
initTabFromUrl();

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

const all = reactive({
  list: [],
  page: 1,
  loading: false,
  finished: false,
});

function getState(key) {
  if (key === 'ele') return ele;
  if (key === 'mt') return mt;
  return all;
}

function getLoader(key) {
  if (key === 'ele') return loadEle;
  if (key === 'mt') return loadMt;
  return loadAll;
}

function onTabChange(key) {
  activeTab.value = key;
  const s = getState(key);
  if (!s.loading && !s.finished && s.list.length === 0) {
    s.loading = true;
    getLoader(key)();
  }
}

// 滚动到底部自动加载更多
function onScroll() {
  const s = getState(activeTab.value);
  if (s.loading || s.finished) return;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const viewH = window.innerHeight;
  const fullH = document.documentElement.scrollHeight;
  if (fullH - scrollTop - viewH < 200) {
    s.loading = true;
    getLoader(activeTab.value)();
  }
}

onMounted(() => {
  // 初始加载当前 tab
  const s = getState(activeTab.value);
  s.loading = true;
  getLoader(activeTab.value)();
  window.addEventListener('scroll', onScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
});

// 小程序码弹层
const showQrPopup = ref(false);
const currentAct = ref(null);
const qrCode = ref('');
const h5Url = ref('');

// ─── 饿了么 ───

async function loadEle() {
  try {
    const r = await api.jtkEleActivities({ page: ele.page, pageSize });
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
    const r = await api.jtkMtCoupons({ page: mt.page, pageSize });
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

// ─── 全部活动（聚推客通用联盟活动，不筛选分类）───

async function loadAll() {
  try {
    const r = await api.jtkActivities({
      page: all.page,
      pageSize,
    });
    const rows = (r.list || r || []).map((item) => ({
      actId: item.actId || item.act_id || item.id,
      actName: item.actName || item.act_name || item.title || item.name,
      desc: item.desc || item.act_desc || item.subtitle || '',
      img: item.img || item.image || item.pic || item.banner || '',
    }));
    all.list.push(...rows);
    all.page += 1;
    if (rows.length < pageSize) all.finished = true;
  } catch (e) {
    showToast(e.message || '加载失败');
    all.finished = true;
  } finally {
    all.loading = false;
  }
}

// 通用联盟活动转链（走 /union/act）
async function onUnionClick(item) {
  currentAct.value = item;
  qrCode.value = '';
  h5Url.value = '';
  try {
    const r = await api.jtkConvert(item.actId);
    handleConvertResult(r);
  } catch (e) {
    showToast(e.message || '转链失败');
  }
}

// ─── 通用跳转逻辑 ───

function handleConvertResult(r) {
  const h5 = r.h5 || r.shortH5 || r.longH5 || r.jump_url || r.url;
  h5Url.value = h5 || '';

  if (h5) {
    window.location.href = h5;
    return;
  }

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
</script>

<style scoped>
.local-life {
  min-height: 100vh;
  background: #f7f8fa;
  width: 100%;
  box-sizing: border-box;
  padding-bottom: 20px;
}

/* ─── 顶部头图 banner ─── */
.ll-banner {
  position: relative;
  padding: calc(16px + env(safe-area-inset-top)) 20px 22px;
  overflow: hidden;
  color: #fff;
}
.ll-banner-inner {
  position: relative;
  z-index: 2;
}
.ll-banner-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 1px;
  text-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.ll-banner-sub {
  font-size: 13px;
  margin-top: 6px;
  opacity: 0.95;
  text-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
.ll-banner-deco {
  position: absolute;
  right: -30px;
  top: -20px;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  z-index: 1;
}
.ll-banner-deco::after {
  content: '';
  position: absolute;
  right: 20px;
  bottom: -40px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
}

/* 各 tab 主题色 */
.ll-banner-ele {
  background: linear-gradient(135deg, #00b43c 0%, #00963a 50%, #007a2f 100%);
}
.ll-banner-mt {
  background: linear-gradient(135deg, #ffd100 0%, #ff9500 50%, #ff6b35 100%);
}
.ll-banner-all {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
}

/* ─── Tabs ─── */
.ll-tabs {
  background: #fff;
  font-weight: 600;
}

/* ─── 通用 section ─── */
.ll-section {
  margin: 10px 12px 0;
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px 14px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  width: calc(100% - 24px);
  box-sizing: border-box;
  min-height: 300px;
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
.ele-btn {
  background: linear-gradient(135deg, #00b43c, #00963a);
}
.mt-btn {
  background: linear-gradient(135deg, #ffd100, #ff9500);
  color: #3a2600;
}
.ticket-btn {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
}
.all-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

/* 加载更多 */
.ll-loadmore {
  text-align: center;
  padding: 16px 0 8px;
  font-size: 13px;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.ll-finished {
  color: #ccc;
}
.ll-clickmore {
  color: #ff9500;
  font-weight: 500;
}
.ll-clickmore:active {
  opacity: 0.7;
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
