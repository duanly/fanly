<template>
  <div class="local-life">
    <!-- 顶部头图 banner（随 tab 切换） -->
    <div class="ll-banner" :class="bannerClass">
      <div class="ll-banner-inner">
        <div class="ll-banner-title">
          <template v-if="activeTab === 'ele'">🍜 饿了么外卖</template>
          <template v-else-if="activeTab === 'mt'">🎫 美团券包</template>
          <template v-else-if="activeTab === 'all'"><AppIcon :name="currentAllCat.icon" :size="24" dot /> {{ currentAllCat.name }}</template>
        </div>
        <div class="ll-banner-sub">
          <template v-if="activeTab === 'ele'">天天领红包 · 每餐都能省</template>
          <template v-else-if="activeTab === 'mt'">到店美食 · 吃喝玩乐超值券</template>
          <template v-else-if="activeTab === 'all'">{{ currentAllCat.slogan }}</template>
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
          v-for="(item, ei) in ele.list"
          :key="'e-' + item.actId"
          class="ll-card"
          :class="'c' + (ei % 5)"
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
          v-for="(item, mi) in mt.list"
          :key="'m-' + item.actId"
          class="ll-card"
          :class="'c' + (mi % 5)"
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
    <div v-show="activeTab === 'all'" class="ll-all-wrap">
      <!-- 子分类栏（横向滚动） -->
      <div class="all-cats">
        <div
          v-for="c in ALL_CATS"
          :key="c.key"
          class="all-cat"
          :class="{ active: allCat === c.key }"
          @click="onAllCatChange(c.key)"
        >
          <span class="ac-ico"><AppIcon :name="c.icon" :size="18" /></span>
          <span class="ac-name">{{ c.name }}</span>
        </div>
      </div>

      <div class="ll-section">
        <div v-if="filteredAllList.length" class="ll-grid">
          <div
            v-for="(item, ai) in filteredAllList"
            :key="'a-' + item.actId"
            class="ll-card"
            :class="'c' + (ai % 5)"
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
        <div v-else-if="all.finished && filteredAllList.length" class="ll-loadmore ll-finished">
          — 没有更多了 —
        </div>
        <div v-else-if="filteredAllList.length" class="ll-loadmore ll-clickmore" @click="loadAll">
          点击加载更多 ↓
        </div>

        <van-empty v-if="!all.loading && all.finished && !filteredAllList.length" description="该分类暂无活动，换个分类看看～" />
      </div>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import { api } from '../api';
import { showToast } from 'vant';

const TABS = [
  { key: 'ele', name: '饿了么' },
  { key: 'mt', name: '美团券包' },
  { key: 'all', name: '全部活动' },
];

const activeTab = ref('ele');
const pageSize = 20;

// ─── 全部活动的子分类 ───

