<template>
  <div class="page">
    <van-nav-bar title="商品详情" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-loading v-if="loading" style="padding:60px;text-align:center" />

    <template v-else-if="g">
      <img :src="g.image" style="width:100%;aspect-ratio:1;object-fit:cover;display:block" />

      <div style="background:#fff;padding:14px">
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
          <span class="price" style="font-size:28px">¥{{ g.couponPrice }}</span>
          <span v-if="g.price && g.price > g.couponPrice" class="strike">原价 ¥{{ g.price }}</span>
          <span class="ref-tag">{{ PLAT[g.platform]?.name }}参考价</span>
        </div>
        <div style="margin-top:10px;font-size:15px;line-height:1.5">
          <span v-if="g.salesVolume > 1000" class="detail-hot-tag">🔥 热销</span>
          {{ g.title }}
        </div>
        <div class="muted" style="margin-top:8px">{{ g.shopName }} · 已售 {{ g.salesVolume }} 件</div>

        <!-- 卡片上低调，到了详情页必须说清楚：钱要付给谁、货从哪儿发 -->
        <div class="from-bar">
          <span class="dot" :style="{ background: PLAT[g.platform]?.bg }">
            {{ PLAT[g.platform]?.short }}
          </span>
          <span>本商品由 <b>{{ PLAT[g.platform]?.name || g.platform }}</b> 发货，点击购买会跳转到该 App 下单</span>
        </div>

        <!--
          把丑话说在前面，而且说成好话。
          平台的满减、百亿补贴、会员价我们拿不到，所以这里的价只能是参考；
          但偏差方向绝大多数是「实际更便宜」，索性挑明了讲——
          用户跳过去发现更便宜是惊喜，比事后解释强得多。
        -->
        <div class="price-note">
          实际价格以{{ PLAT[g.platform]?.name }}结算为准。平台的满减、补贴、会员价我们看不到，
          <b>你实付通常只会更低</b>。返利按平台实际结算的佣金计算，不受这个价影响。
        </div>
      </div>

      <!-- 返利明细：把钱算给用户看，这是转化的关键 -->
      <div style="background:var(--brand-soft);margin:12px;border-radius:12px;padding:14px">
        <van-cell-group :border="false" style="background:transparent">
          <van-cell title="优惠券" :value="`-¥${g.couponAmount}`" :border="false" style="background:transparent" />
          <van-cell title="预计返利" :border="false" style="background:transparent">
            <template #value>
              <span class="price" style="font-size:18px">¥{{ g.rebate }}</span>
            </template>
          </van-cell>
          <van-cell
            title="到手价"
            :value="`约 ¥${(g.couponPrice - g.rebate).toFixed(2)}`"
            :border="false"
            style="background:transparent"
          />
        </van-cell-group>
        <div class="muted" style="padding:0 16px">返利于订单确认收货、联盟结算后到账，退款则不返</div>
      </div>

      <div class="buy-bar">
        <div class="buy-cart" @click="$router.push('/cart')">
          <van-badge :content="cartCount > 0 ? cartCount : ''">
            <van-icon name="star-o" size="24" />
          </van-badge>
          <span>收藏夹</span>
        </div>
        <van-button
          type="warning"
          class="buy-btn"
          :loading="adding"
          @click="addCart"
        >加入收藏</van-button>
        <van-button
          type="danger"
          color="#ff4b3a"
          class="buy-btn"
          :loading="converting"
          @click="buy"
        >领券购买 返¥{{ g.rebate }}</van-button>
      </div>
    </template>

    <van-empty v-else description="商品不存在" />

    <van-dialog v-model:show="showLink" title="转链成功" :show-cancel-button="false" confirm-button-text="知道了">
      <div style="padding:16px;font-size:13px;line-height:1.8;word-break:break-all">
        <div><b>口令</b></div>
        <div style="color:var(--brand)">{{ link?.password }}</div>
        <div style="margin-top:10px"><b>短链</b></div>
        <div>{{ link?.shortUrl }}</div>
        <div class="muted" style="margin-top:10px">
          推广位 {{ link?.positionId }} —— 订单归属靠它，别手改
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import { cartCount, bumpCartCount } from '../utils/cart-badge';
import { PLAT } from '../utils/platform';

const route = useRoute();
const router = useRouter();
const g = ref(null);
const loading = ref(true);
const link = ref(null);
const showLink = ref(false);
const converting = ref(false);
const adding = ref(false);

async function addCart() {
  if (!localStorage.getItem('token')) return router.push('/login');
  adding.value = true;
  try {
    const r = await api.cartAdd(route.params.platform, route.params.goodsId);
    if (r.already) return showToast('已经在收藏夹里了');
    bumpCartCount(1);
    showToast('已加入收藏夹');
  } finally {
    adding.value = false;
  }
}

/** 后端说要先授权就把人送过去，回来还落在这个商品页 */
function toAuth(platform) {
  router.push({ path: `/auth/${platform}`, query: { redirect: route.fullPath } });
}

async function doConvert() {
  if (!localStorage.getItem('token')) return router.push('/login');
  converting.value = true;
  try {
    const r = await api.convert(route.params.platform, route.params.goodsId);
    if (r?.needAuth) return toAuth(r.platform || route.params.platform);
    link.value = r;
    showLink.value = true;
    try { await navigator.clipboard.writeText(link.value.password); } catch { /* 忽略 */ }
  } finally {
    converting.value = false;
  }
}

async function buy() {
  if (!localStorage.getItem('token')) return router.push('/login');
  converting.value = true;
  try {
    const r = await api.convert(route.params.platform, route.params.goodsId);
    if (r?.needAuth) return toAuth(r.platform || route.params.platform);
    link.value = r;
    // 跳 H5 推广短链（HTTP）：浏览器/微信里会自动唤起 App，没装就引导下载。
    // deeplink 是拼多多的 schema（pinduoduo://…），location.href 在很多环境里被拦，
    // 只当短链也空了才拿它兜底。绝不能塞 undefined，会被当成相对路径跳回首页。
    const target = r.shortUrl || r.deeplink;
    if (!target) {
      showLink.value = true;
      return;
    }
    showToast('正在打开购物 App…');
    location.href = target;
    // 1.5 秒后还没离开页面，多半是跳转被拦，把口令/短链弹给用户手动复制
    setTimeout(() => { showLink.value = true; }, 1500);
  } finally {
    converting.value = false;
  }
}

onMounted(async () => {
  try {
    g.value = await api.detail(route.params.platform, route.params.goodsId);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* 购买条放在内容末尾、随页面滚动出现，不再是钉在底部的固定栏 */
.buy-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  padding: 10px 12px;
  margin-top: 12px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}

.buy-cart {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #646566;
  padding: 0 6px;
  cursor: pointer;
}

.buy-btn {
  flex: 1;
  height: 44px;
  font-size: 15px;
  font-weight: 700;
  border-radius: 999px;
}

.detail-hot-tag {
  display: inline-block;
  padding: 2px 6px;
  margin-right: 6px;
  background: #fff0ec;
  color: #ff4b3a;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  vertical-align: middle;
}
</style>
