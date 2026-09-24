<template>
  <div class="page" style="padding-bottom:64px">
    <van-nav-bar title="商品详情" left-arrow fixed placeholder @click-left="$router.back()" />

    <van-loading v-if="loading" style="padding:60px;text-align:center" />

    <template v-else-if="g">
      <img :src="g.image" style="width:100%;aspect-ratio:1;object-fit:cover;display:block" />

      <div style="background:#fff;padding:14px">
        <div style="display:flex;align-items:baseline;gap:8px">
          <span class="price" style="font-size:28px">¥{{ g.couponPrice }}</span>
          <span class="strike">原价 ¥{{ g.price }}</span>
        </div>
        <div style="margin-top:10px;font-size:15px;line-height:1.5">{{ g.title }}</div>
        <div class="muted" style="margin-top:8px">{{ g.shopName }} · 已售 {{ g.salesVolume }} 件</div>
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

      <van-action-bar>
        <van-action-bar-icon
          icon="cart-o"
          text="购物车"
          :badge="cartCount > 0 ? String(cartCount) : ''"
          @click="$router.push('/cart')"
        />
        <van-action-bar-button
          type="warning"
          :loading="adding"
          text="加入购物车"
          @click="addCart"
        />
        <van-action-bar-button
          type="danger"
          color="#ff4b3a"
          :text="`领券购买 返¥${g.rebate}`"
          :loading="converting"
          @click="buy"
        />
      </van-action-bar>
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
    if (r.already) return showToast('已经在购物车里了');
    bumpCartCount(1);
    showToast('已加入购物车');
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
    // deeplink 为空时绝不能往 location.href 里塞 undefined，
    // 那会被当成相对路径跳走，表现就是「点了购买莫名其妙回到首页」
    if (!r.deeplink) {
      showLink.value = true;
      return;
    }
    // 真机上这一步唤起电商 App，浏览器里唤不起就展示链接
    showToast('正在打开购物 App…');
    location.href = r.deeplink;
    setTimeout(() => { showLink.value = true; }, 1200);
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
