<template>
  <div class="page">
    <van-nav-bar title="订单找回" left-arrow fixed placeholder @click-left="back" />

    <NeedLogin v-if="!logged" title="登录后找回订单" desc="找回后返利会自动打到你账上" />

    <template v-else>
      <div class="claim-hero">
        <div class="t">买了东西没看到返利？</div>
        <div class="s">把订单号填进来，我们帮你找。找到了返利自动到账。</div>
      </div>

      <div class="claim-steps">
        <div class="step"><i>1</i><span>打开你下单的那个购物 App</span></div>
        <div class="step"><i>2</i><span>进「我的订单」，找到这笔单</span></div>
        <div class="step"><i>3</i><span>把订单编号复制过来，粘到下面</span></div>
      </div>

      <van-form @submit="submit">
        <van-cell-group inset>
          <van-field
            :model-value="platformName"
            label="在哪买的"
            placeholder="选择平台"
            readonly
            is-link
            @click="showPlat = true"
          />
          <van-field
            v-model="form.platformOrderNo"
            label="订单编号"
            placeholder="一长串数字，直接粘贴就行"
            :rules="[{ required: true, message: '订单编号不能为空' }]"
          />
          <van-field v-model="form.goodsTitle" label="买的什么" placeholder="选填，帮我们核对" />
          <van-field
            v-model="form.payAmount"
            label="付了多少"
            type="number"
            placeholder="选填，单位元"
          />
          <van-field v-model="form.remark" label="补充说明" placeholder="选填" />
        </van-cell-group>

        <div style="padding:16px">
          <van-button block round type="danger" color="#ff4b3a" native-type="submit" :loading="submitting">
            提交找回
          </van-button>
        </div>
      </van-form>

      <div class="claim-note muted">
        只能找回<b>通过本 App 跳转下单</b>的订单。直接在购物 App 里下的单，
        平台不会给我们佣金，没法返利——这点我们不骗你。
      </div>

      <!-- 历史记录 -->
      <div v-if="list.length" class="sec">我的找回记录</div>
      <div v-for="c in list" :key="c.id" class="claim-item">
        <div class="top">
          <span class="no">{{ platName(c.platform) }} · {{ c.platformOrderNo }}</span>
          <span :style="{ color: STATUS[c.status]?.color }">{{ STATUS[c.status]?.text }}</span>
        </div>
        <div class="muted rs">{{ c.resultReason }}</div>
        <div class="muted tm">{{ fmt(c.createdAt) }}</div>
      </div>
    </template>

    <van-popup v-model:show="showPlat" position="bottom" round>
      <van-picker
        :columns="PLATS"
        @confirm="onPlat"
        @cancel="showPlat = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showDialog, showToast } from 'vant';
import { api } from '../api';
import NeedLogin from '../components/NeedLogin.vue';

const PLATS = [
  { text: '拼多多', value: 'PDD' },
  { text: '京东', value: 'JD' },
  { text: '淘宝 / 天猫', value: 'TB' },
  { text: '抖音', value: 'DY' },
];
const STATUS = {
  1: { text: '找寻中', color: '#ff976a' },
  2: { text: '已找回', color: '#07c160' },
  3: { text: '无法找回', color: '#969799' },
};
const platName = (p) => PLATS.find((x) => x.value === p)?.text || p;
const fmt = (d) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '');

const router = useRouter();
const logged = ref(!!localStorage.getItem('token'));
const showPlat = ref(false);
const submitting = ref(false);
const list = ref([]);
const form = reactive({
  platform: 'PDD', platformOrderNo: '', goodsTitle: '', payAmount: '', remark: '',
});
const platformName = computed(() => platName(form.platform));

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/mine');
}

function onPlat({ selectedOptions }) {
  form.platform = selectedOptions[0].value;
  showPlat.value = false;
}

async function load() {
  if (!logged.value) return;
  try {
    const r = await api.claimList();
    list.value = r.list || [];
  } catch {
    list.value = [];
  }
}

async function submit() {
  submitting.value = true;
  try {
    const r = await api.claimApply({
      ...form,
      payAmount: Number(form.payAmount) || 0,
    });
    // 后端能当场匹配的会直接返回结果，别让用户以为还要等
    await showDialog({
      title: STATUS[r.status]?.text || '已提交',
      message: r.resultReason || '我们会尽快帮你找',
      confirmButtonText: '知道了',
    });
    form.platformOrderNo = '';
    form.goodsTitle = '';
    form.payAmount = '';
    form.remark = '';
    load();
  } catch (e) {
    showToast(e?.response?.data?.msg || e?.message || '提交失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.claim-hero {
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  color: #fff;
  padding: 22px 18px;
}
.claim-hero .t { font-size: 19px; font-weight: 800; }
.claim-hero .s { font-size: 13px; opacity: .92; margin-top: 6px; line-height: 1.6; }

.claim-steps { background: #fff; margin: 12px; border-radius: 12px; padding: 14px 16px; }
.step { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 14px; }
.step i {
  flex: none; width: 21px; height: 21px; line-height: 21px;
  border-radius: 50%; background: #ff4b3a; color: #fff;
  font-style: normal; font-size: 12px; text-align: center;
}

.claim-note { padding: 4px 20px 10px; font-size: 12px; line-height: 1.7; }
.claim-note b { color: #ff4b3a; }

.sec { padding: 14px 16px 4px; font-size: 15px; font-weight: 700; }
.claim-item { background: #fff; margin: 10px 12px; border-radius: 12px; padding: 12px 14px; }
.claim-item .top { display: flex; justify-content: space-between; font-size: 13px; }
.claim-item .no { font-weight: 600; }
.claim-item .rs { font-size: 12px; margin-top: 6px; line-height: 1.5; }
.claim-item .tm { font-size: 11px; margin-top: 4px; }
</style>
