<template>
  <van-popup v-model:show="show" position="bottom" round :style="{ padding: '0' }">
    <div class="add-desktop-popup">
      <div class="adp-head">
        <div class="adp-title">添加「{{ appName }}」到桌面</div>
        <van-icon name="cross" size="20" @click="show = false" />
      </div>

      <!-- 能弹原生安装框 -->
      <template v-if="canInstall">
        <div class="adp-body">
          <div class="adp-icon">📱</div>
          <div class="adp-big">一键添加到桌面</div>
          <div class="adp-sub">添加后访问更方便，就像 App 一样</div>
        </div>
        <div class="adp-foot">
          <van-button block round type="primary" color="#ff4b3a" @click="doInstall">
            立即添加
          </van-button>
        </div>
      </template>

      <!-- Android Chrome 图文引导 -->
      <template v-else-if="isAndroidChrome">
        <div class="adp-body">
          <div class="adp-steps">
            <div class="adp-step">
              <div class="adp-step-ico">⋮</div>
              <div class="adp-step-text">
                <div class="adp-step-title">第 1 步</div>
                <div class="adp-step-desc">点击右上角的菜单按钮（三个点）</div>
              </div>
            </div>
            <div class="adp-arrow">↓</div>
            <div class="adp-step">
              <div class="adp-step-ico">⬇️</div>
              <div class="adp-step-text">
                <div class="adp-step-title">第 2 步</div>
                <div class="adp-step-desc">选择「安装应用」或「添加到主屏幕」</div>
              </div>
            </div>
            <div class="adp-arrow">↓</div>
            <div class="adp-step">
              <div class="adp-step-ico">✅</div>
              <div class="adp-step-text">
                <div class="adp-step-title">第 3 步</div>
                <div class="adp-step-desc">确认安装，就能在桌面找到啦</div>
              </div>
            </div>
          </div>
        </div>
        <div class="adp-foot">
          <van-button block round plain color="#ff4b3a" @click="show = false">
            我知道了
          </van-button>
        </div>
      </template>

      <!-- iOS Safari 图文引导 -->
      <template v-else-if="isIOS">
        <div class="adp-body">
          <div class="adp-steps">
            <div class="adp-step">
              <div class="adp-step-ico">⬆</div>
              <div class="adp-step-text">
                <div class="adp-step-title">第 1 步</div>
                <div class="adp-step-desc">点击浏览器底部的分享按钮</div>
              </div>
            </div>
            <div class="adp-arrow">↓</div>
            <div class="adp-step">
              <div class="adp-step-ico">📱</div>
              <div class="adp-step-text">
                <div class="adp-step-title">第 2 步</div>
                <div class="adp-step-desc">往下滑，找到「添加到主屏幕」</div>
              </div>
            </div>
            <div class="adp-arrow">↓</div>
            <div class="adp-step">
              <div class="adp-step-ico">✅</div>
              <div class="adp-step-text">
                <div class="adp-step-title">第 3 步</div>
                <div class="adp-step-desc">点击「添加」，桌面就有啦</div>
              </div>
            </div>
          </div>
        </div>
        <div class="adp-foot">
          <van-button block round plain color="#ff4b3a" @click="show = false">
            我知道了
          </van-button>
        </div>
      </template>

      <!-- 其他浏览器兜底 -->
      <template v-else>
        <div class="adp-body">
          <div class="adp-icon">📋</div>
          <div class="adp-big">添加到桌面</div>
          <div class="adp-sub">请在浏览器菜单中找到「添加到桌面」选项</div>
        </div>
        <div class="adp-foot">
          <van-button block round plain color="#ff4b3a" @click="show = false">
            我知道了
          </van-button>
        </div>
      </template>
    </div>
  </van-popup>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { showToast } from 'vant';

defineProps({
  appName: { type: String, default: '省钱猫' },
});
const show = defineModel('show', { type: Boolean, default: false });

// ─── 安装能力检测（全局状态由 main.js 维护） ───
const canInstall = ref(window.__pwaCanInstall || false);
let deferredPrompt = window.__pwaInstallPrompt || null;

const ua = navigator.userAgent.toLowerCase();
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
const isIOS = /iphone|ipad|ipod/.test(ua)
  && /safari/.test(ua) && !/chrome|crios|fxios|opios|edgios/.test(ua)
  && !isStandalone;
const isAndroidChrome = /android/.test(ua) && /chrome/.test(ua) && !isStandalone;

function onPwaReady() {
  deferredPrompt = window.__pwaInstallPrompt;
  canInstall.value = true;
}

function onPwaChanged() {
  deferredPrompt = window.__pwaInstallPrompt;
  canInstall.value = window.__pwaCanInstall || false;
}

async function doInstall() {
  const prompt = window.__pwaInstallPrompt || deferredPrompt;
  if (!prompt) {
    show.value = false;
    return;
  }
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome === 'accepted') {
    showToast('已添加到桌面');
  }
  window.__pwaInstallPrompt = null;
  window.__pwaCanInstall = false;
  deferredPrompt = null;
  canInstall.value = false;
  show.value = false;
}

let pollTimer = null;

onMounted(() => {
  if (window.__pwaCanInstall) {
    canInstall.value = true;
    deferredPrompt = window.__pwaInstallPrompt;
  }
  // 兜底：SW 注册慢时 beforeinstallprompt 可能延迟，最多等 30 秒
  let checks = 0;
  pollTimer = setInterval(() => {
    checks++;
    if (window.__pwaCanInstall) {
      canInstall.value = true;
      deferredPrompt = window.__pwaInstallPrompt;
      clearInterval(pollTimer);
    }
    if (checks > 30) clearInterval(pollTimer);
  }, 1000);

  window.addEventListener('pwa-install-ready', onPwaReady);
  window.addEventListener('pwa-install-changed', onPwaChanged);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  window.removeEventListener('pwa-install-ready', onPwaReady);
  window.removeEventListener('pwa-install-changed', onPwaChanged);
});
</script>

<style scoped>
.add-desktop-popup {
  padding: 20px 20px 24px;
}
.adp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.adp-title {
  font-size: 17px;
  font-weight: 700;
  color: #1a1a1a;
}
.adp-body {
  padding: 10px 0 20px;
}
.adp-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 12px;
}
.adp-big {
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  color: #1a1a1a;
}
.adp-sub {
  font-size: 13px;
  color: #999;
  text-align: center;
  margin-top: 6px;
}
.adp-steps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.adp-step {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #f7f8fa;
  border-radius: 12px;
}
.adp-step-ico {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 10px;
  font-size: 20px;
  font-weight: 700;
  color: #ff4b3a;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}
.adp-step-text {
  flex: 1;
  min-width: 0;
}
.adp-step-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}
.adp-step-desc {
  font-size: 12px;
  color: #999;
  margin-top: 3px;
  line-height: 1.4;
}
.adp-arrow {
  text-align: center;
  color: #ccc;
  font-size: 14px;
  line-height: 1.2;
}
.adp-foot {
  margin-top: 8px;
}
</style>
