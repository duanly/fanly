<template>
  <div style="margin:12px">
    <div style="background:#fff;border-radius:14px;overflow:hidden">
      <!-- 平台标 -->
      <div style="background:var(--brand-soft);padding:8px 14px;display:flex;align-items:center;gap:6px">
        <van-icon name="passed" color="#ff4b3a" />
        <span style="font-size:13px;color:var(--brand);font-weight:600">
          已识别 · {{ data.platformName }}
        </span>
      </div>

      <div style="display:flex;gap:12px;padding:14px">
        <img
          :src="g.image"
          style="width:96px;height:96px;border-radius:10px;object-fit:cover;background:#eee;flex:0 0 auto"
        />
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;line-height:1.4;max-height:40px;overflow:hidden">
            {{ g.title }}
          </div>
          <div style="margin-top:8px;display:flex;align-items:baseline;gap:6px">
            <span class="price" style="font-size:22px">¥{{ g.couponPrice }}</span>
            <span class="strike">¥{{ g.price }}</span>
          </div>
          <div style="margin-top:4px">
            <span class="tag-coupon">券 {{ g.couponAmount }}</span>
          </div>
        </div>
      </div>

      <!-- 三行账：把钱算清楚给用户看 -->
      <div style="background:linear-gradient(135deg,#fff4f2,#ffe9e5);margin:0 14px 14px;border-radius:10px;padding:12px 14px">
        <div class="ln"><span>券后价</span><span>¥{{ g.couponPrice }}</span></div>
        <div class="ln">
          <span>预计返利</span>
          <span class="price" style="font-size:18px">-¥{{ g.rebate }}</span>
        </div>
        <div class="ln" style="border-top:1px dashed #ffc4bb;padding-top:8px;margin-top:4px">
          <span style="font-weight:700">到手价</span>
          <span style="font-weight:800;font-size:18px">¥{{ afterRebate }}</span>
        </div>
      </div>

      <div style="display:flex;gap:10px;padding:0 14px 14px">
        <van-button plain round size="small" style="flex:1" @click="copyPassword">
          复制口令
        </van-button>
        <van-button plain round size="small" style="flex:1" @click="$router.push(`/goods/${g.platform}/${g.goodsId}`)">
          看详情
        </van-button>
        <van-button round size="small" type="primary" color="#ff4b3a" style="flex:2" @click="$emit('open')">
          领券购买
        </van-button>
      </div>
    </div>

    <div class="muted" style="text-align:center;margin-top:10px;line-height:1.7">
      返利于确认收货、联盟结算后到账，退款则不返<br />
      务必从这里跳转下单，直接去 App 买不算
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { showToast } from 'vant';
import { writeClipboard } from '../utils/clipboard';

const props = defineProps({ data: { type: Object, required: true } });
defineEmits(['open']);

const g = computed(() => props.data.goods);
const afterRebate = computed(() => (g.value.couponPrice - (g.value.rebate ?? 0)).toFixed(2));

async function copyPassword() {
  const pwd = props.data.link?.password || props.data.link?.shortUrl;
  if (!pwd) return showToast('转链信息缺失');
  const ok = await writeClipboard(pwd);
  showToast(ok ? '口令已复制，去 App 粘贴' : pwd);
}
</script>

<style scoped>
.ln {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  padding: 3px 0;
  color: #666;
}
</style>
