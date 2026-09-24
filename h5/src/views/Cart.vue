<template>
  <div class="page">
    <van-nav-bar title="购物车" fixed placeholder>
      <template #right>
        <span v-if="list.length" style="font-size:13px" @click="editing = !editing">
          {{ editing ? '完成' : '管理' }}
        </span>
      </template>
    </van-nav-bar>

    <NeedLogin
      v-if="!logged"
      title="登录后查看购物车"
      desc="把相中的商品先存起来，价格变了我们会告诉你"
    />

    <template v-else>
      <div v-if="refreshing" class="cart-sync muted">正在更新最新价格…</div>

      <van-checkbox-group v-model="picked">
        <div v-for="it in list" :key="it.id" class="cart-item">
          <van-checkbox :name="it.id" checked-color="#ff4b3a" />

          <img :src="it.image" @click="go(it)" />

          <div class="body" @click="go(it)">
            <div class="t">{{ it.title }}</div>

            <div class="meta">
              <span class="plat" :style="{ background: PLAT[it.platform]?.bg }">
                {{ PLAT[it.platform]?.name || it.platform }}
              </span>
              <span v-if="it.invalidReason" class="bad">{{ it.invalidReason }}</span>
              <span v-else-if="it.priceDiff < 0" class="down">
                降了 ¥{{ Math.abs(it.priceDiff).toFixed(2) }}
              </span>
              <span v-else-if="it.priceDiff > 0" class="up">
                涨了 ¥{{ it.priceDiff.toFixed(2) }}
              </span>
            </div>

            <div class="nums">
              <span class="price">¥{{ it.couponPrice }}</span>
              <span class="muted">返 ¥{{ it.rebate }} · 到手 ¥{{ it.finalPrice }}</span>
            </div>
          </div>
        </div>
      </van-checkbox-group>

      <van-empty v-if="!loading && !list.length" description="购物车是空的">
        <van-button round type="primary" size="small" @click="$router.push('/')">
          去逛逛
        </van-button>
      </van-empty>

      <van-submit-bar
        v-if="list.length"
        :price="editing ? 0 : totalFinal * 100"
        :button-text="editing ? `删除 (${picked.length})` : '去购买'"
        :button-color="editing ? '#969799' : '#ff4b3a'"
        :disabled="!picked.length"
        label="到手合计"
        @submit="editing ? doRemove() : doBuy()"
      >
        <van-checkbox v-model="allChecked" checked-color="#ff4b3a" @change="toggleAll">
          全选
        </van-checkbox>
        <template #tip>
          <span v-if="!editing && totalRebate > 0">
            已含返利 ¥{{ totalRebate.toFixed(2) }}，确认收货结算后到账
          </span>
          <span v-else-if="!editing">选中商品后可直接跳转购买</span>
        </template>
      </van-submit-bar>
    </template>

    <!-- 跨平台时得一个一个跳，这里让用户自己点 -->
    <van-action-sheet
      v-model:show="showJump"
      :actions="jumpActions"
      cancel-text="取消"
      description="购物车里的商品来自不同平台，需要分别打开"
      @select="onJump"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import NeedLogin from '../components/NeedLogin.vue';
import { setCartCount } from '../utils/cart-badge';

const PLAT = {
  PDD: { name: '拼多多', bg: '#e02e24' },
  JD: { name: '京东', bg: '#e2231a' },
  TB: { name: '淘宝', bg: '#ff5000' },
  DY: { name: '抖音', bg: '#161823' },
};

const router = useRouter();
const logged = ref(!!localStorage.getItem('token'));
const list = ref([]);
const picked = ref([]);
const loading = ref(true);
const refreshing = ref(false);
const editing = ref(false);
const allChecked = ref(false);

const showJump = ref(false);
const jumpActions = ref([]);

const chosen = computed(() => list.value.filter((i) => picked.value.includes(i.id)));
const totalFinal = computed(() =>
  Math.round(chosen.value.reduce((s, i) => s + i.finalPrice, 0) * 100) / 100,
);
const totalRebate = computed(() =>
  Math.round(chosen.value.reduce((s, i) => s + i.rebate, 0) * 100) / 100,
);

const go = (it) => router.push(`/goods/${it.platform}/${it.goodsId}`);

function toggleAll(v) {
  picked.value = v ? list.value.map((i) => i.id) : [];
}

async function load() {
  if (!logged.value) return;
  loading.value = true;
  try {
    // 先拿快照秒出，再后台刷新价格，别让用户对着转圈等平台接口
    const r = await api.cart();
    list.value = r.list || [];
    setCartCount(list.value.length);
  } finally {
    loading.value = false;
  }

  refreshing.value = true;
  try {
    const r = await api.cartRefresh();
    list.value = r.list || [];
  } catch {
    // 刷新失败就用快照，标题上不提，免得吓人
  } finally {
    refreshing.value = false;
  }
}

async function doRemove() {
  await api.cartRemove(picked.value);
  showToast('已移除');
  picked.value = [];
  allChecked.value = false;
  editing.value = false;
  load();
}

async function doBuy() {
  const bad = chosen.value.filter((i) => i.invalidReason);
  if (bad.length) return showToast(`有 ${bad.length} 件已失效，先取消勾选`);

  // 一件直接跳，多件先让用户选——浏览器不允许连续打开多个 App
  if (chosen.value.length === 1) return jump(chosen.value[0]);
  jumpActions.value = chosen.value.map((i) => ({
    name: `${PLAT[i.platform]?.name || i.platform} · ¥${i.finalPrice}`,
    subname: i.title.slice(0, 20),
    item: i,
  }));
  showJump.value = true;
}

function onJump(action) {
  showJump.value = false;
  jump(action.item);
}

async function jump(it) {
  try {
    const r = await api.convert(it.platform, it.goodsId);
    if (r?.needAuth) {
      return router.push({ path: `/auth/${r.platform || it.platform}`, query: { redirect: '/cart' } });
    }
    if (!r?.deeplink) return showToast('转链失败，稍后再试');
    showToast('正在打开购物 App…');
    location.href = r.deeplink;
  } catch {
    showToast('转链失败，稍后再试');
  }
}

onMounted(load);
</script>

<style scoped>
.cart-sync { padding: 8px 14px 0; font-size: 12px; }

.cart-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  margin: 10px 12px;
  border-radius: 12px;
  padding: 12px;
}
.cart-item img {
  width: 76px; height: 76px; flex: none;
  border-radius: 8px; object-fit: cover; background: #eee;
}
.cart-item .body { flex: 1; min-width: 0; }
.cart-item .t {
  font-size: 13px; line-height: 1.4;
  max-height: 36px; overflow: hidden;
}
.meta { display: flex; align-items: center; gap: 6px; margin: 6px 0 4px; }
.plat { color: #fff; font-size: 10px; padding: 2px 5px; border-radius: 3px; }
.down { color: #07c160; font-size: 11px; }
.up { color: #969799; font-size: 11px; }
.bad { color: #ee0a24; font-size: 11px; }
.nums { display: flex; align-items: baseline; gap: 8px; }
.nums .muted { font-size: 11px; }
</style>