const ALL_CATS = [
  {
    key: 'all',
    name: '全部',
    icon: '🎉',
    slogan: '本地生活全覆盖 · 领券下单享优惠',
    bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    keywords: [],
  },
  {
    key: 'food',
    name: '美食餐饮',
    icon: '🍔',
    slogan: '外卖到店都能省 · 顿顿有优惠',
    bg: 'linear-gradient(135deg, #ff6b35 0%, #ff4b3a 50%, #ff006e 100%)',
    keywords: ['外卖', '美食', '餐饮', '到店', '正餐', '快餐', '火锅', '烧烤', '烤肉', '小吃', '汉堡', '披萨'],
  },
  {
    key: 'coffee',
    name: '奶茶咖啡',
    icon: '☕',
    slogan: '瑞幸星巴克喜茶 · 买一送一随便薅',
    bg: 'linear-gradient(135deg, #c44569 0%, #f8b500 60%, #ffcc70 100%)',
    keywords: ['奶茶', '咖啡', '瑞幸', '星巴克', '喜茶', '奈雪', '蜜雪', '冰饮', '饮料', '茶百道', '古茗', '沪上阿姨', '大牌冰饮', '冰城蜜', 'CoCo', 'coco', '书亦'],
  },
  {
    key: 'taxi',
    name: '打车出行',
    icon: '🚕',
    slogan: '滴滴高德T3 · 出行立减',
    bg: 'linear-gradient(135deg, #f7931e 0%, #ff6b35 50%, #ff4b3a 100%)',
    keywords: ['滴滴', '网约车', '打车', '出行', 'T3', '曹操', '高德打车', '首汽', '花小猪', '万顺'],
  },
  {
    key: 'hotel',
    name: '酒店民宿',
    icon: '🏨',
    slogan: '同城酒店飞猪民宿 · 超值住',
    bg: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 60%, #007991 100%)',
    keywords: ['酒店', '民宿', '飞猪', '同城酒店', '美团酒店', '住宿', '客栈', '宾馆', '汉庭', '如家', '全季', '亚朵', '维也纳'],
  },
  {
    key: 'movie',
    name: '电影演出',
    icon: '🎬',
    slogan: '猫眼淘票票 · 特惠观影',
    bg: 'linear-gradient(135deg, #ff6b9d 0%, #c44569 60%, #562b5c 100%)',
    keywords: ['电影票', '影城', '猫眼', '淘票票', '观影', '演出', '话剧', '演唱会', '万达', '大地', '横店', '金逸', 'CGV'],
  },
  {
    key: 'ticket',
    name: '景点门票',
    icon: '🏞️',
    slogan: '热门景点乐园 · 低价门票随心游',
    bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #00c6fb 100%)',
    keywords: ['景点', '门票', '景区', '乐园', '欢乐谷', '迪士尼', '方特', '长隆', '世界之窗', '海洋', '动物园', '博物'],
  },
  {
    key: 'vip',
    name: '会员权益',
    icon: '✨',
    slogan: '视频音乐会员 · 半价充值',
    bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 60%, #4a569d 100%)',
    keywords: ['会员', '视频会员', '音乐会员', 'vip', 'VIP', '爱奇艺', '腾讯视频', '优酷', '芒果TV', 'B站', 'bilibili', '网易云', 'QQ音乐', '酷狗', '酷我', '喜马拉雅', '得到', '百度网盘', '夸克', 'WPS', '美团会员', '饿了么会员'],
  },
];

const allCat = ref('all');

const currentAllCat = computed(() => {
  return ALL_CATS.find((c) => c.key === allCat.value) || ALL_CATS[0];
});

// banner 样式 class
const bannerClass = computed(() => {
  if (activeTab.value === 'all') {
    return `ll-banner-all ll-banner-all-${allCat.value}`;
  }
  return `ll-banner-${activeTab.value}`;
});

// 分类筛选后的活动列表
const filteredAllList = computed(() => {
  if (allCat.value === 'all') return all.list;
  const cat = ALL_CATS.find((c) => c.key === allCat.value);
  if (!cat || !cat.keywords.length) return all.list;
  return all.list.filter((item) => {
    const text = `${item.actName || ''} ${item.desc || ''} ${item.introduce || ''} ${item.act_desc || ''}`.toLowerCase();
    return cat.keywords.some((kw) => text.includes(kw.toLowerCase()));
  });
});

