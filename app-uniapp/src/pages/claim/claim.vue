<template>
  <view class="page">
    <view class="hero">
      <view class="h-emoji">🔎</view>
      <view class="h-title">订单找回</view>
      <view class="h-sub">下了单但没看到返利？提交订单信息，能当场匹配的立刻归属</view>
    </view>

    <view class="card">
      <view class="field">
        <text class="label">购物平台</text>
        <picker :range="plats" range-key="name" @change="onPlat">
          <view class="picker">{{ platName || '请选择' }}<text class="arrow">›</text></view>
        </picker>
      </view>
      <view class="field">
        <text class="label">订单号</text>
        <input v-model="form.platformOrderNo" class="input" placeholder="平台订单号" />
      </view>
      <view class="field">
        <text class="label">商品名称</text>
        <input v-model="form.goodsTitle" class="input" placeholder="选填，帮助核实" />
      </view>
      <view class="field">
        <text class="label">实付金额</text>
        <input v-model="form.payAmount" type="digit" class="input" placeholder="元，选填" />
      </view>
      <view class="field">
        <text class="label">下单日期</text>
        <picker mode="date" :value="form.orderDate" @change="onDate">
          <view class="picker">{{ form.orderDate || '请选择日期（选填）' }}<text class="arrow">›</text></view>
        </picker>
      </view>
      <view class="field column">
        <text class="label">备注说明</text>
        <textarea v-model="form.remark" class="textarea" placeholder="例如：通过哪个链接下单" />
      </view>
      <button class="submit" :loading="saving" @click="submit">提交找回申请</button>
    </view>

    <view v-if="list.length" class="sec-title">我的申请</view>
    <view v-if="list.length" class="records">
      <view v-for="c in list" :key="c.id" class="rec">
        <view class="rec-top">
          <text class="rec-plat">{{ c.platform }}</text>
          <text class="rec-status" :class="'st' + c.status">{{ statusText(c.status) }}</text>
        </view>
        <view class="rec-no">单号 {{ c.platformOrderNo }}</view>
        <view v-if="c.resultReason" class="rec-reason">{{ c.resultReason }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { api } from '../../api/index.js';

const plats = [
  { key: 'PDD', name: '拼多多' },
  { key: 'TB', name: '淘宝' },
  { key: 'JD', name: '京东' },
  { key: 'VIP', name: '唯品会' },
  { key: 'JTK', name: '本地生活' },
];
const platName = ref('');
const saving = ref(false);
const list = ref([]);
const form = reactive({
  platform: '',
  platformOrderNo: '',
  goodsTitle: '',
  payAmount: '',
  orderDate: '',
  remark: '',
});

const statusText = (s) => ['待审核', '已找回', '未找到'][s] || '待审核';

function onPlat(e) {
  const p = plats[e.detail.value];
  form.platform = p.key;
  platName.value = p.name;
}
function onDate(e) {
  form.orderDate = e.detail.value;
}

async function submit() {
  if (!form.platform) return uni.showToast({ title: '请选平台', icon: 'none' });
  if (!form.platformOrderNo.trim()) return uni.showToast({ title: '请填订单号', icon: 'none' });
  saving.value = true;
  try {
    const r = await api.claimApply({
      platform: form.platform,
      platformOrderNo: form.platformOrderNo.trim(),
      goodsTitle: form.goodsTitle.trim(),
      payAmount: Number(form.payAmount) || 0,
      orderDate: form.orderDate || undefined,
      remark: form.remark.trim(),
    });
    uni.showToast({
      title: r.duplicated ? '这个订单已提交过' : '已提交',
      icon: 'none',
    });
    Object.assign(form, {
      platformOrderNo: '', goodsTitle: '', payAmount: '', orderDate: '', remark: '',
    });
    await loadList();
  } finally {
    saving.value = false;
  }
}

async function loadList() {
  try {
    const r = await api.claimList({ page: 1, pageSize: 20 });
    list.value = r.list || [];
  } catch {}
}

onShow(loadList);
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f5f6f8; padding-bottom: 40rpx; }
.hero {
  margin: 24rpx;
  padding: 48rpx 32rpx;
  background: linear-gradient(135deg, #ff9a8b, #ff6a3d);
  border-radius: 28rpx;
  color: #fff;
  text-align: center;
}
.h-emoji { font-size: 72rpx; }
.h-title { font-size: 36rpx; font-weight: 800; margin-top: 12rpx; }
.h-sub { font-size: 24rpx; opacity: 0.9; margin-top: 12rpx; line-height: 1.6; }

.card { margin: 24rpx; background: #fff; border-radius: 24rpx; padding: 8rpx 28rpx; }
.field {
  display: flex;
  align-items: center;
  padding: 32rpx 0;
  border-bottom: 2rpx solid #f5f6f8;
}
.field:last-of-type { border-bottom: none; }
.field.column { flex-direction: column; align-items: stretch; }
.label { width: 200rpx; font-size: 28rpx; color: #333; flex-shrink: 0; }
.field.column .label { width: auto; margin-bottom: 16rpx; }
.input { flex: 1; font-size: 28rpx; }
.picker { flex: 1; display: flex; justify-content: space-between; align-items: center; font-size: 28rpx; color: #333; }
.arrow { color: #ccc; font-size: 36rpx; }
.textarea { width: 100%; min-height: 160rpx; background: #f7f8fa; border-radius: 16rpx; padding: 20rpx; font-size: 26rpx; box-sizing: border-box; }
.submit {
  margin: 24rpx 0;
  height: 88rpx;
  line-height: 88rpx;
  background: $brand;
  color: #fff;
  border-radius: 999rpx;
  font-size: 30rpx;
}
.submit::after { border: none; }

.sec-title { padding: 8rpx 32rpx 16rpx; font-size: 30rpx; font-weight: 700; }
.records { margin: 0 24rpx; }
.rec {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
}
.rec-top { display: flex; justify-content: space-between; align-items: center; }
.rec-plat { font-size: 28rpx; font-weight: 700; }
.rec-status { font-size: 24rpx; }
.rec-status.st0 { color: #ff976a; }
.rec-status.st1 { color: #07c160; }
.rec-status.st2 { color: #ee0a24; }
.rec-no { font-size: 24rpx; color: #999; margin-top: 12rpx; }
.rec-reason { font-size: 24rpx; color: #666; margin-top: 8rpx; line-height: 1.6; }
</style>
