<template>
  <div class="page">
    <van-nav-bar title="开启返利" left-arrow fixed placeholder @click-left="back" />

    <div class="auth-hero">
      <div class="icon">🔑</div>
      <div class="t">还差一步，去{{ platformName }}授权一下</div>
      <div class="s">
        {{ platformName }}要求先完成一次授权，才能把订单和你的账号对上。
        <b>不授权就下单，返利认不到你头上。</b>
      </div>
    </div>

    <div class="auth-steps">
      <div class="step"><i>1</i><span>点下面的按钮，会跳到{{ platformName }}</span></div>
      <div class="step"><i>2</i><span>在{{ platformName }}里点「同意 / 授权」</span></div>
      <div class="step"><i>3</i><span>回到这里，点「我已完成授权」</span></div>
    </div>

    <div class="auth-note muted">
      只需要做一次，之后所有订单都会自动算给你。授权不会拿到你的账号密码。
    </div>

    <div style="padding:0 16px">
      <van-button
        block round type="danger" color="#ff4b3a"
        :loading="loading" :disabled="!url"
        @click="go"
      >
        去{{ platformName }}授权
      </van-button>

      <van-button
        block round plain style="margin-top:12px"
        :loading="checking"
        @click="recheck"
      >
        我已完成授权
      </van-button>
    </div>

    <div v-if="err" class="auth-err">{{ err }}</div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { api } from '../api';
import { platName } from '../utils/platform';


const route = useRoute();
const router = useRouter();
const platform = (route.params.platform || 'PDD').toUpperCase();
const platformName = platName(platform);

const url = ref('');
const loading = ref(true);
const checking = ref(false);
const err = ref('');

function back() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

async function load() {
  loading.value = true;
  err.value = '';
  try {
    const r = await api.authzUrl(platform);
    url.value = r.shortUrl || r.schemaUrl || '';
    if (!url.value) err.value = '没拿到授权链接，稍后再试';
  } catch (e) {
    err.value = e?.message || '生成授权链接失败';
  } finally {
    loading.value = false;
  }
}

function go() {
  if (!url.value) return;
  // 授权是在拼多多 APP 里完成的，这里直接跳出去
  location.href = url.value;
}

async function recheck() {
  checking.value = true;
  try {
    // force=1，绕开本地缓存直接问平台
    const s = await api.authzStatus(platform, true);
    if (s.bound) {
      showToast('授权成功');
      const redirect = route.query.redirect;
      router.replace(redirect ? String(redirect) : '/');
    } else {
      showToast('还没查到授权记录，稍等几秒再试一次');
    }
  } finally {
    checking.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.auth-hero {
  background: linear-gradient(135deg, #ff6a3d, #ff3b30);
  color: #fff;
  padding: 28px 20px 24px;
  text-align: center;
}
.auth-hero .icon { font-size: 38px; }
.auth-hero .t { font-size: 18px; font-weight: 700; margin-top: 10px; }
.auth-hero .s { font-size: 13px; line-height: 1.7; opacity: .92; margin-top: 8px; }
.auth-hero .s b { opacity: 1; }

.auth-steps {
  background: #fff;
  margin: 12px;
  border-radius: 12px;
  padding: 16px 18px;
}
.step { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: 14px; }
.step i {
  flex: none;
  width: 21px; height: 21px; line-height: 21px;
  border-radius: 50%;
  background: #ff4b3a; color: #fff;
  font-style: normal; font-size: 12px; text-align: center;
}
.auth-note { padding: 0 20px 16px; font-size: 12px; line-height: 1.6; }
.auth-err {
  margin: 14px 16px;
  padding: 10px 12px;
  background: #fff7f5;
  border-radius: 8px;
  color: #ee0a24;
  font-size: 12px;
}
</style>