function onAllCatChange(key) {
  allCat.value = key;
}

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
  // 全部活动下的子分类（?tab=all&cat=coffee）
  const cat = params.get('cat');
  if (cat && ALL_CATS.some((c) => c.key === cat)) {
    allCat.value = cat;
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

function isWechat() {
  return /MicroMessenger/i.test(navigator.userAgent);
}

function handleConvertResult(r) {
  // 收集所有可用的跳转方式
  // 优先用 longH5：短链（kurl05.cn 等）在非微信/部分环境跳转时会丢掉 user_id，
  // 报「缺少 user_id 参数」；长链自带完整签名跟单参数，最稳
  const options = {
    h5: r.longH5 || r.h5 || r.shortH5 || r.jump_url || r.url || '',
    taobaoH5: r.taobaoH5 || r.taobaoInfo?.h5Url || '',
    alipayH5: r.alipayH5 || r.alipayInfo?.h5Url || '',
    wechatQr: r.weAppInfo?.miniCode || r.we_app_info?.mini_code || '',
    taobaoQr: r.taobaoInfo?.qrCode || '',
    alipayQr: r.alipayInfo?.qrCode || '',
    taobaoWord: r.taobaoInfo?.tbWord || r.taobaoInfo?.tbToken || '',
  };

  h5Url.value = options.h5 || options.taobaoH5 || options.alipayH5 || '';

  // 美团/饿了么等红包是微信小程序专属：聚推客返回的 h5 是微信内中转页，
  // 在普通浏览器直接打开会报「不在微信里 / 缺少 user_id」。
  // 有微信小程序码且当前不在微信时，弹码引导，不硬跳。
  if (options.wechatQr && !isWechat()) {
    qrCode.value = options.wechatQr;
    showQrPopup.value = true;
    return;
  }

  // 微信内 / 无微信码的普通活动：有 H5 直接跳
  if (options.h5) {
    window.location.href = options.h5;
    return;
  }

  // 有淘宝/支付宝 H5 也直接跳
  if (options.taobaoH5) {
    window.location.href = options.taobaoH5;
    return;
  }
  if (options.alipayH5) {
    window.location.href = options.alipayH5;
    return;
  }

  // 展示二维码弹层（微信/淘宝/支付宝 哪个有显示哪个）
  const qr = options.wechatQr || options.taobaoQr || options.alipayQr;
  if (qr) {
    qrCode.value = qr;
    showQrPopup.value = true;
    return;
  }

  // 都没有：报错
  showToast('跳转链接获取失败');
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
  /* 默认全部分类紫色 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
}
.ll-banner-all-food {
  background: linear-gradient(135deg, #ff6b35 0%, #ff4b3a 50%, #ff006e 100%);
}
.ll-banner-all-coffee {
  background: linear-gradient(135deg, #c44569 0%, #f8b500 60%, #ffcc70 100%);
}
.ll-banner-all-taxi {
  background: linear-gradient(135deg, #f7931e 0%, #ff6b35 50%, #ff4b3a 100%);
}
.ll-banner-all-hotel {
  background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 60%, #007991 100%);
}
.ll-banner-all-movie {
  background: linear-gradient(135deg, #ff6b9d 0%, #c44569 60%, #562b5c 100%);
}
.ll-banner-all-ticket {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #00c6fb 100%);
}
.ll-banner-all-vip {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 60%, #4a569d 100%);
}

/* ─── 全部活动子分类栏 ─── */
.ll-all-wrap {
  width: 100%;
}
.all-cats {
  display: flex;
  gap: 8px;
  padding: 10px 12px 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  background: #f7f8fa;
  position: sticky;
  top: 44px; /* 顶在 van-tabs 下面 */
  z-index: 5;
}
.all-cats::-webkit-scrollbar {
  display: none;
}
.all-cat {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #fff;
  border-radius: 999px;
  font-size: 12px;
  color: #666;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  white-space: nowrap;
  transition: all 0.2s;
}
.all-cat:active {
  transform: scale(0.95);
}
.all-cat.active {
  background: linear-gradient(135deg, #ff9500, #ff6b35);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
}
.all-cat .ac-ico {
  font-size: 14px;
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
  grid-template-columns: 1fr;
  gap: 10px;
  width: 100%;
  touch-action: manipulation;
  box-sizing: border-box;
}

.ll-card {
  display: block;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.ll-card:active {
  transform: scale(0.99);
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

/* 图片区：占满整行宽度，高度按图片比例自适应、铺满不留白 */
.llc-img {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #f7f8fa;
  display: flex;
  align-items: center;
  justify-content: center;
}
.llc-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.llc-img-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44px;
}

/* 内容区：图片下方，文字左对齐 */
.llc-body {
  padding: 10px 12px 12px;
  background: #fff;
}
.llc-name {
  font-size: 15px;
  line-height: 1.35;
  color: #1a1a1a;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 600;
}
.llc-desc {
  font-size: 12px;
  color: #999;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部按钮：居中 */
.llc-foot {
  margin-top: 10px;
  display: flex;
  justify-content: center;
}
.llc-btn {
  display: inline-block;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #ff9500, #ff6b35);
  border-radius: 999px;
  padding: 5px 22px;
  font-weight: 600;
  white-space: nowrap;
}

/* 每张卡片淡淡的轮换底色（5 色循环，极浅，图片与文字区一体） */
.ll-card.c0 { background: #fff7f3; }
.ll-card.c1 { background: #f6f8ff; }
.ll-card.c2 { background: #f4fbf7; }
.ll-card.c3 { background: #fffdf3; }
.ll-card.c4 { background: #fdf5fb; }
/* 图片区同色，作为图片加载/留白时的兜底，比卡片底色再略深一点点 */
.c0 .llc-img { background: #fbeae2; }
.c1 .llc-img { background: #eef1fc; }
.c2 .llc-img { background: #ebf7f0; }
.c3 .llc-img { background: #faf5e2; }
.c4 .llc-img { background: #faeef5; }
.llc-body { background: transparent; }
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
