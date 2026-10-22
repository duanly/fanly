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
    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="— 没有更多活动了 —"
      @load="loadList"
      class="ll-list"
    >
      <div class="act-grid">
        <div
          v-for="item in list"
          :key="item.actId"
          class="act-card"
          @click="onActClick(item)"
        >
          <div class="ac-img">
            <img v-if="item.icon" :src="item.icon" :alt="item.actName" />
            <div v-else class="ac-img-fallback">🎁</div>
            <div v-if="item.topPrice" class="ac-price-tag">
              ¥{{ item.topPrice }}起
            </div>
          </div>
          <div class="ac-body">
            <div class="ac-name">{{ item.actName }}</div>
            <div class="ac-desc">{{ item.actDesc || item.subTitle || '限时优惠' }}</div>
            <div class="ac-bottom">
              <div class="ac-commission">
                <span class="ac-comm-label">预估返</span>
                <span class="ac-comm-value">¥{{ formatFee(item.estCommission) }}</span>
              </div>
              <div class="ac-btn">去领券</div>
            </div>
          </div>
        </div>
      </div>

      <van-empty v-if="!loading && !list.length" description="该分类暂无活动，看看其他分类吧～" />
    </van-list>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api';
import { showToast } from 'vant';

const CATEGORIES = [
  { key: 'all', name: '全部' },
  { key: '美团', name: '外卖美食' },
  { key: '饿了么', name: '饿了么' },
  { key: '滴滴', name: '打车出行' },
  { key: '酒店', name: '酒店住宿' },
  { key: '电影票', name: '电影演出' },
  { key: '话费', name: '话费充值' },
];

const activeCate = ref('all');
const list = ref([]);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);

const currentCate = computed(() => CATEGORIES.find((c) => c.key === activeCate.value));

function formatFee(val) {
  const n = Number(val || 0);
  if (n === 0) return '待定';
  return n.toFixed(2);
}

function onCateChange() {
  list.value = [];
  page.value = 1;
  finished.value = false;
  loading.value = true;
  loadList();
}

async function loadList() {
  try {
    const cateName = activeCate.value === 'all' ? undefined : currentCate.value?.name;
    const r = await api.jtkActivities({
      cateName,
      page: page.value,
      pageSize,
    });
    const rows = (r.list || r || []).map((item) => ({
      actId: item.actId || item.act_id || item.id,
      actName: item.actName || item.act_name || item.title || item.name,
      actDesc: item.desc || item.act_desc || item.subtitle,
      subTitle: item.subTitle || item.sub_title || item.subtitle,
      icon: item.icon || item.img || item.pic,
      topPrice: item.topPrice || item.top_price || item.price,
      estCommission: item.jtkShareFee ?? item.shareFee ?? item.jtk_share_fee ?? item.commission ?? 0,
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
  try {
    const r = await api.jtkConvert(item.actId);
    const h5 = r.h5 || r.jump_url || r.url;
    if (h5) {
      window.location.href = h5;
    } else {
      showToast('跳转链接获取失败');
    }
  } catch (e) {
    showToast(e.message || '转链失败');
  }
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
  padding: 10px 12px 20px;
}

.act-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.act-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.act-card:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.ac-img {
  position: relative;
  width: 100%;
  padding-top: 60%;
  background: linear-gradient(135deg, #ffecd2, #fcb69f);
}
.ac-img img {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ac-img-fallback {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
}
.ac-price-tag {
  position: absolute;
  left: 8px;
  bottom: 6px;
  padding: 2px 8px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}

.ac-body {
  padding: 8px 10px 10px;
}
.ac-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 34px;
}
.ac-desc {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ac-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.ac-commission {
  display: flex;
  align-items: baseline;
  gap: 2px;
}
.ac-comm-label {
  font-size: 10px;
  color: #ff9500;
}
.ac-comm-value {
  font-size: 15px;
  font-weight: 700;
  color: #ff4b3a;
}
.ac-btn {
  padding: 3px 10px;
  background: linear-gradient(135deg, #ff9500, #ff6b35);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
}
</style>
